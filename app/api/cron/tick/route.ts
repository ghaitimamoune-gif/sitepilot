import { NextResponse } from "next/server";
import { tick } from "@/lib/services/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Point d'appel pour un planificateur externe (Vercel Cron, cron système) :
 * GET /api/cron/tick avec l'en-tête Authorization: Bearer <CRON_SECRET>.
 * L'application exécute aussi ce traitement à chaque chargement de page, au plus une fois par minute.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const fourni = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("secret");
  if (secret) {
    if (fourni !== secret) return new NextResponse("Non autorisé", { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return new NextResponse("CRON_SECRET non configuré", { status: 503 });
  }
  const r = await tick(new Date(), true);
  return NextResponse.json(r);
}
