/**
 * Inscription sécurisée : installation du premier propriétaire par un lien à usage unique,
 * invitations personnelles, aucun code PIN connu en production.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, schema, sql } from "@/lib/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { pinDefini, verifierPinHash } from "@/lib/auth/crypto";
import { chargerDonneesInitiales } from "@/lib/donnees-initiales/charger";
import {
  creerInvitation,
  installationTerminee,
  jetonInstallationValide,
  lireInvitation,
  peutInviter,
  terminerInstallation,
  utiliserInvitation,
} from "@/lib/services/invitations";
import { baseDisponible } from "./base";

const disponible = await baseDisponible();
const JETON = "jeton-installation-de-test-0123456789abcdef";

async function poste(nom: string) {
  const [p] = await db.select().from(schema.postes).where(eq(schema.postes.nom, nom));
  return p;
}

describe.skipIf(!disponible)("installation et invitations", () => {
  beforeAll(async () => {
    await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
    await migrate(db, { migrationsFolder: "./drizzle" });
    await chargerDonneesInitiales(db, () => undefined, { pinsInconnus: true });
    process.env.INSTALLATION_TOKEN = JETON;
  });

  afterAll(() => {
    delete process.env.INSTALLATION_TOKEN;
    delete process.env.INSTALLATION_EXPIRE;
  });

  it("en production, aucun poste n'a de code connu", async () => {
    const postes = await db.select().from(schema.postes);
    expect(postes.length).toBe(17);
    expect(postes.every((p) => !pinDefini(p.pinHash))).toBe(true);
    // Les codes de démonstration ne fonctionnent pas.
    expect(await verifierPinHash("444444", (await poste("Propriétaire — Mamoune")).pinHash)).toBe(false);
  });

  it("le lien d'installation exige le bon jeton et une date valable", () => {
    expect(jetonInstallationValide(JETON)).toBe(true);
    expect(jetonInstallationValide("mauvais")).toBe(false);
    expect(jetonInstallationValide(undefined)).toBe(false);
    process.env.INSTALLATION_EXPIRE = "2000-01-01T00:00:00Z";
    expect(jetonInstallationValide(JETON)).toBe(false);
    delete process.env.INSTALLATION_EXPIRE;
  });

  it("le premier propriétaire choisit son code ; le lien ne sert qu'une fois", async () => {
    const mamoune = await poste("Propriétaire — Mamoune");
    expect(await terminerInstallation(JETON, mamoune.id, "123456")).toEqual({ ok: false, erreur: expect.stringMatching(/trop simple/) });
    expect(await terminerInstallation(JETON, (await poste("Manager")).id, "735194")).toEqual({ ok: false, erreur: expect.stringMatching(/propriétaire/) });
    expect(await terminerInstallation(JETON, mamoune.id, "735194")).toEqual({ ok: true });
    expect(await verifierPinHash("735194", (await poste("Propriétaire — Mamoune")).pinHash)).toBe(true);
    expect(await installationTerminee()).toBe(true);
    expect(await terminerInstallation(JETON, (await poste("Propriétaire — Taha")).id, "918273")).toEqual({ ok: false, erreur: expect.stringMatching(/déjà faite/) });
  });

  it("un associé invité choisit son propre code ; l'invitation est à usage unique", async () => {
    const mamoune = await poste("Propriétaire — Mamoune");
    const taha = await poste("Propriétaire — Taha");
    const inv = await creerInvitation({ posteId: mamoune.id, personneId: null }, "proprietaire", taha.id);
    const lue = await lireInvitation(inv.jeton);
    expect("erreur" in lue).toBe(false);
    if (!("erreur" in lue)) expect(lue.choisirPin).toBe(true);
    // Code déjà pris par un autre poste : refusé.
    expect(await utiliserInvitation(inv.jeton, "735194")).toEqual({ ok: false, erreur: expect.stringMatching(/déjà utilisé/) });
    const r = await utiliserInvitation(inv.jeton, "602815");
    expect(r.ok).toBe(true);
    expect(await verifierPinHash("602815", (await poste("Propriétaire — Taha")).pinHash)).toBe(true);
    expect(await utiliserInvitation(inv.jeton, "602815")).toEqual({ ok: false, erreur: expect.stringMatching(/déjà été utilisé/) });
  });

  it("une invitation expirée est refusée", async () => {
    const mamoune = await poste("Propriétaire — Mamoune");
    const manager = await poste("Manager");
    const inv = await creerInvitation({ posteId: mamoune.id, personneId: null }, "proprietaire", manager.id);
    await db.update(schema.invitations).set({ expireLe: new Date(Date.now() - 1000) }).where(eq(schema.invitations.posteId, manager.id));
    expect(await lireInvitation(inv.jeton)).toEqual({ erreur: expect.stringMatching(/expiré/) });
  });

  it("un employé invité est connecté sans changer le code partagé de son poste", async () => {
    const serveur = await poste("Serveur");
    const inv = await creerInvitation({ posteId: (await poste("Manager")).id, personneId: null }, "manager", serveur.id);
    const lue = await lireInvitation(inv.jeton);
    if (!("erreur" in lue)) expect(lue.choisirPin).toBe(false);
    expect((await utiliserInvitation(inv.jeton, null)).ok).toBe(true);
    expect((await poste("Serveur")).pinHash).toBe(serveur.pinHash);
  });

  it("la manager n'invite que sur les postes employés", async () => {
    expect(peutInviter("manager", "employe")).toBe(true);
    expect(peutInviter("manager", "resp_cuisine")).toBe(false);
    expect(peutInviter("manager", "proprietaire")).toBe(false);
    expect(peutInviter("proprietaire", "manager")).toBe(true);
    await expect(creerInvitation({ posteId: null, personneId: null }, "manager", (await poste("Responsable cuisine")).id)).rejects.toThrow(/ne pouvez pas/);
  });

  it("l'initialisation n'écrase rien sur une base déjà en service", async () => {
    const avant = await db.select().from(schema.postes);
    await chargerDonneesInitiales(db, () => undefined, { pinsInconnus: true });
    const apres = await db.select().from(schema.postes);
    expect(apres.length).toBe(avant.length);
    expect(await verifierPinHash("735194", (await poste("Propriétaire — Mamoune")).pinHash)).toBe(true);
  });
});
