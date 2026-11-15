import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Calendrier, type ExceptionCalendrier } from "@/lib/engine/calendrier";
import type { ISODate } from "@/lib/dates";
import { chargerParametres, listeEntiers } from "./parametres";
import { journaliser, type Acteur } from "./journal";

/** Calendrier d'exploitation : jours de fermeture hebdomadaire, fériés et fermetures exceptionnelles. */
export const chargerCalendrier = cache(async (): Promise<Calendrier> => {
  const p = await chargerParametres();
  const rows = await db.select().from(schema.calendrier);
  const exceptions = new Map<ISODate, ExceptionCalendrier>();
  for (const r of rows) exceptions.set(r.date, { ouvert: r.ouvert, type: r.typeJournee, note: r.note });
  return new Calendrier({
    joursFermetureHebdo: listeEntiers(p, "jours_fermeture_hebdo"),
    joursWeekend: listeEntiers(p, "jours_weekend"),
    exceptions,
  });
});

export async function listerExceptions() {
  return db.select().from(schema.calendrier).orderBy(schema.calendrier.date);
}

export async function enregistrerException(
  acteur: Acteur,
  date: ISODate,
  valeurs: { ouvert: boolean; typeJournee: "semaine" | "weekend"; note: string | null },
): Promise<void> {
  const [avant] = await db.select().from(schema.calendrier).where(eq(schema.calendrier.date, date));
  await db
    .insert(schema.calendrier)
    .values({ date, ...valeurs })
    .onConflictDoUpdate({ target: schema.calendrier.date, set: valeurs });
  await journaliser(acteur, "calendrier", "modifier", { avant: avant ?? null, apres: { date, ...valeurs } });
}

export async function supprimerException(acteur: Acteur, date: ISODate): Promise<void> {
  const [avant] = await db.select().from(schema.calendrier).where(eq(schema.calendrier.date, date));
  if (!avant) return;
  await db.delete(schema.calendrier).where(eq(schema.calendrier.date, date));
  await journaliser(acteur, "calendrier", "retirer_exception", { avant });
}
