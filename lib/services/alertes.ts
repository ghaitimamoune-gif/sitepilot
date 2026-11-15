import { and, desc, eq, isNull, isNotNull, or, sql as dsql } from "drizzle-orm";
import { db, schema, type Tx } from "@/lib/db";
import type { Role } from "@/lib/auth/droits";
import { journaliser, type Acteur } from "./journal";

export type TypeAlerte = (typeof schema.typeAlerteEnum.enumValues)[number];
export type NiveauAlerte = (typeof schema.niveauAlerteEnum.enumValues)[number];

export const LIBELLE_NIVEAU: Record<NiveauAlerte, string> = {
  critique: "Critique",
  avertissement: "Avertissement",
  a_traiter: "À traiter",
  information: "Information",
};

export const LIBELLE_TYPE: Record<TypeAlerte, string> = {
  rupture: "Rupture",
  ecart_stock: "Écart de stock",
  temperature: "Température hors plage",
  tache_structurante: "Tâche structurante non faite",
  ecart_reception: "Écart de réception",
  livraison_non_receptionnee: "Livraison non réceptionnée",
  hausse_prix: "Hausse de prix",
  cout_matiere: "Coût matière",
  commande_a_valider: "Commande à valider",
  fiche_a_verifier: "Fiche à vérifier",
  coefficient_variation: "Coefficient en forte variation",
  quantite_forcee: "Quantité forcée",
  tache_remontee: "Tâche remontée",
  import_libelle_inconnu: "Libellé de caisse inconnu",
};

export interface NouvelleAlerte {
  type: TypeAlerte;
  niveau: NiveauAlerte;
  titre: string;
  detail?: string | null;
  objetType?: string | null;
  objetId?: number | null;
  roles: Role[];
  posteId?: number | null;
  /** Évite les doublons : une alerte ouverte par clé. */
  cleUnique?: string | null;
}

export async function creerAlerte(a: NouvelleAlerte, tx?: Tx): Promise<number | null> {
  const ex = tx ?? db;
  if (a.cleUnique) {
    const [existante] = await ex
      .select({ id: schema.alertes.id, traiteeLe: schema.alertes.traiteeLe })
      .from(schema.alertes)
      .where(eq(schema.alertes.cleUnique, a.cleUnique));
    if (existante) {
      if (existante.traiteeLe === null) return existante.id;
      // Déjà traitée : on rouvre une nouvelle alerte distincte en libérant la clé de l'ancienne.
      await ex.update(schema.alertes).set({ cleUnique: `${a.cleUnique}#${existante.id}` }).where(eq(schema.alertes.id, existante.id));
    }
  }
  const [r] = await ex
    .insert(schema.alertes)
    .values({
      type: a.type,
      niveau: a.niveau,
      titre: a.titre,
      detail: a.detail ?? null,
      objetType: a.objetType ?? null,
      objetId: a.objetId ?? null,
      roles: a.roles,
      posteId: a.posteId ?? null,
      cleUnique: a.cleUnique ?? null,
    })
    .returning({ id: schema.alertes.id });
  return r?.id ?? null;
}

export interface FiltreAlertes {
  role: Role;
  posteId: number;
}

function conditionDestinataire(f: FiltreAlertes) {
  if (f.role === "proprietaire") return undefined;
  return or(
    dsql`${schema.alertes.roles} @> ARRAY[${f.role}]::text[]`,
    eq(schema.alertes.posteId, f.posteId),
  );
}

const ORDRE_NIVEAU: Record<NiveauAlerte, number> = { critique: 0, avertissement: 1, a_traiter: 2, information: 3 };

export async function alertesOuvertes(f: FiltreAlertes) {
  const cond = conditionDestinataire(f);
  const rows = await db
    .select()
    .from(schema.alertes)
    .where(cond ? and(isNull(schema.alertes.traiteeLe), cond) : isNull(schema.alertes.traiteeLe))
    .orderBy(desc(schema.alertes.creeLe))
    .limit(300);
  return rows.sort((a, b) => ORDRE_NIVEAU[a.niveau] - ORDRE_NIVEAU[b.niveau] || b.creeLe.getTime() - a.creeLe.getTime());
}

export async function compterAlertesOuvertes(f: FiltreAlertes): Promise<{ total: number; critiques: number }> {
  const rows = await alertesOuvertes(f);
  return { total: rows.length, critiques: rows.filter((r) => r.niveau === "critique").length };
}

export async function alertesTraitees(f: FiltreAlertes, limite = 100) {
  const cond = conditionDestinataire(f);
  return db
    .select()
    .from(schema.alertes)
    .where(cond ? and(isNotNull(schema.alertes.traiteeLe), cond) : isNotNull(schema.alertes.traiteeLe))
    .orderBy(desc(schema.alertes.traiteeLe))
    .limit(limite);
}

export async function traiterAlerte(acteur: Acteur, id: number, note: string | null): Promise<void> {
  const [a] = await db.select().from(schema.alertes).where(eq(schema.alertes.id, id));
  if (!a || a.traiteeLe) return;
  await db
    .update(schema.alertes)
    .set({ traiteeLe: new Date(), traiteeParPosteId: acteur.posteId, traiteeParPersonneId: acteur.personneId, note })
    .where(eq(schema.alertes.id, id));
  await journaliser(acteur, "alerte", "traiter", { entiteId: id, apres: { note } });
}

/** Clôt les alertes ouvertes portant une clé (par exemple à la levée d'une rupture). */
export async function cloreAlertesParCle(cle: string, note: string, tx?: Tx): Promise<void> {
  const ex = tx ?? db;
  await ex
    .update(schema.alertes)
    .set({ traiteeLe: new Date(), note })
    .where(and(eq(schema.alertes.cleUnique, cle), isNull(schema.alertes.traiteeLe)));
}
