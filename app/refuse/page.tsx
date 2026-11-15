import Link from "next/link";
import { accueilParRole, interdictionsAbsolues } from "@/lib/auth/droits";
import { sessionCourante } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PageRefuse({ searchParams }: { searchParams: Promise<{ droit?: string }> }) {
  const session = await sessionCourante();
  const { droit } = await searchParams;
  const regles = session ? interdictionsAbsolues(session.poste.role) : [];
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8">
      <h1>Accès refusé</h1>
      <p className="text-muted">Votre poste n&apos;a pas accès à cet écran{droit ? ` (${droit.replace(":", " : ")})` : ""}.</p>
      {regles.map((r) => (
        <p key={r} className="card text-sm">
          {r}
        </p>
      ))}
      <Link href={session ? accueilParRole(session.poste.role) : "/connexion"} className="btn-brand">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
