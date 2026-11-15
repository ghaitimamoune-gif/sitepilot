"use server";

import { eq, and } from "drizzle-orm";
import type { ResultatAction } from "@/components/ui/BoutonAction";
import { acteur, actionAvecDroit } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { creerAlerte } from "@/lib/services/alertes";
import { journaliser } from "@/lib/services/journal";

function erreur(e: unknown): ResultatAction {
  return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
}

/** Le responsable cuisine saisit le reste de la veille. Il ne modifie aucune quantité calculée. */
export async function actionSaisirReste(date: string, articleId: number, reste: number | null): Promise<void> {
  const s = await actionAvecDroit("preparations:restes");
  const a = acteur(s);
  await db
    .insert(schema.preparationsJour)
    .values({ date, articleId, resteVeille: reste === null ? null : String(reste), resteSaisiParPersonneId: a.personneId, resteSaisiLe: new Date() })
    .onConflictDoUpdate({
      target: [schema.preparationsJour.date, schema.preparationsJour.articleId],
      set: { resteVeille: reste === null ? null : String(reste), resteSaisiParPersonneId: a.personneId, resteSaisiLe: new Date() },
    });
}

/** La manager peut forcer une quantité pour la journée, avec un motif. Les propriétaires voient la liste des forçages. */
export async function actionForcerQuantite(date: string, articleId: number, quantite: number | null, motif: string): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("preparations:forcer");
    const a = acteur(s);
    if (quantite !== null && !motif.trim()) return { ok: false, erreur: "Un motif est demandé pour forcer une quantité." };
    const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId));
    const [avant] = await db
      .select()
      .from(schema.preparationsJour)
      .where(and(eq(schema.preparationsJour.date, date), eq(schema.preparationsJour.articleId, articleId)));
    await db
      .insert(schema.preparationsJour)
      .values({ date, articleId, forcee: quantite === null ? null : String(quantite), motifForcage: quantite === null ? null : motif.trim(), forceParPersonneId: a.personneId, forceLe: new Date() })
      .onConflictDoUpdate({
        target: [schema.preparationsJour.date, schema.preparationsJour.articleId],
        set: { forcee: quantite === null ? null : String(quantite), motifForcage: quantite === null ? null : motif.trim(), forceParPersonneId: a.personneId, forceLe: new Date() },
      });
    await journaliser(a, "preparation_jour", quantite === null ? "lever_forcage" : "forcer", {
      entiteId: articleId,
      avant: avant ? { forcee: avant.forcee, motif: avant.motifForcage } : null,
      apres: { date, forcee: quantite, motif },
    });
    if (quantite !== null) {
      await creerAlerte({
        type: "quantite_forcee",
        niveau: "information",
        titre: `Quantité forcée : ${article?.nom ?? articleId}`,
        detail: `${quantite} ${article?.uniteComptage ?? ""} pour le ${date} — ${motif.trim()} (${s.personne.prenom})`,
        objetType: "preparation",
        objetId: articleId,
        roles: ["proprietaire"],
        cleUnique: `forcage:${date}:${articleId}`,
      });
    }
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}
