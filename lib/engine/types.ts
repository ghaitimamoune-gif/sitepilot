import type { ISODate } from "@/lib/dates";

export type TypeJournee = "semaine" | "weekend";

export type NatureArticle =
  | "matiere_premiere"
  | "preparation"
  | "emballage"
  | "consommable"
  | "tenue"
  | "materiel";

export interface ProduitMoteur {
  id: number;
  nom: string;
  /** Coefficient effectif (personnalisé s'il existe, sinon mesuré) : unités pour 1 000 DH. */
  coefficients: Record<TypeJournee, number>;
}

export interface ArticleMoteur {
  id: number;
  nom: string;
  nature: NatureArticle;
  uniteComptage: string;
  /** Vrai pour une pièce (boulette, pain, boule, tranche) : arrondi à l'entier supérieur. */
  estPiece: boolean;
  /** Équivalent en kg ou en litre d'une pièce. */
  poidsUnitaire?: number | null;
  unitePoids?: string | null;
  /** Perte prévue de la famille de perte, 0,04 pour 4 %. */
  pertePct: number;
  dlcJours: number | null;
  /** Rendement de parage d'un produit acheté brut (0,75 pour 75 %). */
  rendementParage: number | null;
  /** Part d'avance d'une préparation maison. null : absente de la fiche des préparations. */
  partAvance: number | null;
  /** Rendement d'un batch dans l'unité de comptage. null : préparation proportionnelle. */
  rendementBatch: number | null;
  uniteBatch?: string | null;
  lieAuxVentes: boolean;
  joursSecurite: number;
  structurant: boolean;
}

export interface LigneNomenclature {
  produitId: number;
  articleId: number;
  /** Quantité du composant par unité vendue, dans l'unité de comptage du composant. */
  quantite: number;
}

export interface LigneRecette {
  preparationId: number;
  ingredientId: number;
  /** Quantité d'ingrédient par batch (ou par unité si la préparation est proportionnelle). */
  quantiteParBatch: number;
}

export interface JourPrevu {
  date: ISODate;
  type: TypeJournee;
  /** CA prévu en DH. */
  ca: number;
}

export interface DonneesMoteur {
  produits: ProduitMoteur[];
  articles: ArticleMoteur[];
  nomenclature: LigneNomenclature[];
  recettes: LigneRecette[];
  /** Marge de sécurité générale, 0,10 pour 10 %. */
  margeGenerale: number;
  /** DLC (jours) en dessous de laquelle on ne prend pas d'avance la veille d'une fermeture. */
  seuilDlcVeilleFermeture: number;
}

export interface FichePreparation {
  articleId: number;
  nom: string;
  unite: string;
  estPiece: boolean;
  aujourdHui: number;
  equivalent: { valeur: number; unite: string } | null;
  avance: number;
  avanceSupprimee: boolean;
  total: number;
  resteVeille: number;
  aPreparerCalcule: number;
  aPreparer: number;
  forcee: number | null;
  batchs: number | null;
  rendementBatch: number | null;
}

export interface StockCible {
  articleId: number;
  besoinJour: number;
  couverture: number;
  jours: ISODate[];
  cible: number;
}
