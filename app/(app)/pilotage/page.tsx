import Link from "next/link";
import { ListeAlertes, type AlerteVue } from "@/components/ListeAlertes";
import { Carte, Chiffre, EnTete, Ligne, Vide } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { pinDefini } from "@/lib/auth/crypto";
import { listerPostes } from "@/lib/services/comptes";
import { Message } from "@/components/ui/primitives";
import { dateCourte, dateLongue, journeeExploitation } from "@/lib/dates";
import { fmtDH, fmtPct } from "@/lib/format";
import { alertesOuvertes } from "@/lib/services/alertes";
import { chargerCalendrier } from "@/lib/services/calendrier";
import { chiffresDeLaVeille } from "@/lib/services/cloture";
import { listerCommandes } from "@/lib/services/commandes";
import { listerPrevisions } from "@/lib/services/previsions";
import { serialiser } from "@/lib/vues";

export default async function PagePilotage() {
  const s = await exigerDroit("previsionnel:ecrire");
  const journee = journeeExploitation();
  const cal = await chargerCalendrier();
  const veille = cal.jourOuvertPrecedent(journee);
  const [alertes, chiffres, aValider, previsions, postes] = await Promise.all([
    alertesOuvertes({ role: s.poste.role, posteId: s.poste.id }),
    chiffresDeLaVeille(veille),
    listerCommandes(["en_attente_validation"]),
    listerPrevisions(8),
    listerPostes(false),
  ]);
  const sansCode = postes.filter((x) => x.role !== "employe" && !pinDefini(x.pinHash)).length;
  const ecartCa = chiffres.realise !== null && chiffres.prevu > 0 ? (chiffres.realise - chiffres.prevu) / chiffres.prevu : null;
  return (
    <>
      <EnTete titre="Pilotage" sousTitre={dateLongue(journee)} action={<Link href="/taches/nouvelle" className="btn-ghost btn-sm">+ Tâche</Link>} />
      <div className="flex flex-col gap-4">
        {sansCode > 0 && (
          <Link href="/mise-en-service" className="block">
            <Message type="attention">
              {sansCode} compte{sansCode > 1 ? "s" : ""} d&apos;associé ou d&apos;encadrement sans code : envoyez les invitations depuis « Mise en service ».
            </Message>
          </Link>
        )}
        <Carte titre={`Alertes ouvertes (${alertes.length})`} action={<Link href="/alertes" className="lien text-sm text-brand">Toutes</Link>}>
          <ListeAlertes alertes={serialiser(alertes.slice(0, 5)) as unknown as AlerteVue[]} compact />
        </Carte>

        <section>
          <h2 className="mb-2 text-base">La veille — {dateCourte(veille)}</h2>
          <div className="grid grid-cols-2 gap-2">
            <Chiffre libelle="CA réalisé" valeur={chiffres.realise === null ? "non saisi" : fmtDH(chiffres.realise)} detail={`prévu ${fmtDH(chiffres.prevu)}${ecartCa !== null ? ` · ${ecartCa >= 0 ? "+" : ""}${(ecartCa * 100).toFixed(0)} %` : ""}`} teinte={ecartCa !== null && Math.abs(ecartCa) > 0.05 ? (ecartCa < 0 ? "rouge" : "vert") : undefined} />
            <Chiffre libelle="Coût matière" valeur={chiffres.coutMatierePct === null ? "—" : fmtPct(chiffres.coutMatierePct)} detail={chiffres.coutMatiere === null ? "comptages ou prix manquants" : fmtDH(chiffres.coutMatiere)} />
            <Chiffre libelle="Pertes déclarées" valeur={fmtDH(chiffres.pertes)} />
            <Chiffre libelle="Tâches faites" valeur={chiffres.taches.total > 0 ? `${chiffres.taches.faites}/${chiffres.taches.total}` : "—"} detail={chiffres.taches.total > 0 ? fmtPct(chiffres.taches.faites / chiffres.taches.total, 0) : undefined} teinte={chiffres.taches.total > 0 && chiffres.taches.faites / chiffres.taches.total < 0.8 ? "orange" : undefined} />
          </div>
        </section>

        <Carte titre="Commandes à valider" action={<Link href="/commandes" className="lien text-sm text-brand">Commandes</Link>}>
          {aValider.length === 0 ? (
            <Vide>Aucune commande en attente.</Vide>
          ) : (
            <ul className="divide-rows">
              {aValider.map((c) => (
                <li key={c.c.id}>
                  <Ligne href={`/commandes/${c.c.id}`} gauche={<span className="font-medium">{c.fournisseur}</span>} droite={<span className="text-sm">{fmtDH(c.c.montantEstime)}</span>} />
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Prévisionnel de la semaine" action={<Link href="/previsionnel" className="lien text-sm text-brand">Modifier</Link>}>
          <ul className="divide-rows text-sm">
            {previsions.map((p) => (
              <li key={p.date} className="flex items-center justify-between py-1.5">
                <span>
                  {dateCourte(p.date)} <span className="text-xs text-muted">{p.type === "weekend" ? "week-end" : "semaine"}</span>
                </span>
                <span className="tabular-nums">
                  {fmtDH(p.ca)} <span className={`text-xs ${p.origine === "saisi" ? "text-emerald-700" : "text-muted"}`}>{p.origine === "saisi" ? "saisi" : "estimé"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Carte>
      </div>
    </>
  );
}
