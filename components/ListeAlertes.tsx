"use client";

import Link from "next/link";
import { useState } from "react";
import { actionTraiterAlerte } from "@/app/actions/alertes";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { Badge, Vide, type Teinte } from "@/components/ui/primitives";
import { instantCourt } from "@/lib/dates";

export interface AlerteVue {
  id: number;
  type: string;
  niveau: "critique" | "avertissement" | "a_traiter" | "information";
  titre: string;
  detail: string | null;
  objetType: string | null;
  objetId: number | null;
  creeLe: string;
  traiteeLe: string | null;
  note: string | null;
}

const TEINTE: Record<AlerteVue["niveau"], Teinte> = { critique: "rouge", avertissement: "orange", a_traiter: "bleu", information: "neutre" };
const LIBELLE: Record<AlerteVue["niveau"], string> = { critique: "Critique", avertissement: "Avertissement", a_traiter: "À traiter", information: "Information" };

function lienObjet(a: AlerteVue): string | null {
  if (!a.objetType || !a.objetId) return null;
  switch (a.objetType) {
    case "tache":
      return `/taches/${a.objetId}`;
    case "commande":
      return `/commandes/${a.objetId}`;
    case "reception":
      return `/receptions/${a.objetId}`;
    case "comptage":
      return `/comptages/${a.objetId}`;
    case "article":
      return `/stocks/${a.objetId}`;
    case "fournisseur":
      return `/fournisseurs/${a.objetId}`;
    case "coefficient_propose":
      return `/parametres/produits`;
    case "import":
      return `/import`;
    default:
      return null;
  }
}

export function ListeAlertes({ alertes, peutTraiter = true, compact = false }: { alertes: AlerteVue[]; peutTraiter?: boolean; compact?: boolean }) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [note, setNote] = useState("");
  if (alertes.length === 0) return <Vide>Aucune alerte.</Vide>;
  return (
    <ul className="flex flex-col gap-2">
      {alertes.map((a) => {
        const lien = lienObjet(a);
        return (
          <li key={a.id} className={`card p-3 ${a.niveau === "critique" ? "border-red-300" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Badge teinte={TEINTE[a.niveau]}>{LIBELLE[a.niveau]}</Badge>
                  <span className="text-xs text-muted">{instantCourt(new Date(a.creeLe))}</span>
                </div>
                <p className="font-semibold leading-snug">{a.titre}</p>
                {a.detail && !compact && <p className="mt-1 text-sm text-muted">{a.detail}</p>}
                {a.traiteeLe && (
                  <p className="mt-1 text-xs text-emerald-700">
                    Traitée le {instantCourt(new Date(a.traiteeLe))}
                    {a.note ? ` — ${a.note}` : ""}
                  </p>
                )}
              </div>
              {lien && (
                <Link href={lien} className="btn-ghost btn-sm shrink-0">
                  Ouvrir
                </Link>
              )}
            </div>
            {peutTraiter && !a.traiteeLe && (
              <div className="mt-2">
                {ouverte === a.id ? (
                  <div className="flex flex-col gap-2">
                    <input className="input" placeholder="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex gap-2">
                      <BoutonAction className="btn-brand btn-sm flex-1" action={() => actionTraiterAlerte(a.id, note)} apres={() => setOuverte(null)}>
                        Marquer traitée
                      </BoutonAction>
                      <button type="button" className="btn-ghost btn-sm" onClick={() => setOuverte(null)}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="text-sm font-medium text-brand" onClick={() => { setOuverte(a.id); setNote(""); }}>
                    Traiter…
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
