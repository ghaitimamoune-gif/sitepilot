import { and, desc, eq, inArray, sql as dsql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import type { ISODate } from "@/lib/dates";

export type NatureMouvement = (typeof schema.natureMouvementEnum.enumValues)[number];

/**
 * Le stock théorique se déduit du journal des mouvements :
 *   dernier comptage validé + réceptions validées − consommation théorique − pertes déclarées.
 * Un comptage est enregistré comme un mouvement dont la quantité est l'écart appliqué, si bien
 * que la somme de tous les mouvements d'un article est son stock théorique.
 */
export async function stocksTheoriques(articleIds?: number[], ex: Tx | typeof db = db): Promise<Map<number, number>> {
  const q = ex
    .select({ articleId: schema.mouvementsStock.articleId, total: dsql<string>`coalesce(sum(${schema.mouvementsStock.quantite}), 0)` })
    .from(schema.mouvementsStock)
    .groupBy(schema.mouvementsStock.articleId);
  const rows = articleIds && articleIds.length > 0 ? await q.where(inArray(schema.mouvementsStock.articleId, articleIds)) : await q;
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.articleId, Number(r.total));
  return m;
}

export async function stockTheorique(articleId: number, ex: Tx | typeof db = db): Promise<number> {
  const m = await stocksTheoriques([articleId], ex);
  return m.get(articleId) ?? 0;
}

export async function enregistrerMouvement(
  ex: Tx | typeof db,
  m: {
    articleId: number;
    nature: NatureMouvement;
    quantite: number;
    stockApres?: number | null;
    origineType?: string | null;
    origineId?: number | null;
    posteId?: number | null;
    personneId?: number | null;
    note?: string | null;
    at?: Date;
  },
): Promise<void> {
  await ex.insert(schema.mouvementsStock).values({
    articleId: m.articleId,
    nature: m.nature,
    quantite: String(m.quantite),
    stockApres: m.stockApres === undefined || m.stockApres === null ? null : String(m.stockApres),
    origineType: m.origineType ?? null,
    origineId: m.origineId ?? null,
    posteId: m.posteId ?? null,
    personneId: m.personneId ?? null,
    note: m.note ?? null,
    at: m.at ?? new Date(),
  });
}

/** Mouvements d'un article depuis une date, les plus récents en premier. */
export async function mouvementsArticle(articleId: number, limite = 100) {
  return db
    .select()
    .from(schema.mouvementsStock)
    .where(eq(schema.mouvementsStock.articleId, articleId))
    .orderBy(desc(schema.mouvementsStock.at))
    .limit(limite);
}

/** Consommation théorique cumulée d'un article entre deux instants (valeur positive). */
export async function consommationEntre(articleId: number, depuis: Date, jusqua: Date): Promise<number> {
  const [r] = await db
    .select({ total: dsql<string>`coalesce(sum(${schema.mouvementsStock.quantite}), 0)` })
    .from(schema.mouvementsStock)
    .where(
      and(
        eq(schema.mouvementsStock.articleId, articleId),
        eq(schema.mouvementsStock.nature, "consommation"),
        dsql`${schema.mouvementsStock.at} > ${depuis}`,
        dsql`${schema.mouvementsStock.at} <= ${jusqua}`,
      ),
    );
  return -Number(r?.total ?? 0);
}

export interface PrixConnu {
  articleFournisseurId: number;
  fournisseurId: number;
  fournisseurNom: string;
  prixHt: number;
  tvaPct: number;
  date: ISODate;
  uniteCommande: string;
  qteParUniteCommande: number;
}

/** Dernier prix connu de chaque article chez chaque fournisseur. */
export async function derniersPrix(ex: Tx | typeof db = db): Promise<Map<number, PrixConnu[]>> {
  const rows = await ex
    .select({
      articleId: schema.articleFournisseurs.articleId,
      articleFournisseurId: schema.articleFournisseurs.id,
      fournisseurId: schema.fournisseurs.id,
      fournisseurNom: schema.fournisseurs.nom,
      uniteCommande: schema.articleFournisseurs.uniteCommande,
      qteParUniteCommande: schema.articleFournisseurs.qteParUniteCommande,
      prixHt: schema.prix.prixHt,
      tvaPct: schema.prix.tvaPct,
      date: schema.prix.date,
      prixId: schema.prix.id,
    })
    .from(schema.articleFournisseurs)
    .innerJoin(schema.fournisseurs, eq(schema.fournisseurs.id, schema.articleFournisseurs.fournisseurId))
    .leftJoin(schema.prix, eq(schema.prix.articleFournisseurId, schema.articleFournisseurs.id))
    .where(eq(schema.articleFournisseurs.actif, true))
    .orderBy(desc(schema.prix.date), desc(schema.prix.id));
  const m = new Map<number, PrixConnu[]>();
  const vus = new Set<number>();
  for (const r of rows) {
    if (vus.has(r.articleFournisseurId)) continue;
    vus.add(r.articleFournisseurId);
    if (r.prixHt === null || r.date === null) continue;
    const arr = m.get(r.articleId) ?? [];
    arr.push({
      articleFournisseurId: r.articleFournisseurId,
      fournisseurId: r.fournisseurId,
      fournisseurNom: r.fournisseurNom,
      prixHt: Number(r.prixHt),
      tvaPct: Number(r.tvaPct),
      date: r.date,
      uniteCommande: r.uniteCommande,
      qteParUniteCommande: Number(r.qteParUniteCommande),
    });
    m.set(r.articleId, arr);
  }
  return m;
}

/** Dernier prix d'achat connu d'un article (le plus récent, tous fournisseurs confondus), par unité de comptage. */
export function prixUnitaireComptage(prixArticle: PrixConnu[] | undefined): number | null {
  if (!prixArticle || prixArticle.length === 0) return null;
  const plusRecent = [...prixArticle].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const q = plusRecent.qteParUniteCommande > 0 ? plusRecent.qteParUniteCommande : 1;
  return plusRecent.prixHt / q;
}

/** Quantités commandées et non reçues, par article (unité de comptage). */
export async function quantitesEnCommande(ex: Tx | typeof db = db): Promise<Map<number, number>> {
  const rows = await ex
    .select({
      articleId: schema.commandeLignes.articleId,
      total: dsql<string>`coalesce(sum(greatest(${schema.commandeLignes.qteComptage} - ${schema.commandeLignes.qteRecue}, 0)), 0)`,
    })
    .from(schema.commandeLignes)
    .innerJoin(schema.commandes, eq(schema.commandes.id, schema.commandeLignes.commandeId))
    .where(inArray(schema.commandes.statut, ["envoyee", "recue_partiellement"]))
    .groupBy(schema.commandeLignes.articleId);
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.articleId, Number(r.total));
  return m;
}
