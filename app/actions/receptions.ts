"use server";

import type { ResultatAction } from "@/components/ui/BoutonAction";
import { acteur, actionAvecDroit } from "@/lib/auth/session";
import { parseNombre } from "@/lib/format";
import {
  creerReception,
  creerRectificative,
  retirerLigneReception,
  saisirControles,
  saisirLigneReception,
  validerReception,
  type DecisionReception,
} from "@/lib/services/receptions";

function erreur(e: unknown): ResultatAction {
  return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
}

/** La manager réceptionne ; le responsable cuisine supplée (réception marquée « par suppléant »). La responsable achats n'a jamais accès. */
export async function actionCreerReception(fournisseurId: number, achatDirect = false): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("receptions:ecrire");
    const id = await creerReception(acteur(s), { fournisseurId, parSuppleant: s.poste.role !== "manager", achatDirect });
    return { ok: true, redirection: `/receptions/${id}` };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionSaisirLigneReception(receptionId: number, articleId: number, qteRecue: number | null): Promise<void> {
  const s = await actionAvecDroit("receptions:ecrire");
  await saisirLigneReception(acteur(s), receptionId, articleId, { qteRecue });
}

export async function actionLigneDetail(
  receptionId: number,
  articleId: number,
  v: { qteRefusee?: number | null; motifRefus?: string | null; prixHt?: number | null; tvaPct?: number | null },
): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("receptions:ecrire");
    await saisirLigneReception(acteur(s), receptionId, articleId, v);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionAjouterArticleReception(receptionId: number, articleId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("receptions:ecrire");
    await saisirLigneReception(acteur(s), receptionId, articleId, { qteRecue: 0 });
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionRetirerLigneReception(receptionId: number, articleId: number): Promise<ResultatAction> {
  try {
    await actionAvecDroit("receptions:ecrire");
    await retirerLigneReception(receptionId, articleId);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionControles(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("receptions:ecrire");
    const receptionId = Number(data.get("receptionId"));
    const decision = String(data.get("decision") ?? "") as DecisionReception | "";
    await saisirControles(acteur(s), receptionId, {
      temperature: parseNombre(String(data.get("temperature") ?? "")),
      dlcOk: data.get("dlcOk") === "on",
      emballagesOk: data.get("emballagesOk") === "on",
      aspectOk: data.get("aspectOk") === "on",
      decision: decision || null,
      reserve: String(data.get("reserve") ?? ""),
      montantPaye: parseNombre(String(data.get("montantPaye") ?? "")),
    });
    return { ok: true, message: "Contrôles enregistrés." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionValiderReception(receptionId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("receptions:ecrire");
    const r = await validerReception(acteur(s), receptionId);
    if (!r.ok) return { ok: false, erreur: r.erreur };
    return { ok: true, message: "Réception validée : stock mis à jour." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionRectifier(receptionId: number, motif: string): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("receptions:ecrire");
    const id = await creerRectificative(acteur(s), receptionId, motif);
    return { ok: true, redirection: `/receptions/${id}` };
  } catch (e) {
    return erreur(e);
  }
}
