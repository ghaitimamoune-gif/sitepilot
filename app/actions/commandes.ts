"use server";

import type { ResultatAction } from "@/components/ui/BoutonAction";
import { acteur, actionAvecDroit } from "@/lib/auth/session";
import { parseNombre } from "@/lib/format";
import { creerArticleTerrain, creerFournisseurTerrain } from "@/lib/services/catalogue";
import {
  ajouterLigneManuelle,
  changerFournisseurLigne,
  cloturerCommande,
  confirmerEnvoi,
  genererBrouillons,
  messageWhatsApp,
  modifierLigne,
  preparerCommande,
  remettreEnBrouillon,
  retirerLigne,
  validerCommande,
} from "@/lib/services/commandes";

function erreur(e: unknown): ResultatAction {
  return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
}

export async function actionGenererBrouillons(): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("commandes:ecrire");
    const ids = await genererBrouillons(acteur(s));
    return { ok: true, message: ids.length === 0 ? "Rien à commander pour le moment." : `${ids.length} brouillon(s) prêt(s).` };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionModifierLigne(ligneId: number, qte: number | null): Promise<void> {
  const s = await actionAvecDroit("commandes:ecrire");
  await modifierLigne(acteur(s), ligneId, qte ?? 0);
}

export async function actionRetirerLigne(ligneId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("commandes:ecrire");
    await retirerLigne(acteur(s), ligneId);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionChangerFournisseur(ligneId: number, articleFournisseurId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("commandes:ecrire");
    const id = await changerFournisseurLigne(acteur(s), ligneId, articleFournisseurId);
    return { ok: true, redirection: `/commandes/${id}` };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionAjouterLigne(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("commandes:ecrire");
    const qte = parseNombre(String(data.get("qte") ?? ""));
    if (qte === null || qte <= 0) return { ok: false, erreur: "Indiquez une quantité." };
    const id = await ajouterLigneManuelle(acteur(s), Number(data.get("fournisseurId")), Number(data.get("articleId")), qte, "manuel");
    return { ok: true, redirection: `/commandes/${id}` };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionPreparer(commandeId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("commandes:ecrire");
    const statut = await preparerCommande(acteur(s), commandeId);
    return { ok: true, message: statut === "en_attente_validation" ? "Soumise aux propriétaires pour validation." : "Prête à envoyer." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionRemettreEnBrouillon(commandeId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("commandes:ecrire");
    await remettreEnBrouillon(acteur(s), commandeId);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionValider(commandeId: number, ok: boolean, commentaire: string | null): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("commandes:valider");
    await validerCommande(acteur(s), commandeId, ok, commentaire);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionMessageWhatsApp(commandeId: number): Promise<{ texte: string; url: string | null }> {
  const s = await actionAvecDroit("commandes:ecrire");
  const m = await messageWhatsApp(commandeId, s.personne.prenom);
  return { texte: m.texte, url: m.url };
}

export async function actionConfirmerEnvoi(commandeId: number, texte: string): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("commandes:ecrire");
    await confirmerEnvoi(acteur(s), commandeId, texte);
    return { ok: true, message: "Commande envoyée.", redirection: "/commandes" };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionCloturer(commandeId: number): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("commandes:ecrire");
    await cloturerCommande(acteur(s), commandeId);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

/** Nouveau fournisseur depuis l'écran des commandes (responsable achats) ou des réceptions (manager). */
export async function actionNouveauFournisseur(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("fournisseurs:creer");
    const articleIds = data.getAll("articleIds").map(Number).filter((n) => Number.isInteger(n));
    const nouveaux = String(data.get("nouveauxArticles") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const familleId = Number(data.get("familleId"));
    const unite = String(data.get("unite") ?? "unité");
    const id = await creerFournisseurTerrain(acteur(s), {
      nom: String(data.get("nom") ?? ""),
      whatsapp: String(data.get("whatsapp") ?? ""),
      contact: String(data.get("contact") ?? ""),
      articleIds,
    });
    for (const nom of nouveaux) {
      if (!Number.isInteger(familleId)) break;
      await creerArticleTerrain(acteur(s), { nom, familleId, uniteComptage: unite, fournisseurId: id });
    }
    const retour = String(data.get("retour") ?? "/commandes");
    return { ok: true, message: "Fournisseur créé, utilisable immédiatement (fiche à vérifier par les propriétaires).", redirection: retour };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionNouvelArticle(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("fournisseurs:creer");
    const fournisseurId = Number(data.get("fournisseurId"));
    const id = await creerArticleTerrain(acteur(s), {
      nom: String(data.get("nom") ?? ""),
      familleId: Number(data.get("familleId")),
      uniteComptage: String(data.get("unite") ?? "unité"),
      fournisseurId: Number.isInteger(fournisseurId) && fournisseurId > 0 ? fournisseurId : null,
      uniteCommande: String(data.get("uniteCommande") ?? ""),
      qteParUniteCommande: parseNombre(String(data.get("qteParUniteCommande") ?? "")),
    });
    return { ok: true, message: `Article créé (n° ${id}), à vérifier par les propriétaires.` };
  } catch (e) {
    return erreur(e);
  }
}
