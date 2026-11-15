"use client";

import { useState } from "react";
import { actionAjouterLigne } from "@/app/actions/commandes";
import { ChampNombre } from "@/components/ui/ChampNombre";
import { Formulaire } from "@/components/ui/Formulaire";

/** Ajout manuel d'un article du catalogue à la commande de ce fournisseur. */
export function AjouterLigne({ fournisseurId, catalogue }: { fournisseurId: number; catalogue: { id: number; nom: string; unite: string }[] }) {
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState<{ id: number; nom: string; unite: string } | null>(null);
  const resultats = recherche.trim().length >= 2 && !choisi ? catalogue.filter((a) => a.nom.toLowerCase().includes(recherche.toLowerCase())).slice(0, 8) : [];
  return (
    <details className="card">
      <summary className="cursor-pointer font-medium">Ajouter un article du catalogue</summary>
      <Formulaire action={actionAjouterLigne} bouton="Ajouter à la commande" className="mt-3">
        <input type="hidden" name="fournisseurId" value={fournisseurId} />
        <input type="hidden" name="articleId" value={choisi?.id ?? ""} />
        {choisi ? (
          <div className="flex items-center justify-between rounded-xl border border-brand px-3 py-2">
            <span>{choisi.nom}</span>
            <button type="button" className="text-sm text-brand" onClick={() => { setChoisi(null); setRecherche(""); }}>
              Changer
            </button>
          </div>
        ) : (
          <input className="input" placeholder="Rechercher un article" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        )}
        {resultats.length > 0 && (
          <ul className="divide-rows rounded-xl border border-line">
            {resultats.map((a) => (
              <li key={a.id}>
                <button type="button" className="flex min-h-tap w-full items-center justify-between px-3 text-left" onClick={() => setChoisi(a)}>
                  <span>{a.nom}</span>
                  <span className="text-xs text-muted">{a.unite}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="block">
          <span className="label">Quantité (unité de commande)</span>
          <ChampNombre name="qte" placeholder="1" />
        </label>
      </Formulaire>
    </details>
  );
}
