import { and, desc, eq, gte, lte, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { journeeExploitation, type ISODate } from "@/lib/dates";
import { journaliser, type Acteur } from "./journal";
import { chargerMoteur } from "./moteur";
import { derniersPrix, enregistrerMouvement, prixUnitaireComptage } from "./stock";

export type MotifPerte = (typeof schema.motifPerteEnum.enumValues)[number];

export const LIBELLE_MOTIF: Record<MotifPerte, string> = {
  perime: "Périmé",
  rate: "Raté",
  offert: "Offert",
  refait: "Refait",
  casse: "Cassé",
  chaine_du_froid: "Rupture de la chaîne du froid",
};

/** Une perte déclarée sort du stock et n'apparaît pas comme écart. */
export async function declarerPerte(
  acteur: Acteur,
  p: { articleId: number; quantite: number; motif: MotifPerte; commentaire?: string | null; date?: ISODate },
): Promise<number> {
  if (!(p.quantite > 0)) throw new Error("La quantité doit être positive.");
  const charge = await chargerMoteur();
  const a = charge.articles.get(p.articleId);
  if (!a) throw new Error("Article inconnu.");
  const prixMap = await derniersPrix();
  const prixUnit = prixUnitaireComptage(prixMap.get(p.articleId)) ?? (a.nature === "preparation" ? a.coutRevient : null);
  const valeur = prixUnit === null ? null : p.quantite * prixUnit;
  const date = p.date ?? journeeExploitation();
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.pertes)
      .values({
        articleId: p.articleId,
        date,
        quantite: String(p.quantite),
        motif: p.motif,
        commentaire: p.commentaire?.trim() || null,
        valeur: valeur === null ? null : String(valeur),
        posteId: acteur.posteId!,
        personneId: acteur.personneId!,
      })
      .returning({ id: schema.pertes.id });
    await enregistrerMouvement(tx, {
      articleId: p.articleId,
      nature: "perte",
      quantite: -p.quantite,
      origineType: "perte",
      origineId: row.id,
      posteId: acteur.posteId,
      personneId: acteur.personneId,
      note: LIBELLE_MOTIF[p.motif],
    });
    return row.id;
  });
  await journaliser(acteur, "perte", "declarer", { entiteId: id, apres: { articleId: p.articleId, quantite: p.quantite, motif: p.motif } });
  return id;
}

export async function pertesEntre(debut: ISODate, fin: ISODate) {
  return db
    .select({ p: schema.pertes, article: schema.articles.nom, unite: schema.articles.uniteComptage, prenom: schema.personnes.prenom })
    .from(schema.pertes)
    .innerJoin(schema.articles, eq(schema.articles.id, schema.pertes.articleId))
    .leftJoin(schema.personnes, eq(schema.personnes.id, schema.pertes.personneId))
    .where(and(gte(schema.pertes.date, debut), lte(schema.pertes.date, fin)))
    .orderBy(desc(schema.pertes.creeLe));
}

export async function totalPertesDuJour(date: ISODate): Promise<number> {
  const [r] = await db
    .select({ total: dsql<string>`coalesce(sum(${schema.pertes.valeur}), 0)` })
    .from(schema.pertes)
    .where(eq(schema.pertes.date, date));
  return Number(r?.total ?? 0);
}
