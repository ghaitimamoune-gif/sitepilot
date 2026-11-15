"use server";

import type { ResultatAction } from "@/components/ui/BoutonAction";
import { acteur, actionAvecDroit } from "@/lib/auth/session";
import { parseNombre } from "@/lib/format";
import { declarerPerte, type MotifPerte } from "@/lib/services/pertes";
import { signalerRupture } from "@/lib/services/ruptures";

function erreur(e: unknown): ResultatAction {
  return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
}

export async function actionSignalerRupture(articleId: number, commentaire: string | null): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("rupture:signaler");
    await signalerRupture(acteur(s), s.poste, articleId, commentaire);
    return { ok: true, message: "Rupture signalée : alerte envoyée, ligne de commande prioritaire créée." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionDeclarerPerte(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("pertes:declarer");
    const quantite = parseNombre(String(data.get("quantite") ?? ""));
    if (quantite === null || quantite <= 0) return { ok: false, erreur: "Indiquez une quantité." };
    const id = await declarerPerte(acteur(s), {
      articleId: Number(data.get("articleId")),
      quantite,
      motif: String(data.get("motif") ?? "perime") as MotifPerte,
      commentaire: String(data.get("commentaire") ?? ""),
    });
    return { ok: true, redirection: `/pertes?declaree=${id}` };
  } catch (e) {
    return erreur(e);
  }
}
