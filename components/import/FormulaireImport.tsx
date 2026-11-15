"use client";

import { useState } from "react";
import { actionImporter, actionRattacherLibelle } from "@/app/actions/import";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { ChampNombre } from "@/components/ui/ChampNombre";
import { Formulaire } from "@/components/ui/Formulaire";
import { Champ } from "@/components/ui/primitives";

export function FormulaireImport() {
  const [csv, setCsv] = useState(false);
  return (
    <Formulaire action={actionImporter} bouton="Importer" className="card">
      <Champ label="Fichier de lacaisse.ma" aide="Rapport détaillé des ventes (.xlsx, feuille EXPORT DES VENTES) ou ventes par produit (.csv ;)">
        <input type="file" name="fichier" accept=".xlsx,.xls,.csv" className="input" required onChange={(e) => setCsv(/\.csv$/i.test(e.target.files?.[0]?.name ?? ""))} />
      </Champ>
      {!csv ? (
        <Champ label="CA TTC de la période (contrôle, facultatif)" aide="Sert si la feuille SYNTHESE est absente. Le total des lignes doit lui être égal, sinon l'import est refusé.">
          <ChampNombre name="totalAttendu" />
        </Champ>
      ) : (
        <>
          <Champ label="Période couverte (ex. 24-30 octobre 2026)">
            <input name="periode" className="input" required />
          </Champ>
          <Champ label="CA total de la période (DH)">
            <ChampNombre name="caPeriode" />
          </Champ>
          <Champ label="Type de journées">
            <select name="type" className="input" defaultValue="semaine">
              <option value="semaine">Semaine</option>
              <option value="weekend">Week-end</option>
            </select>
          </Champ>
          <p className="text-xs text-muted">Sans heure ni détail par jour : utilisable pour proposer des coefficients, pas pour le stock quotidien.</p>
        </>
      )}
    </Formulaire>
  );
}

export function RattacherLibelles({ inconnus, produits, peutEcrire }: { inconnus: { libelle: string; quantite: number; montant: number }[]; produits: { id: number; nom: string }[]; peutEcrire: boolean }) {
  const [choix, setChoix] = useState<Record<string, number>>({});
  if (inconnus.length === 0) return null;
  return (
    <ul className="divide-rows">
      {inconnus.map((i) => (
        <li key={i.libelle} className="py-2">
          <p className="font-medium">
            {i.libelle} <span className="text-xs text-muted">· {i.quantite} unités · {i.montant.toFixed(0)} DH</span>
          </p>
          {peutEcrire && (
            <div className="mt-1 flex gap-2">
              <select className="input flex-1" value={choix[i.libelle] ?? ""} onChange={(e) => setChoix((c) => ({ ...c, [i.libelle]: Number(e.target.value) }))}>
                <option value="">Rattacher à…</option>
                {produits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
              <BoutonAction className="btn-brand btn-sm" action={() => actionRattacherLibelle(i.libelle, choix[i.libelle])} disabled={!choix[i.libelle]}>
                OK
              </BoutonAction>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
