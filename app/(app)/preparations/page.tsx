import Link from "next/link";
import { eq } from "drizzle-orm";
import { FichePreparations, type LigneFiche } from "@/components/preparations/FichePreparations";
import { Badge, EnTete, Message } from "@/components/ui/primitives";
import { aLeDroit } from "@/lib/auth/droits";
import { exigerDroit } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { dateLongue, heureLocale, journeeExploitation } from "@/lib/dates";
import { fmtDH } from "@/lib/format";
import { chargerMoteur } from "@/lib/services/moteur";

export default async function PagePreparations({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const s = await exigerDroit("preparations:lire");
  if (s.poste.role === "employe" && !s.poste.voitPreparations) {
    return <Message type="info">Votre poste ne voit pas la fiche des préparations.</Message>;
  }
  const { date: dateParam } = await searchParams;
  const aujourdHui = journeeExploitation();
  const { moteur, articles, parametres } = await chargerMoteur();
  const cal = moteur.calendrier;
  // La fiche d'un jour est consultable dès la veille au soir.
  let date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : aujourdHui;
  if (!cal.estOuvert(date)) date = cal.prochainJourOuvert(date);
  const prochain = cal.prochainJourOuvert(date);
  const precedent = cal.jourOuvertPrecedent(date);
  const saisies = await db.select().from(schema.preparationsJour).where(eq(schema.preparationsJour.date, date));
  const parArticle = new Map(saisies.map((x) => [x.articleId, x]));
  const fiche = moteur.fichePreparations(
    date,
    new Map(saisies.map((x) => [x.articleId, { resteVeille: x.resteVeille === null ? null : Number(x.resteVeille), forcee: x.forcee === null ? null : Number(x.forcee) }])),
  );
  const lignes: LigneFiche[] = fiche
    .map((f) => {
      const a = articles.get(f.articleId)!;
      const sx = parArticle.get(f.articleId);
      return {
        ...f,
        resteVeille: sx?.resteVeille === null || sx?.resteVeille === undefined ? null : Number(sx.resteVeille),
        motifForcage: sx?.motifForcage ?? null,
        uniteBatch: a.uniteBatch ?? null,
        detail: moteur.detailVentes(f.articleId, date).filter((d) => d.unites > 0).map((d) => ({ nom: d.nom, unites: d.unites })),
        ingredients: moteur.ingredients(f.articleId, f.aPreparer).map((i) => ({ nom: i.nom, quantite: i.quantite, unite: i.unite })),
      };
    })
    .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
  const jour = moteur.jour(date);
  const veille = cal.estVeilleFermeture(date);
  return (
    <>
      <EnTete
        titre="Préparations"
        sousTitre={
          <>
            {dateLongue(date)} · CA prévu {fmtDH(jour.ca)} ({jour.type === "weekend" ? "week-end" : "semaine"}) · marge {Math.round(moteur.margeGenerale * 100)} %
            {veille && <> · <Badge teinte="orange">veille de fermeture</Badge></>}
          </>
        }
        action={
          <div className="flex gap-1">
            <Link href={`/preparations?date=${precedent}`} className="btn-ghost btn-sm" aria-label="Jour précédent">‹</Link>
            {date !== aujourdHui && <Link href="/preparations" className="btn-ghost btn-sm">Auj.</Link>}
            <Link href={`/preparations?date=${prochain}`} className="btn-ghost btn-sm" aria-label="Jour suivant">›</Link>
          </div>
        }
      />
      {date > aujourdHui && <div className="mb-3"><Message type="info">Fiche du lendemain, consultable dès la veille au soir pour répartir le travail. Les restes de la veille se saisissent le matin même.</Message></div>}
      {date === aujourdHui && heureLocale() >= "18:00" && (
        <Link href={`/preparations?date=${prochain}`} className="btn-ghost mb-3 w-full">
          Voir la fiche de {dateLongue(prochain)}
        </Link>
      )}
      <FichePreparations
        lignes={lignes}
        date={date}
        peutSaisirRestes={aLeDroit(s.poste.role, "preparations:restes")}
        peutForcer={aLeDroit(s.poste.role, "preparations:forcer")}
      />
      <p className="mt-4 text-xs text-muted">
        Pièces arrondies à l&apos;entier supérieur, poids et volumes à une décimale vers le haut ; les calculs intermédiaires ne sont jamais arrondis. Paramètres : {parametres.nom_restaurant ?? "Easy Burger"}.
      </p>
    </>
  );
}
