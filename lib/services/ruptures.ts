import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import type { PosteMinimal } from "@/lib/auth/droits";
import { cloreAlertesParCle, creerAlerte } from "./alertes";
import { journaliser, type Acteur } from "./journal";
import { creerTachePonctuelle } from "./taches";

/**
 * Rupture : l'article passe « en rupture », une alerte part aux propriétaires, à la manager
 * et à la responsable achats, et une ligne de commande prioritaire sera proposée.
 * Pour un article structurant, la tâche « Appeler les propriétaires » est ajoutée
 * à la liste de la personne qui signale, à faire immédiatement.
 */
export async function signalerRupture(acteur: Acteur, poste: PosteMinimal, articleId: number, commentaire?: string | null): Promise<void> {
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId));
  if (!article) throw new Error("Article inconnu.");
  const [ouverte] = await db
    .select()
    .from(schema.ruptures)
    .where(and(eq(schema.ruptures.articleId, articleId), isNull(schema.ruptures.leveeLe)));
  if (ouverte) return;
  await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(schema.ruptures)
      .values({ articleId, signaleeParPosteId: acteur.posteId!, signaleeParPersonneId: acteur.personneId!, commentaire: commentaire?.trim() || null })
      .returning({ id: schema.ruptures.id });
    await creerAlerte(
      {
        type: "rupture",
        niveau: "critique",
        titre: `Rupture : ${article.nom}`,
        detail: commentaire?.trim() || null,
        objetType: "article",
        objetId: articleId,
        roles: ["proprietaire", "manager", "resp_achats"],
        cleUnique: `rupture:${articleId}`,
      },
      tx,
    );
    if (article.structurant) {
      await creerTachePonctuelle(
        acteur,
        poste,
        {
          posteId: poste.id,
          titre: `Appeler les propriétaires : rupture ${article.nom}`,
          consigne: "Article structurant en rupture. Appeler un propriétaire immédiatement.",
          preuve: "aucune",
          structurante: true,
          delaiRemonteeMin: 15,
        },
        tx,
      );
    }
    await journaliser(acteur, "rupture", "signaler", { entiteId: r.id, apres: { articleId, structurant: article.structurant }, tx });
  });
}

/** L'état se lève à la réception suivante de l'article. */
export async function leverRupture(articleId: number, tx: Tx | typeof db = db, note = "Article réceptionné"): Promise<boolean> {
  const rows = await tx
    .update(schema.ruptures)
    .set({ leveeLe: new Date() })
    .where(and(eq(schema.ruptures.articleId, articleId), isNull(schema.ruptures.leveeLe)))
    .returning({ id: schema.ruptures.id });
  if (rows.length > 0) await cloreAlertesParCle(`rupture:${articleId}`, note, tx === db ? undefined : (tx as Tx));
  return rows.length > 0;
}

export async function rupturesOuvertes() {
  return db
    .select({ r: schema.ruptures, article: schema.articles.nom, structurant: schema.articles.structurant, prenom: schema.personnes.prenom })
    .from(schema.ruptures)
    .innerJoin(schema.articles, eq(schema.articles.id, schema.ruptures.articleId))
    .leftJoin(schema.personnes, eq(schema.personnes.id, schema.ruptures.signaleeParPersonneId))
    .where(isNull(schema.ruptures.leveeLe))
    .orderBy(desc(schema.ruptures.signaleeLe));
}

export async function articlesEnRupture(): Promise<Set<number>> {
  const rows = await db.select({ articleId: schema.ruptures.articleId }).from(schema.ruptures).where(isNull(schema.ruptures.leveeLe));
  return new Set(rows.map((r) => r.articleId));
}
