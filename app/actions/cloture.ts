"use server";

import type { ResultatAction } from "@/components/ui/BoutonAction";
import { acteur, actionAvecDroit } from "@/lib/auth/session";
import { parseNombre } from "@/lib/format";
import { cloturerJournee } from "@/lib/services/cloture";

export async function actionCloturer(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("cloture:ecrire");
    const date = String(data.get("date") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, erreur: "Date invalide." };
    const caRealise = parseNombre(String(data.get("caRealise") ?? ""));
    if (caRealise === null || caRealise < 0) return { ok: false, erreur: "Le CA réalisé est obligatoire." };
    const couverts = parseNombre(String(data.get("couverts") ?? ""));
    await cloturerJournee(acteur(s), date, {
      caRealise,
      caMidi: parseNombre(String(data.get("caMidi") ?? "")),
      caSoir: parseNombre(String(data.get("caSoir") ?? "")),
      couverts: couverts === null ? null : Math.round(couverts),
      especes: parseNombre(String(data.get("especes") ?? "")),
      carte: parseNombre(String(data.get("carte") ?? "")),
      manquant: parseNombre(String(data.get("manquant") ?? "")),
      faitMarquant: String(data.get("faitMarquant") ?? ""),
    });
    return { ok: true, message: "Journée clôturée, rapport composé.", redirection: `/cloture?date=${date}` };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
  }
}
