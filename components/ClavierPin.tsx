"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { actionVerifierPin } from "@/app/actions/auth";

const TOUCHES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

/** Clavier numérique une main : 4 chiffres pour les postes, 6 pour les propriétaires. Le code désigne le poste. */
export function ClavierPin() {
  const [pin, setPin] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const envoyer = (code: string) => {
    setErreur(null);
    start(async () => {
      const r = await actionVerifierPin(code);
      if (!r.ok) {
        setErreur(r.erreur);
        setPin("");
        if (navigator.vibrate) navigator.vibrate(80);
        return;
      }
      router.push(r.redirection ?? "/connexion/prenom");
    });
  };

  // 4 chiffres : on tente aussitôt ; si ce n'est pas un poste, l'utilisateur peut continuer jusqu'à 6.
  useEffect(() => {
    if (pin.length === 6) envoyer(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const appuyer = (t: string) => {
    if (pending) return;
    if (t === "⌫") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (!t) return;
    setPin((p) => (p.length >= 6 ? p : p + t));
  };

  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-5">
      <div className="flex gap-3" aria-label="Code PIN" aria-live="polite">
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? "border-brand bg-brand" : "border-line"} ${pending ? "pulse" : ""}`} />
        ))}
      </div>
      {erreur && (
        <p role="alert" className="text-center text-sm text-red-600">
          {erreur}
        </p>
      )}
      <div className="grid w-full grid-cols-3 gap-3">
        {TOUCHES.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => appuyer(t)}
            disabled={pending || !t}
            className={`display h-16 rounded-2xl text-3xl font-semibold ${t ? "border border-line bg-card active:bg-brand active:text-white" : "invisible"}`}
            aria-label={t === "⌫" ? "Effacer" : t}
          >
            {t}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn-brand w-full"
        disabled={pending || pin.length !== 4}
        onClick={() => envoyer(pin)}
      >
        {pending ? "Vérification…" : "Entrer"}
      </button>
      <p className="text-center text-xs text-muted">4 chiffres pour un poste, 6 chiffres pour un propriétaire.</p>
    </div>
  );
}
