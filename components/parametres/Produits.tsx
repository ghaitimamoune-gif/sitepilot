"use client";

import { useState } from "react";
import { actionCoefficient, actionDeciderCoefficient, actionNomenclature, actionProduit, actionRecalculerCoefficients } from "@/app/actions/parametres";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { ChampNombre } from "@/components/ui/ChampNombre";
import { Formulaire } from "@/components/ui/Formulaire";
import { Badge, Carte, Champ } from "@/components/ui/primitives";
import { fmtNombre } from "@/lib/format";

export interface ProduitParam {
  id: number;
  nom: string;
  categorie: string | null;
  libellesCaisse: string[];
  actif: boolean;
  coef: Record<"semaine" | "weekend", { mesure: number; perso: number | null; fige: boolean }>;
  composants: { articleId: number; nom: string; unite: string; quantite: number; aConfirmer: boolean }[];
}

export interface PropositionCoef {
  id: number;
  produit: string;
  typeJournee: "semaine" | "weekend";
  ancienne: number;
  nouvelle: number;
  periode: string | null;
}

export function Produits({ produits, articles, propositions, peutEcrire }: { produits: ProduitParam[]; articles: { id: number; nom: string; unite: string }[]; propositions: PropositionCoef[]; peutEcrire: boolean }) {
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [perso, setPerso] = useState<Record<string, number | null>>({});
  const [nouveau, setNouveau] = useState<Record<number, { articleId: number; quantite: number | null }>>({});
  return (
    <div className="flex flex-col gap-4">
      {propositions.length > 0 && (
        <Carte titre={`Coefficients en forte variation (${propositions.length})`} className="border-sky-300">
          <ul className="divide-rows text-sm">
            {propositions.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>
                  {p.produit} <Badge teinte={p.typeJournee === "weekend" ? "brand" : "neutre"}>{p.typeJournee === "weekend" ? "week-end" : "semaine"}</Badge>
                  <span className="block text-xs text-muted">
                    {fmtNombre(p.ancienne, 3)} → {fmtNombre(p.nouvelle, 3)} · {p.periode}
                  </span>
                </span>
                {peutEcrire && (
                  <span className="flex gap-1">
                    <BoutonAction className="btn-brand btn-sm" action={() => actionDeciderCoefficient(p.id, true)}>Appliquer</BoutonAction>
                    <BoutonAction className="btn-ghost btn-sm" action={() => actionDeciderCoefficient(p.id, false)}>Refuser</BoutonAction>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Carte>
      )}
      {peutEcrire && (
        <BoutonAction className="btn-ghost w-full" action={() => actionRecalculerCoefficients()}>
          Recalculer les coefficients depuis les ventes importées (4 semaines glissantes)
        </BoutonAction>
      )}
      <ul className="flex flex-col gap-2">
        {produits.map((p) => {
          const estOuvert = ouvert === p.id;
          return (
            <li key={p.id} className={`card p-3 ${!p.actif ? "opacity-60" : ""}`}>
              <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOuvert(estOuvert ? null : p.id)}>
                <span>
                  <span className="font-semibold">{p.nom}</span>
                  <span className="block text-xs text-muted">
                    {p.categorie ?? "—"} · semaine {fmtNombre(p.coef.semaine.perso ?? p.coef.semaine.mesure, 3)} · week-end {fmtNombre(p.coef.weekend.perso ?? p.coef.weekend.mesure, 3)}
                    {(p.coef.semaine.fige || p.coef.weekend.fige) && " · figé"}
                  </span>
                </span>
                <span className="text-muted">{estOuvert ? "▴" : "▾"}</span>
              </button>
              {estOuvert && (
                <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3 text-sm">
                  {(["semaine", "weekend"] as const).map((type) => {
                    const c = p.coef[type];
                    const cle = `${p.id}-${type}`;
                    return (
                      <div key={type} className="flex flex-wrap items-end gap-2 rounded-xl border border-line p-2">
                        <span className="w-full text-xs font-semibold uppercase text-muted">
                          {type === "weekend" ? "Week-end" : "Semaine"} · mesuré {fmtNombre(c.mesure, 3)} unités / 1 000 DH
                        </span>
                        <label className="flex-1">
                          <span className="label">Coefficient personnalisé</span>
                          <ChampNombre defaultValue={c.perso} disabled={!peutEcrire} onValeur={(v) => setPerso((x) => ({ ...x, [cle]: v }))} placeholder="(aucun)" />
                        </label>
                        {peutEcrire && (
                          <>
                            <BoutonAction className="btn-ghost btn-sm" action={() => actionCoefficient(p.id, type, perso[cle] === undefined ? c.perso : perso[cle], c.fige)}>
                              OK
                            </BoutonAction>
                            <BoutonAction className={`btn-sm ${c.fige ? "btn-brand" : "btn-ghost"}`} action={() => actionCoefficient(p.id, type, perso[cle] === undefined ? c.perso : perso[cle], !c.fige)}>
                              {c.fige ? "Figé" : "Figer"}
                            </BoutonAction>
                          </>
                        )}
                      </div>
                    );
                  })}
                  <div>
                    <p className="label">Nomenclature (par unité vendue, avant pertes)</p>
                    <ul className="divide-rows">
                      {p.composants.map((c) => (
                        <li key={c.articleId} className="flex items-center gap-2 py-1">
                          <span className="flex-1 truncate">
                            {c.nom} {c.aConfirmer && <Badge teinte="orange">à confirmer</Badge>}
                          </span>
                          {peutEcrire ? (
                            <QuantiteNomenclature produitId={p.id} articleId={c.articleId} quantite={c.quantite} unite={c.unite} />
                          ) : (
                            <span className="tabular-nums">
                              {fmtNombre(c.quantite, 3)} {c.unite}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {peutEcrire && (
                      <div className="mt-2 flex items-end gap-2">
                        <label className="flex-1">
                          <span className="label">Ajouter un composant</span>
                          <select className="input" value={nouveau[p.id]?.articleId ?? ""} onChange={(e) => setNouveau((x) => ({ ...x, [p.id]: { articleId: Number(e.target.value), quantite: x[p.id]?.quantite ?? null } }))}>
                            <option value="">—</option>
                            {articles.filter((a) => !p.composants.some((c) => c.articleId === a.id)).map((a) => (
                              <option key={a.id} value={a.id}>{a.nom} ({a.unite})</option>
                            ))}
                          </select>
                        </label>
                        <ChampNombre className="w-24" onValeur={(v) => setNouveau((x) => ({ ...x, [p.id]: { articleId: x[p.id]?.articleId ?? 0, quantite: v } }))} placeholder="qté" />
                        <BoutonAction className="btn-ghost btn-sm" action={() => actionNomenclature(p.id, nouveau[p.id]?.articleId ?? 0, nouveau[p.id]?.quantite ?? null)} disabled={!nouveau[p.id]?.articleId || !nouveau[p.id]?.quantite}>
                          +
                        </BoutonAction>
                      </div>
                    )}
                  </div>
                  <Formulaire action={actionProduit} bouton="Enregistrer le produit" boutonClasse="btn-ghost w-full">
                    <input type="hidden" name="id" value={p.id} />
                    <Champ label="Nom"><input name="nom" className="input" defaultValue={p.nom} disabled={!peutEcrire} /></Champ>
                    <Champ label="Catégorie"><input name="categorie" className="input" defaultValue={p.categorie ?? ""} disabled={!peutEcrire} /></Champ>
                    <Champ label="Libellés de caisse (un par ligne)"><textarea name="libellesCaisse" className="input" rows={2} defaultValue={p.libellesCaisse.join("\n")} disabled={!peutEcrire} /></Champ>
                    <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="actif" className="h-6 w-6 accent-brand" defaultChecked={p.actif} disabled={!peutEcrire} /> Actif (à la carte)</label>
                  </Formulaire>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {peutEcrire && (
        <Carte titre="Nouveau produit vendu">
          <Formulaire action={actionProduit} bouton="Créer">
            <Champ label="Nom"><input name="nom" className="input" required /></Champ>
            <Champ label="Catégorie"><input name="categorie" className="input" /></Champ>
            <Champ label="Libellés de caisse (un par ligne)"><textarea name="libellesCaisse" className="input" rows={2} /></Champ>
            <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="actif" className="h-6 w-6 accent-brand" defaultChecked /> Actif</label>
          </Formulaire>
        </Carte>
      )}
    </div>
  );
}

function QuantiteNomenclature({ produitId, articleId, quantite, unite }: { produitId: number; articleId: number; quantite: number; unite: string }) {
  const [v, setV] = useState<number | null>(quantite);
  return (
    <span className="flex items-center gap-1">
      <ChampNombre className="w-24" defaultValue={quantite} onValeur={setV} />
      <span className="w-10 text-xs text-muted">{unite}</span>
      <BoutonAction className="btn-ghost btn-sm" action={() => actionNomenclature(produitId, articleId, v)}>OK</BoutonAction>
      <BoutonAction className="text-xs text-red-700" action={() => actionNomenclature(produitId, articleId, null)}>×</BoutonAction>
    </span>
  );
}
