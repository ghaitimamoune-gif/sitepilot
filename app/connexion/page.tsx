import { redirect } from "next/navigation";
import { ClavierPin } from "@/components/ClavierPin";
import { accueilParRole } from "@/lib/auth/droits";
import { appareilCourant, sessionCourante, verrouillage } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PageConnexion() {
  const appareil = await appareilCourant();
  if (!appareil) redirect("/enroler");
  const session = await sessionCourante();
  if (session) redirect(accueilParRole(session.poste.role));
  const v = await verrouillage(appareil.id);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl font-bold text-white display">EB</div>
        <h1>Code PIN</h1>
        <p className="mt-1 text-sm text-muted">Le code désigne votre poste.</p>
      </div>
      {v.verrouille ? (
        <p role="alert" className="card text-center text-sm text-red-700">
          Trop de codes erronés. Ce poste est bloqué sur cet appareil jusqu&apos;à {v.jusqua?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" })}.
        </p>
      ) : (
        <ClavierPin />
      )}
    </main>
  );
}
