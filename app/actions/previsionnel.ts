"use server";

import type { ResultatAction } from "@/components/ui/BoutonAction";
import { acteur, actionAvecDroit } from "@/lib/auth/session";
import { enregistrerPrevision } from "@/lib/services/previsions";

/** Les propriétaires saisissent la semaine à venir et peuvent corriger une valeur jusqu'au matin même. */
export async function actionSaisirPrevision(date: string, montant: number | null): Promise<void> {
  const s = await actionAvecDroit("previsionnel:ecrire");
  await enregistrerPrevision(acteur(s), date, montant !== null && montant > 0 ? montant : null);
}

export async function actionRevenirEstimation(date: string): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("previsionnel:ecrire");
    await enregistrerPrevision(acteur(s), date, null);
    return { ok: true };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
  }
}
