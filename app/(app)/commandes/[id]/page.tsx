import { notFound } from "next/navigation";
import { AjouterLigne } from "@/components/commandes/AjouterLigne";
import { DetailCommande } from "@/components/commandes/DetailCommande";
import { Badge, EnTete } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { dateLongue, instantCourt } from "@/lib/dates";
import { commandeVue, LIBELLE_STATUT_COMMANDE } from "@/lib/services/commandes";
import { chargerMoteur } from "@/lib/services/moteur";
import { serialiser } from "@/lib/vues";

export default async function PageCommande({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigerDroit("commandes:lire");
  const { id } = await params;
  const vue = await commandeVue(Number(id));
  if (!vue) notFound();
  const peutEcrire = aLeDroit(s.poste.role, "commandes:ecrire");
  const peutValider = aLeDroit(s.poste.role, "commandes:valider");
  const { articles } = await chargerMoteur();
  const catalogue = [...articles.values()]
    .filter((a) => a.statut !== "archive" && a.nature !== "preparation")
    .map((a) => ({ id: a.id, nom: a.nom, unite: a.uniteComptage }))
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  const c = vue.commande;
  return (
    <>
      <EnTete
        titre={vue.fournisseur.nom}
        retour="/commandes"
        sousTitre={
          <>
            Livraison {dateLongue(c.dateLivraison)} · <Badge teinte={c.statut === "envoyee" ? "vert" : c.statut === "prete" ? "brand" : "neutre"}>{LIBELLE_STATUT_COMMANDE[c.statut]}</Badge>
            {vue.fournisseur.heureLimite && ` · à envoyer avant ${vue.fournisseur.heureLimite}`}
            {c.envoyeeLe && ` · envoyée ${instantCourt(c.envoyeeLe)}`}
            {vue.fournisseur.statut === "a_verifier" && <> · <Badge teinte="orange">fiche à vérifier</Badge></>}
          </>
        }
      />
      <DetailCommande vue={serialiser(vue)} peutEcrire={peutEcrire} peutValider={peutValider} />
      {peutEcrire && ["brouillon", "refusee", "prete"].includes(c.statut) && (
        <div className="mt-4">
          <AjouterLigne fournisseurId={vue.fournisseur.id} catalogue={catalogue} />
        </div>
      )}
    </>
  );
}
