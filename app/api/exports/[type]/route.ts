import { NextResponse } from "next/server";
import { aLeDroit } from "@/lib/auth/droits";
import { sessionCourante } from "@/lib/auth/session";
import { ajouterJours, journeeExploitation } from "@/lib/dates";
import { exportCommandes, exportPrix, exportReceptions, exportStocks, exportTaches, exportTemperatures } from "@/lib/services/exports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Export CSV des données par les propriétaires : stocks, commandes, réceptions, prix, tâches, températures. */
export async function GET(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const session = await sessionCourante();
  if (!session) return new NextResponse("Session expirée", { status: 401 });
  const { type } = await ctx.params;
  const url = new URL(req.url);
  const journee = journeeExploitation();
  const debut = url.searchParams.get("debut") ?? ajouterJours(journee, -30);
  const fin = url.searchParams.get("fin") ?? journee;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(debut) || !/^\d{4}-\d{2}-\d{2}$/.test(fin)) return new NextResponse("Dates invalides", { status: 400 });
  // Le relevé des températures est aussi accessible à la manager (activité) ; le reste aux propriétaires.
  const droit = type === "temperatures" ? aLeDroit(session.poste.role, "activite:lire") : aLeDroit(session.poste.role, "export:donnees");
  if (!droit) return new NextResponse("Accès refusé", { status: 403 });
  let csv: string;
  switch (type) {
    case "stocks":
      csv = await exportStocks();
      break;
    case "commandes":
      csv = await exportCommandes(debut, fin);
      break;
    case "receptions":
      csv = await exportReceptions(debut, fin);
      break;
    case "prix":
      csv = await exportPrix();
      break;
    case "taches":
      csv = await exportTaches(debut, fin);
      break;
    case "temperatures":
      csv = await exportTemperatures(debut, fin);
      break;
    default:
      return new NextResponse("Export inconnu", { status: 404 });
  }
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="easy-burger-${type}-${debut}-${fin}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
