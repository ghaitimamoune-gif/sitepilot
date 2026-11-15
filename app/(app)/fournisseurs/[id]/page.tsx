import { notFound } from "next/navigation";
import { FormulaireFournisseur, type FournisseurFormulaire } from "@/components/parametres/FormulaireFournisseur";
import { Badge, EnTete } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { fournisseurAvecArticles } from "@/lib/services/catalogue";
import { chargerMoteur } from "@/lib/services/moteur";

export default async function PageFournisseur({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigerDroit("fournisseurs:creer");
  const { id } = await params;
  const peutCompleter = aLeDroit(s.poste.role, "fournisseurs:completer");
  const nouveau = id === "0";
  if (nouveau && !peutCompleter) notFound();
  const data = nouveau ? null : await fournisseurAvecArticles(Number(id));
  if (!nouveau && !data) notFound();
  const { articles } = await chargerMoteur();
  const f = data?.fournisseur;
  const fiche: FournisseurFormulaire = f
    ? { id: f.id, nom: f.nom, raisonSociale: f.raisonSociale, ice: f.ice, contact: f.contact, whatsapp: f.whatsapp, joursLivraison: f.joursLivraison, heureLimite: f.heureLimite, delaiJours: f.delaiJours, validationRequise: f.validationRequise, achatDirect: f.achatDirect, statut: f.statut }
    : { id: null, nom: "", raisonSociale: null, ice: null, contact: null, whatsapp: null, joursLivraison: [], heureLimite: null, delaiJours: 1, validationRequise: false, achatDirect: false, statut: "actif" };
  return (
    <>
      <EnTete titre={f ? f.nom : "Nouveau fournisseur"} retour="/fournisseurs" sousTitre={f?.statut === "a_verifier" ? <Badge teinte="orange">fiche à vérifier</Badge> : undefined} />
      <FormulaireFournisseur
        fournisseur={fiche}
        liens={(data?.liens ?? []).map((l) => ({
          id: l.af.id,
          articleId: l.article.id,
          nom: l.article.nom,
          unite: l.article.uniteComptage,
          uniteCommande: l.af.uniteCommande,
          qteParUniteCommande: Number(l.af.qteParUniteCommande),
          reference: l.af.reference,
          actif: l.af.actif,
          dernierPrix: l.dernierPrix,
        }))}
        catalogue={[...articles.values()].filter((a) => a.statut !== "archive" && a.nature !== "preparation").map((a) => ({ id: a.id, nom: a.nom, unite: a.uniteComptage })).sort((x, y) => x.nom.localeCompare(y.nom, "fr"))}
        peutEcrire={peutCompleter}
        peutPrix={aLeDroit(s.poste.role, "prix:ecrire")}
      />
    </>
  );
}
