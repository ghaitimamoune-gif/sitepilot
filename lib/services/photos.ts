import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ajouterJours, dateLocale } from "@/lib/dates";
import { chargerParametres, nombreDepuis } from "./parametres";
import type { Acteur } from "./journal";

/**
 * Stockage privé des photos. Jamais d'URL publique : les fichiers sont servis par
 * /api/photos/[id] après vérification de la session.
 *
 * Par défaut sur disque (DATA_DIR/photos). Pour un hébergement sans disque persistant,
 * remplacer `ecrireFichier` et `lireFichier` par un stockage objet (voir DEPLOIEMENT.md).
 */
function dossierData(): string {
  return path.resolve(process.env.DATA_DIR ?? "./data");
}

async function ecrireFichier(chemin: string, contenu: Buffer): Promise<void> {
  const complet = path.join(dossierData(), chemin);
  await mkdir(path.dirname(complet), { recursive: true });
  await writeFile(complet, contenu);
}

async function lireFichier(chemin: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(dossierData(), chemin));
  } catch {
    return null;
  }
}

async function supprimerFichier(chemin: string): Promise<void> {
  try {
    await unlink(path.join(dossierData(), chemin));
  } catch {
    /* déjà absent */
  }
}

export type ObjetPhoto = "tache" | "reception" | "perte" | "facture";

export async function enregistrerPhoto(
  acteur: Acteur,
  objetType: ObjetPhoto,
  objetId: number,
  contenu: Buffer,
  options: { mime?: string; retentionMois?: number } = {},
): Promise<{ id: number }> {
  const p = await chargerParametres();
  const mois = options.retentionMois ?? nombreDepuis(p, "retention_photos_mois");
  const aujourdHui = dateLocale();
  const [y, m] = aujourdHui.split("-");
  const [row] = await db
    .insert(schema.photos)
    .values({
      objetType,
      objetId,
      chemin: "",
      mime: options.mime ?? "image/jpeg",
      taille: contenu.length,
      posteId: acteur.posteId,
      personneId: acteur.personneId,
      conserverJusquau: ajouterJours(aujourdHui, Math.round(mois * 30.44)),
    })
    .returning({ id: schema.photos.id });
  const chemin = path.posix.join("photos", y, m, `${row.id}.jpg`);
  await ecrireFichier(chemin, contenu);
  await db.update(schema.photos).set({ chemin }).where(eq(schema.photos.id, row.id));
  return { id: row.id };
}

export async function lirePhoto(id: number): Promise<{ contenu: Buffer; mime: string } | null> {
  const [row] = await db.select().from(schema.photos).where(and(eq(schema.photos.id, id), isNull(schema.photos.supprimeeLe)));
  if (!row || !row.chemin) return null;
  const contenu = await lireFichier(row.chemin);
  if (!contenu) return null;
  return { contenu, mime: row.mime };
}

export async function photosDe(objetType: ObjetPhoto, objetId: number) {
  return db
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.objetType, objetType), eq(schema.photos.objetId, objetId), isNull(schema.photos.supprimeeLe)))
    .orderBy(schema.photos.priseLe);
}

export async function compterPhotos(objetType: ObjetPhoto, objetIds: number[]): Promise<Map<number, number>> {
  const m = new Map<number, number>();
  if (objetIds.length === 0) return m;
  const rows = await db
    .select({ objetId: schema.photos.objetId })
    .from(schema.photos)
    .where(and(eq(schema.photos.objetType, objetType), isNull(schema.photos.supprimeeLe)));
  for (const r of rows) if (objetIds.includes(r.objetId)) m.set(r.objetId, (m.get(r.objetId) ?? 0) + 1);
  return m;
}

/** Purge des photos dont la durée de conservation est dépassée. La ligne reste, le fichier part. */
export async function purgerPhotosExpirees(): Promise<number> {
  const rows = await db
    .select()
    .from(schema.photos)
    .where(and(isNull(schema.photos.supprimeeLe), lte(schema.photos.conserverJusquau, dateLocale())));
  for (const r of rows) {
    await supprimerFichier(r.chemin);
    await db.update(schema.photos).set({ supprimeeLe: new Date() }).where(eq(schema.photos.id, r.id));
  }
  return rows.length;
}
