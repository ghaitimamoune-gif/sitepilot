/**
 * Construit un jeu de données moteur en mémoire à partir des données initiales,
 * sans base de données. Sert aux tests et au script de chargement.
 */
import type { ArticleMoteur, DonneesMoteur, LigneNomenclature, LigneRecette, ProduitMoteur } from "@/lib/engine/types";
import {
  ARTICLES_ACHETES,
  FAMILLES_COMPTAGE,
  FAMILLES_PERTE,
  PARAMETRES_MOTEUR,
  PREPARATIONS,
  PRODUITS,
  RECETTES,
  type ArticleInitial,
} from "./moteur";

export interface DonneesEnMemoire extends DonneesMoteur {
  idArticle: (nom: string) => number;
  idProduit: (nom: string) => number;
  /** Intervalle de livraison du classeur par article (jours). */
  livraisonTousLes: Map<number, number>;
}

export function construireDonneesMoteur(options: { joursSecuriteForce?: number; margeGenerale?: number } = {}): DonneesEnMemoire {
  const perte = new Map(FAMILLES_PERTE.map((f) => [f.nom, f.pertePct]));
  const securite = new Map(FAMILLES_COMPTAGE.map((f) => [f.nom, f.joursSecurite]));
  const articlesInit: ArticleInitial[] = [...ARTICLES_ACHETES, ...PREPARATIONS];
  const idParNom = new Map<string, number>();
  const articles: ArticleMoteur[] = articlesInit.map((a, i) => {
    const id = i + 1;
    idParNom.set(a.nom, id);
    return {
      id,
      nom: a.nom,
      nature: a.nature,
      uniteComptage: a.unite,
      estPiece: a.estPiece ?? false,
      poidsUnitaire: a.poidsUnitaire ?? null,
      unitePoids: a.unitePoids ?? null,
      pertePct: perte.get(a.famillePerte ?? "Aucune") ?? 0,
      dlcJours: a.dlc ?? null,
      rendementParage: a.rendement ?? null,
      partAvance: a.partAvance ?? null,
      rendementBatch: a.rendementBatch ?? null,
      uniteBatch: a.uniteBatch ?? null,
      lieAuxVentes: a.lieAuxVentes ?? true,
      joursSecurite: options.joursSecuriteForce ?? securite.get(a.famille) ?? 1,
      structurant: a.structurant ?? false,
    };
  });
  const idArticle = (nom: string) => {
    const id = idParNom.get(nom);
    if (!id) throw new Error(`Article initial inconnu : ${nom}`);
    return id;
  };
  const idProduitParNom = new Map<string, number>();
  const produits: ProduitMoteur[] = PRODUITS.map((p, i) => {
    idProduitParNom.set(p.nom, i + 1);
    return { id: i + 1, nom: p.nom, coefficients: { ...p.coef } };
  });
  const idProduit = (nom: string) => {
    const id = idProduitParNom.get(nom);
    if (!id) throw new Error(`Produit initial inconnu : ${nom}`);
    return id;
  };
  const nomenclature: LigneNomenclature[] = [];
  for (const p of PRODUITS) {
    for (const [article, quantite] of p.composants) {
      nomenclature.push({ produitId: idProduit(p.nom), articleId: idArticle(article), quantite });
    }
  }
  const recettes: LigneRecette[] = [];
  for (const r of RECETTES) {
    for (const [ingredient, quantiteParBatch] of r.ingredients) {
      recettes.push({ preparationId: idArticle(r.preparation), ingredientId: idArticle(ingredient), quantiteParBatch });
    }
  }
  const livraisonTousLes = new Map<number, number>();
  for (const a of articlesInit) if (a.livraisonTousLes) livraisonTousLes.set(idArticle(a.nom), a.livraisonTousLes);
  return {
    produits,
    articles,
    nomenclature,
    recettes,
    margeGenerale: options.margeGenerale ?? PARAMETRES_MOTEUR.margeGenerale,
    seuilDlcVeilleFermeture: PARAMETRES_MOTEUR.seuilDlcVeilleFermeture,
    idArticle,
    idProduit,
    livraisonTousLes,
  };
}
