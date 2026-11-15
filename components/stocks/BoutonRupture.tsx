"use client";

import { useState } from "react";
import { actionSignalerRupture } from "@/app/actions/stocks";
import { BoutonAction } from "@/components/ui/BoutonAction";

/** Bouton « Signaler une rupture » : l'article passe en rupture, alerte et ligne prioritaire ; structurant → tâche « Appeler les propriétaires ». */
export function BoutonRupture({ articleId, structurant, compact = false }: { articleId: number; structurant: boolean; compact?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [commentaire, setCommentaire] = useState("");
  if (!ouvert) {
    return (
      <button type="button" className={compact ? "text-sm font-semibold text-red-700" : "btn-danger w-full"} onClick={() => setOuvert(true)}>
        Signaler une rupture
      </button>
    );
  }
  return (
    <div className="card flex flex-col gap-2 border-red-300">
      <p className="text-sm">
        Confirmer la rupture ? {structurant && <strong>Article structurant : la tâche « Appeler les propriétaires » sera ajoutée à votre liste.</strong>}
      </p>
      <input className="input" placeholder="Commentaire (facultatif)" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
      <div className="flex gap-2">
        <BoutonAction className="btn-danger flex-1" action={() => actionSignalerRupture(articleId, commentaire)} apres={() => setOuvert(false)}>
          Confirmer la rupture
        </BoutonAction>
        <button type="button" className="btn-ghost" onClick={() => setOuvert(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}
