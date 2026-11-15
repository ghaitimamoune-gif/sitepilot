"use client";

import { useState } from "react";
import { Formulaire, type ActionFormulaire } from "@/components/ui/Formulaire";
import { Champ } from "@/components/ui/primitives";

export function FormulaireNouvelleTache({
  action,
  postes,
  posteParDefaut,
  journee,
}: {
  action: ActionFormulaire;
  postes: { id: number; nom: string }[];
  posteParDefaut?: number;
  journee: string;
}) {
  const [preuve, setPreuve] = useState<"aucune" | "photos" | "valeurs">("aucune");
  const [nbValeurs, setNbValeurs] = useState(1);
  return (
    <Formulaire action={action} bouton="Créer la tâche" className="card">
      <Champ label="Poste destinataire">
        <select name="posteId" className="input" defaultValue={posteParDefaut ?? postes[0]?.id} required>
          {postes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
      </Champ>
      <Champ label="Titre">
        <input name="titre" className="input" required maxLength={120} placeholder="Ex. Nettoyer la chambre froide" />
      </Champ>
      <Champ label="Consigne (facultatif)">
        <textarea name="consigne" className="input" rows={2} />
      </Champ>
      <div className="grid grid-cols-2 gap-2">
        <Champ label="Jour">
          <input type="date" name="journee" className="input" defaultValue={journee} />
        </Champ>
        <Champ label="Heure cible">
          <input type="time" name="heure" className="input" />
        </Champ>
      </div>
      <Champ label="Points à cocher (un par ligne, facultatif)">
        <textarea name="points" className="input" rows={3} />
      </Champ>
      <Champ label="Preuve demandée">
        <select name="preuve" className="input" value={preuve} onChange={(e) => setPreuve(e.target.value as typeof preuve)}>
          <option value="aucune">Aucune</option>
          <option value="photos">Photos</option>
          <option value="valeurs">Valeurs à saisir</option>
        </select>
      </Champ>
      {preuve === "photos" && (
        <Champ label="Nombre minimum de photos">
          <input type="number" name="photosMin" className="input" min={1} max={6} defaultValue={1} inputMode="numeric" />
        </Champ>
      )}
      {preuve === "valeurs" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: nbValeurs }).map((_, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-1">
              <input name={`valeur_label_${i}`} className="input" placeholder="Libellé" />
              <input name={`valeur_min_${i}`} className="input" placeholder="min" inputMode="decimal" />
              <input name={`valeur_max_${i}`} className="input" placeholder="max" inputMode="decimal" />
              <input name={`valeur_unite_${i}`} className="input" placeholder="unité" />
            </div>
          ))}
          {nbValeurs < 6 && (
            <button type="button" className="btn-ghost btn-sm self-start" onClick={() => setNbValeurs((n) => n + 1)}>
              + une valeur
            </button>
          )}
        </div>
      )}
      <label className="flex min-h-tap items-center gap-3">
        <input type="checkbox" name="structurante" className="h-6 w-6 accent-brand" />
        <span>
          Structurante <span className="block text-xs text-muted">Non faite, elle remonte aussi aux propriétaires.</span>
        </span>
      </label>
    </Formulaire>
  );
}
