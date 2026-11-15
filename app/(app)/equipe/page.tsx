import Link from "next/link";
import { CarteTache } from "@/components/taches/CarteTache";
import { EnTete, Vide } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerSession } from "@/lib/auth/session";
import { dateLongue, journeeExploitation } from "@/lib/dates";
import { genererTachesDuJour, tachesDeLEquipe, tachesRemonteesPour } from "@/lib/services/taches";

export default async function PageEquipe() {
  const s = await exigerSession();
  const peutVerifier = aLeDroit(s.poste.role, "taches:verifier") || s.poste.role === "proprietaire";
  const journee = journeeExploitation();
  await genererTachesDuJour(journee);
  const { postes, taches } = peutVerifier ? await tachesDeLEquipe(s.poste, journee) : { postes: [], taches: [] };
  const remontees = await tachesRemonteesPour(s.poste.role, journee);
  const posteNom = new Map(postes.map((p) => [p.id, p.nom]));
  const idsRemontees = new Set(remontees.map((t) => t.id));
  const aVerifier = taches.filter((t) => t.statut === "faite");
  const enCours = taches.filter((t) => ["a_faire", "a_refaire"].includes(t.statut) && !idsRemontees.has(t.id));
  const terminees = taches.filter((t) => ["verifiee", "non_faite"].includes(t.statut));
  return (
    <>
      <EnTete
        titre="Tâches de l'équipe"
        sousTitre={`${dateLongue(journee)} · ${postes.length} poste${postes.length > 1 ? "s" : ""}`}
        action={aLeDroit(s.poste.role, "taches:creer") ? <Link href="/taches/nouvelle" className="btn-brand btn-sm">+ Tâche</Link> : undefined}
      />
      <div className="flex flex-col gap-2">
        {remontees.length > 0 && (
          <>
            <h2 className="text-base text-red-700">Remontées jusqu&apos;à vous</h2>
            {remontees.map((t) => (
              <CarteTache key={t.id} t={t} poste={posteNom.get(t.posteId) ?? `Poste ${t.posteId}`} />
            ))}
          </>
        )}
        {aVerifier.length > 0 && (
          <>
            <h2 className="mt-2 text-base">À vérifier</h2>
            {aVerifier.map((t) => (
              <CarteTache key={t.id} t={t} poste={posteNom.get(t.posteId)} />
            ))}
          </>
        )}
        <h2 className="mt-2 text-base">En cours</h2>
        {enCours.length === 0 && remontees.length === 0 && aVerifier.length === 0 && <Vide>Aucune tâche en cours dans votre périmètre.</Vide>}
        {enCours.map((t) => (
          <CarteTache key={t.id} t={t} poste={posteNom.get(t.posteId)} />
        ))}
        {terminees.length > 0 && (
          <>
            <h2 className="mt-2 text-base text-muted">Terminées</h2>
            {terminees.map((t) => (
              <CarteTache key={t.id} t={t} poste={posteNom.get(t.posteId)} />
            ))}
          </>
        )}
      </div>
    </>
  );
}
