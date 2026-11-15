import { redirect } from "next/navigation";
import { accueilParRole } from "@/lib/auth/droits";
import { exigerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Racine() {
  const s = await exigerSession();
  redirect(accueilParRole(s.poste.role));
}
