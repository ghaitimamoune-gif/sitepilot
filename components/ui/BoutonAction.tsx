"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

export type ResultatAction = { ok: true; message?: string; redirection?: string } | { ok: false; erreur: string };

/**
 * Bouton qui déclenche une action serveur : état d'attente, confirmation facultative,
 * message d'erreur affiché sous le bouton, rafraîchissement de la page ensuite.
 */
export function BoutonAction({
  action,
  children,
  className = "btn-brand",
  confirmer,
  disabled,
  apres,
}: {
  action: () => Promise<ResultatAction | void>;
  children: ReactNode;
  className?: string;
  confirmer?: string;
  disabled?: boolean;
  apres?: (r: ResultatAction | void) => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className={clsx(className, pending && "pulse")}
        disabled={disabled || pending}
        onClick={() => {
          if (confirmer && !window.confirm(confirmer)) return;
          setErreur(null);
          setMessage(null);
          start(async () => {
            try {
              const r = await action();
              if (r && !r.ok) {
                setErreur(r.erreur);
                return;
              }
              if (r && r.ok && r.message) setMessage(r.message);
              apres?.(r);
              if (r && r.ok && r.redirection) router.push(r.redirection);
              else router.refresh();
            } catch (e) {
              setErreur(e instanceof Error ? e.message : "Erreur inattendue.");
            }
          });
        }}
      >
        {pending ? "…" : children}
      </button>
      {erreur && (
        <p role="alert" className="text-sm text-red-600">
          {erreur}
        </p>
      )}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </div>
  );
}
