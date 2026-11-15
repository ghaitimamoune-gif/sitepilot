import { NextResponse } from "next/server";
import { sessionCourante } from "@/lib/auth/session";
import { lirePhoto } from "@/lib/services/photos";

export const runtime = "nodejs";

/** Les photos ne sont jamais publiques : session obligatoire, réponse non mise en cache partagé. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await sessionCourante();
  if (!session) return new NextResponse("Session expirée", { status: 401 });
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n)) return new NextResponse("Introuvable", { status: 404 });
  const photo = await lirePhoto(n);
  if (!photo) return new NextResponse("Introuvable", { status: 404 });
  return new NextResponse(new Uint8Array(photo.contenu), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=3600",
      "Content-Length": String(photo.contenu.length),
    },
  });
}
