import Link from "next/link";
import { ListeAlertes, type AlerteVue } from "@/components/ListeAlertes";
import { CarteTache } from "@/components/taches/CarteTache";
import { Badge, Carte, EnTete, Ligne, Vide } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { dateLongue, instantCourt, journeeExploitation } from "@/lib/dates";
import { fmtDH } from "@/lib/format";
import { alertesOuvertes } from "@/lib/services/alertes";
import { clotureDuJour } from "@/lib/services/cloture";
import { receptionsDuJour } from "@/lib/services/receptions";
import { genererTachesDuJour, tachesDuPoste, tachesRemonteesPour } from "@/lib/services/taches";
import { serialiser } from "@/lib/vues";

export default async function PageManager() {
  const s = await exigerDroit("cloture:ecrire");
  const journee = journeeExploitation();
  await genererTachesDuJour(journee);
  const [taches, receptions, remontees, alertes, cloture] = await Promise.all([
    tachesDuPoste(s.poste.id, journee),
    receptionsDuJour(journee),
    tachesRemonteesPour("manager", journee),
    alertesOuvertes({ role: s.poste.role, posteId: s.poste.id }),
    clotureDuJour(journee),
  ]);
  const restantes = taches.filter((t) => ["a_faire", "a_refaire", "en_retard", "bloquee"].includes(t.statut));
  return (
    <>
      <EnTete titre="Exploitation" sousTitre={dateLongue(journee)} />
      <div className="flex flex-col gap-4">
        {alertes.length > 0 && (
          <Carte titre={`Alertes (${alertes.length})`} action={<Link href="/alertes" className="text-sm text-brand">Toutes</Link>}>
            <ListeAlertes alertes={serialiser(alertes.slice(0, 4)) as unknown as AlerteVue[]} compact />
          </Carte>
        )}
        {remontees.length > 0 && (
          <Carte titre="Remontées jusqu'à vous" className="border-red-300" action={<Link href="/equipe" className="text-sm text-brand">Équipe</Link>}>
            <div className="flex flex-col gap-2">
              {remontees.slice(0, 5).map((t) => (
                <CarteTache key={t.id} t={t} />
              ))}
            </div>
          </Carte>
        )}
        <Carte titre={`Mes tâches (${restantes.length} restantes)`} action={<Link href="/taches" className="text-sm text-brand">Toutes</Link>}>
          {restantes.length === 0 ? (
            <Vide>Tout est fait.</Vide>
          ) : (
            <div className="flex flex-col gap-2">
              {restantes.slice(0, 4).map((t) => (
                <CarteTache key={t.id} t={t} />
              ))}
            </div>
          )}
        </Carte>
        <Carte titre="Réceptions du jour" action={<Link href="/receptions/nouvelle" className="btn-brand btn-sm">Nouvelle</Link>}>
          {receptions.length === 0 ? (
            <Vide>Aucune livraison saisie. Les livraisons arrivent le matin, avant le service.</Vide>
          ) : (
            <ul className="divide-rows">
              {receptions.map((r) => (
                <li key={r.r.id}>
                  <Ligne href={`/receptions/${r.r.id}`} gauche={<span>{r.fournisseur} <span className="text-xs text-muted">· {instantCourt(r.r.creeLe)}</span></span>} droite={<Badge teinte={r.r.statut === "validee" ? "vert" : "orange"}>{r.r.statut === "validee" ? "validée" : "en cours"}</Badge>} />
                </li>
              ))}
            </ul>
          )}
        </Carte>
        <Carte titre="Clôture de journée" action={<Link href="/cloture" className="btn-ghost btn-sm">Ouvrir</Link>}>
          {cloture ? (
            <p className="text-sm">
              CA réalisé {fmtDH(cloture.caRealise)} ({cloture.source === "import" ? "import caisse" : "saisi"}). Rapport {cloture.rapport ? "composé" : "à composer"}.
            </p>
          ) : (
            <p className="text-sm text-muted">Après le service : CA, couverts, espèces, carte, manquant, fait marquant, puis envoi du rapport.</p>
          )}
        </Carte>
      </div>
    </>
  );
}
