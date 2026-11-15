import { NouveauFournisseur } from "@/components/commandes/NouveauFournisseur";
import { EnTete } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { chargerMoteur } from "@/lib/services/moteur";

export default async function PageNouveauFournisseur({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  await exigerDroit("fournisseurs:creer");
  const { retour } = await searchParams;
  const { articles, familles } = await chargerMoteur();
  const catalogue = [...articles.values()]
    .filter((a) => a.statut !== "archive" && a.nature !== "preparation")
    .map((a) => ({ id: a.id, nom: a.nom }))
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  const retourSur = retour && retour.startsWith("/") ? retour : "/commandes";
  return (
    <>
      <EnTete titre="Nouveau fournisseur" retour={retourSur} />
      <NouveauFournisseur catalogue={catalogue} familles={familles.map((f) => ({ id: f.id, nom: f.nom }))} retour={retourSur} />
    </>
  );
}
