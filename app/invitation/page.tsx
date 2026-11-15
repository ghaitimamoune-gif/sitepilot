import Link from "next/link";
import { actionUtiliserInvitation } from "@/app/actions/invitations";
import { ChampsCode } from "@/components/comptes/ChampsCode";
import { Formulaire } from "@/components/ui/Formulaire";
import { Champ, Message } from "@/components/ui/primitives";
import { LIBELLE_ROLE } from "@/lib/auth/droits";
import { lireInvitation } from "@/lib/services/invitations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitation" };

/** Lien d'invitation personnel : enregistre le téléphone et ouvre la session sur le poste. */
export default async function PageInvitation({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  const inv = await lireInvitation(jeton);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="text-center">
        <div className="display mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-3xl font-bold text-white">EB</div>
        <h1>Bienvenue</h1>
        {"erreur" in inv ? null : (
          <p className="mt-2 text-sm text-muted">
            Vous êtes invité sur le poste <strong className="text-ink">{inv.poste.nom}</strong> ({LIBELLE_ROLE[inv.poste.role]}).
          </p>
        )}
      </div>
      {"erreur" in inv ? (
        <>
          <Message type="erreur">{inv.erreur}</Message>
          <Link href="/connexion" className="btn-ghost w-full">
            J&apos;ai déjà un code
          </Link>
        </>
      ) : (
        <Formulaire action={actionUtiliserInvitation} bouton="Entrer" className="card">
          <input type="hidden" name="jeton" value={jeton} />
          <Champ label="Votre prénom" aide="Chaque action enregistrée portera votre prénom.">
            <input name="prenom" className="input" required minLength={2} maxLength={30} autoComplete="given-name" autoCapitalize="words" autoFocus />
          </Champ>
          {inv.choisirPin ? (
            <ChampsCode longueur={inv.poste.role === "proprietaire" ? 6 : 4} />
          ) : (
            <p className="text-xs text-muted">
              Ce téléphone sera enregistré et vous serez connecté. Pour vous reconnecter plus tard, demandez le code de votre poste à la manager.
            </p>
          )}
        </Formulaire>
      )}
    </main>
  );
}
