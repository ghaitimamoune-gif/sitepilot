import { redirect } from "next/navigation";
import { droitComptageFamille } from "@/app/actions/comptages";
import { acteur, exigerSession } from "@/lib/auth/session";
import { ouvrirComptage } from "@/lib/services/comptages";

/** À l'échéance, le comptage s'ouvre (ou se reprend) et l'on arrive sur l'écran de saisie. */
export default async function PageOuvrirComptage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fermeture?: string }> }) {
  const s = await exigerSession();
  const { id } = await params;
  const { fermeture } = await searchParams;
  const familleId = Number(id);
  if (!Number.isInteger(familleId)) redirect("/comptages");
  if (!(await droitComptageFamille(s, familleId))) redirect("/refuse?droit=comptage");
  const c = await ouvrirComptage(acteur(s), familleId, fermeture === "1");
  redirect(`/comptages/${c.id}`);
}
