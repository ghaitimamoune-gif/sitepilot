import { TableauPrevisions } from "@/components/previsionnel/TableauPrevisions";
import { Carte, EnTete, Message } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { ajouterJours, dateCourte, journeeExploitation } from "@/lib/dates";
import { fmtDH, fmtPct } from "@/lib/format";
import { chargerCalendrier } from "@/lib/services/calendrier";
import { chargerParametres, nombreDepuis } from "@/lib/services/parametres";
import { listerPrevisions, prevuContreRealise } from "@/lib/services/previsions";

export default async function PagePrevisionnel() {
  const s = await exigerDroit("previsionnel:lire");
  const peutEcrire = aLeDroit(s.poste.role, "previsionnel:ecrire");
  const journee = journeeExploitation();
  const [previsions, cal, passe, p] = await Promise.all([listerPrevisions(14, journee), chargerCalendrier(), prevuContreRealise(ajouterJours(journee, -14), ajouterJours(journee, -1)), chargerParametres()]);
  const seuil = nombreDepuis(p, "seuil_ecart_ca");
  return (
    <>
      <EnTete titre="Prévisionnel de CA" sousTitre="Seule donnée d'entrée du moteur. Toute correction recalcule aussitôt les préparations et les commandes non envoyées." />
      <div className="flex flex-col gap-4">
        {!peutEcrire && <Message type="info">Lecture seule : les propriétaires saisissent le prévisionnel.</Message>}
        <TableauPrevisions lignes={previsions.map((x) => ({ date: x.date, type: x.type, ca: x.ca, origine: x.origine, base: x.base, note: cal.note(x.date) }))} peutEcrire={peutEcrire} />
        <Carte titre="Prévu contre réalisé (14 derniers jours)">
          <ul className="divide-rows text-sm">
            {passe.map((j) => {
              const fort = j.ecart !== null && Math.abs(j.ecart) > seuil;
              return (
                <li key={j.date} className="flex items-center justify-between py-1.5">
                  <span>{dateCourte(j.date)}</span>
                  <span className="tabular-nums">
                    <span className="text-muted">{fmtDH(j.prevu)}</span> → <span className="font-medium">{j.realise === null ? "—" : fmtDH(j.realise)}</span>
                    {j.ecart !== null && <span className={`ml-1 text-xs ${fort ? (j.ecart < 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700") : "text-muted"}`}>{j.ecart >= 0 ? "+" : ""}{fmtPct(j.ecart, 0)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">Un écart de plus de {fmtPct(seuil, 0)} est mis en évidence. Les estimations se recalculent à chaque nouveau CA réalisé (médiane des 4 dernières occurrences du même jour de la semaine).</p>
        </Carte>
      </div>
    </>
  );
}
