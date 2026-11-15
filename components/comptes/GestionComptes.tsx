"use client";

import { useState } from "react";
import {
  actionActiverPoste,
  actionArchiverPrenom,
  actionChangerPin,
  actionCreerPoste,
  actionFusionnerPrenoms,
  actionModifierPoste,
  actionRenouvelerCode,
  actionRevoquerAppareil,
} from "@/app/actions/comptes";
import { actionCreerInvitation, actionQrEnrolement } from "@/app/actions/invitations";
import { PartageLien } from "@/components/comptes/PartageLien";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { Formulaire } from "@/components/ui/Formulaire";
import { Badge, Carte, Champ } from "@/components/ui/primitives";
import { LIBELLE_ROLE, type Role, type Zone } from "@/lib/auth/droits";

export interface PosteVue {
  id: number;
  nom: string;
  role: Role;
  zone: Zone;
  actif: boolean;
  posteSuperieurId: number | null;
  voitPreparations: boolean;
  planNettoyage: boolean;
  pinDefini: boolean;
  personnes: { id: number; prenom: string; archivee: boolean; derniereConnexion: string }[];
}

export interface AppareilVue {
  id: number;
  libelle: string | null;
  enroleLe: string;
  dernierVuLe: string;
  revoque: boolean;
}

export function GestionComptes({ postes, estProprietaire, codeEnrolement, appareils, monPosteId }: { postes: PosteVue[]; estProprietaire: boolean; codeEnrolement: string; appareils: AppareilVue[]; monPosteId: number }) {
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [fusion, setFusion] = useState<Record<number, number>>({});
  const encadrement = postes.filter((p) => p.role !== "employe");
  const employes = postes.filter((p) => p.role === "employe");

  const carte = (p: PosteVue) => {
    const peutGerer = estProprietaire || p.role === "employe";
    const estOuvert = ouvert === p.id;
    return (
      <li key={p.id} className={`card p-3 ${!p.actif ? "opacity-60" : ""}`}>
        <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => { setOuvert(estOuvert ? null : p.id); setPin(""); }}>
          <span>
            <span className="font-semibold">{p.nom}</span>
            <span className="block text-xs text-muted">
              {LIBELLE_ROLE[p.role]} · {p.zone} · {p.personnes.filter((x) => !x.archivee).length} prénom(s)
              {!p.pinDefini && <span className="font-semibold text-amber-700"> · code non choisi</span>}
            </span>
          </span>
          {!p.actif ? <Badge teinte="rouge">désactivé</Badge> : <span className="text-muted">{estOuvert ? "▴" : "▾"}</span>}
        </button>
        {estOuvert && (
          <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3 text-sm">
            {peutGerer && p.actif && p.id !== monPosteId && (
              <div>
                <PartageLien
                  creer={() => actionCreerInvitation(p.id)}
                  libelle={p.role === "employe" ? "Inviter un employé sur ce poste (QR code)" : "Envoyer une invitation personnelle"}
                  className="btn-brand w-full"
                />
                <p className="mt-1 text-xs text-muted">
                  {p.role === "employe"
                    ? "Le nouvel employé scanne le QR code : son téléphone est enregistré, il tape son prénom et il est connecté."
                    : "La personne ouvre le lien sur son téléphone et choisit elle-même son code. Lien à usage unique, valable 72 h."}
                </p>
              </div>
            )}
            {(peutGerer || p.id === monPosteId) && (
              <div className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="label">Nouveau code PIN ({p.role === "proprietaire" ? 6 : 4} chiffres)</span>
                  <input className="input" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                </label>
                <BoutonAction className="btn-brand" action={() => actionChangerPin(p.id, pin)} disabled={pin.length !== (p.role === "proprietaire" ? 6 : 4)} apres={() => setPin("")}>
                  Changer
                </BoutonAction>
              </div>
            )}
            {peutGerer && (
              <Formulaire action={actionModifierPoste} bouton="Enregistrer le poste" boutonClasse="btn-ghost w-full">
                <input type="hidden" name="posteId" value={p.id} />
                <Champ label="Nom du poste">
                  <input name="nom" className="input" defaultValue={p.nom} />
                </Champ>
                <div className="grid grid-cols-2 gap-2">
                  <Champ label="Zone">
                    <select name="zone" className="input" defaultValue={p.zone}>
                      <option value="direction">Direction</option>
                      <option value="cuisine">Cuisine</option>
                      <option value="salle">Salle</option>
                    </select>
                  </Champ>
                  <Champ label="Poste supérieur">
                    <select name="posteSuperieurId" className="input" defaultValue={p.posteSuperieurId ?? ""}>
                      <option value="">— (propriétaires)</option>
                      {postes.filter((x) => x.id !== p.id && x.role !== "employe").map((x) => (
                        <option key={x.id} value={x.id}>{x.nom}</option>
                      ))}
                    </select>
                  </Champ>
                </div>
                <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="voitPreparations" className="h-6 w-6 accent-brand" defaultChecked={p.voitPreparations} /> Voit la fiche des préparations</label>
                <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="planNettoyage" className="h-6 w-6 accent-brand" defaultChecked={p.planNettoyage} /> Poste du plan de nettoyage</label>
              </Formulaire>
            )}
            {p.personnes.length > 0 && (
              <div>
                <p className="label">Prénoms sur ce poste</p>
                <ul className="divide-rows">
                  {p.personnes.map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className={x.archivee ? "text-muted line-through" : ""}>
                        {x.prenom} <span className="text-xs text-muted">· {new Date(x.derniereConnexion).toLocaleDateString("fr-FR")}</span>
                      </span>
                      {peutGerer && (
                        <span className="flex items-center gap-2">
                          {!x.archivee && p.personnes.filter((y) => y.id !== x.id && !y.archivee).length > 0 && (
                            <>
                              <select className="input w-28 py-1 text-xs" value={fusion[x.id] ?? ""} onChange={(e) => setFusion((f) => ({ ...f, [x.id]: Number(e.target.value) }))}>
                                <option value="">fusionner dans…</option>
                                {p.personnes.filter((y) => y.id !== x.id && !y.archivee).map((y) => (
                                  <option key={y.id} value={y.id}>{y.prenom}</option>
                                ))}
                              </select>
                              <BoutonAction className="btn-ghost btn-sm" action={() => actionFusionnerPrenoms(x.id, fusion[x.id])} disabled={!fusion[x.id]}>OK</BoutonAction>
                            </>
                          )}
                          <BoutonAction className="text-xs text-muted underline" action={() => actionArchiverPrenom(x.id, !x.archivee)}>
                            {x.archivee ? "restaurer" : "archiver"}
                          </BoutonAction>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {peutGerer && p.id !== monPosteId && (
              <BoutonAction className={p.actif ? "btn-ghost w-full text-red-700" : "btn-ghost w-full"} action={() => actionActiverPoste(p.id, !p.actif)} confirmer={p.actif ? "Désactiver ce poste ? Ses sessions seront fermées." : undefined}>
                {p.actif ? "Désactiver le poste" : "Réactiver le poste"}
              </BoutonAction>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Carte titre="Enrôler un téléphone">
        <p className="mb-2 text-sm text-muted">Le téléphone scanne le QR code (ou ouvre le lien reçu), puis saisit le code de son poste.</p>
        <PartageLien creer={actionQrEnrolement} libelle="Afficher le QR code d'enrôlement" className="btn-brand w-full" />
      </Carte>
      {estProprietaire && (
        <Carte titre="Code d'enrôlement des appareils">
          <p className="display text-2xl font-bold tracking-widest">{codeEnrolement || "— aucun —"}</p>
          <p className="mb-2 text-xs text-muted">À donner à la manager. Renouveler le code n&apos;affecte pas les téléphones déjà enrôlés.</p>
          <BoutonAction className="btn-ghost w-full" action={() => actionRenouvelerCode()} confirmer="Renouveler le code ? L'ancien ne fonctionnera plus.">
            Renouveler le code
          </BoutonAction>
        </Carte>
      )}
      <section>
        <h2 className="mb-2 text-base">Encadrement</h2>
        <ul className="flex flex-col gap-2">{encadrement.map(carte)}</ul>
      </section>
      <section>
        <h2 className="mb-2 text-base">Postes employés</h2>
        <ul className="flex flex-col gap-2">{employes.map(carte)}</ul>
      </section>
      <Carte titre="Créer un poste">
        <Formulaire action={actionCreerPoste} bouton="Créer le poste">
          <Champ label="Nom du poste">
            <input name="nom" className="input" required />
          </Champ>
          <div className="grid grid-cols-2 gap-2">
            <Champ label="Rôle">
              <select name="role" className="input" defaultValue="employe">
                {(estProprietaire ? (Object.keys(LIBELLE_ROLE) as Role[]) : (["employe"] as Role[])).map((r) => (
                  <option key={r} value={r}>{LIBELLE_ROLE[r]}</option>
                ))}
              </select>
            </Champ>
            <Champ label="Zone">
              <select name="zone" className="input" defaultValue="cuisine">
                <option value="direction">Direction</option>
                <option value="cuisine">Cuisine</option>
                <option value="salle">Salle</option>
              </select>
            </Champ>
          </div>
          <Champ label="Code PIN (4 chiffres, 6 pour un propriétaire)">
            <input name="pin" className="input" inputMode="numeric" pattern="[0-9]*" required />
          </Champ>
          <Champ label="Poste supérieur (remontée des tâches)">
            <select name="posteSuperieurId" className="input" defaultValue="">
              <option value="">— (propriétaires)</option>
              {postes.filter((x) => x.role !== "employe").map((x) => (
                <option key={x.id} value={x.id}>{x.nom}</option>
              ))}
            </select>
          </Champ>
          <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="voitPreparations" className="h-6 w-6 accent-brand" /> Voit la fiche des préparations</label>
          <label className="flex min-h-tap items-center gap-3"><input type="checkbox" name="planNettoyage" className="h-6 w-6 accent-brand" /> Poste du plan de nettoyage</label>
        </Formulaire>
      </Carte>
      {estProprietaire && (
        <Carte titre={`Appareils enrôlés (${appareils.filter((a) => !a.revoque).length})`}>
          <ul className="divide-rows text-sm">
            {appareils.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className={a.revoque ? "text-muted line-through" : ""}>
                  {a.libelle ?? `Appareil n° ${a.id}`}
                  <span className="block text-xs text-muted">enrôlé le {new Date(a.enroleLe).toLocaleDateString("fr-FR")} · vu le {new Date(a.dernierVuLe).toLocaleDateString("fr-FR")}</span>
                </span>
                {!a.revoque && (
                  <BoutonAction className="text-xs text-red-700 underline" action={() => actionRevoquerAppareil(a.id)} confirmer="Révoquer cet appareil ? Il devra être enrôlé de nouveau.">
                    révoquer
                  </BoutonAction>
                )}
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}
