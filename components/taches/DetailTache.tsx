"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionBloquerTache, actionCocherPoint, actionSaisirValeurs, actionTerminerTache } from "@/app/actions/taches";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { ChampNombre } from "@/components/ui/ChampNombre";
import { Photos, type PhotoVue } from "@/components/ui/Photos";
import { Message } from "@/components/ui/primitives";
import type { ValeurAttendue, ValeurSaisie } from "@/lib/db/schema";

export interface TacheDetail {
  id: number;
  titre: string;
  consigne: string | null;
  statut: string;
  points: string[];
  pointsCoches: boolean[];
  preuve: "aucune" | "photos" | "valeurs";
  photosMin: number;
  valeurs: ValeurAttendue[];
  valeursSaisies: ValeurSaisie[];
  ecranLie: string | null;
  familleId: number | null;
  structurante: boolean;
}

const LIEN_ECRAN: Record<string, (t: TacheDetail) => string> = {
  comptage: (t) => (t.familleId ? `/comptages/famille/${t.familleId}${/fermeture/i.test(t.titre) ? "?fermeture=1" : ""}` : "/comptages"),
  reception: () => "/receptions",
  commandes: () => "/commandes",
  cloture: () => "/cloture",
  pertes: () => "/pertes",
};

export function DetailTache({ tache, photos, photosMax, estLeMien }: { tache: TacheDetail; photos: PhotoVue[]; photosMax: number; estLeMien: boolean }) {
  const ouverte = ["a_faire", "a_refaire", "en_retard", "bloquee"].includes(tache.statut);
  const modifiable = estLeMien && ouverte;
  const [coches, setCoches] = useState<boolean[]>(tache.points.map((_, i) => tache.pointsCoches[i] ?? false));
  const [valeurs, setValeurs] = useState<(number | null)[]>(tache.valeurs.map((_, i) => tache.valeursSaisies[i]?.valeur ?? null));
  const [messageValeurs, setMessageValeurs] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [bloquer, setBloquer] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  const cocher = (i: number, v: boolean) => {
    setCoches((c) => c.map((x, j) => (j === i ? v : x)));
    start(async () => {
      await actionCocherPoint(tache.id, i, v);
    });
  };

  const enregistrerValeurs = () => {
    start(async () => {
      const r = await actionSaisirValeurs(tache.id, valeurs);
      if (r.ok) setMessageValeurs(r.message ?? "Valeurs enregistrées.");
      else setMessageValeurs(r.erreur);
      router.refresh();
    });
  };

  const horsPlage = (i: number) => {
    const a = tache.valeurs[i];
    const v = valeurs[i];
    if (v === null || v === undefined) return false;
    return (a.min !== null && a.min !== undefined && v < a.min) || (a.max !== null && a.max !== undefined && v > a.max);
  };

  const lienEcran = tache.ecranLie ? LIEN_ECRAN[tache.ecranLie]?.(tache) : null;

  return (
    <div className="flex flex-col gap-4">
      {tache.consigne && <p className="card whitespace-pre-line text-sm">{tache.consigne}</p>}

      {lienEcran && ouverte && (
        <a href={lienEcran} className="btn-brand w-full">
          Ouvrir l&apos;écran lié
        </a>
      )}

      {tache.points.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-base">Points à cocher</h2>
          <ul className="divide-rows">
            {tache.points.map((p, i) => (
              <li key={i}>
                <label className="flex min-h-tap cursor-pointer items-center gap-3 py-2">
                  <input type="checkbox" className="h-6 w-6 shrink-0 accent-brand" checked={coches[i] ?? false} disabled={!modifiable} onChange={(e) => cocher(i, e.target.checked)} />
                  <span className={coches[i] ? "text-muted line-through" : ""}>{p}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tache.preuve === "valeurs" && tache.valeurs.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-base">Valeurs à saisir</h2>
          <div className="flex flex-col gap-2">
            {tache.valeurs.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <span className="block text-sm font-medium">{a.label}</span>
                  <span className="block text-xs text-muted">
                    {a.min !== null && a.min !== undefined ? `${a.min}` : "…"} à {a.max !== null && a.max !== undefined ? `${a.max}` : "…"} {a.unite ?? ""}
                  </span>
                </div>
                <ChampNombre
                  className={`w-28 ${horsPlage(i) ? "border-red-500 text-red-700" : ""}`}
                  defaultValue={valeurs[i]}
                  disabled={!modifiable}
                  onValeur={(v) => setValeurs((l) => l.map((x, j) => (j === i ? v : x)))}
                />
                <span className="w-8 text-xs text-muted">{a.unite ?? ""}</span>
              </div>
            ))}
          </div>
          {modifiable && (
            <button type="button" className="btn-ghost mt-3 w-full" onClick={enregistrerValeurs}>
              Enregistrer les valeurs
            </button>
          )}
          {messageValeurs && <div className="mt-2"><Message type={messageValeurs.startsWith("Hors") ? "attention" : "succes"}>{messageValeurs}</Message></div>}
        </section>
      )}

      {(tache.preuve === "photos" || photos.length > 0 || modifiable) && (
        <section className="card">
          <h2 className="mb-2 text-base">Photos</h2>
          <Photos objetType="tache" objetId={tache.id} initiales={photos} minimum={tache.preuve === "photos" ? tache.photosMin : 0} maximum={photosMax} lectureSeule={!modifiable} />
        </section>
      )}

      {modifiable && (
        <div className="flex flex-col gap-2">
          <BoutonAction key={`fait-${photos.length}`} className="btn-brand w-full text-lg" action={() => actionTerminerTache(tache.id)}>
            C&apos;est fait
          </BoutonAction>
          {!bloquer ? (
            <button type="button" className="btn-ghost w-full" onClick={() => setBloquer(true)}>
              Bloquée
            </button>
          ) : (
            <div className="card flex flex-col gap-2">
              <label className="label">Motif du blocage</label>
              <textarea className="input" rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ce qui empêche de faire la tâche" />
              <BoutonAction className="btn-danger w-full" action={() => actionBloquerTache(tache.id, motif)} disabled={motif.trim().length < 2}>
                Signaler bloquée
              </BoutonAction>
              <button type="button" className="text-sm text-muted" onClick={() => setBloquer(false)}>
                Annuler
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
