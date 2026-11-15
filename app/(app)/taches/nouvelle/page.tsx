import { actionCreerTache } from "@/app/actions/taches";
import { FormulaireNouvelleTache } from "@/components/taches/FormulaireNouvelleTache";
import { EnTete, Vide } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { journeeExploitation } from "@/lib/dates";
import { postesDuPerimetre } from "@/lib/services/taches";

export default async function PageNouvelleTache({ searchParams }: { searchParams: Promise<{ poste?: string }> }) {
  const s = await exigerDroit("taches:creer");
  const { poste } = await searchParams;
  const postes = await postesDuPerimetre(s.poste);
  return (
    <>
      <EnTete titre="Ajouter une tâche" retour="/equipe" sousTitre="Une tâche ponctuelle pour un poste de votre périmètre. Elle apparaît aussitôt chez le destinataire, avec votre nom." />
      {postes.length === 0 ? (
        <Vide>Aucun poste dans votre périmètre.</Vide>
      ) : (
        <FormulaireNouvelleTache
          action={actionCreerTache}
          postes={postes.map((p) => ({ id: p.id, nom: p.nom }))}
          posteParDefaut={poste ? Number(poste) : undefined}
          journee={journeeExploitation()}
        />
      )}
    </>
  );
}
