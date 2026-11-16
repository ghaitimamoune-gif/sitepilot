import { NextResponse } from "next/server";
import { FUSEAU, heureLocale, journeeExploitation } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** État du serveur (sans donnée sensible) : version de Node, table des fuseaux, heure locale. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    node: process.versions.node,
    tz: process.versions.tz ?? null,
    fuseau: FUSEAU,
    heureLocale: heureLocale(),
    journee: journeeExploitation(),
  });
}
