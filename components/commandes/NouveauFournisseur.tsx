"use client";

import { useState } from "react";
import { actionNouveauFournisseur } from "@/app/actions/commandes";
import { Formulaire } from "@/components/ui/Formulaire";
import { Champ } from "@/components/ui/primitives";

/** Fiche minimale : nom, numéro WhatsApp, articles fournis (choisis dans le catalogue ou créés). */
export function NouveauFournisseur({ catalogue, familles, retour }: { catalogue: { id: number; nom: string }[]; familles: { id: number; nom: string }[]; retour: string }) {
  const [recherche, setRecherche] = useState("");
  const [choisis, setChoisis] = useState<{ id: number; nom: string }[]>([]);
  const resultats = recherche.trim().length >= 2 ? catalogue.filter((a) => !choisis.some((c) => c.id === a.id) && a.nom.toLowerCase().includes(recherche.toLowerCase())).slice(0, 8) : [];
  return (
    <Formulaire action={actionNouveauFournisseur} bouton="Créer le fournisseur" className="card">
      <input type="hidden" name="retour" value={retour} />
      <Champ label="Nom">
        <input name="nom" className="input" required />
      </Champ>
      <Champ label="Numéro WhatsApp" aide="Format international, par exemple +212 6 12 34 56 78">
        <input name="whatsapp" className="input" inputMode="tel" placeholder="+212…" />
      </Champ>
      <Champ label="Contact (facultatif)">
        <input name="contact" className="input" />
      </Champ>
      <Champ label="Articles fournis (catalogue)">
        <input className="input" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      </Champ>
      {resultats.length > 0 && (
        <ul className="divide-rows -mt-2 rounded-xl border border-line">
          {resultats.map((a) => (
            <li key={a.id}>
              <button type="button" className="flex min-h-tap w-full items-center px-3 text-left" onClick={() => { setChoisis((l) => [...l, a]); setRecherche(""); }}>
                + {a.nom}
              </button>
            </li>
          ))}
        </ul>
      )}
      {choisis.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {choisis.map((c) => (
            <li key={c.id} className="badge bg-brand/15 text-brand-dark">
              <input type="hidden" name="articleIds" value={c.id} />
              {c.nom}
              <button type="button" className="ml-1" aria-label="Retirer" onClick={() => setChoisis((l) => l.filter((x) => x.id !== c.id))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <Champ label="Nouveaux articles (un par ligne, facultatif)">
        <textarea name="nouveauxArticles" className="input" rows={2} placeholder="Ex. Pain brioché" />
      </Champ>
      <div className="grid grid-cols-2 gap-2">
        <Champ label="Famille des nouveaux articles">
          <select name="familleId" className="input" defaultValue={familles[0]?.id}>
            {familles.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
        </Champ>
        <Champ label="Unité de comptage">
          <input name="unite" className="input" defaultValue="kg" />
        </Champ>
      </div>
      <p className="text-xs text-muted">Le fournisseur est utilisable immédiatement, marqué « à vérifier » et signalé aux propriétaires, qui complètent la fiche (jours de livraison, heure limite, validation).</p>
    </Formulaire>
  );
}
