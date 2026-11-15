import Link from "next/link";
import { FormulaireCloture } from "@/components/cloture/FormulaireCloture";
import { LienWhatsApp } from "@/components/ui/LienWhatsApp";
import { Carte, EnTete, Message } from "@/components/ui/primitives";
import { exigerDroit } from "@/lib/auth/session";
import { dateLongue, journeeExploitation } from "@/lib/dates";
import { fmtDH, fmtNombre, fmtPct } from "@/lib/format";
import { chargerCalendrier } from "@/lib/services/calendrier";
import { clotureDuJour, composerRapport, coutMatiereDuJour, urlRapportWhatsApp } from "@/lib/services/cloture";

export default async function PageCloture({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await exigerDroit("cloture:ecrire");
  const { date: dateParam } = await searchParams;
  const journee = journeeExploitation();
  const cal = await chargerCalendrier();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : journee;
  const veille = cal.jourOuvertPrecedent(date);
  const [cloture, cm] = await Promise.all([clotureDuJour(date), coutMatiereDuJour(date)]);
  const rapport = cloture ? cloture.rapport ?? (await composerRapport(date)) : null;
  return (
    <>
      <EnTete
        titre="Clôture de journée"
        sousTitre={dateLongue(date)}
        action={
          <div className="flex gap-1">
            <Link href={`/cloture?date=${veille}`} className="btn-ghost btn-sm">Veille</Link>
            {date !== journee && <Link href="/cloture" className="btn-ghost btn-sm">Auj.</Link>}
          </div>
        }
      />
      <div className="flex flex-col gap-4">
        {!cal.estOuvert(date) && <Message type="attention">Jour fermé au calendrier.</Message>}
        <FormulaireCloture
          date={date}
          valeurs={{
            caRealise: cloture ? Number(cloture.caRealise) : null,
            caMidi: cloture?.caMidi === null || cloture?.caMidi === undefined ? null : Number(cloture.caMidi),
            caSoir: cloture?.caSoir === null || cloture?.caSoir === undefined ? null : Number(cloture.caSoir),
            couverts: cloture?.couverts ?? null,
            especes: cloture?.especes === null || cloture?.especes === undefined ? null : Number(cloture.especes),
            carte: cloture?.carte === null || cloture?.carte === undefined ? null : Number(cloture.carte),
            manquant: cloture?.manquant === null || cloture?.manquant === undefined ? null : Number(cloture.manquant),
            faitMarquant: cloture?.faitMarquant ?? null,
            source: cloture?.source ?? null,
          }}
        />
        <Carte titre="Coût matière du jour">
          {cm.calculable ? (
            <>
              <p className="display text-3xl font-bold">
                {cm.pct !== null ? fmtPct(cm.pct) : "—"} <span className="text-base font-normal text-muted">{fmtDH(cm.total)} · cible {fmtPct(cm.cible, 0)}</span>
              </p>
              <ul className="mt-2 divide-rows text-sm">
                {cm.lignes.map((l) => (
                  <li key={l.nom} className="flex justify-between py-1">
                    <span>{l.nom}</span>
                    <span className="tabular-nums text-muted">
                      {fmtNombre(l.matin, 1)} + {fmtNombre(l.receptions, 1)} − {fmtNombre(l.soir, 1)} = {fmtNombre(l.consomme, 1)} {l.unite} · {fmtDH(l.cout)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Message type="info">Non calculable pour l&apos;instant : {cm.manque.join(" ; ")}. Il faut le comptage du matin, le comptage de fermeture des produits critiques et un prix d&apos;achat.</Message>
          )}
        </Carte>
        {rapport && (
          <Carte titre="Rapport du soir">
            <pre className="whitespace-pre-wrap rounded-xl bg-bg p-3 text-xs">{rapport}</pre>
            <div className="mt-3">
              <LienWhatsApp url={urlRapportWhatsApp(rapport)} texte={rapport} libelle="Envoyer le rapport" />
            </div>
            <p className="mt-2 text-xs text-muted">WhatsApp demande de choisir la conversation : en pratique, le groupe de la direction.</p>
          </Carte>
        )}
      </div>
    </>
  );
}
