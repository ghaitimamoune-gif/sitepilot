"use server";

import type { ResultatAction } from "@/components/ui/BoutonAction";
import { acteur, actionAvecDroit } from "@/lib/auth/session";
import { traiterAlerte } from "@/lib/services/alertes";

export async function actionTraiterAlerte(id: number, note: string | null): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("alertes:lire");
    await traiterAlerte(acteur(s), id, note?.trim() || null);
    return { ok: true };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
  }
}
