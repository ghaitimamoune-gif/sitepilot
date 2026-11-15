"use client";

import { useState } from "react";
import { actionAnnulerTache, actionVerifierTache } from "@/app/actions/taches";
import { BoutonAction } from "@/components/ui/BoutonAction";

/** Côté responsable : valider une tâche faite, ou la renvoyer « à refaire » avec un commentaire. */
export function VerifierTache({ tacheId, statut, peutVerifier, peutAnnuler }: { tacheId: number; statut: string; peutVerifier: boolean; peutAnnuler: boolean }) {
  const [renvoi, setRenvoi] = useState(false);
  const [commentaire, setCommentaire] = useState("");
  return (
    <div className="card flex flex-col gap-2">
      {peutVerifier && statut === "faite" && (
        <>
          <h2 className="text-base">Vérification</h2>
          <BoutonAction className="btn-brand w-full" action={() => actionVerifierTache(tacheId, true, null)}>
            Valider
          </BoutonAction>
          {!renvoi ? (
            <button type="button" className="btn-ghost w-full" onClick={() => setRenvoi(true)}>
              Renvoyer à refaire…
            </button>
          ) : (
            <>
              <textarea className="input" rows={2} placeholder="Ce qui doit être refait" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
              <BoutonAction className="btn-danger w-full" action={() => actionVerifierTache(tacheId, false, commentaire)} disabled={commentaire.trim().length < 2} apres={() => setRenvoi(false)}>
                Renvoyer à refaire
              </BoutonAction>
            </>
          )}
        </>
      )}
      {peutVerifier && statut !== "faite" && <p className="text-sm text-muted">La vérification se fait quand la tâche est marquée faite.</p>}
      {peutAnnuler && !["verifiee", "annulee"].includes(statut) && (
        <BoutonAction className="btn-ghost w-full text-red-700" action={() => actionAnnulerTache(tacheId)} confirmer="Annuler cette tâche ponctuelle ?">
          Annuler la tâche
        </BoutonAction>
      )}
    </div>
  );
}
