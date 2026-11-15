import { cache } from "react";
import { desc, eq, gte, lte, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ajouterJours, dateLocale, jourSemaine, type ISODate } from "@/lib/dates";
import type { JourPrevu, TypeJournee } from "@/lib/engine/types";
import type { Previsionniste } from "@/lib/engine/moteur";
import { chargerCalendrier } from "./calendrier";
import { chargerParametres, nombreDepuis } from "./parametres";
import { journaliser, type Acteur } from "./journal";

export interface PrevisionJour extends JourPrevu {
  origine: "estime" | "saisi";
  /** Détail de l'estimation pour l'écran. */
  base: string;
}

function mediane(valeurs: number[]): number {
  const v = [...valeurs].sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return 0;
  return n % 2 === 1 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}

/**
 * Estimateur de CA : médiane du CA réalisé des 4 dernières occurrences du même jour de
 * la semaine, hors jours fériés et fermetures. Un jour férié prend la médiane des 4
 * derniers jours de type « week-end ». Moins de 4 occurrences : moyennes de départ.
 */
export const chargerPrevisionniste = cache(async (): Promise<{
  pour: (date: ISODate) => PrevisionJour;
  prevision: Previsionniste;
}> => {
  const [cal, p, saisies, historique, exceptions] = await Promise.all([
    chargerCalendrier(),
    chargerParametres(),
    db.select().from(schema.previsionsCa),
    db
      .select({ date: schema.cloturesJournee.date, ca: schema.cloturesJournee.caRealise })
      .from(schema.cloturesJournee)
      .orderBy(desc(schema.cloturesJournee.date))
      .limit(120),
    db.select().from(schema.calendrier),
  ]);
  const occurrences = nombreDepuis(p, "historique_ca_occurrences");
  const defauts: Record<TypeJournee, number> = {
    semaine: nombreDepuis(p, "ca_defaut_semaine"),
    weekend: nombreDepuis(p, "ca_defaut_weekend"),
  };
  const saisiesMap = new Map(saisies.filter((s) => s.origine === "saisi").map((s) => [s.date, Number(s.montant)]));
  const exceptionDates = new Set(exceptions.map((e) => e.date));
  // Historique utilisable : jours ouverts ordinaires (ni férié ni fermeture exceptionnelle).
  const hist = historique.filter((h) => !exceptionDates.has(h.date) && Number(h.ca) > 0);
  const memo = new Map<ISODate, PrevisionJour>();

  function estimer(date: ISODate): { montant: number; base: string } {
    const type = cal.typeJournee(date);
    const estException = exceptionDates.has(date);
    let candidats: number[];
    if (estException) {
      candidats = hist.filter((h) => cal.typeJournee(h.date) === "weekend" && h.date < date).map((h) => Number(h.ca));
    } else {
      const js = jourSemaine(date);
      candidats = hist.filter((h) => jourSemaine(h.date) === js && h.date < date).map((h) => Number(h.ca));
    }
    const derniers = candidats.slice(0, occurrences);
    if (derniers.length >= occurrences) {
      return {
        montant: mediane(derniers),
        base: estException
          ? `médiane des ${occurrences} derniers jours de type week-end`
          : `médiane des ${occurrences} derniers ${["dimanches", "lundis", "mardis", "mercredis", "jeudis", "vendredis", "samedis"][jourSemaine(date)]}`,
      };
    }
    return { montant: defauts[type], base: `moyenne de départ (${type === "weekend" ? "week-end" : "semaine"})` };
  }

  const pour = (date: ISODate): PrevisionJour => {
    const m = memo.get(date);
    if (m) return m;
    const type = cal.typeJournee(date);
    const saisi = saisiesMap.get(date);
    const r: PrevisionJour =
      saisi !== undefined
        ? { date, type, ca: saisi, origine: "saisi", base: "saisi par un propriétaire" }
        : { date, type, ca: estimer(date).montant, origine: "estime", base: estimer(date).base };
    memo.set(date, r);
    return r;
  };
  return { pour, prevision: (date) => pour(date) };
});

/** Les jours ouverts des `nbJours` prochains jours, avec leur prévision. */
export async function listerPrevisions(nbJours = 14, depuis: ISODate = dateLocale()): Promise<PrevisionJour[]> {
  const cal = await chargerCalendrier();
  const { pour } = await chargerPrevisionniste();
  const res: PrevisionJour[] = [];
  for (let i = 0; i < nbJours; i++) {
    const d = ajouterJours(depuis, i);
    if (cal.estOuvert(d)) res.push(pour(d));
  }
  return res;
}

export async function enregistrerPrevision(acteur: Acteur, date: ISODate, montant: number | null): Promise<void> {
  const [avant] = await db.select().from(schema.previsionsCa).where(eq(schema.previsionsCa.date, date));
  if (montant === null) {
    // Retour à l'estimation : on efface la saisie (journalisé).
    if (avant) await db.delete(schema.previsionsCa).where(eq(schema.previsionsCa.date, date));
  } else {
    await db
      .insert(schema.previsionsCa)
      .values({
        date,
        montant: String(montant),
        origine: "saisi",
        saisiParPosteId: acteur.posteId,
        saisiParPersonneId: acteur.personneId,
        modifieLe: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.previsionsCa.date,
        set: {
          montant: String(montant),
          origine: "saisi",
          saisiParPosteId: acteur.posteId,
          saisiParPersonneId: acteur.personneId,
          modifieLe: new Date(),
        },
      });
  }
  await journaliser(acteur, "prevision_ca", "saisir", {
    avant: avant ? { date, montant: avant.montant } : null,
    apres: { date, montant },
  });
}

/** Prévu, réalisé et écart pour les jours passés d'une période. */
export async function prevuContreRealise(debut: ISODate, fin: ISODate) {
  const { pour } = await chargerPrevisionniste();
  const cal = await chargerCalendrier();
  const clotures = await db
    .select()
    .from(schema.cloturesJournee)
    .where(and(gte(schema.cloturesJournee.date, debut), lte(schema.cloturesJournee.date, fin)))
    .orderBy(desc(schema.cloturesJournee.date));
  const parDate = new Map(clotures.map((c) => [c.date, c]));
  const res: { date: ISODate; prevu: number; realise: number | null; ecart: number | null; origine: string }[] = [];
  let d = fin;
  while (d >= debut) {
    if (cal.estOuvert(d)) {
      const prev = pour(d);
      const c = parDate.get(d);
      const realise = c ? Number(c.caRealise) : null;
      res.push({
        date: d,
        prevu: prev.ca,
        realise,
        ecart: realise !== null && prev.ca > 0 ? (realise - prev.ca) / prev.ca : null,
        origine: prev.origine,
      });
    }
    d = ajouterJours(d, -1);
  }
  return res;
}
