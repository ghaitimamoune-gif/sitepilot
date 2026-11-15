import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { ajouterJours, journeeExploitation } from "@/lib/dates";
import { recalculerCoefficients } from "./coefficients";
import { purgerPhotosExpirees } from "./photos";
import { alerterLivraisonsNonReceptionnees } from "./receptions";
import { cloreJourneeTaches, genererTachesDuJour, remonterTachesEnRetard } from "./taches";

const MINUTE = 60_000;

async function derniereExecution(cle: string): Promise<Date | null> {
  const [r] = await db.select().from(schema.tachesJob).where(eq(schema.tachesJob.cle, cle));
  return r?.derniereExecution ?? null;
}

async function marquer(cle: string, at = new Date()): Promise<void> {
  await db
    .insert(schema.tachesJob)
    .values({ cle, derniereExecution: at })
    .onConflictDoUpdate({ target: schema.tachesJob.cle, set: { derniereExecution: at } });
}

export interface ResultatTick {
  execute: boolean;
  tachesGenerees: number;
  remontees: number;
  livraisons: number;
  coefficients: { appliques: number; proposes: number } | null;
  photosPurgees: number;
}

/**
 * Planificateur interne, sans infrastructure : appelé à chaque chargement de page (au plus
 * une fois par minute) et par /api/cron/tick pour un planificateur externe.
 * Génère les tâches du jour, remonte les retards, clôt la journée précédente, alerte sur les
 * livraisons non réceptionnées, recalcule les coefficients chaque semaine, purge les photos.
 */
export async function tick(maintenant = new Date(), force = false): Promise<ResultatTick> {
  const vide: ResultatTick = { execute: false, tachesGenerees: 0, remontees: 0, livraisons: 0, coefficients: null, photosPurgees: 0 };
  const derniere = await derniereExecution("tick");
  if (!force && derniere && maintenant.getTime() - derniere.getTime() < MINUTE) return vide;
  await marquer("tick", maintenant);
  const journee = journeeExploitation(maintenant);
  const res: ResultatTick = { ...vide, execute: true };
  try {
    res.tachesGenerees = await genererTachesDuJour(journee);
    await cloreJourneeTaches(ajouterJours(journee, -1), maintenant);
    res.remontees = await remonterTachesEnRetard(maintenant);
    res.livraisons = await alerterLivraisonsNonReceptionnees(maintenant);
    const coef = await derniereExecution("coefficients");
    if (!coef || maintenant.getTime() - coef.getTime() > 7 * 24 * 60 * MINUTE) {
      const r = await recalculerCoefficients(journee);
      res.coefficients = { appliques: r.appliques, proposes: r.proposes };
      await marquer("coefficients", maintenant);
    }
    const purge = await derniereExecution("purge_photos");
    if (!purge || maintenant.getTime() - purge.getTime() > 24 * 60 * MINUTE) {
      res.photosPurgees = await purgerPhotosExpirees();
      await marquer("purge_photos", maintenant);
    }
  } catch (e) {
    console.error("[tick]", e);
  }
  return res;
}

/**
 * Appel non bloquant depuis une page : exécuté après l'envoi de la réponse (after),
 * ce qui reste fiable sur un hébergement serverless. Les erreurs sont journalisées.
 */
export function tickEnArrierePlan(): void {
  try {
    after(() => tick().then(() => undefined, (e) => console.error("[tick]", e)));
  } catch {
    tick().catch((e) => console.error("[tick]", e));
  }
}
