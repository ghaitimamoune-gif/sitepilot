import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { dateLocale, joursEntre } from "@/lib/dates";
import { Moteur } from "@/lib/engine/moteur";
import { prochaineLivraison } from "@/lib/engine/commandes";
import type { ArticleMoteur, DonneesMoteur, ProduitMoteur, TypeJournee } from "@/lib/engine/types";
import { chargerCalendrier } from "./calendrier";
import { chargerParametres, nombreDepuis } from "./parametres";
import { chargerPrevisionniste } from "./previsions";

export interface ArticleCharge extends ArticleMoteur {
  familleId: number | null;
  familleNom: string | null;
  rythme: "quotidien" | "hebdomadaire" | "mensuel" | null;
  famillePerteNom: string | null;
  critique: boolean;
  statut: "actif" | "a_verifier" | "archive";
  aConfirmer: boolean;
  stockMinimum: number | null;
  stockCibleFixe: number | null;
  coutRevient: number | null;
}

export interface ProduitCharge extends ProduitMoteur {
  libellesCaisse: string[];
  categorie: string | null;
  actif: boolean;
  mesure: Record<TypeJournee, number>;
  perso: Record<TypeJournee, number | null>;
  fige: Record<TypeJournee, boolean>;
}

const UNITES_PIECE = new Set(["boulette", "pain", "boule", "tranche", "unité", "unite", "pièce", "piece", "bidon", "sac", "boîte", "boite", "rouleau", "paquet", "carton"]);

export function estUnitePiece(unite: string): boolean {
  return UNITES_PIECE.has(unite.trim().toLowerCase());
}

/** Charge le référentiel et construit le moteur de calcul du jour. */
export const chargerMoteur = cache(async () => {
  const [p, cal, { prevision }, articlesRows, famillesRows, perteRows, produitsRows, coefRows, nomRows, recRows] =
    await Promise.all([
      chargerParametres(),
      chargerCalendrier(),
      chargerPrevisionniste(),
      db.select().from(schema.articles),
      db.select().from(schema.familles),
      db.select().from(schema.famillesPerte),
      db.select().from(schema.produitsVendus).orderBy(schema.produitsVendus.ordre, schema.produitsVendus.nom),
      db.select().from(schema.coefficients),
      db.select().from(schema.nomenclature),
      db.select().from(schema.recetteLignes),
    ]);
  const familles = new Map(famillesRows.map((f) => [f.id, f]));
  const pertes = new Map(perteRows.map((f) => [f.id, f]));
  const articles = new Map<number, ArticleCharge>();
  for (const a of articlesRows) {
    const fam = a.familleId ? familles.get(a.familleId) : undefined;
    const fp = a.famillePerteId ? pertes.get(a.famillePerteId) : undefined;
    articles.set(a.id, {
      id: a.id,
      nom: a.nom,
      nature: a.nature,
      uniteComptage: a.uniteComptage,
      estPiece: estUnitePiece(a.uniteComptage),
      poidsUnitaire: a.poidsUnitaire === null ? null : Number(a.poidsUnitaire),
      unitePoids: a.unitePoids,
      pertePct: fp ? Number(fp.pertePct) : 0,
      dlcJours: a.dlcJours,
      rendementParage: a.rendementParage === null ? null : Number(a.rendementParage),
      partAvance: a.partAvance === null ? null : Number(a.partAvance),
      rendementBatch: a.rendementBatch === null ? null : Number(a.rendementBatch),
      uniteBatch: a.uniteBatch,
      lieAuxVentes: a.lieAuxVentes,
      joursSecurite: fam?.joursSecurite ?? 1,
      structurant: a.structurant,
      familleId: a.familleId,
      familleNom: fam?.nom ?? null,
      rythme: fam?.rythme ?? null,
      famillePerteNom: fp?.nom ?? null,
      critique: a.critiqueCoutMatiere,
      statut: a.statut,
      aConfirmer: a.aConfirmer,
      stockMinimum: a.stockMinimum === null ? null : Number(a.stockMinimum),
      stockCibleFixe: a.stockCibleFixe === null ? null : Number(a.stockCibleFixe),
      coutRevient: a.coutRevient === null ? null : Number(a.coutRevient),
    });
  }
  const coefs = new Map<number, Record<TypeJournee, { mesure: number; perso: number | null; fige: boolean }>>();
  for (const c of coefRows) {
    const r = coefs.get(c.produitId) ?? {
      semaine: { mesure: 0, perso: null, fige: false },
      weekend: { mesure: 0, perso: null, fige: false },
    };
    r[c.typeJournee] = { mesure: Number(c.valeurMesuree), perso: c.valeurPerso === null ? null : Number(c.valeurPerso), fige: c.fige };
    coefs.set(c.produitId, r);
  }
  const produits = new Map<number, ProduitCharge>();
  for (const pr of produitsRows) {
    const c = coefs.get(pr.id) ?? {
      semaine: { mesure: 0, perso: null, fige: false },
      weekend: { mesure: 0, perso: null, fige: false },
    };
    const eff = (t: TypeJournee) => (pr.actif ? (c[t].perso ?? c[t].mesure) : 0);
    produits.set(pr.id, {
      id: pr.id,
      nom: pr.nom,
      coefficients: { semaine: eff("semaine"), weekend: eff("weekend") },
      libellesCaisse: pr.libellesCaisse,
      categorie: pr.categorie,
      actif: pr.actif,
      mesure: { semaine: c.semaine.mesure, weekend: c.weekend.mesure },
      perso: { semaine: c.semaine.perso, weekend: c.weekend.perso },
      fige: { semaine: c.semaine.fige, weekend: c.weekend.fige },
    });
  }
  const articlesActifs = [...articles.values()].filter((a) => a.statut !== "archive");
  const donnees: DonneesMoteur = {
    produits: [...produits.values()],
    articles: articlesActifs,
    nomenclature: nomRows.map((n) => ({ produitId: n.produitId, articleId: n.articleId, quantite: Number(n.quantite) })),
    recettes: recRows.map((r) => ({ preparationId: r.preparationId, ingredientId: r.ingredientId, quantiteParBatch: Number(r.quantiteParBatch) })),
    margeGenerale: nombreDepuis(p, "marge_generale"),
    seuilDlcVeilleFermeture: nombreDepuis(p, "seuil_dlc_veille_fermeture"),
  };
  const moteur = new Moteur(donnees, cal, prevision);
  return {
    moteur,
    donnees,
    articles,
    produits,
    familles: famillesRows.sort((a, b) => a.ordre - b.ordre),
    famillesPerte: perteRows,
    nomenclature: nomRows,
    recettes: recRows,
    parametres: p,
  };
});

/**
 * Jours jusqu'à la prochaine livraison possible de chaque article, à partir des
 * jours de livraison réels de ses fournisseurs (le plus tôt livré l'emporte). 7 par défaut.
 */
export const joursProchaineLivraisonParArticle = cache(async (): Promise<Map<number, { jours: number; date: string; fournisseurId: number } | null>> => {
  const cal = await chargerCalendrier();
  const aujourdHui = dateLocale();
  const rows = await db
    .select({
      articleId: schema.articleFournisseurs.articleId,
      fournisseurId: schema.fournisseurs.id,
      joursLivraison: schema.fournisseurs.joursLivraison,
      delaiJours: schema.fournisseurs.delaiJours,
      statut: schema.fournisseurs.statut,
    })
    .from(schema.articleFournisseurs)
    .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.articleFournisseurs.fournisseurId))
    .where(eq(schema.articleFournisseurs.actif, true));
  const m = new Map<number, { jours: number; date: string; fournisseurId: number } | null>();
  for (const r of rows) {
    if (r.statut === "archive") continue;
    const d = prochaineLivraison({ joursLivraison: r.joursLivraison, delaiJours: r.delaiJours }, cal, aujourdHui);
    if (!d) continue;
    const jours = joursEntre(aujourdHui, d);
    const actuel = m.get(r.articleId);
    if (!actuel || jours < actuel.jours) m.set(r.articleId, { jours, date: d, fournisseurId: r.fournisseurId });
  }
  return m;
});
