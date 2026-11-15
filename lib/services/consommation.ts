import { and, eq, inArray, sql as dsql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { instantLocal, type ISODate } from "@/lib/dates";
import type { DonneesMoteur } from "@/lib/engine/types";
import { chargerMoteur } from "./moteur";
import { enregistrerMouvement } from "./stock";

export type ModeConsommation = "import" | "estime";

export interface MouvementsJournee {
  mode: ModeConsommation;
  /** Consommation par article (valeur positive, unité de comptage). */
  consommation: Map<number, number>;
  /** Production des préparations maison de la fiche (valeur positive). */
  production: Map<number, number>;
}

/**
 * Mouvements théoriques d'une journée.
 *
 * Ventes : avec le détail importé de la caisse, ventes réelles × nomenclature (exact à l'article
 * près) ; sans import, CA réalisé × coefficients (juste à 5 ou 10 % près). Ni marge ni perte :
 * la perte réelle apparaît dans l'écart de stock.
 *
 * Préparations maison de la fiche (boulettes, sauces, pains…) : la vente consomme leur stock ;
 * leur production du jour (quantité « à préparer » de la fiche) entre en stock et consomme leurs
 * ingrédients. Les préparations faites au service (citronnade servie) consomment directement leurs
 * ingrédients. Ainsi la viande baisse quand on presse les boulettes, pas quand on les vend.
 */
export async function mouvementsTheoriques(date: ISODate): Promise<MouvementsJournee | null> {
  const charge = await chargerMoteur();
  const ventes = await db
    .select({ produitId: schema.ventes.produitId, quantite: dsql<string>`sum(${schema.ventes.quantite})` })
    .from(schema.ventes)
    .where(eq(schema.ventes.date, date))
    .groupBy(schema.ventes.produitId);
  let mode: ModeConsommation;
  const unites = new Map<number, number>();
  if (ventes.length > 0) {
    mode = "import";
    for (const v of ventes) if (v.produitId !== null) unites.set(v.produitId, Number(v.quantite));
  } else {
    const [cloture] = await db.select().from(schema.cloturesJournee).where(eq(schema.cloturesJournee.date, date));
    if (!cloture) return null;
    mode = "estime";
    const ca = Number(cloture.caRealise);
    const type = charge.moteur.calendrier.typeJournee(date);
    for (const p of charge.donnees.produits) unites.set(p.id, (p.coefficients[type] * ca) / 1000);
  }
  const saisies = await db.select().from(schema.preparationsJour).where(eq(schema.preparationsJour.date, date));
  const fiche = charge.moteur.fichePreparations(
    date,
    new Map(saisies.map((x) => [x.articleId, { resteVeille: x.resteVeille === null ? null : Number(x.resteVeille), forcee: x.forcee === null ? null : Number(x.forcee) }])),
  );
  return calculerMouvements(charge.donnees, unites, new Map(fiche.map((f) => [f.articleId, f.aPreparer])), mode);
}

/** Partie pure, testée : ventes et production → consommation et production par article. */
export function calculerMouvements(
  donnees: Pick<DonneesMoteur, "articles" | "nomenclature" | "recettes">,
  unitesVendues: Map<number, number>,
  productionFiche: Map<number, number>,
  mode: ModeConsommation = "import",
): MouvementsJournee {
  const articles = new Map(donnees.articles.map((a) => [a.id, a]));
  const recetteDe = new Map<number, { ingredientId: number; quantiteParBatch: number }[]>();
  for (const r of donnees.recettes) {
    const arr = recetteDe.get(r.preparationId) ?? [];
    arr.push({ ingredientId: r.ingredientId, quantiteParBatch: r.quantiteParBatch });
    recetteDe.set(r.preparationId, arr);
  }
  const surFiche = (id: number) => {
    const a = articles.get(id);
    return !!a && a.nature === "preparation" && a.partAvance !== null;
  };
  const consommation = new Map<number, number>();
  const ajouter = (id: number, q: number) => consommation.set(id, (consommation.get(id) ?? 0) + q);

  /** Consommer une quantité d'un article : stock propre, ou ingrédients pour une préparation faite au service. */
  const consommer = (id: number, q: number, profondeur = 0) => {
    if (q <= 0 || profondeur > 10) return;
    const a = articles.get(id);
    if (!a) return;
    const recette = recetteDe.get(id);
    if (a.nature === "preparation" && !surFiche(id) && recette && recette.length > 0) {
      const rendement = a.rendementBatch && a.rendementBatch > 0 ? a.rendementBatch : 1;
      for (const r of recette) consommer(r.ingredientId, (q / rendement) * r.quantiteParBatch, profondeur + 1);
      return;
    }
    if (!a.lieAuxVentes && a.nature !== "preparation") return;
    ajouter(id, q);
  };

  for (const l of donnees.nomenclature) {
    const u = unitesVendues.get(l.produitId) ?? 0;
    if (u > 0) consommer(l.articleId, u * l.quantite);
  }
  const production = new Map<number, number>();
  for (const [prepId, q] of productionFiche) {
    if (!(q > 0) || !surFiche(prepId)) continue;
    production.set(prepId, q);
    const a = articles.get(prepId)!;
    const rendement = a.rendementBatch && a.rendementBatch > 0 ? a.rendementBatch : 1;
    for (const r of recetteDe.get(prepId) ?? []) consommer(r.ingredientId, (q / rendement) * r.quantiteParBatch, 1);
  }
  return { mode, consommation, production };
}

/**
 * Écrit (ou recalcule) les mouvements théoriques d'une journée.
 * Rejouable : un recalcul annule les mouvements précédents par une correction, sans rien supprimer.
 */
export async function appliquerConsommationJour(date: ISODate, tx?: Tx): Promise<ModeConsommation | null> {
  const res = await mouvementsTheoriques(date);
  if (!res) return null;
  const ex = tx ?? db;
  const origine = `journee:${date}`;
  const existants = await ex
    .select({ articleId: schema.mouvementsStock.articleId, total: dsql<string>`sum(${schema.mouvementsStock.quantite})` })
    .from(schema.mouvementsStock)
    .where(and(eq(schema.mouvementsStock.origineType, origine), inArray(schema.mouvementsStock.nature, ["consommation", "production", "correction"])))
    .groupBy(schema.mouvementsStock.articleId);
  const at = instantLocal(date, "23:59");
  for (const e of existants) {
    const net = Number(e.total);
    if (Math.abs(net) < 1e-9) continue;
    await enregistrerMouvement(ex, { articleId: e.articleId, nature: "correction", quantite: -net, origineType: origine, note: `Recalcul des mouvements du ${date}`, at });
  }
  const libelle = res.mode === "import" ? "ventes importées" : "estimée depuis le CA";
  for (const [articleId, q] of res.production) {
    await enregistrerMouvement(ex, { articleId, nature: "production", quantite: q, origineType: origine, note: `Production du ${date} (fiche des préparations)`, at });
  }
  for (const [articleId, q] of res.consommation) {
    await enregistrerMouvement(ex, { articleId, nature: "consommation", quantite: -q, origineType: origine, note: `Consommation théorique du ${date} (${libelle})`, at });
  }
  return res.mode;
}

/** Mode de la dernière consommation calculée (pour l'écran de comptage). */
export async function dernierModeConsommation(): Promise<ModeConsommation | null> {
  const [r] = await db
    .select({ note: schema.mouvementsStock.note })
    .from(schema.mouvementsStock)
    .where(eq(schema.mouvementsStock.nature, "consommation"))
    .orderBy(dsql`${schema.mouvementsStock.at} desc`)
    .limit(1);
  if (!r?.note) return null;
  return r.note.includes("importées") ? "import" : "estime";
}
