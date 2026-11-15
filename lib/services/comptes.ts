import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { codeEnrolementAleatoire, hacherPin } from "@/lib/auth/crypto";
import type { Role, Zone } from "@/lib/auth/droits";
import { journaliser, type Acteur } from "./journal";
import { ecrireParametre, parametre } from "./parametres";

const ROLES_ENCADREMENT: Role[] = ["proprietaire", "manager", "resp_achats", "resp_cuisine", "resp_salle"];

export function pinValide(pin: string, role: Role): boolean {
  const attendu = role === "proprietaire" ? 6 : 4;
  return new RegExp(`^\\d{${attendu}}$`).test(pin);
}

/** Les PIN désignent le poste : deux postes actifs ne peuvent pas partager le même code. */
async function pinDejaUtilise(pin: string, saufPosteId: number | null): Promise<boolean> {
  const { verifierPinHash } = await import("@/lib/auth/crypto");
  const postes = await db.select().from(schema.postes).where(eq(schema.postes.actif, true));
  for (const p of postes) {
    if (p.id === saufPosteId) continue;
    if (await verifierPinHash(pin, p.pinHash)) return true;
  }
  return false;
}

/**
 * Les propriétaires créent les comptes d'encadrement ; la manager crée les postes employés.
 * Elle ne peut ni créer un compte d'encadrement ni modifier ses propres droits.
 */
export async function creerPoste(
  acteur: Acteur,
  roleActeur: Role,
  p: { nom: string; role: Role; zone: Zone; pin: string; posteSuperieurId?: number | null; voitPreparations?: boolean; planNettoyage?: boolean },
): Promise<number> {
  if (roleActeur !== "proprietaire" && (roleActeur !== "manager" || p.role !== "employe")) {
    throw new Error("Seul un propriétaire crée un compte d'encadrement.");
  }
  const nom = p.nom.trim();
  if (!nom) throw new Error("Le nom du poste est obligatoire.");
  if (!pinValide(p.pin, p.role)) throw new Error(p.role === "proprietaire" ? "Le code PIN d'un propriétaire fait 6 chiffres." : "Le code PIN fait 4 chiffres.");
  if (await pinDejaUtilise(p.pin, null)) throw new Error("Ce code PIN est déjà utilisé par un autre poste.");
  const [row] = await db
    .insert(schema.postes)
    .values({
      nom,
      role: p.role,
      zone: p.zone,
      pinHash: await hacherPin(p.pin),
      posteSuperieurId: p.posteSuperieurId ?? null,
      voitPreparations: p.voitPreparations ?? (p.zone === "cuisine"),
      planNettoyage: p.planNettoyage ?? false,
    })
    .returning({ id: schema.postes.id });
  await journaliser(acteur, "poste", "creer", { entiteId: row.id, apres: { nom, role: p.role, zone: p.zone } });
  return row.id;
}

export async function modifierPoste(
  acteur: Acteur,
  roleActeur: Role,
  posteId: number,
  p: { nom?: string; zone?: Zone; posteSuperieurId?: number | null; voitPreparations?: boolean; planNettoyage?: boolean; actif?: boolean },
): Promise<void> {
  const [cible] = await db.select().from(schema.postes).where(eq(schema.postes.id, posteId));
  if (!cible) throw new Error("Poste introuvable.");
  if (roleActeur !== "proprietaire") {
    if (roleActeur !== "manager" || cible.role !== "employe") throw new Error("La manager ne modifie que les postes employés.");
  }
  if (cible.id === acteur.posteId && p.actif === false) throw new Error("Vous ne pouvez pas désactiver votre propre poste.");
  const set: Partial<typeof schema.postes.$inferInsert> = {};
  if (p.nom !== undefined) set.nom = p.nom.trim();
  if (p.zone !== undefined) set.zone = p.zone;
  if (p.posteSuperieurId !== undefined) set.posteSuperieurId = p.posteSuperieurId;
  if (p.voitPreparations !== undefined) set.voitPreparations = p.voitPreparations;
  if (p.planNettoyage !== undefined) set.planNettoyage = p.planNettoyage;
  if (p.actif !== undefined) set.actif = p.actif;
  await db.update(schema.postes).set(set).where(eq(schema.postes.id, posteId));
  if (p.actif === false) await db.update(schema.sessions).set({ fermeeLe: new Date() }).where(eq(schema.sessions.posteId, posteId));
  await journaliser(acteur, "poste", "modifier", { entiteId: posteId, avant: { nom: cible.nom, zone: cible.zone, actif: cible.actif }, apres: set });
}

/** Changement de PIN, par exemple au départ d'un employé. Ferme les sessions ouvertes du poste. */
export async function changerPin(acteur: Acteur, roleActeur: Role, posteId: number, pin: string): Promise<void> {
  const [cible] = await db.select().from(schema.postes).where(eq(schema.postes.id, posteId));
  if (!cible) throw new Error("Poste introuvable.");
  const propre = cible.id === acteur.posteId;
  if (!propre && roleActeur !== "proprietaire" && (roleActeur !== "manager" || cible.role !== "employe")) {
    throw new Error("Vous ne pouvez pas changer le code de ce poste.");
  }
  if (!pinValide(pin, cible.role)) throw new Error(cible.role === "proprietaire" ? "6 chiffres attendus." : "4 chiffres attendus.");
  if (await pinDejaUtilise(pin, posteId)) throw new Error("Ce code PIN est déjà utilisé par un autre poste.");
  await db.update(schema.postes).set({ pinHash: await hacherPin(pin) }).where(eq(schema.postes.id, posteId));
  await db.update(schema.sessions).set({ fermeeLe: new Date() }).where(and(eq(schema.sessions.posteId, posteId)));
  await journaliser(acteur, "poste", "changer_pin", { entiteId: posteId });
}

export async function listerPostes(inclureInactifs = true) {
  const rows = await db.select().from(schema.postes).orderBy(asc(schema.postes.ordre), asc(schema.postes.nom));
  return inclureInactifs ? rows : rows.filter((p) => p.actif);
}

export async function listerPersonnes(posteId: number) {
  return db
    .select()
    .from(schema.personnes)
    .where(eq(schema.personnes.posteId, posteId))
    .orderBy(asc(schema.personnes.archivee), desc(schema.personnes.derniereConnexion));
}

/** La manager peut fusionner ou archiver un prénom. */
export async function archiverPrenom(acteur: Acteur, personneId: number, archivee: boolean): Promise<void> {
  await db.update(schema.personnes).set({ archivee }).where(eq(schema.personnes.id, personneId));
  await journaliser(acteur, "personne", archivee ? "archiver" : "restaurer", { entiteId: personneId });
}

export async function fusionnerPrenoms(acteur: Acteur, sourceId: number, cibleId: number): Promise<void> {
  if (sourceId === cibleId) return;
  const [source] = await db.select().from(schema.personnes).where(eq(schema.personnes.id, sourceId));
  const [cible] = await db.select().from(schema.personnes).where(eq(schema.personnes.id, cibleId));
  if (!source || !cible || source.posteId !== cible.posteId) throw new Error("Les deux prénoms doivent appartenir au même poste.");
  await db.transaction(async (tx) => {
    await tx.update(schema.personnes).set({ fusionneeDans: cibleId, archivee: true }).where(eq(schema.personnes.id, sourceId));
    // Les actions passées restent attribuées au prénom d'origine ; les nouvelles connexions vont vers la cible.
    await tx.update(schema.sessions).set({ fermeeLe: new Date() }).where(eq(schema.sessions.personneId, sourceId));
  });
  await journaliser(acteur, "personne", "fusionner", { entiteId: sourceId, apres: { dans: cibleId } });
}

export async function codeEnrolement(): Promise<string> {
  return parametre("code_enrolement");
}

/** Le code est long et renouvelable par les propriétaires. */
export async function renouvelerCodeEnrolement(acteur: Acteur, auteur: string): Promise<string> {
  const code = codeEnrolementAleatoire();
  await ecrireParametre(acteur, "code_enrolement", code, auteur);
  return code;
}

export async function listerAppareils() {
  return db.select().from(schema.appareils).orderBy(desc(schema.appareils.dernierVuLe));
}

export async function revoquerAppareil(acteur: Acteur, appareilId: number): Promise<void> {
  await db.update(schema.appareils).set({ revoque: true }).where(eq(schema.appareils.id, appareilId));
  await db.update(schema.sessions).set({ fermeeLe: new Date() }).where(eq(schema.sessions.appareilId, appareilId));
  await journaliser(acteur, "appareil", "revoquer", { entiteId: appareilId });
}

export { ROLES_ENCADREMENT };
