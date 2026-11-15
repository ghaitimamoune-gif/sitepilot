import { asc } from "drizzle-orm";
import { ModelesTaches } from "@/components/parametres/ModelesTaches";
import { EnTete } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { chargerMoteur } from "@/lib/services/moteur";
import { postesActifs } from "@/lib/services/taches";

export default async function PageModelesTaches() {
  const s = await exigerDroit("parametres:lire");
  const [modeles, postes, { familles }] = await Promise.all([
    db.select().from(schema.tacheModeles).orderBy(asc(schema.tacheModeles.ordre), asc(schema.tacheModeles.titre)),
    postesActifs(),
    chargerMoteur(),
  ]);
  return (
    <>
      <EnTete titre="Modèles de tâches" retour="/parametres" sousTitre="Les tâches récurrentes se génèrent chaque jour ouvert à partir de ces modèles (checklists 03.1 à 03.9 du manuel)." />
      <ModelesTaches
        modeles={modeles.map((m) => ({ ...m }))}
        postes={postes.map((p) => ({ id: p.id, nom: p.nom }))}
        familles={familles.map((f) => ({ id: f.id, nom: f.nom }))}
        peutEcrire={aLeDroit(s.poste.role, "parametres:ecrire")}
      />
    </>
  );
}
