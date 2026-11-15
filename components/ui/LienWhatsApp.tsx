"use client";

import { useState } from "react";

/**
 * Ouvre WhatsApp sur la conversation, message pré-rempli (wa.me). Aucun pilotage de WhatsApp :
 * la personne appuie elle-même sur envoyer, puis confirme dans l'application.
 */
export function LienWhatsApp({
  url,
  texte,
  libelle = "Envoyer sur WhatsApp",
  className = "btn-brand w-full",
  onOuvert,
}: {
  url: string | null;
  texte: string;
  libelle?: string;
  className?: string;
  onOuvert?: () => void;
}) {
  const [copie, setCopie] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className={className} onClick={() => onOuvert?.()}>
          {libelle}
        </a>
      ) : (
        <p className="text-sm text-amber-700">Numéro WhatsApp manquant sur la fiche fournisseur : copiez le message.</p>
      )}
      <button
        type="button"
        className="btn-ghost w-full"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texte);
            setCopie(true);
            setTimeout(() => setCopie(false), 2000);
          } catch {
            window.prompt("Copiez le message :", texte);
          }
        }}
      >
        {copie ? "Message copié" : "Copier le message"}
      </button>
    </div>
  );
}
