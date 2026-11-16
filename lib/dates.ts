/**
 * Dates et heures de l'exploitation.
 * Fuseau Africa/Casablanca. La journée d'exploitation se termine à 4 h du matin.
 */

/**
 * Le Maroc est passé à l'heure GMT permanente (UTC+0) le 20 septembre 2026 (tzdata 2026c).
 * Un environnement dont la table des fuseaux est plus ancienne calculerait encore UTC+1 :
 * dans ce cas, on utilise UTC, qui est l'heure légale marocaine depuis cette date.
 */
function fuseauEffectif(): string {
  try {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Casablanca", timeZoneName: "shortOffset" });
    const nom = f.formatToParts(new Date(Date.UTC(2026, 10, 15, 12))).find((p) => p.type === "timeZoneName")?.value ?? "";
    return nom === "GMT" || nom === "GMT+0" ? "Africa/Casablanca" : "UTC";
  } catch {
    return "UTC";
  }
}

export const FUSEAU = fuseauEffectif();
export const FIN_JOURNEE_EXPLOITATION_HEURE = 4;

export type ISODate = string; // YYYY-MM-DD

const partsFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Composantes locales (Casablanca) d'un instant. */
export function composantesLocales(d: Date): {
  annee: number;
  mois: number;
  jour: number;
  heure: number;
  minute: number;
  seconde: number;
} {
  const p = Object.fromEntries(partsFormatter.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    annee: Number(p.year),
    mois: Number(p.month),
    jour: Number(p.day),
    heure: Number(p.hour),
    minute: Number(p.minute),
    seconde: Number(p.second),
  };
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Date civile locale (YYYY-MM-DD) d'un instant. */
export function dateLocale(d: Date = new Date()): ISODate {
  const c = composantesLocales(d);
  return `${c.annee}-${pad2(c.mois)}-${pad2(c.jour)}`;
}

/** Heure locale HH:MM d'un instant. */
export function heureLocale(d: Date = new Date()): string {
  const c = composantesLocales(d);
  return `${pad2(c.heure)}:${pad2(c.minute)}`;
}

/** Journée d'exploitation : avant 4 h du matin, on appartient encore à la veille. */
export function journeeExploitation(d: Date = new Date()): ISODate {
  const c = composantesLocales(d);
  const civile = `${c.annee}-${pad2(c.mois)}-${pad2(c.jour)}`;
  if (c.heure < FIN_JOURNEE_EXPLOITATION_HEURE) return ajouterJours(civile, -1);
  return civile;
}

export function ajouterJours(date: ISODate, n: number): ISODate {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d + n);
  const r = new Date(t);
  return `${r.getUTCFullYear()}-${pad2(r.getUTCMonth() + 1)}-${pad2(r.getUTCDate())}`;
}

/** 0 = dimanche ... 6 = samedi */
export function jourSemaine(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function comparerDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function joursEntre(a: ISODate, b: ISODate): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Décalage (minutes) du fuseau Casablanca à un instant donné. */
function decalageMinutes(instant: Date): number {
  const c = composantesLocales(instant);
  const commeUtc = Date.UTC(c.annee, c.mois - 1, c.jour, c.heure, c.minute, c.seconde);
  return Math.round((commeUtc - instant.getTime()) / 60000);
}

/** Instant correspondant à une date et une heure locales (Casablanca). */
export function instantLocal(date: ISODate, heure: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = heure.split(":").map(Number);
  const approx = new Date(Date.UTC(y, m - 1, d, hh, mm ?? 0));
  const dec = decalageMinutes(approx);
  const corrige = new Date(approx.getTime() - dec * 60000);
  // Deuxième passe : autour d'un changement d'heure, le décalage peut différer.
  const dec2 = decalageMinutes(corrige);
  return dec2 === dec ? corrige : new Date(approx.getTime() - dec2 * 60000);
}

/** Fin de la journée d'exploitation : 4 h du matin le lendemain civil. */
export function finJourneeExploitation(date: ISODate): Date {
  return instantLocal(ajouterJours(date, 1), `${pad2(FIN_JOURNEE_EXPLOITATION_HEURE)}:00`);
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function nomJour(date: ISODate, court = false): string {
  const j = jourSemaine(date);
  return court ? JOURS_COURTS[j] : JOURS[j];
}

/** « mardi 4 novembre » */
export function dateLongue(date: ISODate, avecAnnee = false): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${nomJour(date)} ${d} ${MOIS[m - 1]}${avecAnnee ? ` ${y}` : ""}`;
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « mar. 4 nov. » */
export function dateCourte(date: ISODate): string {
  const [, m, d] = date.split("-").map(Number);
  return `${nomJour(date, true)} ${d} ${MOIS_COURTS[m - 1]}`;
}

/** « 04/11/2026 » */
export function dateNumerique(date: ISODate): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

/** « 04/11 14:32 » */
export function instantCourt(d: Date): string {
  const c = composantesLocales(d);
  return `${pad2(c.jour)}/${pad2(c.mois)} ${pad2(c.heure)}:${pad2(c.minute)}`;
}

export function premierJourDuMois(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}
