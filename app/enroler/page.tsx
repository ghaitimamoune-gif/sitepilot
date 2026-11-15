import { redirect } from "next/navigation";
import { actionEnroler } from "@/app/actions/auth";
import { Formulaire } from "@/components/ui/Formulaire";
import { Champ } from "@/components/ui/primitives";
import { appareilCourant } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PageEnroler() {
  const appareil = await appareilCourant();
  if (appareil) redirect("/connexion");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-3xl font-bold text-white display">EB</div>
        <h1>Easy Burger Ops</h1>
        <p className="mt-2 text-sm text-muted">Ce téléphone n&apos;est pas encore enrôlé. Saisissez le code d&apos;enrôlement donné par la manager.</p>
      </div>
      <Formulaire action={actionEnroler} bouton="Enrôler ce téléphone" className="card">
        <Champ label="Code d'enrôlement">
          <input name="code" className="input text-center text-lg uppercase tracking-widest" autoComplete="off" autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX" required />
        </Champ>
        <Champ label="Nom de l'appareil (facultatif)" aide="Par exemple « Téléphone de Youssef »">
          <input name="libelle" className="input" autoComplete="off" />
        </Champ>
      </Formulaire>
      <p className="text-center text-xs text-muted">Sans enrôlement, l&apos;écran du code PIN ne s&apos;affiche pas.</p>
    </main>
  );
}
