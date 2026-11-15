"use client";

import { actionRevenirEstimation, actionSaisirPrevision } from "@/app/actions/previsionnel";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { SaisieLigne } from "@/components/ui/SaisieLigne";
import { Badge } from "@/components/ui/primitives";
import { dateCourte } from "@/lib/dates";

export interface PrevisionLigne {
  date: string;
  type: "semaine" | "weekend";
  ca: number;
  origine: "estime" | "saisi";
  base: string;
  note: string | null;
}

/** Une ligne par jour ouvert des 14 prochains jours : date, type, CA prévu, origine (estimé ou saisi). */
export function TableauPrevisions({ lignes, peutEcrire }: { lignes: PrevisionLigne[]; peutEcrire: boolean }) {
  return (
    <ul className="card divide-rows p-0 px-3">
      {lignes.map((l) => (
        <li key={l.date} className="flex items-center gap-2 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {dateCourte(l.date)} <Badge teinte={l.type === "weekend" ? "brand" : "neutre"}>{l.type === "weekend" ? "week-end" : "semaine"}</Badge>
            </p>
            <p className="truncate text-xs text-muted">
              {l.origine === "saisi" ? <span className="text-emerald-700">saisi</span> : <span>estimé — {l.base}</span>}
              {l.note ? ` · ${l.note}` : ""}
            </p>
            {peutEcrire && l.origine === "saisi" && (
              <BoutonAction className="text-xs text-muted underline" action={() => actionRevenirEstimation(l.date)}>
                revenir à l&apos;estimation
              </BoutonAction>
            )}
          </div>
          {peutEcrire ? (
            <SaisieLigne cle={`prev-${l.date}`} valeurInitiale={l.ca} enregistrer={(v) => actionSaisirPrevision(l.date, v)} className="w-28" />
          ) : (
            <span className="display text-xl font-bold tabular-nums">{Math.round(l.ca).toLocaleString("fr-FR")} <span className="text-xs font-normal text-muted">DH</span></span>
          )}
        </li>
      ))}
    </ul>
  );
}
