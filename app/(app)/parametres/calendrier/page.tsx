import { actionCalendrier, actionRetirerException } from "@/app/actions/parametres";
import { BoutonAction } from "@/components/ui/BoutonAction";
import { Formulaire } from "@/components/ui/Formulaire";
import { Badge, Carte, Champ, EnTete, Vide } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { dateLongue } from "@/lib/dates";
import { listerExceptions } from "@/lib/services/calendrier";

export default async function PageCalendrier() {
  const s = await exigerDroit("parametres:lire");
  const peutEcrire = aLeDroit(s.poste.role, "parametres:ecrire");
  const exceptions = await listerExceptions();
  return (
    <>
      <EnTete titre="Calendrier" retour="/parametres" sousTitre="Jours fériés et fermetures exceptionnelles. Un jour férié prend par défaut le type « week-end »." />
      <div className="flex flex-col gap-4">
        {peutEcrire && (
          <Formulaire action={actionCalendrier} bouton="Enregistrer" className="card">
            <Champ label="Date">
              <input type="date" name="date" className="input" required />
            </Champ>
            <div className="grid grid-cols-2 gap-2">
              <Champ label="Restaurant">
                <select name="ouvert" className="input" defaultValue="oui">
                  <option value="oui">Ouvert (jour férié)</option>
                  <option value="non">Fermé</option>
                </select>
              </Champ>
              <Champ label="Type de journée">
                <select name="type" className="input" defaultValue="weekend">
                  <option value="weekend">Week-end</option>
                  <option value="semaine">Semaine</option>
                </select>
              </Champ>
            </div>
            <Champ label="Note">
              <input name="note" className="input" placeholder="Ex. Aïd, fermeture pour travaux" />
            </Champ>
          </Formulaire>
        )}
        <Carte titre="Exceptions enregistrées">
          {exceptions.length === 0 ? (
            <Vide>Aucune exception : mardi à dimanche ouverts, lundi fermé.</Vide>
          ) : (
            <ul className="divide-rows text-sm">
              {exceptions.map((e) => (
                <li key={e.date} className="flex items-center justify-between gap-2 py-1.5">
                  <span>
                    {dateLongue(e.date, true)} {e.ouvert ? <Badge teinte={e.typeJournee === "weekend" ? "brand" : "neutre"}>{e.typeJournee === "weekend" ? "week-end" : "semaine"}</Badge> : <Badge teinte="rouge">fermé</Badge>}
                    {e.note && <span className="block text-xs text-muted">{e.note}</span>}
                  </span>
                  {peutEcrire && (
                    <BoutonAction className="text-xs text-red-700 underline" action={() => actionRetirerException(e.date)}>
                      retirer
                    </BoutonAction>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </>
  );
}
