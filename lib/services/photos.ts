import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, isNull, lte, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ajouterJours, dateLocale } from "@/lib/dates";
import { chargerParametres, nombreDepuis } from "./parametres";
import type { Acteur } from "./journal";

/**
 * Stockage privé des photos. Jamais d'URL publique : les fichiers sont servis par
 * /api/photos/[id] après vérification de la session.
 *
 * Deux pilotes :
 *  - Supabase Storage (bucket privé) si SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définis,
 *    obligatoire sur un hébergement sans disque persistant (Vercel) ;
 *  - sinon le disque local (DATA_DIR/photos), pour un serveur classique ou le développement.
 */
function dossierData(): string {
  return path.resolve(process.env.DATA_DIR ?? "./data");
}

function supabase(): { url: string; cle: string; bucket: string } | null {
  const url = process.env.SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return null;
  return { url: url.replace(/\/$/, ""), cle, bucket: process.env.SUPABASE_BUCKET ?? "photos" };
}

async function ecrireFichier(chemin: string, contenu: Buffer, mime: string): Promise<void> {
  const s = supabase();
  if (s) {
    let derniere: unknown = null;
    for (let essai = 0; essai < 3; essai++) {
      try {
        const r = await fetch(`${s.url}/storage/v1/object/${s.bucket}/${chemin}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${s.cle}`, apikey: s.cle, "Content-Type": mime, "x-upsert": "true" },
          body: new Uint8Array(contenu),
        });
        if (r.ok) return;
        derniere = new Error(`Stockage : ${r.status} ${await r.text()}`);
      } catch (e) {
        derniere = e;
      }
    }
    throw derniere instanceof Error ? derniere : new Error("Stockage indisponible");
  }
  const complet = path.join(dossierData(), chemin);
  await mkdir(path.dirname(complet), { recursive: true });
  await writeFile(complet, contenu);
}

async function lireFichier(chemin: string): Promise<Buffer | null> {
  const s = supabase();
  if (s) {
    const r = await fetch(`${s.url}/storage/v1/object/authenticated/${s.bucket}/${chemin}`, {
      headers: { Authorization: `Bearer ${s.cle}`, apikey: s.cle },
    });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  }
  try {
    return await readFile(path.join(dossierData(), chemin));
  } catch {
    return null;
  }
}

async function supprimerFichier(chemin: string): Promise<void> {
  const s = supabase();
  if (s) {
    await fetch(`${s.url}/storage/v1/object/${s.bucket}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${s.cle}`, apikey: s.cle, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [chemin] }),
    }).catch(() => undefined);
    return;
  }
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
  try {
    await ecrireFichier(chemin, contenu, options.mime ?? "image/jpeg");
  } catch (e) {
    // Un envoi échoué ne doit pas compter comme preuve : la ligne est marquée supprimée.
    await db.update(schema.photos).set({ supprimeeLe: new Date() }).where(eq(schema.photos.id, row.id));
    throw e;
  }
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
    .where(and(eq(schema.photos.objetType, objetType), inArray(schema.photos.objetId, objetIds), isNull(schema.photos.supprimeeLe), ne(schema.photos.chemin, "")));
  for (const r of rows) m.set(r.objetId, (m.get(r.objetId) ?? 0) + 1);
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
