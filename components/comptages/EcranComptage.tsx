"use client";

import { useMemo, useState } from "react";
import { actionAjouterLigne, actionSaisirLigne, actionValiderComptage } from "@/app/actions/comptages";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { SaisieLigne } from "@/components/ui/SaisieLigne";
import { Badge, Message } from "@/components/ui/primitives";
import { fmtDH, fmtNombre, fmtPct } from "@/lib/format";

export interface LigneComptageClient {
  id: number;
  articleId: number;
  nom: string;
  unite: string;
  estPiece: boolean;
  structurant: boolean;
  quantiteComptee: number | null;
  stockTheorique: number | null;
  ecart: number | null;
  ecartPct: number | null;
  ecartValeur: number | null;
}

export function EcranComptage({
  comptageId,
  lignes,
  valide,
  catalogue,
  seuilPct,
  modeConsommation,
}: {
  comptageId: number;
  lignes: LigneComptageClient[];
  valide: boolean;
  catalogue: { id: number; nom: string; unite: string }[];
  seuilPct: number;
  modeConsommation: "import" | "estime" | null;
}) {
  const [recherche, setRecherche] = useState("");
  const saisies = lignes.filter((l) => l.quantiteComptee !== null).length;
  const dejaPresents = useMemo(() => new Set(lignes.map((l) => l.articleId)), [lignes]);
  const resultats = recherche.trim().length >= 2 ? catalogue.filter((a) => !dejaPresents.has(a.id) && a.nom.toLowerCase().includes(recherche.toLowerCase())).slice(0, 8) : [];

  if (valide) {
    const ecartsTotal = lignes.reduce((s, l) => s + (l.ecartValeur ?? 0), 0);
    return (
      <div className="flex flex-col gap-3">
        <Message type="succes">
          Comptage validé : le stock est recalé sur les quantités comptées. Consommation {modeConsommation === "import" ? "exacte (ventes importées)" : "estimée depuis le CA (± 5 à 10 %)"} ; seuil d&apos;alerte {fmtPct(seuilPct, 0)} sur les articles structurants.
        </Message>
        <ul className="card divide-rows p-0 px-3">
          {lignes.map((l) => {
            const hors = l.structurant && l.ecartPct !== null && Math.abs(l.ecartPct) > seuilPct;
            return (
              <li key={l.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {l.nom} {l.structurant && <Badge teinte="brand">structurant</Badge>}
                  </span>
                  <span className="tabular-nums">
                    {l.quantiteComptee === null ? <span className="text-muted">non compté</span> : `${fmtNombre(l.quantiteComptee, 2)} ${l.unite}`}
                  </span>
                </div>
                {l.quantiteComptee !== null && (
                  <p className={`text-xs ${hors ? "font-semibold text-red-600" : "text-muted"}`}>
                    théorique {fmtNombre(l.stockTheorique, 2)} · écart {l.ecart !== null && l.ecart > 0 ? "+" : ""}
                    {fmtNombre(l.ecart, 2)} {l.unite} ({l.ecartPct !== null ? fmtPct(l.ecartPct, 0) : "—"}){l.ecartValeur !== null ? ` · ${fmtDH(l.ecartValeur)}` : ""}
                    {hors && " · alerte propriétaires"}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-right text-sm text-muted">Écart total valorisé : {fmtDH(ecartsTotal)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Message type="info">Le stock théorique n&apos;est pas affiché : comptez réellement. Chaque ligne est enregistrée dès la saisie.</Message>
      <ul className="card divide-rows p-0 px-3">
        {lignes.map((l, i) => (
          <li key={l.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-snug">{l.nom}</p>
              <p className="text-xs text-muted">
                {l.unite}
                {l.structurant && " · structurant"}
              </p>
            </div>
            <SaisieLigne cle={`comptage-${comptageId}-${l.articleId}`} valeurInitiale={l.quantiteComptee} enregistrer={(v) => actionSaisirLigne(comptageId, l.articleId, v)} className="w-28" placeholder="—" autoFocus={i === 0 && l.quantiteComptee === null} />
          </li>
        ))}
      </ul>
      <div className="card">
        <label className="label">Ajouter un article du catalogue</label>
        <input className="input" placeholder="Rechercher…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        {resultats.length > 0 && (
          <ul className="mt-2 divide-rows">
            {resultats.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-1.5">
                <span>
                  {a.nom} <span className="text-xs text-muted">({a.unite})</span>
                </span>
                <BoutonAction className="btn-ghost btn-sm" action={() => actionAjouterLigne(comptageId, a.id)} apres={() => setRecherche("")}>
                  Ajouter
                </BoutonAction>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BoutonAction className="btn-brand w-full text-lg" action={() => actionValiderComptage(comptageId)} confirmer={saisies < lignes.length ? `${lignes.length - saisies} article(s) non compté(s) seront ignorés. Valider quand même ?` : undefined} disabled={saisies === 0}>
        Valider le comptage ({saisies}/{lignes.length})
      </BoutonAction>
    </div>
  );
}
