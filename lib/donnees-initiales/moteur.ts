/**
 * Données initiales du moteur (section 14 du brief), telles que le classeur
 * de référence les portait au 12 novembre 2026. Chargées en base par
 * scripts/seed.ts et rejouées telles quelles par les tests du moteur.
 *
 * Tout est modifiable ensuite par les propriétaires dans l'application.
 */
import type { NatureArticle, TypeJournee } from "@/lib/engine/types";

export type RoleCompteur = "resp_cuisine" | "resp_achats";
export type Rythme = "quotidien" | "hebdomadaire" | "mensuel";

// 14.3 — familles de perte
export const FAMILLES_PERTE: { nom: string; pertePct: number }[] = [
  { nom: "Viande", pertePct: 0.04 },
  { nom: "Pain", pertePct: 0.06 },
  { nom: "Fromage", pertePct: 0.03 },
  { nom: "Pommes de terre", pertePct: 0.08 },
  { nom: "Surgelés", pertePct: 0.03 },
  { nom: "Crudités", pertePct: 0.12 },
  { nom: "Sauces et condiments", pertePct: 0.05 },
  { nom: "Pâtisserie et desserts", pertePct: 0.05 },
  { nom: "Boissons", pertePct: 0.05 },
  { nom: "Aucune", pertePct: 0 },
];

// Section 7 — familles de comptage
export const FAMILLES_COMPTAGE: {
  nom: string;
  rythme: Rythme;
  role: RoleCompteur;
  joursSecurite: number;
}[] = [
  { nom: "Frais et préparations maison", rythme: "quotidien", role: "resp_cuisine", joursSecurite: 1 },
  { nom: "Épicerie et crémerie", rythme: "hebdomadaire", role: "resp_cuisine", joursSecurite: 6 },
  { nom: "Surgelés", rythme: "hebdomadaire", role: "resp_cuisine", joursSecurite: 6 },
  { nom: "Huile de friture", rythme: "hebdomadaire", role: "resp_cuisine", joursSecurite: 6 },
  { nom: "Emballages et stickers", rythme: "hebdomadaire", role: "resp_achats", joursSecurite: 6 },
  { nom: "Consommables de salle", rythme: "hebdomadaire", role: "resp_achats", joursSecurite: 6 },
  { nom: "Entretien et hygiène", rythme: "hebdomadaire", role: "resp_achats", joursSecurite: 6 },
  { nom: "Tenues", rythme: "mensuel", role: "resp_achats", joursSecurite: 6 },
  { nom: "Petit matériel", rythme: "mensuel", role: "resp_achats", joursSecurite: 6 },
];

export interface ArticleInitial {
  nom: string;
  nature: NatureArticle;
  unite: string;
  famille: string;
  famillePerte?: string;
  estPiece?: boolean;
  poidsUnitaire?: number;
  unitePoids?: string;
  structurant?: boolean;
  critique?: boolean;
  dlc?: number;
  rendement?: number;
  /** Intervalle de livraison du classeur (jours), remplacé par les jours réels du fournisseur. */
  livraisonTousLes?: number;
  partAvance?: number;
  rendementBatch?: number;
  uniteBatch?: string;
  lieAuxVentes?: boolean;
  stockMinimum?: number;
  stockCible?: number;
  aConfirmer?: boolean;
  coutRevient?: number;
}

const FRAIS = "Frais et préparations maison";
const EPICERIE = "Épicerie et crémerie";

// 14.6 — articles achetés (DLC et intervalle de livraison du classeur)
export const ARTICLES_ACHETES: ArticleInitial[] = [
  { nom: "Viande hachée fraîche (80/20)", nature: "matiere_premiere", unite: "kg", famille: FRAIS, famillePerte: "Viande", dlc: 2, livraisonTousLes: 1, structurant: true, critique: true },
  { nom: "Salade iceberg", nature: "matiere_premiere", unite: "kg", famille: FRAIS, famillePerte: "Crudités", dlc: 3, livraisonTousLes: 2, rendement: 0.75, aConfirmer: true },
  { nom: "Tomates", nature: "matiere_premiere", unite: "kg", famille: FRAIS, famillePerte: "Crudités", dlc: 4, livraisonTousLes: 2, rendement: 0.92, aConfirmer: true },
  { nom: "Pommes de terre", nature: "matiere_premiere", unite: "kg", famille: FRAIS, famillePerte: "Pommes de terre", dlc: 7, livraisonTousLes: 3, rendement: 0.75, structurant: true, critique: true, aConfirmer: true },
  { nom: "Cheddar en tranches", nature: "matiere_premiere", unite: "tranche", famille: EPICERIE, famillePerte: "Fromage", estPiece: true, poidsUnitaire: 0.02, unitePoids: "kg", dlc: 14, livraisonTousLes: 7, structurant: true, critique: true },
  { nom: "Cheddar râpé", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Fromage", dlc: 7, livraisonTousLes: 7 },
  { nom: "Oignons", nature: "matiere_premiere", unite: "kg", famille: FRAIS, famillePerte: "Crudités", dlc: 14, livraisonTousLes: 7, rendement: 0.85, aConfirmer: true },
  { nom: "Citrons", nature: "matiere_premiere", unite: "kg", famille: FRAIS, famillePerte: "Crudités", dlc: 14, livraisonTousLes: 7, rendement: 0.35, aConfirmer: true },
  { nom: "Mix soft serve", nature: "matiere_premiere", unite: "L", famille: EPICERIE, famillePerte: "Pâtisserie et desserts", dlc: 7, livraisonTousLes: 7 },
  { nom: "Frites de patates douces surgelées", nature: "matiere_premiere", unite: "kg", famille: "Surgelés", famillePerte: "Surgelés", dlc: 120, livraisonTousLes: 7 },
  { nom: "Chicken tenders surgelés", nature: "matiere_premiere", unite: "kg", famille: "Surgelés", famillePerte: "Surgelés", dlc: 120, livraisonTousLes: 7, critique: true },
  { nom: "Mayonnaise", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Sauces et condiments", dlc: 60, livraisonTousLes: 7 },
  { nom: "Ketchup Heinz", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Sauces et condiments", dlc: 90, livraisonTousLes: 7 },
  { nom: "Moutarde américaine", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Sauces et condiments", dlc: 90, livraisonTousLes: 7 },
  { nom: "Cornichons", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 60, livraisonTousLes: 7 },
  { nom: "Parmesan râpé", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Fromage", dlc: 30, livraisonTousLes: 7 },
  { nom: "Crispy onions", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 120, livraisonTousLes: 7 },
  { nom: "Sauce fromage", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Sauces et condiments", dlc: 7, livraisonTousLes: 7 },
  { nom: "Nutella", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Pâtisserie et desserts", dlc: 90, livraisonTousLes: 7 },
  { nom: "Coca Cola", nature: "matiere_premiere", unite: "unité", famille: EPICERIE, famillePerte: "Boissons", estPiece: true, dlc: 180, livraisonTousLes: 7 },
  { nom: "Coca Zero", nature: "matiere_premiere", unite: "unité", famille: EPICERIE, famillePerte: "Boissons", estPiece: true, dlc: 180, livraisonTousLes: 7 },
  { nom: "Sprite", nature: "matiere_premiere", unite: "unité", famille: EPICERIE, famillePerte: "Boissons", estPiece: true, dlc: 180, livraisonTousLes: 7 },
  { nom: "Hawai", nature: "matiere_premiere", unite: "unité", famille: EPICERIE, famillePerte: "Boissons", estPiece: true, dlc: 180, livraisonTousLes: 7 },
  { nom: "Eau", nature: "matiere_premiere", unite: "unité", famille: EPICERIE, famillePerte: "Boissons", estPiece: true, dlc: 180, livraisonTousLes: 7 },
  // Ingrédients des recettes (14.5), absents du tableau 14.6 : valeurs de départ prudentes.
  { nom: "Miel", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 365, livraisonTousLes: 7 },
  { nom: "Sauce BBQ", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Sauces et condiments", dlc: 180, livraisonTousLes: 7 },
  { nom: "Sel", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 365, livraisonTousLes: 7 },
  { nom: "Poivre noir", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 365, livraisonTousLes: 7 },
  { nom: "Maïzena", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 365, livraisonTousLes: 7 },
  { nom: "Sucre blanc", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 365, livraisonTousLes: 7 },
  { nom: "Sucre roux", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 365, livraisonTousLes: 7 },
  { nom: "Farine", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 180, livraisonTousLes: 7 },
  { nom: "Chocolat noir", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Pâtisserie et desserts", dlc: 180, livraisonTousLes: 7 },
  { nom: "Œufs", nature: "matiere_premiere", unite: "unité", famille: EPICERIE, famillePerte: "Pâtisserie et desserts", estPiece: true, dlc: 21, livraisonTousLes: 7 },
  { nom: "Beurre", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Pâtisserie et desserts", dlc: 30, livraisonTousLes: 7, aConfirmer: true },
  { nom: "Glutamate", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 365, livraisonTousLes: 7 },
  { nom: "Paprika", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 365, livraisonTousLes: 7 },
  { nom: "Oignon en poudre", nature: "matiere_premiere", unite: "kg", famille: EPICERIE, famillePerte: "Aucune", dlc: 365, livraisonTousLes: 7 },
  { nom: "Huile de friture", nature: "matiere_premiere", unite: "bidon", famille: "Huile de friture", famillePerte: "Aucune", estPiece: true, dlc: 365, livraisonTousLes: 7, lieAuxVentes: false, stockMinimum: 2, stockCible: 6 },
];

// 14.4 — préparations maison
export const PREPARATIONS: ArticleInitial[] = [
  { nom: "Boulettes smash pressées", nature: "preparation", unite: "boulette", famille: FRAIS, famillePerte: "Viande", estPiece: true, poidsUnitaire: 0.07, unitePoids: "kg", dlc: 1, partAvance: 0.3, aConfirmer: true, structurant: false },
  { nom: "Pains burger", nature: "preparation", unite: "pain", famille: FRAIS, famillePerte: "Pain", estPiece: true, dlc: 1, partAvance: 0, critique: true, coutRevient: 1.5 },
  { nom: "Salade iceberg taillée", nature: "preparation", unite: "kg", famille: FRAIS, famillePerte: "Crudités", dlc: 1, partAvance: 0.25, aConfirmer: true },
  { nom: "Tomates en rondelles", nature: "preparation", unite: "kg", famille: FRAIS, famillePerte: "Crudités", dlc: 1, partAvance: 0.25, aConfirmer: true },
  { nom: "Oignons rouges en rondelles", nature: "preparation", unite: "kg", famille: FRAIS, famillePerte: "Crudités", dlc: 2, partAvance: 0.4, aConfirmer: true },
  { nom: "Oignon haché", nature: "preparation", unite: "kg", famille: FRAIS, famillePerte: "Crudités", dlc: 2, partAvance: 0.4, aConfirmer: true },
  { nom: "Frites taillées et trempées", nature: "preparation", unite: "kg", famille: FRAIS, famillePerte: "Pommes de terre", dlc: 1, partAvance: 0.25, aConfirmer: true },
  { nom: "Sauce Easy", nature: "preparation", unite: "kg", famille: FRAIS, famillePerte: "Sauces et condiments", dlc: 5, partAvance: 0.5, rendementBatch: 2.801, uniteBatch: "kg" },
  { nom: "Base sweet creamy", nature: "preparation", unite: "kg", famille: FRAIS, famillePerte: "Sauces et condiments", dlc: 10, rendementBatch: 7.42, uniteBatch: "kg" },
  { nom: "Sweet creamy, sauce finie", nature: "preparation", unite: "kg", famille: FRAIS, famillePerte: "Sauces et condiments", dlc: 10, partAvance: 0.5, rendementBatch: 1.386, uniteBatch: "kg" },
  { nom: "Mayo truffe", nature: "preparation", unite: "kg", famille: FRAIS, famillePerte: "Sauces et condiments", dlc: 5, partAvance: 0.5, aConfirmer: true },
  { nom: "Oignons caramélisés", nature: "preparation", unite: "kg", famille: FRAIS, famillePerte: "Sauces et condiments", dlc: 5, partAvance: 0.5, rendementBatch: 0.85, uniteBatch: "kg", aConfirmer: true },
  { nom: "Boules de pâte à cookies", nature: "preparation", unite: "boule", famille: FRAIS, famillePerte: "Pâtisserie et desserts", estPiece: true, poidsUnitaire: 0.1, unitePoids: "kg", dlc: 30, partAvance: 0.5, rendementBatch: 25, uniteBatch: "boules", aConfirmer: true },
  { nom: "Concentré de citronnade", nature: "preparation", unite: "L", famille: FRAIS, famillePerte: "Boissons", dlc: 5, partAvance: 0.5, rendementBatch: 2.5, uniteBatch: "L", aConfirmer: true },
  { nom: "Sirop de sucre", nature: "preparation", unite: "L", famille: FRAIS, famillePerte: "Boissons", dlc: 30, partAvance: 0.5, rendementBatch: 3.9, uniteBatch: "L", aConfirmer: true },
  // Nœud de conversion : la citronnade servie est préparée au service, pas à l'avance.
  { nom: "Citronnade servie", nature: "preparation", unite: "L", famille: FRAIS, famillePerte: "Boissons", dlc: 1, rendementBatch: 2.5, uniteBatch: "L" },
];

// 14.5 — recettes des batchs : ingrédient et quantité par batch (ou par unité si pas de batch)
export const RECETTES: { preparation: string; ingredients: [string, number][] }[] = [
  { preparation: "Boulettes smash pressées", ingredients: [["Viande hachée fraîche (80/20)", 0.07]] },
  { preparation: "Salade iceberg taillée", ingredients: [["Salade iceberg", 1]] },
  { preparation: "Tomates en rondelles", ingredients: [["Tomates", 1]] },
  { preparation: "Oignons rouges en rondelles", ingredients: [["Oignons", 1]] },
  { preparation: "Oignon haché", ingredients: [["Oignons", 1]] },
  { preparation: "Frites taillées et trempées", ingredients: [["Pommes de terre", 1]] },
  {
    preparation: "Sauce Easy",
    ingredients: [
      ["Mayonnaise", 1.495],
      ["Ketchup Heinz", 0.585],
      ["Cornichons", 0.52],
      ["Sucre blanc", 0.078],
      ["Glutamate", 0.039],
      ["Paprika", 0.026],
      ["Oignon en poudre", 0.026],
    ],
  },
  {
    preparation: "Base sweet creamy",
    ingredients: [
      ["Miel", 2.4],
      ["Moutarde américaine", 1.44],
      ["Sauce BBQ", 2.88],
      ["Citrons", 0.32],
      ["Sel", 0.28],
      ["Poivre noir", 0.1],
    ],
  },
  {
    preparation: "Sweet creamy, sauce finie",
    ingredients: [
      ["Base sweet creamy", 0.744],
      ["Mayonnaise", 0.54],
      ["Maïzena", 0.04],
    ],
  },
  {
    preparation: "Boules de pâte à cookies",
    ingredients: [
      ["Farine", 0.855],
      ["Sucre roux", 0.6],
      ["Sucre blanc", 0.075],
      ["Chocolat noir", 0.75],
      ["Œufs", 6],
    ],
  },
  { preparation: "Sirop de sucre", ingredients: [["Sucre blanc", 3]] },
  {
    preparation: "Concentré de citronnade",
    ingredients: [
      ["Sirop de sucre", 1.5],
      ["Citrons", 1],
    ],
  },
  { preparation: "Citronnade servie", ingredients: [["Concentré de citronnade", 1]] },
];

export interface ProduitInitial {
  nom: string;
  libellesCaisse?: string[];
  categorie: string;
  coef: Record<TypeJournee, number>;
  composants: [string, number][];
  remarque?: string;
}

const GARNITURE_EASY: [string, number][] = [
  ["Sauce Easy", 0.034],
  ["Salade iceberg taillée", 0.008],
  ["Tomates en rondelles", 0.03],
  ["Oignons rouges en rondelles", 0.01],
];
const GARNITURE_CLASSIC: [string, number][] = [
  ["Ketchup Heinz", 0.03],
  ["Moutarde américaine", 0.01],
  ["Cornichons", 0.015],
  ["Oignon haché", 0.001],
];

// 14.1 et 14.2 — produits vendus, coefficients et nomenclature
export const PRODUITS: ProduitInitial[] = [
  { nom: "Easy", categorie: "Burgers", coef: { semaine: 3.078, weekend: 2.455 }, composants: [["Pains burger", 1], ["Boulettes smash pressées", 1], ["Cheddar en tranches", 1], ...GARNITURE_EASY] },
  { nom: "Double Easy", categorie: "Burgers", coef: { semaine: 4.664, weekend: 4.715 }, composants: [["Pains burger", 1], ["Boulettes smash pressées", 2], ["Cheddar en tranches", 2], ...GARNITURE_EASY] },
  { nom: "Classic Double Cheese", categorie: "Burgers", coef: { semaine: 1.026, weekend: 1.148 }, composants: [["Pains burger", 1], ["Boulettes smash pressées", 2], ["Cheddar en tranches", 2], ...GARNITURE_CLASSIC] },
  { nom: "4x4", categorie: "Burgers", coef: { semaine: 0.213, weekend: 0.265 }, composants: [["Pains burger", 1], ["Boulettes smash pressées", 4], ["Cheddar en tranches", 4], ...GARNITURE_CLASSIC] },
  { nom: "Hamburger Enfants", categorie: "Burgers", coef: { semaine: 0.107, weekend: 0.388 }, composants: [["Pains burger", 1], ["Boulettes smash pressées", 1], ["Cheddar en tranches", 1], ...GARNITURE_EASY] },
  { nom: "Truffle Parmesan Burger", categorie: "Burgers", coef: { semaine: 0, weekend: 0 }, remarque: "Pas encore à la carte : coefficient personnalisé au lancement", composants: [["Pains burger", 1], ["Boulettes smash pressées", 1], ["Cheddar en tranches", 1], ["Mayo truffe", 0.04], ["Crispy onions", 0.015], ["Parmesan râpé", 0.01], ["Oignons caramélisés", 0.02]] },
  { nom: "Cheesy Overload", categorie: "Burgers", coef: { semaine: 0, weekend: 0 }, remarque: "Pas encore à la carte : coefficient personnalisé au lancement", composants: [["Pains burger", 1], ["Boulettes smash pressées", 2], ["Cheddar en tranches", 2], ...GARNITURE_CLASSIC, ["Sauce fromage", 0.08]] },
  { nom: "Frites", libellesCaisse: ["Frites", "Frites (portion de 250 g)"], categorie: "Sides", coef: { semaine: 4.637, weekend: 3.938 }, composants: [["Frites taillées et trempées", 0.25]] },
  { nom: "Frites Patates Douces", categorie: "Sides", coef: { semaine: 1.199, weekend: 1.448 }, composants: [["Frites de patates douces surgelées", 0.15]] },
  { nom: "Truffle Parmesan Fries", categorie: "Sides", coef: { semaine: 1.066, weekend: 1.13 }, composants: [["Frites taillées et trempées", 0.15], ["Mayo truffe", 0.03], ["Parmesan râpé", 0.01], ["Crispy onions", 0.01]] },
  { nom: "Cheesy Fries", categorie: "Sides", coef: { semaine: 0.866, weekend: 1.024 }, composants: [["Frites taillées et trempées", 0.15], ["Sauce fromage", 0.08]] },
  { nom: "Loaded Beef Fries", categorie: "Sides", coef: { semaine: 0.8, weekend: 0.883 }, composants: [["Frites taillées et trempées", 0.2], ["Sauce Easy", 0.04], ["Viande hachée fraîche (80/20)", 0.035], ["Cheddar râpé", 0.007], ["Crispy onions", 0.003]] },
  { nom: "Tenders", categorie: "Sides", coef: { semaine: 0.4, weekend: 0.689 }, composants: [["Chicken tenders surgelés", 0.2]] },
  { nom: "Easy Melt", libellesCaisse: ["Easy Melt", "Scoopable Cookie + Soft Serve"], categorie: "Desserts", coef: { semaine: 0.4, weekend: 0.583 }, composants: [["Boules de pâte à cookies", 1], ["Mix soft serve", 0.12]] },
  { nom: "Cookie Classic", categorie: "Desserts", coef: { semaine: 0.173, weekend: 0.035 }, composants: [["Boules de pâte à cookies", 1]] },
  { nom: "Cookie Double Trouble", categorie: "Desserts", coef: { semaine: 0.04, weekend: 0 }, composants: [["Boules de pâte à cookies", 1]] },
  { nom: "Cookie Caramel beurre salé", categorie: "Desserts", coef: { semaine: 0.093, weekend: 0.053 }, remarque: "Inclut les ventes encaissées par erreur sous « Mini Beignets »", composants: [["Boules de pâte à cookies", 1]] },
  { nom: "Easy Sundae", categorie: "Desserts", coef: { semaine: 0.093, weekend: 0.141 }, composants: [["Mix soft serve", 0.12]] },
  { nom: "Citronnade", libellesCaisse: ["Citronnade", "Citronnade (verre)"], categorie: "Boissons", coef: { semaine: 4.744, weekend: 4.432 }, composants: [["Citronnade servie", 0.25]] },
  { nom: "Carafe de citronnade", categorie: "Boissons", coef: { semaine: 0.12, weekend: 0.106 }, composants: [["Citronnade servie", 1]] },
  { nom: "Coca Cola", categorie: "Boissons", coef: { semaine: 1.373, weekend: 1.289 }, composants: [["Coca Cola", 1]] },
  { nom: "Coca Zero", categorie: "Boissons", coef: { semaine: 0.6, weekend: 1.024 }, composants: [["Coca Zero", 1]] },
  { nom: "Eau", categorie: "Boissons", coef: { semaine: 0.853, weekend: 0.547 }, composants: [["Eau", 1]] },
  { nom: "Hawai", categorie: "Boissons", coef: { semaine: 0.426, weekend: 0.353 }, composants: [["Hawai", 1]] },
  { nom: "Sprite", categorie: "Boissons", coef: { semaine: 0.253, weekend: 0.088 }, composants: [["Sprite", 1]] },
  { nom: "Sauce Easy (portion à part)", libellesCaisse: ["Sauce Easy (portion à part)", "Sauce Easy"], categorie: "Sauces", coef: { semaine: 5.837, weekend: 4.874 }, composants: [["Sauce Easy", 0.03]] },
  { nom: "Sauce Sweet Creamy (portion à part)", libellesCaisse: ["Sauce Sweet Creamy (portion à part)", "Sauce Sweet Creamy"], categorie: "Sauces", coef: { semaine: 0.48, weekend: 0.812 }, composants: [["Sweet creamy, sauce finie", 0.03]] },
  { nom: "Sauce Ketchup (portion à part)", libellesCaisse: ["Sauce Ketchup (portion à part)", "Sauce Ketchup"], categorie: "Sauces", coef: { semaine: 0.213, weekend: 1.148 }, composants: [["Ketchup Heinz", 0.03]] },
  { nom: "Sauce Yellow Mustard (portion à part)", libellesCaisse: ["Sauce Yellow Mustard (portion à part)", "Sauce Yellow Mustard"], categorie: "Sauces", coef: { semaine: 0.027, weekend: 0.018 }, composants: [["Moutarde américaine", 0.03]] },
  { nom: "Dips (Easy + Sweet Creamy)", libellesCaisse: ["Dips (Easy + Sweet Creamy)", "Dips"], categorie: "Sauces", coef: { semaine: 0, weekend: 0.035 }, composants: [["Sauce Easy", 0.015], ["Sweet creamy, sauce finie", 0.015]] },
  { nom: "Supplément fromage", categorie: "Suppléments", coef: { semaine: 0.107, weekend: 0.177 }, composants: [["Cheddar en tranches", 1]] },
  { nom: "Supplément Smash patty", categorie: "Suppléments", coef: { semaine: 0.093, weekend: 0.018 }, composants: [["Boulettes smash pressées", 1]] },
  { nom: "Coulis Nutella", libellesCaisse: ["Coulis Nutella", "Coulis Nutella (portion)"], categorie: "Desserts", coef: { semaine: 0.493, weekend: 0.689 }, composants: [["Nutella", 0.025]] },
];

/** Libellés de caisse retirés de la carte, à ignorer sans alerte. */
export const LIBELLES_RETIRES = ["green mayo", "spicy mayo", "beignet citron"];

/** Options sans matière, ignorées à l'import. */
export const LIBELLES_SANS_MATIERE_PREFIXES = ["sans "];

export const PARAMETRES_MOTEUR = {
  margeGenerale: 0.1,
  seuilDlcVeilleFermeture: 2,
  caDefautSemaine: 18760,
  caDefautWeekend: 28315,
};
