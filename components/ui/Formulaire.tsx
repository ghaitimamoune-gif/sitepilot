"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, type ReactNode } from "react";
import type { ResultatAction } from "./BoutonAction";

export type ActionFormulaire = (etat: ResultatAction | null, data: FormData) => Promise<ResultatAction>;

/**
 * Formulaire branché sur une action serveur. Affiche l'erreur renvoyée, puis rafraîchit
 * la page (ou redirige) en cas de succès.
 */
export function Formulaire({
  action,
  children,
  className,
  bouton = "Enregistrer",
  boutonClasse = "btn-brand w-full",
  onSucces,
}: {
  action: ActionFormulaire;
  children: ReactNode;
  className?: string;
  bouton?: ReactNode;
  boutonClasse?: string;
  onSucces?: () => void;
}) {
  const [etat, soumettre, pending] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => {
    if (etat?.ok) {
      onSucces?.();
      if (etat.redirection) router.push(etat.redirection);
      else router.refresh();
    }
  }, [etat, router, onSucces]);
  return (
    <form action={soumettre} className={clsx("flex flex-col gap-3", className)}>
      {children}
      {etat && !etat.ok && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          {etat.erreur}
        </p>
      )}
      {etat?.ok && etat.message && <p className="text-sm text-emerald-700">{etat.message}</p>}
      <button type="submit" className={clsx(boutonClasse, pending && "pulse")} disabled={pending}>
        {pending ? "…" : bouton}
      </button>
    </form>
  );
}
