import { Carte, EnTete } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { ajouterJours, journeeExploitation, premierJourDuMois } from "@/lib/dates";

const EXPORTS: { type: string; libelle: string; periode: boolean }[] = [
  { type: "stocks", libelle: "Stocks théoriques et valeur", periode: false },
  { type: "commandes", libelle: "Commandes et lignes", periode: true },
  { type: "receptions", libelle: "Réceptions et lignes", periode: true },
  { type: "prix", libelle: "Historique des prix d'achat", periode: false },
  { type: "taches", libelle: "Tâches", periode: true },
  { type: "temperatures", libelle: "Relevés de température", periode: true },
];

export default async function PageExports({ searchParams }: { searchParams: Promise<{ debut?: string; fin?: string }> }) {
  await exigerDroit("export:donnees");
  const { debut: d0, fin: f0 } = await searchParams;
  const journee = journeeExploitation();
  const debut = d0 && /^\d{4}-\d{2}-\d{2}$/.test(d0) ? d0 : premierJourDuMois(journee);
  const fin = f0 && /^\d{4}-\d{2}-\d{2}$/.test(f0) ? f0 : journee;
  return (
    <>
      <EnTete titre="Exports" sousTitre="Fichiers CSV lisibles par Excel (point-virgule, virgule décimale)." />
      <form method="get" className="mb-4 flex items-end gap-2">
        <label className="flex-1">
          <span className="label">Début</span>
          <input type="date" name="debut" defaultValue={debut} className="input" />
        </label>
        <label className="flex-1">
          <span className="label">Fin</span>
          <input type="date" name="fin" defaultValue={fin} className="input" />
        </label>
        <button type="submit" className="btn-ghost">OK</button>
      </form>
      <Carte className="divide-rows p-0 px-4 py-1">
        {EXPORTS.map((e) => (
          <a key={e.type} href={`/api/exports/${e.type}?debut=${debut}&fin=${fin}`} className="row tap">
            <span>
              <span className="font-medium">{e.libelle}</span>
              {e.periode && <span className="block text-xs text-muted">{debut} → {fin}</span>}
            </span>
            <span className="text-brand">Télécharger</span>
          </a>
        ))}
      </Carte>
      <p className="mt-3 text-xs text-muted">Sauvegarde de la base : voir DEPLOIEMENT.md (sauvegarde quotidienne et restauration testée). Les 30 derniers jours : {ajouterJours(journee, -30)} → {journee}.</p>
    </>
  );
}
