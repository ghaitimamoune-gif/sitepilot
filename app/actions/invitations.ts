"use server";

import { redirect } from "next/navigation";
import type { ResultatAction } from "@/components/ui/BoutonAction";
import { accueilParRole } from "@/lib/auth/droits";
import { acteur, actionAvecDroit, ouvrirSessionPoste } from "@/lib/auth/session";
import { origine, qrSvg } from "@/lib/qr";
import { codeEnrolement } from "@/lib/services/comptes";
import {
  annulerInvitation,
  associerPersonneInvitation,
  creerInvitation,
  DUREE_INVITATION_HEURES,
  terminerInstallation,
  utiliserInvitation,
} from "@/lib/services/invitations";

export interface LienPartage {
  ok: true;
  lien: string;
  qr: string;
  whatsapp: string;
  titre: string;
  detail: string;
}

/** Lien d'invitation à usage unique pour un poste, avec QR code et message WhatsApp prêt. */
export async function actionCreerInvitation(posteId: number): Promise<LienPartage | { ok: false; erreur: string }> {
  try {
    const s = await actionAvecDroit("comptes:employes");
    const inv = await creerInvitation(acteur(s), s.poste.role, posteId);
    const lien = `${await origine()}/invitation?jeton=${inv.jeton}`;
    const message = `Bonjour, voici ton accès à Easy Burger Ops (${inv.posteNom}). Ouvre ce lien sur ton téléphone, il est personnel et valable ${DUREE_INVITATION_HEURES} heures :\n${lien}`;
    return {
      ok: true,
      lien,
      qr: await qrSvg(lien),
      whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
      titre: `Invitation : ${inv.posteNom}`,
      detail: `Lien personnel, utilisable une seule fois, valable ${DUREE_INVITATION_HEURES} h.`,
    };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
  }
}

/** QR code d'enrôlement du restaurant : scanné, il ouvre l'application avec le code déjà saisi. */
export async function actionQrEnrolement(): Promise<LienPartage | { ok: false; erreur: string }> {
  try {
    await actionAvecDroit("comptes:employes");
    const code = await codeEnrolement();
    if (!code) return { ok: false, erreur: "Aucun code d'enrôlement : un propriétaire doit en créer un." };
    const lien = `${await origine()}/enroler?code=${encodeURIComponent(code)}`;
    return {
      ok: true,
      lien,
      qr: await qrSvg(lien),
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`Easy Burger Ops : ouvre ce lien pour enregistrer ton téléphone, puis demande le code de ton poste :\n${lien}`)}`,
      titre: "Enrôler un téléphone",
      detail: `Code : ${code}`,
    };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
  }
}

export async function actionAnnulerInvitation(id: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("comptes:employes");
    await annulerInvitation(acteur(s), id);
    return { ok: true };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
  }
}

function lireCode(data: FormData): { pin: string | null; erreur: string | null } {
  const pin = String(data.get("pin") ?? "").replace(/\D/g, "");
  const pin2 = String(data.get("pin2") ?? "").replace(/\D/g, "");
  if (!data.has("pin")) return { pin: null, erreur: null };
  if (pin !== pin2) return { pin: null, erreur: "Les deux codes ne sont pas identiques." };
  return { pin, erreur: null };
}

export async function actionUtiliserInvitation(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  const jeton = String(data.get("jeton") ?? "");
  const prenom = String(data.get("prenom") ?? "");
  const { pin, erreur } = lireCode(data);
  if (erreur) return { ok: false, erreur };
  const r = await utiliserInvitation(jeton, pin);
  if (!r.ok) return { ok: false, erreur: r.erreur };
  const s = await ouvrirSessionPoste(r.posteId, prenom, "invitation");
  if (!s.ok) return { ok: false, erreur: s.erreur };
  await associerPersonneInvitation(r.invitationId, s.personneId);
  // Redirection côté serveur : poser les cookies rafraîchit la page d'invitation, dont le formulaire disparaît.
  redirect(`${accueilParRole(s.role)}?bienvenue=1`);
}

export async function actionInstallation(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  const jeton = String(data.get("jeton") ?? "");
  const prenom = String(data.get("prenom") ?? "");
  const posteId = Number(data.get("posteId"));
  const { pin, erreur } = lireCode(data);
  if (erreur) return { ok: false, erreur };
  const r = await terminerInstallation(jeton, posteId, pin ?? "");
  if (!r.ok) return { ok: false, erreur: r.erreur };
  const s = await ouvrirSessionPoste(posteId, prenom, "installation");
  if (!s.ok) return { ok: false, erreur: s.erreur };
  redirect("/mise-en-service");
}
