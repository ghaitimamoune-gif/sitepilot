"use client";

import { useState } from "react";
import { actionForcerQuantite, actionSaisirReste } from "@/app/actions/preparations";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { ChampNombre } from "@/components/ui/ChampNombre";
import { SaisieLigne } from "@/components/ui/SaisieLigne";
import { Badge } from "@/components/ui/primitives";
import { fmtNombre, fmtQuantite } from "@/lib/format";

export interface LigneFiche {
  articleId: number;
  nom: string;
  unite: string;
  estPiece: boolean;
  aujourdHui: number;
  equivalent: { valeur: number; unite: string } | null;
  avance: number;
  avanceSupprimee: boolean;
  total: number;
  resteVeille: number | null;
  aPreparerCalcule: number;
  aPreparer: number;
  forcee: number | null;
  motifForcage: string | null;
  batchs: number | null;
  rendementBatch: number | null;
  uniteBatch: string | null;
  detail: { nom: string; unites: number }[];
  ingredients: { nom: string; quantite: number; unite: string }[];
}

export function FichePreparations({ lignes, date, peutSaisirRestes, peutForcer }: { lignes: LigneFiche[]; date: string; peutSaisirRestes: boolean; peutForcer: boolean }) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [toutes, setToutes] = useState(false);
  // Les préparations sans aucun besoin (produit pas encore à la carte, par exemple) sont repliées.
  const sansBesoin = lignes.filter((l) => l.total < 1e-6 && l.forcee === null && !l.resteVeille);
  const visibles = toutes ? lignes : lignes.filter((l) => !sansBesoin.includes(l));
  return (
    <ul className="flex flex-col gap-2">
      {sansBesoin.length > 0 && !toutes && (
        <li>
          <button type="button" className="lien w-full justify-center text-sm text-muted" onClick={() => setToutes(true)}>
            {sansBesoin.length} préparation{sansBesoin.length > 1 ? "s" : ""} sans besoin aujourd&apos;hui — afficher
          </button>
        </li>
      )}
      {visibles.map((l) => {
        const estOuverte = ouverte === l.articleId;
        return (
          <li key={l.articleId} className={`card p-3 ${l.forcee !== null ? "border-amber-400" : ""}`}>
            <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setOuverte(estOuverte ? null : l.articleId)}>
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{l.nom}</p>
                <p className="text-xs text-muted">
                  Aujourd&apos;hui {fmtQuantite(l.aujourdHui, l.estPiece)} {l.unite}
                  {l.equivalent && ` (≈ ${fmtNombre(l.equivalent.valeur, 1)} ${l.equivalent.unite})`}
                  {" · "}avance {l.avanceSupprimee ? <span className="text-amber-700">0 (veille de fermeture)</span> : `${fmtQuantite(l.avance, l.estPiece)}`}
                  {" · "}total {fmtQuantite(l.total, l.estPiece)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="display block text-2xl font-bold leading-none text-brand">{fmtQuantite(l.aPreparer, l.estPiece)}</span>
                <span className="text-[11px] text-muted">à préparer{l.batchs !== null ? ` · ${l.batchs} batch${l.batchs > 1 ? "s" : ""}` : ""}</span>
              </div>
            </button>
            {l.forcee !== null && (
              <p className="mt-1 text-xs text-amber-700">
                <Badge teinte="orange">Forcée</Badge> {l.motifForcage} — calculé : {fmtQuantite(l.aPreparerCalcule, l.estPiece)}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3">
              <span className="flex-1 text-sm text-muted">Reste de la veille</span>
              {peutSaisirRestes ? (
                <SaisieLigne cle={`reste-${date}-${l.articleId}`} valeurInitiale={l.resteVeille} enregistrer={(v) => actionSaisirReste(date, l.articleId, v)} className="w-28" placeholder="0" />
              ) : (
                <span className="font-medium">{l.resteVeille === null ? "—" : fmtQuantite(l.resteVeille, l.estPiece)}</span>
              )}
              <span className="w-10 text-xs text-muted">{l.unite}</span>
            </div>
            {estOuverte && (
              <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3 text-sm">
                {l.detail.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-muted">Ventes prévues qui consomment cette préparation</p>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                      {l.detail.map((d) => (
                        <li key={d.nom} className="flex justify-between">
                          <span className="truncate">{d.nom}</span>
                          <span className="tabular-nums text-muted">{fmtNombre(d.unites, 1)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {l.ingredients.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-muted">
                      Ingrédients pour {fmtQuantite(l.aPreparer, l.estPiece)} {l.unite}
                      {l.rendementBatch ? ` (batch de ${fmtNombre(l.rendementBatch, 2)} ${l.uniteBatch ?? l.unite})` : ""}
                    </p>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                      {l.ingredients.map((i) => (
                        <li key={i.nom} className="flex justify-between">
                          <span className="truncate">{i.nom}</span>
                          <span className="tabular-nums text-muted">
                            {fmtNombre(i.quantite, 3)} {i.unite}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {peutForcer && <Forcage date={date} articleId={l.articleId} forcee={l.forcee} motif={l.motifForcage} unite={l.unite} />}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Forcage({ date, articleId, forcee, motif, unite }: { date: string; articleId: number; forcee: number | null; motif: string | null; unite: string }) {
  const [q, setQ] = useState<number | null>(forcee);
  const [m, setM] = useState(motif ?? "");
  return (
    <div className="rounded-xl border border-dashed border-amber-400 p-2">
      <p className="mb-1 text-xs font-semibold uppercase text-amber-700">Forcer la quantité à préparer (manager)</p>
      <div className="flex items-center gap-2">
        <ChampNombre className="w-28" defaultValue={forcee} onValeur={(v) => setQ(v)} placeholder="quantité" />
        <span className="text-xs text-muted">{unite}</span>
        <input className="input flex-1" placeholder="Motif" value={m} onChange={(e) => setM(e.target.value)} />
      </div>
      <div className="mt-2 flex gap-2">
        <BoutonAction className="btn-brand btn-sm flex-1" action={() => actionForcerQuantite(date, articleId, q, m)} disabled={q === null || m.trim().length < 2}>
          Forcer
        </BoutonAction>
        {forcee !== null && (
          <BoutonAction className="btn-ghost btn-sm" action={() => actionForcerQuantite(date, articleId, null, "")}>
            Lever le forçage
          </BoutonAction>
        )}
      </div>
    </div>
  );
}
