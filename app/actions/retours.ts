"use server";

import type { ResultatAction } from "@/components/ui/BoutonAction";
import { sessionCourante } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

/** Remarque de recette : enregistrée avec l'écran, le poste et le prénom de la personne connectée. */
export async function actionSignalerProbleme(page: string, texte: string): Promise<ResultatAction> {
  const t = texte.trim();
  if (t.length < 3) return { ok: false, erreur: "Décrivez le problème en quelques mots." };
  const s = await sessionCourante();
  await db.insert(schema.retours).values({
    page: page.slice(0, 300),
    texte: t.slice(0, 4000),
    posteId: s?.poste.id ?? null,
    personneId: s?.personne.id ?? null,
  });
  return { ok: true, message: "Merci, c'est noté." };
}
