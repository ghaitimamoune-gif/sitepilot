"use server";

import type { ResultatAction } from "@/components/ui/BoutonAction";
import { acteur, actionAvecDroit } from "@/lib/auth/session";
import type { ValeurAttendue } from "@/lib/db/schema";
import { parseNombre } from "@/lib/format";
import {
  annulerTache,
  bloquerTache,
  cocherPoint,
  creerTachePonctuelle,
  saisirValeurs,
  terminerTache,
  verifierTache,
} from "@/lib/services/taches";

function erreur(e: unknown): ResultatAction {
  return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
}

export async function actionCocherPoint(tacheId: number, index: number, coche: boolean): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("taches:cocher");
    await cocherPoint(acteur(s), tacheId, index, coche);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionSaisirValeurs(tacheId: number, valeurs: (number | null)[]): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("taches:cocher");
    const r = await saisirValeurs(acteur(s), tacheId, valeurs);
    return { ok: true, message: r.horsPlage.length > 0 ? `Hors plage : ${r.horsPlage.join(" ; ")}. La manager est alertée. Ne rien jeter, ne rien utiliser.` : undefined };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionTerminerTache(tacheId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("taches:cocher");
    const r = await terminerTache(acteur(s), tacheId);
    if (!r.ok) return { ok: false, erreur: r.erreur };
    return { ok: true, redirection: "/taches" };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionBloquerTache(tacheId: number, motif: string): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("taches:cocher");
    await bloquerTache(acteur(s), tacheId, motif);
    return { ok: true, redirection: "/taches" };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionVerifierTache(tacheId: number, ok: boolean, commentaire: string | null): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("taches:verifier");
    await verifierTache(acteur(s), s.poste, tacheId, ok, commentaire);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionAnnulerTache(tacheId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("taches:creer");
    await annulerTache(acteur(s), s.poste.role, tacheId);
    return { ok: true, redirection: "/equipe" };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionCreerTache(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("taches:creer");
    const preuve = String(data.get("preuve") ?? "aucune") as "aucune" | "photos" | "valeurs";
    const valeurs: ValeurAttendue[] = [];
    for (let i = 0; i < 6; i++) {
      const label = String(data.get(`valeur_label_${i}`) ?? "").trim();
      if (!label) continue;
      valeurs.push({ label, min: parseNombre(String(data.get(`valeur_min_${i}`) ?? "")), max: parseNombre(String(data.get(`valeur_max_${i}`) ?? "")), unite: String(data.get(`valeur_unite_${i}`) ?? "").trim() || undefined });
    }
    const points = String(data.get("points") ?? "")
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    const id = await creerTachePonctuelle(acteur(s), s.poste, {
      posteId: Number(data.get("posteId")),
      titre: String(data.get("titre") ?? ""),
      consigne: String(data.get("consigne") ?? ""),
      journee: String(data.get("journee") ?? "") || undefined,
      heure: String(data.get("heure") ?? "") || undefined,
      preuve,
      photosMin: Number(data.get("photosMin") ?? 1) || 1,
      valeurs: preuve === "valeurs" ? valeurs : [],
      points,
      structurante: data.get("structurante") === "on",
    });
    return { ok: true, redirection: `/taches/${id}` };
  } catch (e) {
    return erreur(e);
  }
}
