"use client";

import { useState } from "react";
import { actionFamillePerte } from "@/app/actions/parametres";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { ChampNombre } from "@/components/ui/ChampNombre";

export function FamillesPerte({ familles, peutEcrire }: { familles: { id: number; nom: string; pertePct: number }[]; peutEcrire: boolean }) {
  const [valeurs, setValeurs] = useState<Record<number, number | null>>(Object.fromEntries(familles.map((f) => [f.id, f.pertePct * 100])));
  return (
    <ul className="divide-rows">
      {familles.map((f) => (
        <li key={f.id} className="flex items-center gap-2 py-1.5">
          <span className="flex-1 text-sm font-medium">{f.nom}</span>
          <ChampNombre className="w-24" defaultValue={f.pertePct * 100} disabled={!peutEcrire} onValeur={(v) => setValeurs((x) => ({ ...x, [f.id]: v }))} />
          <span className="w-6 text-xs text-muted">%</span>
          {peutEcrire && (
            <BoutonAction className="btn-ghost btn-sm" action={() => actionFamillePerte(f.id, valeurs[f.id] === null || valeurs[f.id] === undefined ? null : valeurs[f.id]! / 100)}>
              OK
            </BoutonAction>
          )}
        </li>
      ))}
    </ul>
  );
}
