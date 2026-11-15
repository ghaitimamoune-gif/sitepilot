"use client";

import { useState } from "react";
import { actionArticle, actionRecette } from "@/app/actions/parametres";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { ChampNombre } from "@/components/ui/ChampNombre";
import { Formulaire } from "@/components/ui/Formulaire";
import { Carte, Champ } from "@/components/ui/primitives";
import { fmtNombre } from "@/lib/format";

export interface ArticleFormulaire {
  id: number | null;
  nom: string;
  nature: string;
  familleId: number | null;
  famillePerteId: number | null;
  uniteComptage: string;
  poidsUnitaire: number | null;
  unitePoids: string | null;
  structurant: boolean;
  dlcJours: number | null;
  rendementParage: number | null;
  lieAuxVentes: boolean;
  stockMinimum: number | null;
  stockCibleFixe: number | null;
  partAvance: number | null;
  rendementBatch: number | null;
  uniteBatch: string | null;
  coutRevient: number | null;
  critiqueCoutMatiere: boolean;
  statut: string;
  aConfirmer: boolean;
}

export function FormulaireArticle({
  article,
  familles,
  famillesPerte,
  recette,
  ingredients,
  peutEcrire,
}: {
  article: ArticleFormulaire;
  familles: { id: number; nom: string }[];
  famillesPerte: { id: number; nom: string }[];
  recette: { ingredientId: number; nom: string; unite: string; quantiteParBatch: number }[];
  ingredients: { id: number; nom: string; unite: string }[];
  peutEcrire: boolean;
}) {
  const [nature, setNature] = useState(article.nature);
  const [nouvel, setNouvel] = useState<{ id: number; q: number | null }>({ id: 0, q: null });
  const d = !peutEcrire;
  return (
    <div className="flex flex-col gap-4">
      <Formulaire action={actionArticle} bouton="Enregistrer l'article" className="card">
        {article.id !== null && <input type="hidden" name="id" value={article.id} />}
        <Champ label="Nom"><input name="nom" className="input" defaultValue={article.nom} required disabled={d} /></Champ>
        <div className="grid grid-cols-2 gap-2">
          <Champ label="Nature">
            <select name="nature" className="input" value={nature} onChange={(e) => setNature(e.target.value)} disabled={d}>
              <option value="matiere_premiere">Matière première</option>
              <option value="preparation">Préparation maison</option>
              <option value="emballage">Emballage</option>
              <option value="consommable">Consommable</option>
              <option value="tenue">Tenue</option>
              <option value="materiel">Matériel</option>
            </select>
          </Champ>
          <Champ label="Statut">
            <select name="statut" className="input" defaultValue={article.statut} disabled={d}>
              <option value="actif">Actif</option>
              <option value="a_verifier">À vérifier</option>
              <option value="archive">Archivé</option>
            </select>
          </Champ>
          <Champ label="Famille de comptage">
            <select name="familleId" className="input" defaultValue={article.familleId ?? ""} disabled={d}>
              <option value="">—</option>
              {familles.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </Champ>
          <Champ label="Famille de perte">
            <select name="famillePerteId" className="input" defaultValue={article.famillePerteId ?? ""} disabled={d}>
              <option value="">—</option>
              {famillesPerte.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </Champ>
          <Champ label="Unité de comptage"><input name="uniteComptage" className="input" defaultValue={article.uniteComptage} disabled={d} /></Champ>
          <Champ label="DLC (jours)"><ChampNombre name="dlcJours" defaultValue={article.dlcJours} decimales={false} disabled={d} /></Champ>
          <Champ label="Équivalent d'une pièce (kg ou L)"><ChampNombre name="poidsUnitaire" defaultValue={article.poidsUnitaire} disabled={d} /></Champ>
          <Champ label="Unité de l'équivalent"><input name="unitePoids" className="input" defaultValue={article.unitePoids ?? ""} placeholder="kg" disabled={d} /></Champ>
          <Champ label="Rendement de parage (0,75 = 75 %)"><ChampNombre name="rendementParage" defaultValue={article.rendementParage} disabled={d} /></Champ>
          <Champ label="Coût de revient (DH / unité)"><ChampNombre name="coutRevient" defaultValue={article.coutRevient} disabled={d} /></Champ>
        </div>
        {nature === "preparation" && (
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-dashed border-line p-2">
            <Champ label="Part d'avance (0,5 = 50 %)"><ChampNombre name="partAvance" defaultValue={article.partAvance} disabled={d} /></Champ>
            <Champ label="Rendement d'un batch"><ChampNombre name="rendementBatch" defaultValue={article.rendementBatch} disabled={d} /></Champ>
            <Champ label="Unité du batch"><input name="uniteBatch" className="input" defaultValue={article.uniteBatch ?? ""} disabled={d} /></Champ>
            <p className="col-span-3 text-xs text-muted">Sans part d&apos;avance, la préparation n&apos;apparaît pas sur la fiche (nœud de conversion, par exemple la citronnade servie).</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Champ label="Stock minimum (hors ventes)"><ChampNombre name="stockMinimum" defaultValue={article.stockMinimum} disabled={d} /></Champ>
          <Champ label="Stock cible fixe (hors ventes)"><ChampNombre name="stockCibleFixe" defaultValue={article.stockCibleFixe} disabled={d} /></Champ>
        </div>
        <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="lieAuxVentes" className="h-6 w-6 accent-brand" defaultChecked={article.lieAuxVentes} disabled={d} /> Lié aux ventes (stock cible calculé par le moteur)</label>
        <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="structurant" className="h-6 w-6 accent-brand" defaultChecked={article.structurant} disabled={d} /> Structurant (alertes écart &gt; 3 %, prix &gt; 3 %, tâche « appeler les propriétaires » en rupture)</label>
        <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="critiqueCoutMatiere" className="h-6 w-6 accent-brand" defaultChecked={article.critiqueCoutMatiere} disabled={d} /> Produit critique du coût matière (fiche 07.4)</label>
        <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="aConfirmer" className="h-6 w-6 accent-brand" defaultChecked={article.aConfirmer} disabled={d} /> Valeurs à confirmer en cuisine</label>
      </Formulaire>

      {article.id !== null && nature === "preparation" && (
        <Carte titre="Recette (ingrédients par batch, ou par unité sans batch)">
          <ul className="divide-rows text-sm">
            {recette.map((r) => (
              <li key={r.ingredientId} className="flex items-center gap-2 py-1">
                <span className="flex-1 truncate">{r.nom}</span>
                {peutEcrire ? <QuantiteRecette preparationId={article.id!} ingredientId={r.ingredientId} quantite={r.quantiteParBatch} unite={r.unite} /> : <span className="tabular-nums">{fmtNombre(r.quantiteParBatch, 3)} {r.unite}</span>}
              </li>
            ))}
            {recette.length === 0 && <li className="py-2 text-xs text-muted">Recette non formalisée.</li>}
          </ul>
          {peutEcrire && (
            <div className="mt-2 flex items-end gap-2">
              <label className="flex-1">
                <span className="label">Ajouter un ingrédient</span>
                <select className="input" value={nouvel.id} onChange={(e) => setNouvel((x) => ({ ...x, id: Number(e.target.value) }))}>
                  <option value={0}>—</option>
                  {ingredients.filter((i) => i.id !== article.id && !recette.some((r) => r.ingredientId === i.id)).map((i) => (
                    <option key={i.id} value={i.id}>{i.nom} ({i.unite})</option>
                  ))}
                </select>
              </label>
              <ChampNombre className="w-24" onValeur={(q) => setNouvel((x) => ({ ...x, q }))} placeholder="qté" />
              <BoutonAction className="btn-ghost btn-sm" action={() => actionRecette(article.id!, nouvel.id, nouvel.q)} disabled={!nouvel.id || !nouvel.q}>+</BoutonAction>
            </div>
          )}
        </Carte>
      )}
    </div>
  );
}

function QuantiteRecette({ preparationId, ingredientId, quantite, unite }: { preparationId: number; ingredientId: number; quantite: number; unite: string }) {
  const [v, setV] = useState<number | null>(quantite);
  return (
    <span className="flex items-center gap-1">
      <ChampNombre className="w-24" defaultValue={quantite} onValeur={setV} />
      <span className="w-10 text-xs text-muted">{unite}</span>
      <BoutonAction className="btn-ghost btn-sm" action={() => actionRecette(preparationId, ingredientId, v)}>OK</BoutonAction>
      <BoutonAction className="text-xs text-red-700" action={() => actionRecette(preparationId, ingredientId, null)}>×</BoutonAction>
    </span>
  );
}
