"use client";

import { useState } from "react";
import {
  actionAjouterArticleReception,
  actionControles,
  actionLigneDetail,
  actionRectifier,
  actionRetirerLigneReception,
  actionSaisirLigneReception,
  actionValiderReception,
} from "@/app/actions/receptions";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { ChampNombre } from "@/components/ui/ChampNombre";
import { Formulaire } from "@/components/ui/Formulaire";
import { Photos, type PhotoVue } from "@/components/ui/Photos";
import { SaisieLigne } from "@/components/ui/SaisieLigne";
import { Badge, Champ, Message, type Teinte } from "@/components/ui/primitives";
import { fmtDH, fmtNombre } from "@/lib/format";
import type { ReceptionVue } from "@/lib/services/receptions";

const TEINTE_ETAT: Record<string, Teinte> = { conforme: "vert", ecart: "orange", non_livre: "rouge", en_plus: "bleu" };
const LIBELLE_ETAT: Record<string, string> = { conforme: "Conforme", ecart: "Écart", non_livre: "Non livré", en_plus: "En plus" };

export function EcranReception({ vue, photos, catalogue, peutEcrire }: { vue: ReceptionVue; photos: PhotoVue[]; catalogue: { id: number; nom: string; unite: string }[]; peutEcrire: boolean }) {
  const { reception, fournisseur, lignes, articlesFournisseur } = vue;
  const brouillon = reception.statut === "brouillon" && peutEcrire;
  const [recherche, setRecherche] = useState("");
  const [detail, setDetail] = useState<number | null>(null);
  const [motifRectif, setMotifRectif] = useState("");
  const [rectifier, setRectifier] = useState(false);
  const presents = new Set(lignes.map((l) => l.articleId));
  const proposes = articlesFournisseur.filter((a) => !presents.has(a.id));
  const resultats = recherche.trim().length >= 2 ? catalogue.filter((a) => !presents.has(a.id) && a.nom.toLowerCase().includes(recherche.toLowerCase())).slice(0, 8) : [];
  const toutesQuantites = lignes.every((l) => l.qteRecue > 0 || l.qteRefusee > 0);
  const pret = lignes.length > 0 && toutesQuantites && photos.length > 0 && !!reception.decision;

  if (!brouillon) {
    const anomalies = lignes.filter((l) => l.etat && l.etat !== "conforme");
    return (
      <div className="flex flex-col gap-3">
        {reception.statut === "validee" ? (
          <Message type={anomalies.length > 0 ? "attention" : "succes"}>
            Réception validée{anomalies.length > 0 ? ` avec ${anomalies.length} anomalie(s), signalée(s) aux propriétaires et à la responsable achats.` : ", conforme à la commande."}
            {reception.rectifieId ? ` Rectifie la réception n° ${reception.rectifieId}.` : ""}
          </Message>
        ) : (
          <Message type="info">Réception en cours de saisie par la manager.</Message>
        )}
        <ul className="card divide-rows p-0 px-3">
          {lignes.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="font-medium">{l.nom}</span>
                <span className="block text-xs text-muted">
                  {l.qteCommandee !== null ? `commandé ${fmtNombre(l.qteCommandee, 2)} ${l.unite}` : "hors commande"}
                  {l.qteRefusee > 0 ? ` · refusé ${fmtNombre(l.qteRefusee, 2)} (${l.motifRefus ?? ""})` : ""}
                  {l.prixHt !== null ? ` · ${fmtDH(l.prixHt, 2)} HT` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="display block text-lg font-bold tabular-nums">{fmtNombre(l.qteRecue, 2)} <span className="text-xs font-normal text-muted">{l.unite}</span></span>
                {l.etat && <Badge teinte={TEINTE_ETAT[l.etat]}>{LIBELLE_ETAT[l.etat]}</Badge>}
              </span>
            </li>
          ))}
        </ul>
        <div className="card text-sm">
          <p>
            Décision : <strong>{reception.decision === "accepte" ? "Accepté" : reception.decision === "accepte_reserve" ? "Accepté avec réserve" : reception.decision === "refuse" ? "Refusé" : "—"}</strong>
            {reception.reserve ? ` — ${reception.reserve}` : ""}
          </p>
          <p className="text-muted">
            Température {reception.temperature !== null ? `${fmtNombre(Number(reception.temperature), 1)} °C` : "—"} · DLC {reception.dlcOk ? "ok" : "—"} · emballages {reception.emballagesOk ? "ok" : "—"} · aspect {reception.aspectOk ? "ok" : "—"}
            {reception.achatDirect && reception.montantPaye !== null ? ` · payé ${fmtDH(Number(reception.montantPaye))}` : ""}
          </p>
        </div>
        <div className="card">
          <p className="label">Bon de livraison</p>
          <Photos objetType="reception" objetId={reception.id} initiales={photos} lectureSeule />
        </div>
        {peutEcrire && reception.statut === "validee" && !rectifier && (
          <button type="button" className="btn-ghost w-full" onClick={() => setRectifier(true)}>
            Réception rectificative…
          </button>
        )}
        {rectifier && (
          <div className="card flex flex-col gap-2">
            <p className="text-sm">Une réception validée ne se modifie plus. La rectificative annule celle-ci et la remplace, avec un motif visible des propriétaires.</p>
            <input className="input" placeholder="Motif de la rectification" value={motifRectif} onChange={(e) => setMotifRectif(e.target.value)} />
            <BoutonAction className="btn-brand w-full" action={() => actionRectifier(reception.id, motifRectif)} disabled={motifRectif.trim().length < 3}>
              Créer la rectificative
            </BoutonAction>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Message type="info">Comptez à l&apos;aveugle : les quantités commandées s&apos;afficheront après la validation.</Message>

      <section className="card">
        <h2 className="mb-2 text-base">Articles reçus</h2>
        <ul className="divide-rows">
          {lignes.map((l) => (
            <li key={l.id} className="py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.nom}</p>
                  <p className="text-xs text-muted">
                    {l.unite}
                    {l.qteRefusee > 0 ? ` · ${fmtNombre(l.qteRefusee, 2)} refusés` : ""}
                    {l.prixHt !== null ? ` · ${fmtDH(l.prixHt, 2)} HT` : ""}
                  </p>
                </div>
                <SaisieLigne cle={`rec-${reception.id}-${l.articleId}`} valeurInitiale={l.qteRecue > 0 ? l.qteRecue : null} enregistrer={(v) => actionSaisirLigneReception(reception.id, l.articleId, v)} className="w-24" placeholder="0" />
              </div>
              <div className="mt-1 flex gap-3 text-xs">
                <button type="button" className="font-medium text-brand" onClick={() => setDetail(detail === l.id ? null : l.id)}>
                  Refus / prix facture
                </button>
                <BoutonAction className="font-medium text-red-700" action={() => actionRetirerLigneReception(reception.id, l.articleId)}>
                  Retirer
                </BoutonAction>
              </div>
              {detail === l.id && <DetailLigne receptionId={reception.id} ligne={l} onFerme={() => setDetail(null)} />}
            </li>
          ))}
          {lignes.length === 0 && <li className="py-3 text-center text-sm text-muted">Ajoutez les articles un par un.</li>}
        </ul>
        {proposes.length > 0 && (
          <div className="mt-3">
            <p className="label">Articles que ce fournisseur livre</p>
            <div className="flex flex-wrap gap-2">
              {proposes.map((a) => (
                <BoutonAction key={a.id} className="btn-ghost btn-sm" action={() => actionAjouterArticleReception(reception.id, a.id)}>
                  + {a.nom}
                </BoutonAction>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3">
          <input className="input" placeholder="Rechercher dans tout le catalogue" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          {resultats.length > 0 && (
            <ul className="mt-2 divide-rows rounded-xl border border-line">
              {resultats.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-3 py-1.5">
                  <span>
                    {a.nom} <span className="text-xs text-muted">({a.unite})</span>
                  </span>
                  <BoutonAction className="btn-ghost btn-sm" action={() => actionAjouterArticleReception(reception.id, a.id)} apres={() => setRecherche("")}>
                    Ajouter
                  </BoutonAction>
                </li>
              ))}
            </ul>
          )}
          <a href={`/fournisseurs/nouveau?retour=/receptions/${reception.id}`} className="mt-2 inline-block text-sm font-medium text-brand">
            Nouvel article ou nouveau fournisseur…
          </a>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 text-base">Contrôles à l&apos;arrivée</h2>
        <Formulaire action={actionControles} bouton="Enregistrer les contrôles" boutonClasse="btn-ghost w-full">
          <input type="hidden" name="receptionId" value={reception.id} />
          <Champ label="Température des produits frais (°C)">
            <ChampNombre name="temperature" defaultValue={reception.temperature === null ? null : Number(reception.temperature)} />
          </Champ>
          <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="dlcOk" className="h-6 w-6 accent-brand" defaultChecked={reception.dlcOk ?? false} /><span>DLC contrôlées : refus de tout produit à moins de 3 jours</span></label>
          <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="emballagesOk" className="h-6 w-6 accent-brand" defaultChecked={reception.emballagesOk ?? false} /><span>Emballages intacts et propres</span></label>
          <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="aspectOk" className="h-6 w-6 accent-brand" defaultChecked={reception.aspectOk ?? false} /><span>Aspect, odeur et couleur conformes</span></label>
          <Champ label="Décision">
            <select name="decision" className="input" defaultValue={reception.decision ?? ""} required>
              <option value="">Choisir…</option>
              <option value="accepte">Accepté</option>
              <option value="accepte_reserve">Accepté avec réserve (notée sur le bon)</option>
              <option value="refuse">Refusé</option>
            </select>
          </Champ>
          <Champ label="Réserve ou remarque">
            <input name="reserve" className="input" defaultValue={reception.reserve ?? ""} />
          </Champ>
          {reception.achatDirect && (
            <Champ label="Montant payé (DH)">
              <ChampNombre name="montantPaye" defaultValue={reception.montantPaye === null ? null : Number(reception.montantPaye)} />
            </Champ>
          )}
        </Formulaire>
      </section>

      <section className="card">
        <h2 className="mb-2 text-base">Photo du bon de livraison</h2>
        <Photos objetType="reception" objetId={reception.id} initiales={photos} minimum={1} maximum={6} libelle="Photo du bon" />
      </section>

      <BoutonAction className="btn-brand w-full text-lg" action={() => actionValiderReception(reception.id)} disabled={!pret}>
        Valider la réception
      </BoutonAction>
      {!pret && (
        <p className="text-center text-xs text-muted">
          Pour valider : au moins un article, toutes les quantités, la décision, et au moins une photo du bon.
        </p>
      )}
      <p className="text-xs text-muted">{fournisseur.nom}{reception.parSuppleant ? " · réception par suppléant" : ""}</p>
    </div>
  );
}

function DetailLigne({ receptionId, ligne, onFerme }: { receptionId: number; ligne: ReceptionVue["lignes"][number]; onFerme: () => void }) {
  const [refusee, setRefusee] = useState<number | null>(ligne.qteRefusee > 0 ? ligne.qteRefusee : null);
  const [motif, setMotif] = useState(ligne.motifRefus ?? "");
  const [prix, setPrix] = useState<number | null>(ligne.prixHt);
  const [tva, setTva] = useState<number | null>(ligne.tvaPct);
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-dashed border-line p-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">Quantité refusée</span>
          <ChampNombre defaultValue={refusee} onValeur={setRefusee} />
        </label>
        <label className="block">
          <span className="label">Motif</span>
          <select className="input" value={motif} onChange={(e) => setMotif(e.target.value)}>
            <option value="">—</option>
            <option value="température">Température</option>
            <option value="aspect">Aspect</option>
            <option value="date">Date</option>
            <option value="casse">Casse</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Prix facture HT (par {ligne.unite})</span>
          <ChampNombre defaultValue={prix} onValeur={setPrix} />
        </label>
        <label className="block">
          <span className="label">TVA %</span>
          <ChampNombre defaultValue={tva} onValeur={setTva} />
        </label>
      </div>
      <div className="flex gap-2">
        <BoutonAction className="btn-brand btn-sm flex-1" action={() => actionLigneDetail(receptionId, ligne.articleId, { qteRefusee: refusee ?? 0, motifRefus: motif || null, prixHt: prix, tvaPct: tva })} apres={onFerme}>
          Enregistrer
        </BoutonAction>
        <button type="button" className="btn-ghost btn-sm" onClick={onFerme}>
          Fermer
        </button>
      </div>
    </div>
  );
}
