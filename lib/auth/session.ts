import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import { chargerParametres, nombreDepuis } from "@/lib/services/parametres";
import { journaliser } from "@/lib/services/journal";
import { empreinte, jetonAleatoire, normaliserCode, signer, verifierSignature, verifierPinHash } from "./crypto";
import { aLeDroit, type Droit, type Role, type Zone } from "./droits";
import { normaliserPrenom, prenomValide, presenterPrenom } from "./prenom";

export const COOKIE_APPAREIL = "eb_appareil";
export const COOKIE_SESSION = "eb_session";
export const COOKIE_PIN = "eb_pin";

const UN_AN = 60 * 60 * 24 * 365;

export interface Session {
  sessionId: number;
  poste: {
    id: number;
    nom: string;
    role: Role;
    zone: Zone;
    posteSuperieurId: number | null;
    voitPreparations: boolean;
  };
  personne: { id: number; prenom: string };
  appareilId: number;
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export class ErreurDroit extends Error {
  constructor(message = "Accès refusé") {
    super(message);
    this.name = "ErreurDroit";
  }
}

// ---------------------------------------------------------------------------
// Appareil
// ---------------------------------------------------------------------------

export const appareilCourant = cache(async () => {
  const jar = await cookies();
  const jeton = jar.get(COOKIE_APPAREIL)?.value;
  if (!jeton) return null;
  const [a] = await db
    .select()
    .from(schema.appareils)
    .where(and(eq(schema.appareils.jetonHash, empreinte(jeton)), eq(schema.appareils.revoque, false)));
  return a ?? null;
});

export async function enrolerAppareil(code: string, libelle?: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const p = await chargerParametres();
  const attendu = normaliserCode(p.code_enrolement ?? "");
  if (!attendu) return { ok: false, erreur: "Aucun code d'enrôlement n'est défini. Un propriétaire doit en créer un." };
  if (normaliserCode(code) !== attendu) {
    await journaliser(null, "appareil", "enrolement_refuse", { apres: { libelle: libelle ?? null } });
    return { ok: false, erreur: "Code d'enrôlement incorrect." };
  }
  const jeton = jetonAleatoire();
  const [a] = await db
    .insert(schema.appareils)
    .values({ jetonHash: empreinte(jeton), libelle: libelle?.slice(0, 80) ?? null })
    .returning();
  const jar = await cookies();
  jar.set(COOKIE_APPAREIL, jeton, cookieOptions(UN_AN));
  await journaliser(null, "appareil", "enroler", { entiteId: a.id, apres: { libelle: a.libelle } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Code PIN
// ---------------------------------------------------------------------------

export async function verrouillage(appareilId: number): Promise<{ verrouille: boolean; jusqua: Date | null; restantes: number }> {
  const p = await chargerParametres();
  const max = nombreDepuis(p, "pin_tentatives_max");
  const minutes = nombreDepuis(p, "pin_verrouillage_minutes");
  const depuis = new Date(Date.now() - minutes * 60000);
  const recentes = await db
    .select()
    .from(schema.tentativesPin)
    .where(and(eq(schema.tentativesPin.appareilId, appareilId), gt(schema.tentativesPin.at, depuis)))
    .orderBy(desc(schema.tentativesPin.at));
  // On compte les échecs consécutifs depuis la dernière réussite.
  let echecs = 0;
  for (const t of recentes) {
    if (t.reussie) break;
    echecs++;
  }
  if (echecs >= max) {
    const derniere = recentes[0]?.at ?? new Date();
    return { verrouille: true, jusqua: new Date(derniere.getTime() + minutes * 60000), restantes: 0 };
  }
  return { verrouille: false, jusqua: null, restantes: max - echecs };
}

export async function verifierPin(
  pin: string,
): Promise<{ ok: true; posteId: number } | { ok: false; erreur: string; verrouilleJusqua?: Date }> {
  const appareil = await appareilCourant();
  if (!appareil) return { ok: false, erreur: "Appareil non enrôlé." };
  const v = await verrouillage(appareil.id);
  if (v.verrouille) {
    return { ok: false, erreur: "Trop de codes erronés. Réessayez dans quelques minutes.", verrouilleJusqua: v.jusqua! };
  }
  const propre = pin.replace(/\D/g, "");
  let trouve: { id: number; role: Role } | null = null;
  if (propre.length === 4 || propre.length === 6) {
    const candidats = await db
      .select({ id: schema.postes.id, role: schema.postes.role, pinHash: schema.postes.pinHash })
      .from(schema.postes)
      .where(eq(schema.postes.actif, true));
    for (const c of candidats) {
      const attendu = c.role === "proprietaire" ? 6 : 4;
      if (propre.length !== attendu) continue;
      if (await verifierPinHash(propre, c.pinHash)) {
        trouve = { id: c.id, role: c.role };
        break;
      }
    }
  }
  await db.insert(schema.tentativesPin).values({ appareilId: appareil.id, reussie: trouve !== null });
  if (!trouve) {
    await journaliser(null, "appareil", "pin_errone", { entiteId: appareil.id });
    const apres = await verrouillage(appareil.id);
    if (apres.verrouille) {
      await journaliser(null, "appareil", "verrouillage", { entiteId: appareil.id, apres: { jusqua: apres.jusqua } });
      return { ok: false, erreur: "Cinq codes erronés : poste bloqué 5 minutes sur cet appareil.", verrouilleJusqua: apres.jusqua! };
    }
    return { ok: false, erreur: `Code incorrect. ${apres.restantes} ${apres.restantes > 1 ? "essais restants" : "essai restant"}.` };
  }
  const jar = await cookies();
  jar.set(COOKIE_PIN, signer(String(trouve.id), 300), cookieOptions(300));
  return { ok: true, posteId: trouve.id };
}

/** Poste autorisé par le PIN, en attente du prénom. */
export async function posteApresPin(): Promise<{ id: number; nom: string; role: Role } | null> {
  const jar = await cookies();
  const valeur = verifierSignature(jar.get(COOKIE_PIN)?.value);
  if (!valeur) return null;
  const [p] = await db
    .select({ id: schema.postes.id, nom: schema.postes.nom, role: schema.postes.role })
    .from(schema.postes)
    .where(and(eq(schema.postes.id, Number(valeur)), eq(schema.postes.actif, true)));
  return p ?? null;
}

export async function prenomsDuPoste(posteId: number): Promise<{ id: number; prenom: string }[]> {
  return db
    .select({ id: schema.personnes.id, prenom: schema.personnes.prenom })
    .from(schema.personnes)
    .where(and(eq(schema.personnes.posteId, posteId), eq(schema.personnes.archivee, false), isNull(schema.personnes.fusionneeDans)))
    .orderBy(desc(schema.personnes.derniereConnexion));
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function ouvrirSession(prenom: string): Promise<{ ok: true; role: Role } | { ok: false; erreur: string }> {
  const appareil = await appareilCourant();
  if (!appareil) return { ok: false, erreur: "Appareil non enrôlé." };
  const poste = await posteApresPin();
  if (!poste) return { ok: false, erreur: "Le code PIN a expiré, recommencez." };
  if (!prenomValide(prenom)) return { ok: false, erreur: "Prénom invalide (2 à 30 lettres)." };
  const norm = normaliserPrenom(prenom);
  const maintenant = new Date();
  let [personne] = await db
    .select()
    .from(schema.personnes)
    .where(and(eq(schema.personnes.posteId, poste.id), eq(schema.personnes.prenomNorm, norm)));
  if (personne?.fusionneeDans) {
    const [cible] = await db.select().from(schema.personnes).where(eq(schema.personnes.id, personne.fusionneeDans));
    if (cible) personne = cible;
  }
  if (!personne) {
    [personne] = await db
      .insert(schema.personnes)
      .values({ posteId: poste.id, prenom: presenterPrenom(prenom), prenomNorm: norm, premiereConnexion: maintenant, derniereConnexion: maintenant })
      .returning();
  } else {
    await db
      .update(schema.personnes)
      .set({ derniereConnexion: maintenant, archivee: false })
      .where(eq(schema.personnes.id, personne.id));
  }
  const jeton = jetonAleatoire();
  const [s] = await db
    .insert(schema.sessions)
    .values({ jetonHash: empreinte(jeton), posteId: poste.id, personneId: personne.id, appareilId: appareil.id })
    .returning();
  // Le cookie dure ; c'est l'inactivité (12 h par défaut), vérifiée côté serveur, qui ferme la session.
  const jar = await cookies();
  jar.set(COOKIE_SESSION, jeton, cookieOptions(30 * 24 * 3600));
  jar.delete(COOKIE_PIN);
  await journaliser({ posteId: poste.id, personneId: personne.id }, "session", "ouvrir", { entiteId: s.id });
  return { ok: true, role: poste.role };
}

export async function fermerSession(): Promise<void> {
  const jar = await cookies();
  const jeton = jar.get(COOKIE_SESSION)?.value;
  if (jeton) {
    const [s] = await db
      .update(schema.sessions)
      .set({ fermeeLe: new Date() })
      .where(eq(schema.sessions.jetonHash, empreinte(jeton)))
      .returning();
    if (s) await journaliser({ posteId: s.posteId, personneId: s.personneId }, "session", "fermer", { entiteId: s.id });
  }
  jar.delete(COOKIE_SESSION);
  jar.delete(COOKIE_PIN);
}

/** Session courante, ou null. Prolonge la session (glissante) à chaque requête. */
export const sessionCourante = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const jeton = jar.get(COOKIE_SESSION)?.value;
  if (!jeton) return null;
  const [row] = await db
    .select({
      s: schema.sessions,
      poste: schema.postes,
      personne: schema.personnes,
    })
    .from(schema.sessions)
    .innerJoin(schema.postes, eq(schema.postes.id, schema.sessions.posteId))
    .innerJoin(schema.personnes, eq(schema.personnes.id, schema.sessions.personneId))
    .where(and(eq(schema.sessions.jetonHash, empreinte(jeton)), isNull(schema.sessions.fermeeLe)));
  if (!row || !row.poste.actif) return null;
  const p = await chargerParametres();
  const heures = nombreDepuis(p, "session_duree_heures");
  const limite = Date.now() - heures * 3600 * 1000;
  if (row.s.derniereActivite.getTime() < limite) {
    await db.update(schema.sessions).set({ fermeeLe: new Date() }).where(eq(schema.sessions.id, row.s.id));
    return null;
  }
  // Prolongation : au plus une écriture par minute.
  if (Date.now() - row.s.derniereActivite.getTime() > 60000) {
    const maintenant = new Date();
    await db.update(schema.sessions).set({ derniereActivite: maintenant }).where(eq(schema.sessions.id, row.s.id));
    await db.update(schema.appareils).set({ dernierVuLe: maintenant }).where(eq(schema.appareils.id, row.s.appareilId));
  }
  return {
    sessionId: row.s.id,
    poste: {
      id: row.poste.id,
      nom: row.poste.nom,
      role: row.poste.role,
      zone: row.poste.zone,
      posteSuperieurId: row.poste.posteSuperieurId,
      voitPreparations: row.poste.voitPreparations,
    },
    personne: { id: row.personne.id, prenom: row.personne.prenom },
    appareilId: row.s.appareilId,
  };
});

/** Pour les pages : redirige vers la connexion si besoin. */
export async function exigerSession(): Promise<Session> {
  const s = await sessionCourante();
  if (!s) {
    const appareil = await appareilCourant();
    redirect(appareil ? "/connexion" : "/enroler");
  }
  return s;
}

/** Pour les pages : exige un droit, sinon page 403. */
export async function exigerDroit(droit: Droit): Promise<Session> {
  const s = await exigerSession();
  if (!aLeDroit(s.poste.role, droit)) redirect(`/refuse?droit=${encodeURIComponent(droit)}`);
  return s;
}

/** Pour les actions serveur : exige un droit, sinon lève une erreur. */
export async function actionAvecDroit(droit: Droit): Promise<Session> {
  const s = await sessionCourante();
  if (!s) throw new ErreurDroit("Session expirée, reconnectez-vous.");
  if (!aLeDroit(s.poste.role, droit)) throw new ErreurDroit("Votre poste n'a pas ce droit.");
  return s;
}

export function acteur(s: Session): { posteId: number; personneId: number } {
  return { posteId: s.poste.id, personneId: s.personne.id };
}
