"use server";

import type { ResultatAction } from "@/components/ui/BoutonAction";
import type { Role, Zone } from "@/lib/auth/droits";
import { acteur, actionAvecDroit } from "@/lib/auth/session";
import { archiverPrenom, changerPin, creerPoste, fusionnerPrenoms, modifierPoste, renouvelerCodeEnrolement, revoquerAppareil } from "@/lib/services/comptes";

function erreur(e: unknown): ResultatAction {
  return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
}

export async function actionCreerPoste(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("comptes:employes");
    const sup = Number(data.get("posteSuperieurId"));
    const id = await creerPoste(acteur(s), s.poste.role, {
      nom: String(data.get("nom") ?? ""),
      role: String(data.get("role") ?? "employe") as Role,
      zone: String(data.get("zone") ?? "cuisine") as Zone,
      pin: String(data.get("pin") ?? ""),
      posteSuperieurId: Number.isInteger(sup) && sup > 0 ? sup : null,
      voitPreparations: data.get("voitPreparations") === "on",
      planNettoyage: data.get("planNettoyage") === "on",
    });
    return { ok: true, message: `Poste créé (n° ${id}).` };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionChangerPin(posteId: number, pin: string): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("taches:cocher");
    await changerPin(acteur(s), s.poste.role, posteId, pin);
    return { ok: true, message: "Code PIN changé. Les sessions ouvertes de ce poste sont fermées." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionActiverPoste(posteId: number, actif: boolean): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("comptes:employes");
    await modifierPoste(acteur(s), s.poste.role, posteId, { actif });
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionModifierPoste(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("comptes:employes");
    const sup = Number(data.get("posteSuperieurId"));
    await modifierPoste(acteur(s), s.poste.role, Number(data.get("posteId")), {
      nom: String(data.get("nom") ?? ""),
      zone: String(data.get("zone") ?? "cuisine") as Zone,
      posteSuperieurId: Number.isInteger(sup) && sup > 0 ? sup : null,
      voitPreparations: data.get("voitPreparations") === "on",
      planNettoyage: data.get("planNettoyage") === "on",
    });
    return { ok: true, message: "Poste modifié." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionArchiverPrenom(personneId: number, archivee: boolean): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("comptes:employes");
    await archiverPrenom(acteur(s), personneId, archivee);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionFusionnerPrenoms(sourceId: number, cibleId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("comptes:employes");
    await fusionnerPrenoms(acteur(s), sourceId, cibleId);
    return { ok: true, message: "Prénoms fusionnés." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionRenouvelerCode(): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("comptes:encadrement");
    const code = await renouvelerCodeEnrolement(acteur(s), s.personne.prenom);
    return { ok: true, message: `Nouveau code : ${code}` };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionRevoquerAppareil(appareilId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("comptes:encadrement");
    await revoquerAppareil(acteur(s), appareilId);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}
