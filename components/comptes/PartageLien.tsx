"use client";

import { useState, useTransition } from "react";
import type { LienPartage } from "@/app/actions/invitations";

/**
 * Bouton qui crée un lien (invitation ou enrôlement) et l'affiche avec son QR code,
 * prêt à être scanné sur place ou envoyé par WhatsApp.
 */
export function PartageLien({
  creer,
  libelle,
  className = "btn-ghost btn-sm",
}: {
  creer: () => Promise<LienPartage | { ok: false; erreur: string }>;
  libelle: string;
  className?: string;
}) {
  const [resultat, setResultat] = useState<LienPartage | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErreur(null);
            const r = await creer();
            if (r.ok) setResultat(r);
            else setErreur(r.erreur);
          })
        }
      >
        {pending ? "…" : libelle}
      </button>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {resultat && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-card p-4 shadow-xl">
            <h2 className="text-lg">{resultat.titre}</h2>
            <p className="mb-3 text-xs text-muted">{resultat.detail}</p>
            <div className="mx-auto mb-3 w-56 rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: resultat.qr }} />
            <p className="mb-3 text-center text-xs text-muted">À scanner avec l&apos;appareil photo du téléphone, ou à envoyer :</p>
            <div className="flex flex-col gap-2">
              <a href={resultat.whatsapp} target="_blank" rel="noopener noreferrer" className="btn-brand w-full">
                Envoyer par WhatsApp
              </a>
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(resultat.lien);
                    setCopie(true);
                  } catch {
                    window.prompt("Copiez le lien :", resultat.lien);
                  }
                }}
              >
                {copie ? "Lien copié" : "Copier le lien"}
              </button>
              <button type="button" className="btn-ghost w-full" onClick={() => { setResultat(null); setCopie(false); }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
