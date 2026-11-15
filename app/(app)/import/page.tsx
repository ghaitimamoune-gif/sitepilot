import { FormulaireImport, RattacherLibelles } from "@/components/import/FormulaireImport";
import { Carte, EnTete, Vide } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { instantCourt } from "@/lib/dates";
import { fmtDH } from "@/lib/format";
import { libellesInconnus, listerImports } from "@/lib/services/imports";
import { chargerMoteur } from "@/lib/services/moteur";

export default async function PageImport() {
  const s = await exigerDroit("import:ventes");
  const [imports, inconnus, { produits }] = await Promise.all([listerImports(15), libellesInconnus(), chargerMoteur()]);
  return (
    <>
      <EnTete titre="Import des ventes" sousTitre="lacaisse.ma n'a pas d'API confirmée : déposez le fichier. Si un export automatique devient disponible, il alimentera le même traitement." />
      <div className="flex flex-col gap-4">
        <FormulaireImport />
        <Carte titre="Règles appliquées">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>« Prix de vente » est le total de la ligne ; le CA du jour est la somme de cette colonne.</li>
            <li>Les lignes « Menu … » portent le prix mais ne sont pas des produits ; les unités se comptent sur les lignes du produit.</li>
            <li>Libellés nettoyés (espaces et tirets de fin). Options « Sans … » ignorées, suppléments comptés.</li>
            <li>Le total doit égaler la feuille SYNTHESE, sinon l&apos;import est refusé.</li>
            <li>Un libellé inconnu bloque sa ligne et est signalé aux propriétaires.</li>
          </ul>
        </Carte>
        {inconnus.length > 0 && (
          <Carte titre={`Libellés de caisse inconnus (${inconnus.length})`}>
            <RattacherLibelles inconnus={inconnus} produits={[...produits.values()].map((p) => ({ id: p.id, nom: p.nom }))} peutEcrire={aLeDroit(s.poste.role, "parametres:ecrire")} />
          </Carte>
        )}
        <Carte titre="Imports précédents">
          {imports.length === 0 ? (
            <Vide>Aucun import.</Vide>
          ) : (
            <ul className="divide-rows text-sm">
              {imports.map((i) => (
                <li key={i.id} className="py-1.5">
                  <span className="font-medium">{i.fichier}</span>
                  <span className="block text-xs text-muted">
                    {instantCourt(i.creeLe)} · {i.format === "detaille" ? `${i.dateDebut} → ${i.dateFin}` : "par produit"} · {i.lignes} lignes · {fmtDH(i.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </>
  );
}
