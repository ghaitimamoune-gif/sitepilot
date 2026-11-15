import { notFound } from "next/navigation";
import { FormulaireArticle, type ArticleFormulaire } from "@/components/parametres/FormulaireArticle";
import { EnTete } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { chargerMoteur } from "@/lib/services/moteur";

export default async function PageArticle({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigerDroit("parametres:lire");
  const peutEcrire = aLeDroit(s.poste.role, "parametres:ecrire");
  const { id } = await params;
  const { articles, familles, famillesPerte, recettes } = await chargerMoteur();
  const nouveau = id === "nouveau";
  const a = nouveau ? null : articles.get(Number(id));
  if (!nouveau && !a) notFound();
  if (nouveau && !peutEcrire) notFound();
  // Les valeurs issues de la table complète (famille de perte, statut…) sont dans ArticleCharge.
  const rowFamillePerte = a ? famillesPerte.find((f) => f.nom === a.famillePerteNom)?.id ?? null : null;
  const article: ArticleFormulaire = a
    ? {
        id: a.id,
        nom: a.nom,
        nature: a.nature,
        familleId: a.familleId,
        famillePerteId: rowFamillePerte,
        uniteComptage: a.uniteComptage,
        poidsUnitaire: a.poidsUnitaire ?? null,
        unitePoids: a.unitePoids ?? null,
        structurant: a.structurant,
        dlcJours: a.dlcJours,
        rendementParage: a.rendementParage,
        lieAuxVentes: a.lieAuxVentes,
        stockMinimum: a.stockMinimum,
        stockCibleFixe: a.stockCibleFixe,
        partAvance: a.partAvance,
        rendementBatch: a.rendementBatch,
        uniteBatch: a.uniteBatch ?? null,
        coutRevient: a.coutRevient,
        critiqueCoutMatiere: a.critique,
        statut: a.statut,
        aConfirmer: a.aConfirmer,
      }
    : {
        id: null,
        nom: "",
        nature: "matiere_premiere",
        familleId: familles[0]?.id ?? null,
        famillePerteId: null,
        uniteComptage: "kg",
        poidsUnitaire: null,
        unitePoids: null,
        structurant: false,
        dlcJours: null,
        rendementParage: null,
        lieAuxVentes: true,
        stockMinimum: null,
        stockCibleFixe: null,
        partAvance: null,
        rendementBatch: null,
        uniteBatch: null,
        coutRevient: null,
        critiqueCoutMatiere: false,
        statut: "actif",
        aConfirmer: false,
      };
  const recette = a
    ? recettes
        .filter((r) => r.preparationId === a.id)
        .map((r) => {
          const ing = articles.get(r.ingredientId);
          return { ingredientId: r.ingredientId, nom: ing?.nom ?? String(r.ingredientId), unite: ing?.uniteComptage ?? "", quantiteParBatch: Number(r.quantiteParBatch) };
        })
    : [];
  const ingredients = [...articles.values()]
    .filter((x) => x.statut !== "archive")
    .map((x) => ({ id: x.id, nom: x.nom, unite: x.uniteComptage }))
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  return (
    <>
      <EnTete titre={a ? a.nom : "Nouvel article"} retour="/parametres/articles" />
      <FormulaireArticle article={article} familles={familles.map((f) => ({ id: f.id, nom: f.nom }))} famillesPerte={famillesPerte.map((f) => ({ id: f.id, nom: f.nom }))} recette={recette} ingredients={ingredients} peutEcrire={peutEcrire} />
    </>
  );
}
