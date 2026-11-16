"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { actionSignalerProbleme } from "@/app/actions/retours";

/**
 * Bouton de recette (mode test uniquement) : on décrit ce qui ne va pas sur l'écran courant ;
 * la remarque est enregistrée avec l'écran, le poste et le prénom.
 */
export function SignalerProbleme() {
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOuvert(true);
          setMessage(null);
        }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-lg"
        aria-label="Signaler un problème sur cet écran"
        title="Signaler un problème"
      >
        💬
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-card p-4 shadow-xl">
            <h2 className="text-lg">Signaler un problème</h2>
            <p className="mb-2 text-xs text-muted">Écran : {pathname}. Décrivez ce qui ne va pas, ce que vous attendiez, ou une idée d&apos;amélioration.</p>
            {message ? (
              <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">{message}</p>
            ) : (
              <textarea className="input mb-3" rows={5} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Par exemple : le bouton est trop petit, la quantité de sauce me paraît fausse…" autoFocus />
            )}
            <div className="flex gap-2">
              {!message && (
                <button
                  type="button"
                  className="btn-brand flex-1"
                  disabled={pending || texte.trim().length < 3}
                  onClick={() =>
                    start(async () => {
                      const r = await actionSignalerProbleme(pathname, texte);
                      if (r && r.ok) {
                        setMessage(r.message ?? "Merci, c'est noté.");
                        setTexte("");
                      } else if (r && !r.ok) setMessage(r.erreur);
                    })
                  }
                >
                  {pending ? "…" : "Envoyer"}
                </button>
              )}
              <button type="button" className="btn-ghost flex-1" onClick={() => setOuvert(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
