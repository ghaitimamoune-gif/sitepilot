"use server";

import { eq } from "drizzle-orm";
import type { ResultatAction } from "@/components/ui/BoutonAction";
import { acteur, actionAvecDroit } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { ValeurAttendue } from "@/lib/db/schema";
import { parseNombre } from "@/lib/format";
import { enregistrerException, supprimerException } from "@/lib/services/calendrier";
import {
  enregistrerArticle,
  enregistrerCoefficient,
  enregistrerFamille,
  enregistrerFamillePerte,
  enregistrerFournisseur,
  enregistrerNomenclature,
  enregistrerPrix,
  enregistrerProduit,
  enregistrerRecette,
  lierArticleFournisseur,
  type FicheArticle,
} from "@/lib/services/catalogue";
import { deciderProposition, recalculerCoefficients } from "@/lib/services/coefficients";
import { journaliser } from "@/lib/services/journal";
import { ecrireParametre, PARAMETRES_DEFAUT } from "@/lib/services/parametres";

function erreur(e: unknown): ResultatAction {
  return { ok: false, erreur: e instanceof Error ? e.message : "Erreur." };
}

const n = (v: FormDataEntryValue | null) => parseNombre(v === null ? "" : String(v));
const t = (v: FormDataEntryValue | null) => (v === null ? "" : String(v)).trim();
const b = (v: FormDataEntryValue | null) => v === "on" || v === "true";

export async function actionParametre(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    const cle = t(data.get("cle"));
    if (!(cle in PARAMETRES_DEFAUT)) return { ok: false, erreur: "Paramètre inconnu." };
    const valeur = t(data.get("valeur")).replace(",", ".");
    await ecrireParametre(acteur(s), cle, cle === "modele_message_commande" ? String(data.get("valeur") ?? "") : valeur, s.personne.prenom);
    return { ok: true, message: "Enregistré." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionCalendrier(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    const date = t(data.get("date"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, erreur: "Date invalide." };
    const ouvert = t(data.get("ouvert")) === "oui";
    await enregistrerException(acteur(s), date, { ouvert, typeJournee: ouvert ? ((t(data.get("type")) || "weekend") as "semaine" | "weekend") : "semaine", note: t(data.get("note")) || null });
    return { ok: true, message: "Calendrier mis à jour." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionRetirerException(date: string): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    await supprimerException(acteur(s), date);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionCoefficient(produitId: number, type: "semaine" | "weekend", valeurPerso: number | null, fige: boolean): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    await enregistrerCoefficient(acteur(s), produitId, type, { valeurPerso, fige });
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionDeciderCoefficient(id: number, ok: boolean): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    await deciderProposition(acteur(s), id, ok);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionRecalculerCoefficients(): Promise<ResultatAction> {
  try {
    await actionAvecDroit("parametres:ecrire");
    const r = await recalculerCoefficients();
    return { ok: true, message: `${r.appliques} coefficient(s) appliqué(s), ${r.proposes} proposé(s), ${r.joursUtilises} journée(s) importée(s) utilisée(s).` };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionNomenclature(produitId: number, articleId: number, quantite: number | null): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    await enregistrerNomenclature(acteur(s), produitId, articleId, quantite);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionRecette(preparationId: number, ingredientId: number, quantite: number | null): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    await enregistrerRecette(acteur(s), preparationId, ingredientId, quantite);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionProduit(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    const id = n(data.get("id"));
    await enregistrerProduit(acteur(s), id === null ? null : Math.round(id), {
      nom: t(data.get("nom")),
      categorie: t(data.get("categorie")) || null,
      libellesCaisse: t(data.get("libellesCaisse")).split("\n").map((l) => l.trim()).filter(Boolean),
      actif: b(data.get("actif")),
    });
    return { ok: true, message: "Produit enregistré." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionArticle(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    const id = n(data.get("id"));
    const fiche: FicheArticle = {
      nom: t(data.get("nom")),
      nature: t(data.get("nature")) as FicheArticle["nature"],
      familleId: n(data.get("familleId")) === null ? null : Math.round(n(data.get("familleId"))!),
      famillePerteId: n(data.get("famillePerteId")) === null ? null : Math.round(n(data.get("famillePerteId"))!),
      uniteComptage: t(data.get("uniteComptage")),
      poidsUnitaire: n(data.get("poidsUnitaire")),
      unitePoids: t(data.get("unitePoids")) || null,
      structurant: b(data.get("structurant")),
      dlcJours: n(data.get("dlcJours")) === null ? null : Math.round(n(data.get("dlcJours"))!),
      rendementParage: n(data.get("rendementParage")),
      lieAuxVentes: b(data.get("lieAuxVentes")),
      stockMinimum: n(data.get("stockMinimum")),
      stockCibleFixe: n(data.get("stockCibleFixe")),
      partAvance: n(data.get("partAvance")),
      rendementBatch: n(data.get("rendementBatch")),
      uniteBatch: t(data.get("uniteBatch")) || null,
      coutRevient: n(data.get("coutRevient")),
      critiqueCoutMatiere: b(data.get("critiqueCoutMatiere")),
      statut: (t(data.get("statut")) || "actif") as FicheArticle["statut"],
      aConfirmer: b(data.get("aConfirmer")),
    };
    const nid = await enregistrerArticle(acteur(s), id === null ? null : Math.round(id), fiche);
    return { ok: true, message: "Article enregistré.", redirection: id === null ? `/parametres/articles/${nid}` : undefined };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionFamille(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    const id = n(data.get("id"));
    await enregistrerFamille(acteur(s), id === null ? null : Math.round(id), {
      nom: t(data.get("nom")),
      rythme: t(data.get("rythme")) as "quotidien" | "hebdomadaire" | "mensuel",
      roleCompteur: t(data.get("roleCompteur")) as "resp_cuisine" | "resp_achats",
      joursSecurite: Math.round(n(data.get("joursSecurite")) ?? 1),
    });
    return { ok: true, message: "Famille enregistrée." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionFamillePerte(id: number, pertePct: number | null): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    await enregistrerFamillePerte(acteur(s), id, pertePct ?? 0);
    return { ok: true };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionFournisseur(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("fournisseurs:completer");
    const id = n(data.get("id"));
    const nid = await enregistrerFournisseur(acteur(s), id === null ? null : Math.round(id), {
      nom: t(data.get("nom")),
      raisonSociale: t(data.get("raisonSociale")) || null,
      ice: t(data.get("ice")) || null,
      contact: t(data.get("contact")) || null,
      whatsapp: t(data.get("whatsapp")) || null,
      joursLivraison: data.getAll("joursLivraison").map(Number).filter((x) => Number.isInteger(x)),
      heureLimite: t(data.get("heureLimite")) || null,
      delaiJours: Math.round(n(data.get("delaiJours")) ?? 1),
      validationRequise: b(data.get("validationRequise")),
      achatDirect: b(data.get("achatDirect")),
      statut: (t(data.get("statut")) || "actif") as "actif" | "a_verifier" | "archive",
    });
    return { ok: true, message: "Fournisseur enregistré.", redirection: id === null ? `/fournisseurs/${nid}` : undefined };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionLierArticle(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("fournisseurs:completer");
    await lierArticleFournisseur(acteur(s), {
      articleId: Math.round(n(data.get("articleId")) ?? 0),
      fournisseurId: Math.round(n(data.get("fournisseurId")) ?? 0),
      uniteCommande: t(data.get("uniteCommande")) || "unité",
      qteParUniteCommande: n(data.get("qteParUniteCommande")) ?? 1,
      reference: t(data.get("reference")) || null,
      actif: data.get("actif") === null ? true : b(data.get("actif")),
    });
    return { ok: true, message: "Lien enregistré." };
  } catch (e) {
    return erreur(e);
  }
}

export async function actionPrix(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("prix:ecrire");
    const montant = n(data.get("montant"));
    if (montant === null || montant <= 0) return { ok: false, erreur: "Indiquez un prix." };
    await enregistrerPrix(acteur(s), {
      articleFournisseurId: Math.round(n(data.get("articleFournisseurId")) ?? 0),
      montant,
      tvaPct: n(data.get("tvaPct")) ?? 0,
      estTtc: t(data.get("base")) === "ttc",
      date: t(data.get("date")) || undefined,
    });
    return { ok: true, message: "Prix enregistré." };
  } catch (e) {
    return erreur(e);
  }
}

/** Modèles de tâches récurrentes (section 10). */
export async function actionModeleTache(_etat: ResultatAction | null, data: FormData): Promise<ResultatAction> {
  try {
    const s = await actionAvecDroit("parametres:ecrire");
    const id = n(data.get("id"));
    const preuve = (t(data.get("preuve")) || "aucune") as "aucune" | "photos" | "valeurs";
    const valeurs: ValeurAttendue[] = t(data.get("valeurs"))
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        // « Frigo 1 ; 0 ; 4 ; °C »
        const [label, min, max, unite] = l.split(";").map((x) => x.trim());
        return { label, min: parseNombre(min ?? ""), max: parseNombre(max ?? ""), unite: unite || undefined };
      });
    const famille = n(data.get("familleId"));
    const valeursModele = {
      titre: t(data.get("titre")),
      consigne: t(data.get("consigne")) || null,
      posteId: Math.round(n(data.get("posteId")) ?? 0),
      recurrence: (t(data.get("recurrence")) || "chaque_jour_ouvert") as "chaque_jour_ouvert" | "jours_semaine" | "hebdomadaire" | "mensuelle",
      joursSemaine: data.getAll("joursSemaine").map(Number).filter((x) => Number.isInteger(x)),
      jourDuMois: n(data.get("jourDuMois")) === null ? null : Math.round(n(data.get("jourDuMois"))!),
      heureCibleSemaine: t(data.get("heureCibleSemaine")) || "09:00",
      heureCibleWeekend: t(data.get("heureCibleWeekend")) || "10:00",
      delaiRemonteeMin: Math.round(n(data.get("delaiRemonteeMin")) ?? 30),
      points: t(data.get("points")).split("\n").map((l) => l.trim()).filter(Boolean),
      preuve,
      photosMin: Math.max(1, Math.round(n(data.get("photosMin")) ?? 1)),
      valeurs: preuve === "valeurs" ? valeurs : [],
      structurante: b(data.get("structurante")),
      ecranLie: (t(data.get("ecranLie")) || null) as "comptage" | "reception" | "commandes" | "cloture" | "pertes" | null,
      familleId: famille === null ? null : Math.round(famille),
      actif: b(data.get("actif")),
    };
    if (!valeursModele.titre) return { ok: false, erreur: "Le titre est obligatoire." };
    if (id === null) {
      const [row] = await db.insert(schema.tacheModeles).values(valeursModele).returning({ id: schema.tacheModeles.id });
      await journaliser(acteur(s), "tache_modele", "creer", { entiteId: row.id, apres: valeursModele });
    } else {
      const [avant] = await db.select().from(schema.tacheModeles).where(eq(schema.tacheModeles.id, Math.round(id)));
      await db.update(schema.tacheModeles).set(valeursModele).where(eq(schema.tacheModeles.id, Math.round(id)));
      await journaliser(acteur(s), "tache_modele", "modifier", { entiteId: Math.round(id), avant, apres: valeursModele });
    }
    return { ok: true, message: "Modèle enregistré. Il s'applique à partir de la prochaine génération des tâches du jour." };
  } catch (e) {
    return erreur(e);
  }
}
