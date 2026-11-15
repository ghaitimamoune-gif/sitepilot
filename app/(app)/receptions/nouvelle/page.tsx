import Link from "next/link";
import { ChoixFournisseur } from "@/components/receptions/ChoixFournisseur";
import { EnTete } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { fournisseursPourReception } from "@/lib/services/receptions";

export default async function PageNouvelleReception() {
  await exigerDroit("receptions:ecrire");
  const fournisseurs = await fournisseursPourReception();
  return (
    <>
      <EnTete titre="Nouvelle réception" retour="/receptions" sousTitre="Choisir le fournisseur. Ceux dont une commande est attendue viennent en tête." />
      <ChoixFournisseur fournisseurs={fournisseurs.map((f) => ({ id: f.id, nom: f.nom, statut: f.statut, achatDirect: f.achatDirect, attendue: f.attendue }))} />
      <Link href="/fournisseurs/nouveau?retour=/receptions/nouvelle" className="btn-ghost mt-4 w-full">
        Nouveau fournisseur
      </Link>
    </>
  );
}
