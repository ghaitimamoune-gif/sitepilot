import { ListeAlertes, type AlerteVue } from "@/components/ListeAlertes";
import { Carte, EnTete } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { alertesOuvertes, alertesTraitees } from "@/lib/services/alertes";
import { serialiser } from "@/lib/vues";

export default async function PageAlertes() {
  const s = await exigerDroit("alertes:lire");
  const f = { role: s.poste.role, posteId: s.poste.id };
  const [ouvertes, traitees] = await Promise.all([alertesOuvertes(f), alertesTraitees(f, 30)]);
  return (
    <>
      <EnTete titre="Alertes" sousTitre={`${ouvertes.length} ouverte${ouvertes.length > 1 ? "s" : ""}, les critiques en tête`} />
      <div className="flex flex-col gap-4">
        <ListeAlertes alertes={serialiser(ouvertes) as unknown as AlerteVue[]} />
        {traitees.length > 0 && (
          <Carte titre="Historique récent">
            <ListeAlertes alertes={serialiser(traitees) as unknown as AlerteVue[]} peutTraiter={false} compact />
          </Carte>
        )}
      </div>
    </>
  );
}
