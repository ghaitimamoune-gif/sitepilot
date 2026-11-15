import { Produits, type ProduitParam } from "@/components/parametres/Produits";
import { EnTete } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { propositionsEnAttente } from "@/lib/services/coefficients";
import { chargerMoteur } from "@/lib/services/moteur";

export default async function PageProduits() {
  const s = await exigerDroit("parametres:lire");
  const peutEcrire = aLeDroit(s.poste.role, "parametres:ecrire");
  const [{ produits, articles, nomenclature }, propositions] = await Promise.all([chargerMoteur(), propositionsEnAttente()]);
  const vues: ProduitParam[] = [...produits.values()].map((p) => ({
    id: p.id,
    nom: p.nom,
    categorie: p.categorie,
    libellesCaisse: p.libellesCaisse,
    actif: p.actif,
    coef: {
      semaine: { mesure: p.mesure.semaine, perso: p.perso.semaine, fige: p.fige.semaine },
      weekend: { mesure: p.mesure.weekend, perso: p.perso.weekend, fige: p.fige.weekend },
    },
    composants: nomenclature
      .filter((n) => n.produitId === p.id)
      .map((n) => {
        const a = articles.get(n.articleId);
        return { articleId: n.articleId, nom: a?.nom ?? String(n.articleId), unite: a?.uniteComptage ?? "", quantite: Number(n.quantite), aConfirmer: n.aConfirmer };
      }),
  }));
  const listeArticles = [...articles.values()]
    .filter((a) => a.statut !== "archive")
    .map((a) => ({ id: a.id, nom: a.nom, unite: a.uniteComptage }))
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  return (
    <>
      <EnTete titre="Produits et coefficients" retour="/parametres" sousTitre="Unités vendues pour 1 000 DH de CA, par type de journée. Un coefficient personnalisé remplace le mesuré ; figé, il n'est plus recalculé." />
      <Produits
        produits={vues}
        articles={listeArticles}
        propositions={propositions.map((p) => ({ id: p.p.id, produit: p.produit, typeJournee: p.p.typeJournee, ancienne: Number(p.p.ancienneValeur), nouvelle: Number(p.p.nouvelleValeur), periode: p.p.periode }))}
        peutEcrire={peutEcrire}
      />
    </>
  );
}
