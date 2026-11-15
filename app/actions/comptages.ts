"use server";

import { eq } from "drizzle-orm";
import type { ResultatAction } from "@/components/ui/BoutonAction";
import { aLeDroit } from "@/lib/auth/droits";
import { acteur, sessionCourante, ErreurDroit, type Session } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { ajouterLigneComptage, saisirLigneComptage, validerComptage } from "@/lib/services/comptages";

/** La cuisine est comptée par le responsable cuisine (suppléante : manager), la réserve par la responsable achats. */
export async function droitComptageFamille(s: Session, familleId: number): Promise<boolean> {
  const [f] = await db.select().from(schema.familles).where(eq(schema.familles.id, familleId));
  if (!f) return false;
  if (f.roleCompteur === "resp_cuisine") return aLeDroit(s.poste.role, "comptage_cuisine:ecrire");
  return aLeDroit(s.poste.role, "comptage_reserve:ecrire");
}

async function exigerComptage(comptageId: number) {
  const s = await sessionCourante();
  if (!s) throw new ErreurDroit("Session expirée.");
  const [c] = await db.select().from(schema.comptages).where(eq(schema.comptages.id, comptageId));
  if (!c) throw new Error("Comptage introuvable.");
  if (!(await droitComptageFamille(s, c.familleId))) throw new ErreurDroit("Votre poste ne compte pas cette famille.");
  return { s, c };
}

export async function actionSaisirLigne(comptageId: number, articleId: number, quantite: number | null): Promise<void> {
  const { s } = await exigerComptage(comptageId);
  await saisirLigneComptage(acteur(s), comptageId, articleId, quantite);
}

export async function actionAjouterLigne(comptageId: number, articleId: number): Promise<ResultatAction> {
  try {
    await exigerComptage(comptageId);
    await ajouterLigneComptage(comptageId, articleId);
    return { ok: true };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
  }
}

export async function actionValiderComptage(comptageId: number): Promise<ResultatAction> {
  try {
    const { s } = await exigerComptage(comptageId);
    const r = await validerComptage(acteur(s), comptageId);
    return { ok: true, message: r.alertes > 0 ? `${r.alertes} alerte(s) d'écart envoyée(s) aux propriétaires.` : undefined };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
  }
}
