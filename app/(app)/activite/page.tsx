import Link from "next/link";
import { Carte, EnTete, Vide } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { ajouterJours, dateCourte, journeeExploitation, premierJourDuMois } from "@/lib/dates";
import { activiteParPersonne } from "@/lib/services/taches";

export default async function PageActivite({ searchParams }: { searchParams: Promise<{ debut?: string; fin?: string }> }) {
  await exigerDroit("activite:lire");
  const { debut: d0, fin: f0 } = await searchParams;
  const journee = journeeExploitation();
  const debut = d0 && /^\d{4}-\d{2}-\d{2}$/.test(d0) ? d0 : ajouterJours(journee, -13);
  const fin = f0 && /^\d{4}-\d{2}-\d{2}$/.test(f0) ? f0 : journee;
  const lignes = await activiteParPersonne(debut, fin);
  const mois = premierJourDuMois(journee);
  return (
    <>
      <EnTete titre="Activité par personne" sousTitre={`${dateCourte(debut)} → ${dateCourte(fin)}`} />
      <div className="flex flex-col gap-4">
        <form className="flex items-end gap-2" method="get">
          <label className="flex-1">
            <span className="label">Début</span>
            <input type="date" name="debut" defaultValue={debut} className="input" />
          </label>
          <label className="flex-1">
            <span className="label">Fin</span>
            <input type="date" name="fin" defaultValue={fin} className="input" />
          </label>
          <button type="submit" className="btn-ghost">
            OK
          </button>
        </form>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={`/activite?debut=${ajouterJours(journee, -6)}&fin=${journee}`} className="btn-ghost btn-sm">7 jours</Link>
          <Link href={`/activite?debut=${mois}&fin=${journee}`} className="btn-ghost btn-sm">Ce mois</Link>
          <a href={`/api/exports/temperatures?debut=${mois}&fin=${journee}`} className="btn-ghost btn-sm">Relevé des températures du mois (CSV)</a>
        </div>
        <Carte titre="Tâches par prénom">
          {lignes.length === 0 ? (
            <Vide>Aucune tâche faite sur la période.</Vide>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-1">Prénom</th>
                  <th className="py-1 text-right">Faites</th>
                  <th className="py-1 text-right">En retard</th>
                  <th className="py-1 text-right">À refaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lignes.map((l) => (
                  <tr key={l.personneId}>
                    <td className="py-1.5">
                      <span className="font-medium">{l.prenom}</span>
                      <span className="block text-xs text-muted">{l.poste}</span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{l.faites}</td>
                    <td className={`py-1.5 text-right tabular-nums ${l.retard > 0 ? "text-red-600" : ""}`}>{l.retard}</td>
                    <td className={`py-1.5 text-right tabular-nums ${l.refaire > 0 ? "text-amber-600" : ""}`}>{l.refaire}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Carte>
      </div>
    </>
  );
}
