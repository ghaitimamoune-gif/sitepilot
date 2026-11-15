"use client";

import { useState } from "react";
import { actionFournisseur, actionLierArticle, actionPrix } from "@/app/actions/parametres";
import { ChampNombre } from "@/components/ui/ChampNombre";
import { Formulaire } from "@/components/ui/Formulaire";
import { Badge, Carte, Champ } from "@/components/ui/primitives";
import { fmtDH } from "@/lib/format";

const JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export interface FournisseurFormulaire {
  id: number | null;
  nom: string;
  raisonSociale: string | null;
  ice: string | null;
  contact: string | null;
  whatsapp: string | null;
  joursLivraison: number[];
  heureLimite: string | null;
  delaiJours: number;
  validationRequise: boolean;
  achatDirect: boolean;
  statut: string;
}

export interface LienVue {
  id: number;
  articleId: number;
  nom: string;
  unite: string;
  uniteCommande: string;
  qteParUniteCommande: number;
  reference: string | null;
  actif: boolean;
  dernierPrix: { prixHt: number; tvaPct: number; date: string } | null;
}

export function FormulaireFournisseur({ fournisseur, liens, catalogue, peutEcrire, peutPrix }: { fournisseur: FournisseurFormulaire; liens: LienVue[]; catalogue: { id: number; nom: string; unite: string }[]; peutEcrire: boolean; peutPrix: boolean }) {
  const [recherche, setRecherche] = useState("");
  const [prixPour, setPrixPour] = useState<number | null>(null);
  const resultats = recherche.trim().length >= 2 ? catalogue.filter((a) => !liens.some((l) => l.articleId === a.id) && a.nom.toLowerCase().includes(recherche.toLowerCase())).slice(0, 6) : [];
  const d = !peutEcrire;
  return (
    <div className="flex flex-col gap-4">
      <Formulaire action={actionFournisseur} bouton="Enregistrer la fiche" className="card">
        {fournisseur.id !== null && <input type="hidden" name="id" value={fournisseur.id} />}
        <Champ label="Nom"><input name="nom" className="input" defaultValue={fournisseur.nom} required disabled={d} /></Champ>
        <div className="grid grid-cols-2 gap-2">
          <Champ label="Raison sociale"><input name="raisonSociale" className="input" defaultValue={fournisseur.raisonSociale ?? ""} disabled={d} /></Champ>
          <Champ label="ICE"><input name="ice" className="input" defaultValue={fournisseur.ice ?? ""} disabled={d} /></Champ>
          <Champ label="Contact"><input name="contact" className="input" defaultValue={fournisseur.contact ?? ""} disabled={d} /></Champ>
          <Champ label="WhatsApp (international)"><input name="whatsapp" className="input" inputMode="tel" defaultValue={fournisseur.whatsapp ?? ""} placeholder="+212…" disabled={d} /></Champ>
        </div>
        <div>
          <span className="label">Jours de livraison</span>
          <div className="flex flex-wrap gap-1">
            {JOURS.map((j, i) => (
              <label key={i} className="flex min-h-tap items-center gap-1 rounded-lg border border-line px-2 text-sm">
                <input type="checkbox" name="joursLivraison" value={i} defaultChecked={fournisseur.joursLivraison.includes(i)} className="accent-brand" disabled={d} /> {j}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Aucun jour coché : tout jour ouvert. La quantité commandée couvre jusqu&apos;à la prochaine livraison possible.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Champ label="Heure limite"><input type="time" name="heureLimite" className="input" defaultValue={fournisseur.heureLimite ?? ""} disabled={d} /></Champ>
          <Champ label="Délai (jours)"><input name="delaiJours" className="input" inputMode="numeric" defaultValue={fournisseur.delaiJours} disabled={d} /></Champ>
          <Champ label="Statut">
            <select name="statut" className="input" defaultValue={fournisseur.statut} disabled={d}>
              <option value="actif">Actif</option>
              <option value="a_verifier">À vérifier</option>
              <option value="archive">Archivé</option>
            </select>
          </Champ>
        </div>
        <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="validationRequise" className="h-6 w-6 accent-brand" defaultChecked={fournisseur.validationRequise} disabled={d} /> Validation propriétaire requise avant envoi</label>
        <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="achatDirect" className="h-6 w-6 accent-brand" defaultChecked={fournisseur.achatDirect} disabled={d} /> Achat direct (dépannage payé en espèces)</label>
      </Formulaire>

      {fournisseur.id !== null && (
        <Carte titre="Articles fournis">
          <ul className="divide-rows text-sm">
            {liens.map((l) => (
              <li key={l.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={l.actif ? "" : "text-muted line-through"}>
                    <span className="font-medium">{l.nom}</span>
                    <span className="block text-xs text-muted">
                      {l.uniteCommande} = {l.qteParUniteCommande} {l.unite}
                      {l.reference ? ` · réf. ${l.reference}` : ""}
                      {l.dernierPrix ? ` · ${fmtDH(l.dernierPrix.prixHt, 2)} HT (${l.dernierPrix.date})` : " · prix inconnu"}
                    </span>
                  </span>
                  {peutPrix && (
                    <button type="button" className="text-sm font-medium text-brand" onClick={() => setPrixPour(prixPour === l.id ? null : l.id)}>
                      Prix
                    </button>
                  )}
                </div>
                {prixPour === l.id && (
                  <Formulaire action={actionPrix} bouton="Enregistrer le prix" boutonClasse="btn-brand btn-sm self-end" className="mt-2 rounded-xl border border-dashed border-line p-2">
                    <input type="hidden" name="articleFournisseurId" value={l.id} />
                    <div className="grid grid-cols-4 gap-2">
                      <Champ label={`Prix / ${l.uniteCommande}`}><ChampNombre name="montant" /></Champ>
                      <Champ label="Base">
                        <select name="base" className="input" defaultValue="ht"><option value="ht">HT</option><option value="ttc">TTC</option></select>
                      </Champ>
                      <Champ label="TVA %"><ChampNombre name="tvaPct" defaultValue={l.dernierPrix?.tvaPct ?? 20} /></Champ>
                      <Champ label="Date"><input type="date" name="date" className="input" /></Champ>
                    </div>
                    <p className="text-xs text-muted">Les prix se stockent hors taxe avec leur taux ; les comparaisons entre fournisseurs se font hors taxe.</p>
                  </Formulaire>
                )}
                {peutEcrire && (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-muted">conditionnement</summary>
                    <Formulaire action={actionLierArticle} bouton="OK" boutonClasse="btn-ghost btn-sm self-end" className="mt-1">
                      <input type="hidden" name="articleId" value={l.articleId} />
                      <input type="hidden" name="fournisseurId" value={fournisseur.id!} />
                      <div className="grid grid-cols-3 gap-2">
                        <Champ label="Unité de commande"><input name="uniteCommande" className="input" defaultValue={l.uniteCommande} /></Champ>
                        <Champ label={`${l.unite} par unité`}><ChampNombre name="qteParUniteCommande" defaultValue={l.qteParUniteCommande} /></Champ>
                        <Champ label="Référence"><input name="reference" className="input" defaultValue={l.reference ?? ""} /></Champ>
                      </div>
                      <label className="flex items-center gap-2"><input type="checkbox" name="actif" defaultChecked={l.actif} className="accent-brand" /> actif</label>
                    </Formulaire>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {peutEcrire && (
            <div className="mt-3">
              <input className="input" placeholder="Lier un article du catalogue…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
              {resultats.map((a) => (
                <Formulaire key={a.id} action={actionLierArticle} bouton={`Lier ${a.nom}`} boutonClasse="btn-ghost btn-sm w-full mt-1" onSucces={() => setRecherche("")}>
                  <input type="hidden" name="articleId" value={a.id} />
                  <input type="hidden" name="fournisseurId" value={fournisseur.id!} />
                  <input type="hidden" name="uniteCommande" value={a.unite} />
                  <input type="hidden" name="qteParUniteCommande" value={1} />
                </Formulaire>
              ))}
            </div>
          )}
          {fournisseur.statut === "a_verifier" && <p className="mt-2 text-xs"><Badge teinte="orange">à vérifier</Badge> Fiche créée sur le terrain : compléter puis passer le statut à « Actif ».</p>}
        </Carte>
      )}
    </div>
  );
}
