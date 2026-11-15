import Link from "next/link";
import { actionInstallation } from "@/app/actions/invitations";
import { ChampsCode } from "@/components/comptes/ChampsCode";
import { Formulaire } from "@/components/ui/Formulaire";
import { Champ, Message } from "@/components/ui/primitives";
import { installationTerminee, jetonInstallationValide, postesProprietaires } from "@/lib/services/invitations";

export const dynamic = "force-dynamic";
export const metadata = { title: "Installation" };

/**
 * Inscription du premier propriétaire par le lien d'installation à usage unique.
 * Aucun identifiant par défaut : il choisit lui-même son code ; le lien ne sert plus ensuite.
 */
export default async function PageInstallation({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  const terminee = await installationTerminee();
  const valide = jetonInstallationValide(jeton);
  const proprietaires = terminee || !valide ? [] : await postesProprietaires();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="text-center">
        <div className="display mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-3xl font-bold text-white">EB</div>
        <h1>Installation</h1>
        <p className="mt-2 text-sm text-muted">Easy Burger Ops — inscription du premier propriétaire.</p>
      </div>
      {terminee ? (
        <>
          <Message type="info">L&apos;installation est déjà faite : ce lien ne sert plus. Connectez-vous avec votre code, ou demandez une invitation à un associé.</Message>
          <Link href="/connexion" className="btn-brand w-full">
            Se connecter
          </Link>
        </>
      ) : !valide ? (
        <Message type="erreur">Lien d&apos;installation non valable ou expiré.</Message>
      ) : (
        <Formulaire action={actionInstallation} bouton="Terminer l'installation" className="card">
          <input type="hidden" name="jeton" value={jeton} />
          <Champ label="Votre compte">
            <select name="posteId" className="input" required defaultValue={proprietaires[proprietaires.length - 1]?.id}>
              {proprietaires.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </Champ>
          <Champ label="Votre prénom">
            <input name="prenom" className="input" required minLength={2} maxLength={30} autoComplete="given-name" autoCapitalize="words" />
          </Champ>
          <ChampsCode longueur={6} />
          <p className="text-xs text-muted">Ce téléphone sera enregistré et vous serez connecté. Vous inviterez ensuite vos associés, la manager et les responsables depuis l&apos;écran « Mise en service ».</p>
        </Formulaire>
      )}
    </main>
  );
}
