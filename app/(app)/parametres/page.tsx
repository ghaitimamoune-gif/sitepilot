import Link from "next/link";
import { actionFamille, actionParametre } from "@/app/actions/parametres";
import { FamillesPerte } from "@/components/parametres/FamillesPerte";
import { Formulaire } from "@/components/ui/Formulaire";
import { Carte, Champ, EnTete, Message } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { chargerMoteur } from "@/lib/services/moteur";
import { chargerParametres, PARAMETRES_DEFAUT } from "@/lib/services/parametres";

const GROUPES: { titre: string; cles: (keyof typeof PARAMETRES_DEFAUT)[] }[] = [
  { titre: "Moteur de calcul", cles: ["marge_generale", "seuil_dlc_veille_fermeture", "ca_defaut_semaine", "ca_defaut_weekend", "historique_ca_occurrences", "seuil_variation_coefficient", "semaines_glissantes_coefficients"] },
  { titre: "Seuils d'alerte", cles: ["seuil_ecart_stock_structurant", "seuil_ecart_stock_estime", "seuil_hausse_prix", "seuil_ecart_ca", "prix_a_reverifier_jours", "cout_matiere_cible", "cout_matiere_alerte_points", "cout_matiere_critique_points", "heure_limite_reception"] },
  { titre: "Calendrier et comptages", cles: ["jours_fermeture_hebdo", "jours_weekend", "comptage_hebdo_jour", "comptage_hebdo_heure", "comptage_quotidien_heure"] },
  { titre: "Tâches, photos, sécurité", cles: ["delai_remontee_defaut", "photos_max", "photo_grand_cote", "retention_photos_mois", "retention_temperatures_mois", "session_duree_heures", "pin_tentatives_max", "pin_verrouillage_minutes"] },
  { titre: "Messages", cles: ["nom_restaurant", "modele_message_commande"] },
];

export default async function PageParametres() {
  const s = await exigerDroit("parametres:lire");
  const peutEcrire = aLeDroit(s.poste.role, "parametres:ecrire");
  const [p, { familles, famillesPerte }] = await Promise.all([chargerParametres(), chargerMoteur()]);
  return (
    <>
      <EnTete titre="Paramètres" sousTitre="Toutes les valeurs chiffrées du brief sont ici, jamais dans le code. Chaque modification est journalisée." />
      <div className="flex flex-col gap-4">
        {!peutEcrire && <Message type="info">Lecture seule : seuls les propriétaires modifient les paramètres.</Message>}
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/parametres/produits" className="btn-ghost btn-sm">Produits et coefficients</Link>
          <Link href="/parametres/articles" className="btn-ghost btn-sm">Articles</Link>
          <Link href="/parametres/taches" className="btn-ghost btn-sm">Modèles de tâches</Link>
          <Link href="/parametres/calendrier" className="btn-ghost btn-sm">Calendrier</Link>
          <Link href="/fournisseurs" className="btn-ghost btn-sm">Fournisseurs</Link>
        </nav>
        {GROUPES.map((g) => (
          <Carte key={g.titre} titre={g.titre}>
            <div className="flex flex-col gap-3">
              {g.cles.map((cle) => (
                <Formulaire key={cle} action={actionParametre} bouton="OK" boutonClasse="btn-ghost btn-sm self-end" className="rounded-xl border border-line p-2">
                  <input type="hidden" name="cle" value={cle} />
                  <Champ label={PARAMETRES_DEFAUT[cle].libelle}>
                    {cle === "modele_message_commande" ? (
                      <textarea name="valeur" className="input font-mono text-xs" rows={6} defaultValue={p[cle]} disabled={!peutEcrire} />
                    ) : (
                      <input name="valeur" className="input" defaultValue={p[cle]} disabled={!peutEcrire} />
                    )}
                  </Champ>
                </Formulaire>
              ))}
            </div>
          </Carte>
        ))}
        <Carte titre="Pertes prévues par famille">
          <FamillesPerte familles={famillesPerte.map((f) => ({ id: f.id, nom: f.nom, pertePct: Number(f.pertePct) }))} peutEcrire={peutEcrire} />
        </Carte>
        <Carte titre="Familles de comptage">
          <div className="flex flex-col gap-3">
            {familles.map((f) => (
              <Formulaire key={f.id} action={actionFamille} bouton="OK" boutonClasse="btn-ghost btn-sm self-end" className="rounded-xl border border-line p-2">
                <input type="hidden" name="id" value={f.id} />
                <Champ label="Nom">
                  <input name="nom" className="input" defaultValue={f.nom} disabled={!peutEcrire} />
                </Champ>
                <div className="grid grid-cols-3 gap-2">
                  <Champ label="Rythme">
                    <select name="rythme" className="input" defaultValue={f.rythme} disabled={!peutEcrire}>
                      <option value="quotidien">Quotidien</option>
                      <option value="hebdomadaire">Hebdomadaire</option>
                      <option value="mensuel">Mensuel</option>
                    </select>
                  </Champ>
                  <Champ label="Compté par">
                    <select name="roleCompteur" className="input" defaultValue={f.roleCompteur} disabled={!peutEcrire}>
                      <option value="resp_cuisine">Resp. cuisine</option>
                      <option value="resp_achats">Resp. achats</option>
                    </select>
                  </Champ>
                  <Champ label="Jours de sécurité">
                    <input name="joursSecurite" className="input" inputMode="numeric" defaultValue={f.joursSecurite} disabled={!peutEcrire} />
                  </Champ>
                </div>
              </Formulaire>
            ))}
            {peutEcrire && (
              <details className="rounded-xl border border-dashed border-line p-2">
                <summary className="cursor-pointer text-sm font-medium">Nouvelle famille</summary>
                <Formulaire action={actionFamille} bouton="Créer" boutonClasse="btn-brand btn-sm self-end" className="mt-2">
                  <Champ label="Nom"><input name="nom" className="input" required /></Champ>
                  <div className="grid grid-cols-3 gap-2">
                    <Champ label="Rythme">
                      <select name="rythme" className="input" defaultValue="hebdomadaire"><option value="quotidien">Quotidien</option><option value="hebdomadaire">Hebdomadaire</option><option value="mensuel">Mensuel</option></select>
                    </Champ>
                    <Champ label="Compté par">
                      <select name="roleCompteur" className="input" defaultValue="resp_achats"><option value="resp_cuisine">Resp. cuisine</option><option value="resp_achats">Resp. achats</option></select>
                    </Champ>
                    <Champ label="Jours de sécurité"><input name="joursSecurite" className="input" inputMode="numeric" defaultValue={6} /></Champ>
                  </div>
                </Formulaire>
              </details>
            )}
          </div>
        </Carte>
      </div>
    </>
  );
}
