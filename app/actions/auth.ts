"use server";

import { redirect } from "next/navigation";
import { accueilParRole } from "@/lib/auth/droits";
import { enrolerAppareil, fermerSession, ouvrirSession, verifierPin } from "@/lib/auth/session";
import type { ResultatAction } from "@/components/ui/BoutonAction";

export async function actionEnroler(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  const code = String(data.get("code") ?? "");
  const libelle = String(data.get("libelle") ?? "").trim();
  const r = await enrolerAppareil(code, libelle || undefined);
  if (!r.ok) return { ok: false, erreur: r.erreur };
  return { ok: true, redirection: "/connexion" };
}

export async function actionVerifierPin(pin: string): Promise<ResultatAction> {
  const r = await verifierPin(pin);
  if (!r.ok) return { ok: false, erreur: r.erreur };
  return { ok: true, redirection: "/connexion/prenom" };
}

export async function actionOuvrirSession(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  const prenom = String(data.get("prenom") ?? "");
  const r = await ouvrirSession(prenom);
  if (!r.ok) return { ok: false, erreur: r.erreur };
  return { ok: true, redirection: accueilParRole(r.role) };
}

export async function actionChoisirPrenom(prenom: string): Promise<ResultatAction> {
  const r = await ouvrirSession(prenom);
  if (!r.ok) return { ok: false, erreur: r.erreur };
  return { ok: true, redirection: accueilParRole(r.role) };
}

export async function actionSortir(): Promise<void> {
  await fermerSession();
  redirect("/connexion");
}
