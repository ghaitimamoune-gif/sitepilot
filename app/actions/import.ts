"use server";

import type { ResultatAction } from "@/components/ui/BoutonAction";
import { acteur, actionAvecDroit } from "@/lib/auth/session";
import { parseNombre } from "@/lib/format";
import { importerRapportDetaille, importerVentesParProduit, rattacherLibelle } from "@/lib/services/imports";

export async function actionImporter(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("import:ventes");
    const fichier = data.get("fichier");
    if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, erreur: "Choisissez un fichier." };
    if (fichier.size > 15 * 1024 * 1024) return { ok: false, erreur: "Fichier trop lourd (15 Mo maximum)." };
    const nom = fichier.name;
    const totalAttendu = parseNombre(String(data.get("totalAttendu") ?? ""));
    if (/\.xlsx?$/i.test(nom)) {
      const r = await importerRapportDetaille(acteur(s), Buffer.from(await fichier.arrayBuffer()), nom, totalAttendu);
      const jours = r.jours.map((j) => `${j.date} : ${j.total.toFixed(0)} DH`).join(" · ");
      return {
        ok: true,
        message: `Import réussi : ${r.lignes} lignes, ${r.total.toFixed(2)} DH. ${jours}.${r.inconnus.length > 0 ? ` ${r.inconnus.length} libellé(s) inconnu(s) signalé(s) aux propriétaires.` : ""}`,
      };
    }
    if (/\.csv$/i.test(nom)) {
      const texte = Buffer.from(await fichier.arrayBuffer()).toString("utf8");
      const caPeriode = parseNombre(String(data.get("caPeriode") ?? ""));
      const periode = String(data.get("periode") ?? "").trim();
      const type = String(data.get("type") ?? "semaine") as "semaine" | "weekend";
      if (!caPeriode || !periode) return { ok: false, erreur: "Pour un fichier par produit, indiquez la période et son CA total." };
      const r = await importerVentesParProduit(acteur(s), texte, nom, { periode, caPeriode, type });
      return { ok: true, message: `${r.propositions} coefficient(s) proposé(s) aux propriétaires.${r.inconnus.length > 0 ? ` Libellés inconnus : ${r.inconnus.join(", ")}.` : ""}` };
    }
    return { ok: false, erreur: "Format non reconnu : .xlsx (rapport détaillé) ou .csv (ventes par produit)." };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
  }
}

export async function actionRattacherLibelle(libelle: string, produitId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    const n = await rattacherLibelle(acteur(s), libelle, produitId);
    return { ok: true, message: `${n} ligne(s) rattachée(s).` };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
  }
}
