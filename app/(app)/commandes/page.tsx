import Link from "next/link";
import { BoutonGenererBrouillons } from "@/components/commandes/Propositions";
import { Badge, Carte, EnTete, Ligne, Message, Vide, type Teinte } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { dateCourte, heureLocale } from "@/lib/dates";
import { fmtDH } from "@/lib/format";
import { articlesJamaisComptes, calculerPropositions, complementsApresEnvoi, listerCommandes, LIBELLE_STATUT_COMMANDE, type StatutCommande } from "@/lib/services/commandes";

const TEINTE: Record<StatutCommande, Teinte> = {
  brouillon: "neutre",
  en_attente_validation: "bleu",
  refusee: "rouge",
  prete: "brand",
  envoyee: "vert",
  recue_partiellement: "orange",
  recue: "vert",
  cloturee: "neutre",
};

export default async function PageCommandes() {
  const s = await exigerDroit("commandes:lire");
  const peutEcrire = aLeDroit(s.poste.role, "commandes:ecrire");
  const peutValider = aLeDroit(s.poste.role, "commandes:valider");
  const [propositions, commandes, complements, jamaisComptes] = await Promise.all([
    peutEcrire ? calculerPropositions() : Promise.resolve([]),
    listerCommandes(undefined, 60),
    peutEcrire ? complementsApresEnvoi() : Promise.resolve([]),
    peutEcrire ? articlesJamaisComptes() : Promise.resolve([]),
  ]);
  const actives = commandes.filter((c) => !["cloturee", "recue"].includes(c.c.statut));
  const terminees = commandes.filter((c) => ["cloturee", "recue"].includes(c.c.statut)).slice(0, 15);
  const aValider = actives.filter((c) => c.c.statut === "en_attente_validation");
  const nbLignesProposees = propositions.reduce((n, g) => n + g.lignes.length, 0);
  const maintenant = heureLocale();
  return (
    <>
      <EnTete
        titre="Commandes"
        sousTitre="Les commandes partent la veille pour une livraison le lendemain matin."
        action={peutEcrire ? <Link href="/fournisseurs/nouveau?retour=/commandes" className="btn-ghost btn-sm">+ Fournisseur</Link> : undefined}
      />
      <div className="flex flex-col gap-4">
        {peutValider && aValider.length > 0 && (
          <Carte titre="À valider" className="border-sky-300">
            {aValider.map((c) => (
              <Ligne key={c.c.id} href={`/commandes/${c.c.id}`} gauche={<span className="font-medium">{c.fournisseur}</span>} droite={<span className="text-sm">{fmtDH(c.c.montantEstime)}</span>} />
            ))}
          </Carte>
        )}
        {peutEcrire && (
          <Carte titre="Lignes proposées">
            {nbLignesProposees === 0 ? (
              <Vide>Rien à commander d&apos;après le stock théorique et le prévisionnel.</Vide>
            ) : (
              <ul className="mb-3 divide-rows text-sm">
                {propositions.map((g) => (
                  <li key={g.fournisseur?.id ?? 0} className="py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{g.fournisseur?.nom ?? "Sans fournisseur"}</span>
                      <span className="text-xs text-muted">
                        {g.lignes.length} ligne{g.lignes.length > 1 ? "s" : ""}
                        {g.dateLivraison ? ` · livraison ${dateCourte(g.dateLivraison)}` : ""}
                        {g.fournisseur?.heureLimite ? ` · avant ${g.fournisseur.heureLimite}` : ""}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted">
                      {g.lignes.map((l) => `${l.enRupture ? "⚠ " : ""}${l.nom}`).join(", ")}
                    </p>
                    {g.fournisseur?.heureLimite && maintenant > g.fournisseur.heureLimite && <p className="text-xs text-amber-700">Heure limite dépassée : livraison décalée d&apos;un jour.</p>}
                  </li>
                ))}
              </ul>
            )}
            <BoutonGenererBrouillons libelle={nbLignesProposees === 0 ? "Actualiser les propositions" : "Créer ou mettre à jour les brouillons"} />
            {complements.length > 0 && (
              <div className="mt-3">
                <Message type="attention">
                  Compléments à commander après envoi : {complements.map((c) => `${c.nom} +${c.complement} ${c.unite} (${c.fournisseur})`).join(" ; ")}
                </Message>
              </div>
            )}
          </Carte>
        )}
        {peutEcrire && jamaisComptes.length > 0 && (
          <details className="card text-sm">
            <summary className="cursor-pointer font-medium">
              {jamaisComptes.length} article{jamaisComptes.length > 1 ? "s" : ""} jamais compté{jamaisComptes.length > 1 ? "s" : ""} : stock inconnu, non proposé{jamaisComptes.length > 1 ? "s" : ""}
            </summary>
            <p className="mt-2 text-xs text-muted">Le premier comptage de leur famille fixera le stock ; d&apos;ici là, ajoutez-les à la main dans une commande si besoin.</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
              {jamaisComptes.map((a) => (
                <li key={a.id} className="truncate">{a.nom}</li>
              ))}
            </ul>
          </details>
        )}
        <Carte titre="En cours">
          {actives.length === 0 ? (
            <Vide>Aucune commande en cours.</Vide>
          ) : (
            <ul className="divide-rows">
              {actives.map((c) => (
                <li key={c.c.id}>
                  <Ligne
                    href={`/commandes/${c.c.id}`}
                    gauche={
                      <>
                        <span className="font-medium">
                          {c.fournisseur} {c.nbPrioritaires > 0 && <Badge teinte="rouge">rupture</Badge>}
                        </span>
                        <span className="block text-xs text-muted">
                          livraison {dateCourte(c.c.dateLivraison)} · {c.nbLignes} ligne{c.nbLignes > 1 ? "s" : ""}
                          {c.heureLimite && c.c.statut === "prete" ? ` · à envoyer avant ${c.heureLimite}` : ""}
                          {c.c.montantEstime && Number(c.c.montantEstime) > 0 ? ` · ${fmtDH(c.c.montantEstime)}` : ""}
                        </span>
                      </>
                    }
                    droite={<Badge teinte={TEINTE[c.c.statut]}>{LIBELLE_STATUT_COMMANDE[c.c.statut]}</Badge>}
                  />
                </li>
              ))}
            </ul>
          )}
        </Carte>
        {terminees.length > 0 && (
          <Carte titre="Terminées">
            <ul className="divide-rows">
              {terminees.map((c) => (
                <li key={c.c.id}>
                  <Ligne href={`/commandes/${c.c.id}`} gauche={<span>{c.fournisseur} <span className="text-xs text-muted">· {dateCourte(c.c.dateLivraison)}</span></span>} droite={<Badge teinte={TEINTE[c.c.statut]}>{LIBELLE_STATUT_COMMANDE[c.c.statut]}</Badge>} />
                </li>
              ))}
            </ul>
          </Carte>
        )}
      </div>
    </>
  );
}
