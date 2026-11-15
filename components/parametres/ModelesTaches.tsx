"use client";

import { useState } from "react";
import { actionModeleTache } from "@/app/actions/parametres";
import { Formulaire } from "@/components/ui/Formulaire";
import { Badge, Carte, Champ } from "@/components/ui/primitives";
import type { ValeurAttendue } from "@/lib/db/schema";

export interface ModeleVue {
  id: number | null;
  titre: string;
  consigne: string | null;
  posteId: number;
  recurrence: string;
  joursSemaine: number[];
  jourDuMois: number | null;
  heureCibleSemaine: string;
  heureCibleWeekend: string;
  delaiRemonteeMin: number;
  points: string[];
  preuve: string;
  photosMin: number;
  valeurs: ValeurAttendue[];
  structurante: boolean;
  ecranLie: string | null;
  familleId: number | null;
  actif: boolean;
}

const JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const RECURRENCE: Record<string, string> = { chaque_jour_ouvert: "chaque jour ouvert", jours_semaine: "certains jours", hebdomadaire: "hebdomadaire", mensuelle: "mensuelle" };

const VIDE: ModeleVue = { id: null, titre: "", consigne: null, posteId: 0, recurrence: "chaque_jour_ouvert", joursSemaine: [], jourDuMois: null, heureCibleSemaine: "09:00", heureCibleWeekend: "10:00", delaiRemonteeMin: 30, points: [], preuve: "aucune", photosMin: 1, valeurs: [], structurante: false, ecranLie: null, familleId: null, actif: true };

export function ModelesTaches({ modeles, postes, familles, peutEcrire }: { modeles: ModeleVue[]; postes: { id: number; nom: string }[]; familles: { id: number; nom: string }[]; peutEcrire: boolean }) {
  const [ouvert, setOuvert] = useState<number | "nouveau" | null>(null);
  const nomPoste = new Map(postes.map((p) => [p.id, p.nom]));
  const formulaire = (m: ModeleVue) => (
    <Formulaire action={actionModeleTache} bouton="Enregistrer le modèle" className="mt-3 border-t border-line pt-3">
      {m.id !== null && <input type="hidden" name="id" value={m.id} />}
      <Champ label="Titre"><input name="titre" className="input" defaultValue={m.titre} required disabled={!peutEcrire} /></Champ>
      <Champ label="Consigne"><textarea name="consigne" className="input" rows={2} defaultValue={m.consigne ?? ""} disabled={!peutEcrire} /></Champ>
      <div className="grid grid-cols-2 gap-2">
        <Champ label="Poste destinataire">
          <select name="posteId" className="input" defaultValue={m.posteId || postes[0]?.id} disabled={!peutEcrire}>
            {postes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </Champ>
        <Champ label="Récurrence">
          <select name="recurrence" className="input" defaultValue={m.recurrence} disabled={!peutEcrire}>
            {Object.entries(RECURRENCE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Champ>
      </div>
      <div>
        <span className="label">Jours (certains jours / hebdomadaire)</span>
        <div className="flex flex-wrap gap-1">
          {JOURS.map((j, i) => (
            <label key={i} className="flex min-h-tap items-center gap-1 rounded-lg border border-line px-2 text-sm">
              <input type="checkbox" name="joursSemaine" value={i} defaultChecked={m.joursSemaine.includes(i)} className="accent-brand" disabled={!peutEcrire} /> {j}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Champ label="Heure (semaine)"><input type="time" name="heureCibleSemaine" className="input" defaultValue={m.heureCibleSemaine} disabled={!peutEcrire} /></Champ>
        <Champ label="Heure (week-end)"><input type="time" name="heureCibleWeekend" className="input" defaultValue={m.heureCibleWeekend} disabled={!peutEcrire} /></Champ>
        <Champ label="Délai de remontée (min)"><input name="delaiRemonteeMin" className="input" inputMode="numeric" defaultValue={m.delaiRemonteeMin} disabled={!peutEcrire} /></Champ>
      </div>
      <Champ label="Jour du mois (mensuelle, vide = premier jour ouvert)"><input name="jourDuMois" className="input" inputMode="numeric" defaultValue={m.jourDuMois ?? ""} disabled={!peutEcrire} /></Champ>
      <Champ label="Points à cocher (un par ligne, mot pour mot du manuel)"><textarea name="points" className="input" rows={4} defaultValue={m.points.join("\n")} disabled={!peutEcrire} /></Champ>
      <div className="grid grid-cols-2 gap-2">
        <Champ label="Preuve">
          <select name="preuve" className="input" defaultValue={m.preuve} disabled={!peutEcrire}>
            <option value="aucune">Aucune</option>
            <option value="photos">Photos</option>
            <option value="valeurs">Valeurs à saisir</option>
          </select>
        </Champ>
        <Champ label="Photos minimum"><input name="photosMin" className="input" inputMode="numeric" defaultValue={m.photosMin} disabled={!peutEcrire} /></Champ>
      </div>
      <Champ label="Valeurs à saisir (une par ligne : libellé ; min ; max ; unité)">
        <textarea name="valeurs" className="input font-mono text-xs" rows={3} defaultValue={m.valeurs.map((v) => `${v.label} ; ${v.min ?? ""} ; ${v.max ?? ""} ; ${v.unite ?? ""}`).join("\n")} disabled={!peutEcrire} />
      </Champ>
      <div className="grid grid-cols-2 gap-2">
        <Champ label="Écran lié">
          <select name="ecranLie" className="input" defaultValue={m.ecranLie ?? ""} disabled={!peutEcrire}>
            <option value="">Aucun</option>
            <option value="comptage">Comptage</option>
            <option value="reception">Réception</option>
            <option value="commandes">Commandes</option>
            <option value="cloture">Clôture</option>
            <option value="pertes">Pertes</option>
          </select>
        </Champ>
        <Champ label="Famille (comptage)">
          <select name="familleId" className="input" defaultValue={m.familleId ?? ""} disabled={!peutEcrire}>
            <option value="">—</option>
            {familles.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </Champ>
      </div>
      <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="structurante" className="h-6 w-6 accent-brand" defaultChecked={m.structurante} disabled={!peutEcrire} /> Structurante (remonte aussi aux propriétaires)</label>
      <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="actif" className="h-6 w-6 accent-brand" defaultChecked={m.actif} disabled={!peutEcrire} /> Actif</label>
    </Formulaire>
  );
  return (
    <div className="flex flex-col gap-2">
      {peutEcrire && (
        <Carte>
          <button type="button" className="btn-brand w-full" onClick={() => setOuvert(ouvert === "nouveau" ? null : "nouveau")}>
            + Nouveau modèle
          </button>
          {ouvert === "nouveau" && formulaire(VIDE)}
        </Carte>
      )}
      {modeles.map((m) => (
        <div key={m.id} className={`card p-3 ${!m.actif ? "opacity-60" : ""}`}>
          <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOuvert(ouvert === m.id ? null : m.id)}>
            <span>
              <span className="font-semibold">{m.titre}</span>
              <span className="block text-xs text-muted">
                {nomPoste.get(m.posteId)} · {RECURRENCE[m.recurrence]} {m.joursSemaine.length > 0 ? `(${m.joursSemaine.map((j) => JOURS[j]).join(", ")})` : ""} · {m.heureCibleSemaine} / {m.heureCibleWeekend} · {m.preuve}
                {m.ecranLie ? ` · écran ${m.ecranLie}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-1">
              {m.structurante && <Badge teinte="brand">structurante</Badge>}
              <span className="text-muted">{ouvert === m.id ? "▴" : "▾"}</span>
            </span>
          </button>
          {ouvert === m.id && formulaire(m)}
        </div>
      ))}
    </div>
  );
}
