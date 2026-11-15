import { and, eq, sql as dsql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import { instantLocal, type ISODate } from "@/lib/dates";
import { Moteur } from "@/lib/engine/moteur";
import type { DonneesMoteur } from "@/lib/engine/types";
import { chargerMoteur } from "./moteur";
import { enregistrerMouvement } from "./stock";

export type ModeConsommation = "import" | "estime";

/**
 * Consommation théorique d'une journée, par article (unité de comptage, valeur positive).
 * Avec le détail des ventes importé : ventes réelles × nomenclature, exact à l'article près.
 * Sans import : CA réalisé × coefficients, juste à 5 ou 10 % près.
 * Ni marge ni perte : la perte réelle apparaît dans l'écart de stock.
 */
export async function consommationTheorique(date: ISODate): Promise<{ mode: ModeConsommation; parArticle: Map<number, number> } | null> {
  const charge = await chargerMoteur();
  const ventes = await db
    .select({ produitId: schema.ventes.produitId, quantite: dsql<string>`sum(${schema.ventes.quantite})` })
    .from(schema.ventes)
    .where(eq(schema.ventes.date, date))
    .groupBy(schema.ventes.produitId);
  let mode: ModeConsommation;
  let unites: Map<number, number>;
  if (ventes.length > 0) {
    mode = "import";
    unites = new Map();
    for (const v of ventes) if (v.produitId !== null) unites.set(v.produitId, Number(v.quantite));
  } else {
    const [cloture] = await db.select().from(schema.cloturesJournee).where(eq(schema.cloturesJournee.date, date));
    if (!cloture) return null;
    mode = "estime";
    const ca = Number(cloture.caRealise);
    const type = charge.moteur.calendrier.typeJournee(date);
    unites = new Map();
    for (const p of charge.donnees.produits) unites.set(p.id, (p.coefficients[type] * ca) / 1000);
  }
  // On réutilise la récursion du moteur avec marge et perte nulles et des « coefficients » égaux aux unités vendues.
  const donnees: DonneesMoteur = {
    ...charge.donnees,
    margeGenerale: 0,
    articles: charge.donnees.articles.map((a) => ({ ...a, pertePct: 0 })),
    produits: charge.donnees.produits.map((p) => {
      const u = unites.get(p.id) ?? 0;
      return { ...p, coefficients: { semaine: u, weekend: u } };
    }),
  };
  const m = new Moteur(donnees, charge.moteur.calendrier, (d) => ({ date: d, type: "semaine", ca: 1000 }));
  const parArticle = new Map<number, number>();
  for (const a of donnees.articles) {
    if (!a.lieAuxVentes) continue;
    const q = m.besoinTotal(a.id, date);
    if (q > 0) parArticle.set(a.id, q);
  }
  return { mode, parArticle };
}

/**
 * Écrit (ou recalcule) les mouvements de consommation théorique d'une journée.
 * Rejouable : un recalcul annule les mouvements précédents par une correction, sans rien supprimer.
 */
export async function appliquerConsommationJour(date: ISODate, tx?: Tx): Promise<ModeConsommation | null> {
  const res = await consommationTheorique(date);
  if (!res) return null;
  const ex = tx ?? db;
  const origine = `journee:${date}`;
  const existants = await ex
    .select({ articleId: schema.mouvementsStock.articleId, total: dsql<string>`sum(${schema.mouvementsStock.quantite})` })
    .from(schema.mouvementsStock)
    .where(and(eq(schema.mouvementsStock.origineType, origine), eq(schema.mouvementsStock.nature, "consommation")))
    .groupBy(schema.mouvementsStock.articleId);
  const dejaAnnules = await ex
    .select({ articleId: schema.mouvementsStock.articleId, total: dsql<string>`sum(${schema.mouvementsStock.quantite})` })
    .from(schema.mouvementsStock)
    .where(and(eq(schema.mouvementsStock.origineType, origine), eq(schema.mouvementsStock.nature, "correction")))
    .groupBy(schema.mouvementsStock.articleId);
  const annule = new Map(dejaAnnules.map((r) => [r.articleId, Number(r.total)]));
  const at = instantLocal(date, "23:59");
  for (const e of existants) {
    const net = Number(e.total) + (annule.get(e.articleId) ?? 0);
    if (Math.abs(net) < 1e-9) continue;
    await enregistrerMouvement(ex, {
      articleId: e.articleId,
      nature: "correction",
      quantite: -net,
      origineType: origine,
      note: `Recalcul de la consommation du ${date}`,
      at,
    });
  }
  for (const [articleId, q] of res.parArticle) {
    await enregistrerMouvement(ex, {
      articleId,
      nature: "consommation",
      quantite: -q,
      origineType: origine,
      note: `Consommation théorique du ${date} (${res.mode === "import" ? "ventes importées" : "estimée depuis le CA"})`,
      at,
    });
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
