import { GestionComptes } from "@/components/comptes/GestionComptes";
import { EnTete } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { codeEnrolement, listerAppareils, listerPersonnes, listerPostes } from "@/lib/services/comptes";

export default async function PageComptes() {
  const s = await exigerDroit("comptes:employes");
  const estProprietaire = s.poste.role === "proprietaire";
  const [postes, code, appareils] = await Promise.all([listerPostes(true), estProprietaire ? codeEnrolement() : Promise.resolve(""), estProprietaire ? listerAppareils() : Promise.resolve([])]);
  const vues = [];
  for (const p of postes) {
    const personnes = await listerPersonnes(p.id);
    vues.push({
      id: p.id,
      nom: p.nom,
      role: p.role,
      zone: p.zone,
      actif: p.actif,
      posteSuperieurId: p.posteSuperieurId,
      voitPreparations: p.voitPreparations,
      planNettoyage: p.planNettoyage,
      personnes: personnes.filter((x) => !x.fusionneeDans).map((x) => ({ id: x.id, prenom: x.prenom, archivee: x.archivee, derniereConnexion: x.derniereConnexion.toISOString() })),
    });
  }
  return (
    <>
      <EnTete titre="Comptes et postes" sousTitre="Un compte est attaché à un poste, pas à une personne : le prénom saisi à la connexion dit qui agit." />
      <GestionComptes
        postes={vues}
        estProprietaire={estProprietaire}
        codeEnrolement={code}
        appareils={appareils.map((a) => ({ id: a.id, libelle: a.libelle, enroleLe: a.enroleLe.toISOString(), dernierVuLe: a.dernierVuLe.toISOString(), revoque: a.revoque }))}
        monPosteId={s.poste.id}
      />
    </>
  );
}
