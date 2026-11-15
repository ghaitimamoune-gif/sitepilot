import { redirect } from "next/navigation";
import { ChoixPrenom } from "@/components/ChoixPrenom";
import { LIBELLE_ROLE } from "@/lib/auth/droits";
import { posteApresPin, prenomsDuPoste } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PagePrenom() {
  const poste = await posteApresPin();
  if (!poste) redirect("/connexion");
  const prenoms = await prenomsDuPoste(poste.id);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">{LIBELLE_ROLE[poste.role]}</p>
        <h1>{poste.nom}</h1>
        <p className="mt-2 text-sm text-muted">Qui êtes-vous ? Chaque action enregistrée portera votre prénom.</p>
      </div>
      <div className="card">
        <ChoixPrenom prenoms={prenoms} />
      </div>
      <a href="/connexion" className="lien justify-center text-sm text-muted underline">
        Ce n&apos;est pas mon poste
      </a>
    </main>
  );
}
