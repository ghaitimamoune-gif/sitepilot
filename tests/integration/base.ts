/**
 * Base de test : schéma vidé, migrations rejouées, données initiales chargées.
 * Les tests d'intégration sont ignorés si PostgreSQL n'est pas joignable.
 */
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { vi } from "vitest";
import { db, schema, sql } from "@/lib/db";
import { chargerDonneesInitiales } from "@/lib/donnees-initiales/charger";
import { normaliserPrenom } from "@/lib/auth/prenom";
import type { PosteMinimal } from "@/lib/auth/droits";

export async function baseDisponible(): Promise<boolean> {
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}

export async function reinitialiserBase(): Promise<void> {
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
  await migrate(db, { migrationsFolder: "./drizzle" });
  await chargerDonneesInitiales(db);
}

/** Fige l'horloge (Date uniquement : les minuteries du pilote PostgreSQL continuent). */
export function maintenant(iso: string): Date {
  const d = new Date(iso);
  vi.useFakeTimers({ toFake: ["Date"], now: d });
  vi.setSystemTime(d);
  return d;
}

export interface ActeurTest {
  posteId: number;
  personneId: number;
  poste: PosteMinimal & { nom: string };
}

export async function acteurPour(nomPoste: string, prenom: string): Promise<ActeurTest> {
  const [p] = await db.select().from(schema.postes).where(eq(schema.postes.nom, nomPoste));
  if (!p) throw new Error(`Poste inconnu : ${nomPoste}`);
  const [pers] = await db
    .insert(schema.personnes)
    .values({ posteId: p.id, prenom, prenomNorm: normaliserPrenom(prenom) })
    .onConflictDoUpdate({ target: [schema.personnes.posteId, schema.personnes.prenomNorm], set: { prenom } })
    .returning();
  return { posteId: p.id, personneId: pers.id, poste: { id: p.id, nom: p.nom, role: p.role, zone: p.zone, posteSuperieurId: p.posteSuperieurId } };
}

export async function idArticle(nom: string): Promise<number> {
  const [a] = await db.select({ id: schema.articles.id }).from(schema.articles).where(eq(schema.articles.nom, nom));
  if (!a) throw new Error(`Article inconnu : ${nom}`);
  return a.id;
}

export async function idFournisseur(nom: string): Promise<number> {
  const [f] = await db.select({ id: schema.fournisseurs.id }).from(schema.fournisseurs).where(eq(schema.fournisseurs.nom, nom));
  if (!f) throw new Error(`Fournisseur inconnu : ${nom}`);
  return f.id;
}

export async function idFamille(nom: string): Promise<number> {
  const [f] = await db.select({ id: schema.familles.id }).from(schema.familles).where(eq(schema.familles.nom, nom));
  if (!f) throw new Error(`Famille inconnue : ${nom}`);
  return f.id;
}

/** Quelques octets suffisent : le serveur ne décode pas l'image. */
export const PHOTO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
