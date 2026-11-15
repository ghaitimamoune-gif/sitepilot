import { and, desc, eq, inArray, sql as dsql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import type { ISODate } from "@/lib/dates";

export type NatureMouvement = (typeof schema.natureMouvementEnum.enumValues)[number];

/**
 * Le stock théorique se déduit du journal des mouvements :
 *   dernier comptage validé + réceptions validées − consommation théorique − pertes déclarées
 *   (+ production des préparations maison).
 * Seuls les mouvements postérieurs au dernier comptage comptent : une consommation datée de la
 * veille mais enregistrée après le comptage du matin ne fausse pas le stock recalé.
 */
export async function stocksTheoriques(articleIds?: number[], ex: Tx | typeof db = db): Promise<Map<number, number>> {
  const filtre = articleIds && articleIds.length > 0 ? dsql`and m.article_id in (${dsql.join(articleIds.map((id) => dsql`${id}`), dsql`, `)})` : dsql``;
  const res = await ex.execute(dsql`
    with dernier as (
      select distinct on (article_id) article_id, at, stock_apres
      from mouvements_stock
      where nature = 'comptage'
      order by article_id, at desc, id desc
    )
    select m.article_id as "articleId",
           coalesce(max(d.stock_apres), 0)
           + coalesce(sum(m.quantite) filter (where m.nature <> 'comptage' and (d.at is null or m.at > d.at)), 0) as total
    from mouvements_stock m
    left join dernier d on d.article_id = m.article_id
    where true ${filtre}
    group by m.article_id
  `);
  const m = new Map<number, number>();
  for (const r of res as unknown as { articleId: number; total: string }[]) m.set(Number(r.articleId), Number(r.total));
  return m;
}

/** Articles ayant déjà été comptés au moins une fois (stock connu). */
export async function articlesComptes(ex: Tx | typeof db = db): Promise<Set<number>> {
  const rows = await ex
    .selectDistinct({ articleId: schema.mouvementsStock.articleId })
    .from(schema.mouvementsStock)
    .where(eq(schema.mouvementsStock.nature, "comptage"));
  return new Set(rows.map((r) => r.articleId));
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
