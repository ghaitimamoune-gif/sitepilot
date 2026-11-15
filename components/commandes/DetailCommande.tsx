"use client";

import { useState } from "react";
import {
  actionChangerFournisseur,
  actionCloturer,
  actionConfirmerEnvoi,
  actionMessageWhatsApp,
  actionModifierLigne,
  actionPreparer,
  actionRemettreEnBrouillon,
  actionRetirerLigne,
  actionValider,
} from "@/app/actions/commandes";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { LienWhatsApp } from "@/components/ui/LienWhatsApp";
import { SaisieLigne } from "@/components/ui/SaisieLigne";
import { Badge, Message } from "@/components/ui/primitives";
import { fmtDH, fmtNombre } from "@/lib/format";
import type { CommandeVue } from "@/lib/services/commandes";

const LIBELLE_ORIGINE: Record<string, string> = { moteur: "besoin calculé", comptage: "comptage", rupture: "rupture", reception: "réception", manuel: "manuel" };

export function DetailCommande({ vue, peutEcrire, peutValider }: { vue: CommandeVue; peutEcrire: boolean; peutValider: boolean }) {
  const { commande, fournisseur, lignes, haussesPrix } = vue;
  const modifiable = peutEcrire && ["brouillon", "refusee", "prete"].includes(commande.statut);
  const [message, setMessage] = useState<{ texte: string; url: string | null } | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [commentaire, setCommentaire] = useState("");
  const [changement, setChangement] = useState<number | null>(null);
  const total = lignes.reduce((s, l) => s + l.qteCommandee * (l.prixEstime ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {commande.statut === "refusee" && <Message type="erreur">Refusée par un propriétaire : {commande.commentaireValidation}</Message>}
      {commande.statut === "en_attente_validation" && !peutValider && <Message type="info">En attente de validation d&apos;un propriétaire (fournisseur soumis à validation).</Message>}
      {haussesPrix.length > 0 && (
        <Message type="attention">
          Hausses de prix : {haussesPrix.map((h) => `${h.nom} ${fmtDH(h.ancien, 2)} → ${fmtDH(h.nouveau, 2)}`).join(" ; ")}
        </Message>
      )}

      <ul className="card divide-rows p-0 px-3">
        {lignes.map((l) => {
          const modifiee = l.qteCommandee !== l.qteProposee;
          return (
            <li key={l.id} className="py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">
                    {l.nom} {l.prioritaire && <Badge teinte="rouge">rupture</Badge>} {l.structurant && <Badge teinte="brand">structurant</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {LIBELLE_ORIGINE[l.origine]}
                    {l.detail ? ` · ${l.detail}` : ""} · {l.qteParUniteCommande !== 1 ? `${l.uniteCommande} de ${fmtNombre(l.qteParUniteCommande, 2)} ${l.unite}` : l.uniteCommande}
                    {l.prixEstime !== null ? ` · ${fmtDH(l.prixEstime, 2)} HT` : " · prix inconnu"}
                    {commande.statut !== "brouillon" && l.qteRecue > 0 ? ` · reçu ${fmtNombre(l.qteRecue, 2)} ${l.unite}` : ""}
                  </p>
                  {modifiee && <p className="text-xs text-amber-700">Proposé : {fmtNombre(l.qteProposee, 2)} {l.uniteCommande}</p>}
                </div>
                {modifiable ? (
                  <SaisieLigne cle={`cmd-${commande.id}-${l.id}`} valeurInitiale={l.qteCommandee} enregistrer={(v) => actionModifierLigne(l.id, v)} className="w-24" />
                ) : (
                  <span className="display text-xl font-bold tabular-nums">
                    {fmtNombre(l.qteCommandee, 2)} <span className="text-xs font-normal text-muted">{l.uniteCommande}</span>
                  </span>
                )}
              </div>
              {modifiable && (
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                  {l.options.length > 1 && (
                    <button type="button" className="font-medium text-brand" onClick={() => setChangement(changement === l.id ? null : l.id)}>
                      Autre fournisseur ({l.options.length})
                    </button>
                  )}
                  <BoutonAction className="font-medium text-red-700" action={() => actionRetirerLigne(l.id)}>
                    Retirer
                  </BoutonAction>
                </div>
              )}
              {changement === l.id && (
                <ul className="mt-2 divide-rows rounded-xl border border-line text-sm">
                  {l.options.map((o) => (
                    <li key={o.articleFournisseurId} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span>
                        {o.fournisseurNom}
                        <span className="block text-xs text-muted">
                          {o.prixHt !== null ? `${fmtDH(o.prixHt, 2)} HT / ${o.uniteCommande} (${o.prixDate})` : "prix inconnu"}
                          {o.aReverifier && " · à revérifier"}
                        </span>
                      </span>
                      {o.fournisseurId === fournisseur.id ? (
                        <Badge teinte="vert">actuel</Badge>
                      ) : (
                        <BoutonAction className="btn-ghost btn-sm" action={() => actionChangerFournisseur(l.id, o.articleFournisseurId)}>
                          Choisir
                        </BoutonAction>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {lignes.length === 0 && <li className="py-4 text-center text-sm text-muted">Aucune ligne.</li>}
      </ul>
      <p className="text-right text-sm text-muted">Montant estimé HT : {fmtDH(total)}</p>

      {peutEcrire && ["brouillon", "refusee"].includes(commande.statut) && lignes.length > 0 && (
        <BoutonAction className="btn-brand w-full" action={() => actionPreparer(commande.id)}>
          {fournisseur.validationRequise ? "Soumettre à validation" : "Marquer prête à envoyer"}
        </BoutonAction>
      )}

      {peutValider && commande.statut === "en_attente_validation" && (
        <div className="card flex flex-col gap-2 border-sky-300">
          <h2 className="text-base">Validation propriétaire</h2>
          <p className="text-sm text-muted">Montant estimé {fmtDH(commande.montantEstime)} · {lignes.length} ligne(s){haussesPrix.length > 0 ? ` · ${haussesPrix.length} hausse(s) de prix` : ""}</p>
          <BoutonAction className="btn-brand w-full" action={() => actionValider(commande.id, true, commentaire || null)}>
            Valider
          </BoutonAction>
          <input className="input" placeholder="Commentaire (obligatoire pour refuser)" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
          <BoutonAction className="btn-ghost w-full text-red-700" action={() => actionValider(commande.id, false, commentaire)} disabled={commentaire.trim().length < 2}>
            Refuser
          </BoutonAction>
        </div>
      )}

      {peutEcrire && commande.statut === "prete" && (
        <div className="card flex flex-col gap-3 border-brand">
          <h2 className="text-base">Envoi sur WhatsApp</h2>
          {!message ? (
            <BoutonAction
              className="btn-brand w-full"
              action={async () => {
                const m = await actionMessageWhatsApp(commande.id);
                setMessage(m);
                setOuvert(false);
                return { ok: true };
              }}
            >
              Préparer le message
            </BoutonAction>
          ) : (
            <>
              <pre className="whitespace-pre-wrap rounded-xl bg-bg p-3 text-xs">{message.texte}</pre>
              <LienWhatsApp url={message.url} texte={message.texte} onOuvert={() => setOuvert(true)} />
              <p className="text-xs text-muted">WhatsApp s&apos;ouvre sur la conversation du fournisseur, message déjà écrit. Appuyez sur envoyer, puis confirmez ici.</p>
              <BoutonAction className={`w-full ${ouvert ? "btn-brand" : "btn-ghost"}`} action={() => actionConfirmerEnvoi(commande.id, message.texte)} confirmer="Confirmer que le message a bien été envoyé au fournisseur ?">
                Message envoyé
              </BoutonAction>
            </>
          )}
          <BoutonAction className="text-sm text-muted" action={() => actionRemettreEnBrouillon(commande.id)}>
            Remettre en brouillon
          </BoutonAction>
        </div>
      )}

      {commande.statut === "envoyee" && commande.message && (
        <details className="card text-sm">
          <summary className="cursor-pointer font-medium">Message envoyé</summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{commande.message}</pre>
        </details>
      )}

      {peutEcrire && ["envoyee", "recue_partiellement", "recue"].includes(commande.statut) && (
        <BoutonAction className="btn-ghost w-full" action={() => actionCloturer(commande.id)} confirmer="Clôturer cette commande ? Les quantités non reçues ne seront plus attendues.">
          Clôturer
        </BoutonAction>
      )}
    </div>
  );
}
