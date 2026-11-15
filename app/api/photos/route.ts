import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { aLeDroit } from "@/lib/auth/droits";
import { acteur, sessionCourante } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { enregistrerPhoto, type ObjetPhoto } from "@/lib/services/photos";
import { chargerParametres, nombreDepuis } from "@/lib/services/parametres";

export const runtime = "nodejs";

const OBJETS: ObjetPhoto[] = ["tache", "reception", "perte", "facture"];

/** Dépôt d'une photo (multipart). Les droits sont vérifiés selon l'objet lié. */
export async function POST(req: Request) {
  const session = await sessionCourante();
  if (!session) return new NextResponse("Session expirée", { status: 401 });
  const fd = await req.formData();
  const objetType = String(fd.get("objetType") ?? "") as ObjetPhoto;
  const objetId = Number(fd.get("objetId"));
  const fichier = fd.get("fichier");
  if (!OBJETS.includes(objetType) || !Number.isInteger(objetId) || !(fichier instanceof Blob)) {
    return new NextResponse("Requête invalide", { status: 400 });
  }
  if (fichier.size > 8 * 1024 * 1024) return new NextResponse("Photo trop lourde", { status: 413 });
  const p = await chargerParametres();
  let retentionMois = nombreDepuis(p, "retention_photos_mois");
  if (objetType === "tache") {
    const [t] = await db.select().from(schema.taches).where(eq(schema.taches.id, objetId));
    if (!t) return new NextResponse("Tâche introuvable", { status: 404 });
    if (t.posteId !== session.poste.id && !aLeDroit(session.poste.role, "taches:verifier") && session.poste.role !== "proprietaire") {
      return new NextResponse("Accès refusé", { status: 403 });
    }
    if (t.preuve === "valeurs") retentionMois = nombreDepuis(p, "retention_temperatures_mois");
    const nb = await db.select({ id: schema.photos.id }).from(schema.photos).where(eq(schema.photos.objetId, objetId));
    if (nb.filter(Boolean).length >= nombreDepuis(p, "photos_max")) return new NextResponse("Nombre maximum de photos atteint", { status: 409 });
  } else if (objetType === "reception" || objetType === "facture") {
    if (!aLeDroit(session.poste.role, "receptions:ecrire") && !aLeDroit(session.poste.role, "prix:ecrire")) {
      return new NextResponse("Accès refusé", { status: 403 });
    }
    retentionMois = Math.max(retentionMois, 12);
  } else if (objetType === "perte") {
    if (!aLeDroit(session.poste.role, "pertes:declarer")) return new NextResponse("Accès refusé", { status: 403 });
  }
  const contenu = Buffer.from(await fichier.arrayBuffer());
  const { id } = await enregistrerPhoto(acteur(session), objetType, objetId, contenu, { mime: fichier.type || "image/jpeg", retentionMois });
  return NextResponse.json({ id });
}
