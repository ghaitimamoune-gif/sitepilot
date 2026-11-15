import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { empreinte, hacherPin, jetonAleatoire, pinDefini, secretsEgaux } from "@/lib/auth/crypto";
import type { Role } from "@/lib/auth/droits";
import { journaliser, type Acteur } from "./journal";
import { pinValide } from "./comptes";
import { ecrireParametre, parametre } from "./parametres";

/** Durée de validité d'un lien d'invitation. */
export const DUREE_INVITATION_HEURES = 72;

/** Un compte personnel (propriétaire, encadrement) choisit son code ; un poste employé est partagé. */
export function choisitSonPin(role: Role): boolean {
  return role !== "employe";
}

/**
 * Qui peut inviter sur quel poste : les propriétaires sur tout poste, la manager sur les postes
 * employés (comme pour la création des comptes et le changement de code).
 */
export function peutInviter(roleActeur: Role, roleCible: Role): boolean {
  if (roleActeur === "proprietaire") return true;
  return roleActeur === "manager" && roleCible === "employe";
}

export async function creerInvitation(acteur: Acteur, roleActeur: Role, posteId: number): Promise<{ jeton: string; expireLe: Date; posteNom: string }> {
  const [poste] = await db.select().from(schema.postes).where(eq(schema.postes.id, posteId));
  if (!poste || !poste.actif) throw new Error("Poste introuvable ou désactivé.");
  if (!peutInviter(roleActeur, poste.role)) throw new Error("Vous ne pouvez pas inviter sur ce poste.");
  const jeton = jetonAleatoire(24);
  const expireLe = new Date(Date.now() + DUREE_INVITATION_HEURES * 3600 * 1000);
  const [inv] = await db
    .insert(schema.invitations)
    .values({ posteId, jetonHash: empreinte(jeton), expireLe, creeParPosteId: acteur.posteId, creeParPersonneId: acteur.personneId })
    .returning({ id: schema.invitations.id });
  await journaliser(acteur, "invitation", "creer", { entiteId: inv.id, apres: { posteId, poste: poste.nom, expireLe } });
  return { jeton, expireLe, posteNom: poste.nom };
}

export interface InvitationValide {
  id: number;
  poste: { id: number; nom: string; role: Role; pinDefini: boolean };
  choisirPin: boolean;
  expireLe: Date;
}

export async function lireInvitation(jeton: string | null | undefined): Promise<InvitationValide | { erreur: string }> {
  if (!jeton || jeton.length < 20) return { erreur: "Lien d'invitation incomplet." };
  const [row] = await db
    .select({ inv: schema.invitations, poste: schema.postes })
    .from(schema.invitations)
    .innerJoin(schema.postes, eq(schema.postes.id, schema.invitations.posteId))
    .where(eq(schema.invitations.jetonHash, empreinte(jeton)));
  if (!row) return { erreur: "Ce lien d'invitation n'est pas valable." };
  if (row.inv.utiliseeLe) return { erreur: "Ce lien a déjà été utilisé. Demandez-en un nouveau." };
  if (row.inv.annuleeLe) return { erreur: "Ce lien a été annulé." };
  if (row.inv.expireLe.getTime() < Date.now()) return { erreur: "Ce lien a expiré. Demandez-en un nouveau." };
  if (!row.poste.actif) return { erreur: "Ce poste a été désactivé." };
  return {
    id: row.inv.id,
    poste: { id: row.poste.id, nom: row.poste.nom, role: row.poste.role, pinDefini: pinDefini(row.poste.pinHash) },
    choisirPin: choisitSonPin(row.poste.role),
    expireLe: row.inv.expireLe,
  };
}

/** Deux postes actifs ne peuvent pas partager un code : c'est le code qui désigne le poste. */
async function pinDejaPris(pin: string, saufPosteId: number): Promise<boolean> {
  const { verifierPinHash } = await import("@/lib/auth/crypto");
  const postes = await db.select().from(schema.postes).where(eq(schema.postes.actif, true));
  for (const p of postes) {
    if (p.id === saufPosteId) continue;
    if (await verifierPinHash(pin, p.pinHash)) return true;
  }
  return false;
}

/**
 * Consomme une invitation : fixe le code du poste si l'invité le choisit, et marque le lien utilisé.
 * L'ouverture de la session (cookies) se fait ensuite dans l'action serveur.
 */
export async function utiliserInvitation(jeton: string, pin: string | null): Promise<{ ok: true; posteId: number; invitationId: number } | { ok: false; erreur: string }> {
  const inv = await lireInvitation(jeton);
  if ("erreur" in inv) return { ok: false, erreur: inv.erreur };
  if (inv.choisirPin) {
    if (!pin || !pinValide(pin, inv.poste.role)) {
      return { ok: false, erreur: inv.poste.role === "proprietaire" ? "Choisissez un code de 6 chiffres." : "Choisissez un code de 4 chiffres." };
    }
    if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) {
      return { ok: false, erreur: "Code trop simple (suite ou chiffres répétés). Choisissez-en un autre." };
    }
    if (await pinDejaPris(pin, inv.poste.id)) return { ok: false, erreur: "Ce code est déjà utilisé par un autre poste. Choisissez-en un autre." };
  }
  const maj = await db
    .update(schema.invitations)
    .set({ utiliseeLe: new Date() })
    .where(and(eq(schema.invitations.id, inv.id), isNull(schema.invitations.utiliseeLe)))
    .returning({ id: schema.invitations.id });
  if (maj.length === 0) return { ok: false, erreur: "Ce lien vient d'être utilisé." };
  if (inv.choisirPin && pin) {
    await db.update(schema.postes).set({ pinHash: await hacherPin(pin) }).where(eq(schema.postes.id, inv.poste.id));
    // Un nouveau code ferme les sessions ouvertes avec l'ancien.
    await db.update(schema.sessions).set({ fermeeLe: new Date() }).where(and(eq(schema.sessions.posteId, inv.poste.id), isNull(schema.sessions.fermeeLe)));
  }
  await journaliser(null, "invitation", "utiliser", { entiteId: inv.id, apres: { posteId: inv.poste.id, codeChoisi: inv.choisirPin } });
  return { ok: true, posteId: inv.poste.id, invitationId: inv.id };
}

export async function associerPersonneInvitation(invitationId: number, personneId: number): Promise<void> {
  await db.update(schema.invitations).set({ utiliseeParPersonneId: personneId }).where(eq(schema.invitations.id, invitationId));
}

export async function invitationsEnCours() {
  return db
    .select({ inv: schema.invitations, poste: schema.postes.nom })
    .from(schema.invitations)
    .innerJoin(schema.postes, eq(schema.postes.id, schema.invitations.posteId))
    .where(and(isNull(schema.invitations.utiliseeLe), isNull(schema.invitations.annuleeLe), gt(schema.invitations.expireLe, new Date())))
    .orderBy(desc(schema.invitations.creeLe));
}

export async function annulerInvitation(acteur: Acteur, id: number): Promise<void> {
  await db.update(schema.invitations).set({ annuleeLe: new Date() }).where(and(eq(schema.invitations.id, id), isNull(schema.invitations.utiliseeLe)));
  await journaliser(acteur, "invitation", "annuler", { entiteId: id });
}

// ---------------------------------------------------------------------------
// Installation : premier propriétaire, par un lien à usage unique
// ---------------------------------------------------------------------------

/**
 * Le lien d'installation porte un jeton fixé dans la variable d'environnement INSTALLATION_TOKEN
 * (jamais en base). Il ne sert qu'une fois : l'installation terminée, la page est fermée.
 */
export async function installationTerminee(): Promise<boolean> {
  return (await parametre("installation_terminee")) === "oui";
}

export function jetonInstallationValide(jeton: string | null | undefined): boolean {
  const attendu = process.env.INSTALLATION_TOKEN;
  if (!attendu || attendu.length < 32 || !jeton) return false;
  const expire = process.env.INSTALLATION_EXPIRE;
  if (expire && Date.parse(expire) < Date.now()) return false;
  return secretsEgaux(jeton, attendu);
}

export async function postesProprietaires() {
  const rows = await db.select().from(schema.postes).where(and(eq(schema.postes.role, "proprietaire"), eq(schema.postes.actif, true))).orderBy(schema.postes.ordre);
  return rows.map((p) => ({ id: p.id, nom: p.nom, pinDefini: pinDefini(p.pinHash) }));
}

/** Fixe le code du premier propriétaire et ferme l'installation. */
export async function terminerInstallation(jeton: string, posteId: number, pin: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  if (await installationTerminee()) return { ok: false, erreur: "L'installation est déjà faite." };
  if (!jetonInstallationValide(jeton)) return { ok: false, erreur: "Lien d'installation non valable ou expiré." };
  const [poste] = await db.select().from(schema.postes).where(eq(schema.postes.id, posteId));
  if (!poste || poste.role !== "proprietaire") return { ok: false, erreur: "Choisissez votre compte de propriétaire." };
  if (!pinValide(pin, "proprietaire")) return { ok: false, erreur: "Choisissez un code de 6 chiffres." };
  if (/^(\d)\1+$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) {
    return { ok: false, erreur: "Code trop simple (suite ou chiffres répétés). Choisissez-en un autre." };
  }
  if (await pinDejaPris(pin, posteId)) return { ok: false, erreur: "Ce code est déjà utilisé. Choisissez-en un autre." };
  await db.update(schema.postes).set({ pinHash: await hacherPin(pin) }).where(eq(schema.postes.id, posteId));
  await ecrireParametre({ posteId, personneId: null }, "installation_terminee", "oui", "installation");
  await journaliser({ posteId, personneId: null }, "installation", "terminer", { entiteId: posteId });
  return { ok: true };
}
