"use client";

import { useState } from "react";
import { ChampNombre } from "@/components/ui/ChampNombre";
import { Formulaire, type ActionFormulaire } from "@/components/ui/Formulaire";
import { Champ } from "@/components/ui/primitives";

export function FormulairePerte({ action, articles, motifs }: { action: ActionFormulaire; articles: { id: number; nom: string; unite: string }[]; motifs: [string, string][] }) {
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState<{ id: number; nom: string; unite: string } | null>(null);
  const resultats = recherche.trim().length >= 2 && !choisi ? articles.filter((a) => a.nom.toLowerCase().includes(recherche.toLowerCase())).slice(0, 8) : [];
  return (
    <Formulaire action={action} bouton="Déclarer la perte" className="card">
      <Champ label="Article ou préparation">
        {choisi ? (
          <div className="flex items-center justify-between rounded-xl border border-brand bg-brand/5 px-3 py-2">
            <span className="font-medium">{choisi.nom}</span>
            <button type="button" className="text-sm text-brand" onClick={() => { setChoisi(null); setRecherche(""); }}>
              Changer
            </button>
          </div>
        ) : (
          <input className="input" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        )}
        <input type="hidden" name="articleId" value={choisi?.id ?? ""} />
      </Champ>
      {resultats.length > 0 && (
        <ul className="divide-rows -mt-2 rounded-xl border border-line">
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
      <Champ label={`Quantité${choisi ? ` (${choisi.unite})` : ""}`}>
        <ChampNombre name="quantite" placeholder="0" />
      </Champ>
      <Champ label="Motif">
        <select name="motif" className="input" defaultValue="perime">
          {motifs.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Champ>
      <Champ label="Commentaire (facultatif)">
        <input name="commentaire" className="input" />
      </Champ>
    </Formulaire>
  );
}
