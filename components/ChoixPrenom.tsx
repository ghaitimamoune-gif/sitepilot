"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actionChoisirPrenom } from "@/app/actions/auth";

/** Première fois : on tape son prénom. Les fois suivantes, les prénoms déjà utilisés sur ce poste, en un appui. */
export function ChoixPrenom({ prenoms }: { prenoms: { id: number; prenom: string }[] }) {
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const choisir = (prenom: string) => {
    setErreur(null);
    start(async () => {
      const r = await actionChoisirPrenom(prenom);
      if (!r.ok) {
        setErreur(r.erreur);
        return;
      }
      router.push(r.redirection ?? "/");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {prenoms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {prenoms.map((p) => (
            <button key={p.id} type="button" disabled={pending} onClick={() => choisir(p.prenom)} className="btn-ghost display text-xl">
              {p.prenom}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (saisie.trim()) choisir(saisie);
        }}
      >
        <input
          className="input flex-1"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder={prenoms.length > 0 ? "Autre prénom" : "Votre prénom"}
          autoComplete="given-name"
          autoCapitalize="words"
          maxLength={30}
          autoFocus={prenoms.length === 0}
        />
        <button type="submit" className="btn-brand" disabled={pending || saisie.trim().length < 2}>
          {pending ? "…" : "Entrer"}
        </button>
      </form>
      {erreur && (
        <p role="alert" className="text-sm text-red-600">
          {erreur}
        </p>
      )}
    </div>
  );
}
