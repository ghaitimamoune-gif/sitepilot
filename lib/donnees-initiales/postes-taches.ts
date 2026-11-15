/**
 * Postes de départ (section 3) et tâches récurrentes de départ (section 14.7).
 *
 * Les points à cocher reprennent l'esprit des checklists 03.1 à 03.9 du manuel ; le texte
 * exact de chaque point se recopie mot pour mot depuis le manuel dans Paramètres → Tâches.
 * Les codes PIN de départ sont à changer dès la mise en service (voir ADMINISTRATION.md).
 */
import type { Role, Zone } from "@/lib/auth/droits";
import type { ValeurAttendue } from "@/lib/db/schema";

export interface PosteInitial {
  nom: string;
  role: Role;
  zone: Zone;
  pin: string;
  superieur?: string;
  voitPreparations?: boolean;
  planNettoyage?: boolean;
  ordre: number;
}

export const POSTES: PosteInitial[] = [
  { nom: "Propriétaire — Jaafar", role: "proprietaire", zone: "direction", pin: "111111", ordre: 1 },
  { nom: "Propriétaire — Amani", role: "proprietaire", zone: "direction", pin: "222222", ordre: 2 },
  { nom: "Propriétaire — Taha", role: "proprietaire", zone: "direction", pin: "333333", ordre: 3 },
  { nom: "Propriétaire — Mamoune", role: "proprietaire", zone: "direction", pin: "444444", ordre: 4 },
  { nom: "Manager", role: "manager", zone: "direction", pin: "1000", ordre: 10, voitPreparations: true },
  { nom: "Responsable achats", role: "resp_achats", zone: "direction", pin: "2000", superieur: "Manager", ordre: 11 },
  { nom: "Responsable cuisine", role: "resp_cuisine", zone: "cuisine", pin: "3000", superieur: "Manager", voitPreparations: true, ordre: 12 },
  { nom: "Responsable salle", role: "resp_salle", zone: "salle", pin: "4000", superieur: "Manager", ordre: 13 },
  { nom: "MEP viande et fromage", role: "employe", zone: "cuisine", pin: "1001", superieur: "Responsable cuisine", voitPreparations: true, ordre: 20 },
  { nom: "MEP légumes et frites", role: "employe", zone: "cuisine", pin: "1002", superieur: "Responsable cuisine", voitPreparations: true, ordre: 21 },
  { nom: "MEP pâtisserie et boissons", role: "employe", zone: "cuisine", pin: "1003", superieur: "Responsable cuisine", voitPreparations: true, ordre: 22 },
  { nom: "Grill et montage", role: "employe", zone: "cuisine", pin: "1004", superieur: "Responsable cuisine", voitPreparations: true, planNettoyage: true, ordre: 23 },
  { nom: "Frites et sides", role: "employe", zone: "cuisine", pin: "1005", superieur: "Responsable cuisine", voitPreparations: true, planNettoyage: true, ordre: 24 },
  { nom: "Dispatch", role: "employe", zone: "cuisine", pin: "1006", superieur: "Responsable cuisine", voitPreparations: true, ordre: 25 },
  { nom: "Plonge et desserts", role: "employe", zone: "cuisine", pin: "1007", superieur: "Responsable cuisine", voitPreparations: true, planNettoyage: true, ordre: 26 },
  { nom: "Serveur", role: "employe", zone: "salle", pin: "1008", superieur: "Responsable salle", ordre: 30 },
  { nom: "Ménage et débarrassage", role: "employe", zone: "salle", pin: "1009", superieur: "Responsable salle", planNettoyage: true, ordre: 31 },
];

export interface TacheInitiale {
  titre: string;
  consigne?: string;
  poste: string;
  recurrence: "chaque_jour_ouvert" | "jours_semaine" | "hebdomadaire" | "mensuelle";
  joursSemaine?: number[];
  heureSemaine: string;
  heureWeekend: string;
  delaiRemonteeMin?: number;
  preuve: "aucune" | "photos" | "valeurs";
  photosMin?: number;
  points?: string[];
  valeurs?: ValeurAttendue[];
  structurante?: boolean;
  ecranLie?: "comptage" | "reception" | "commandes" | "cloture" | "pertes";
  famille?: string;
  ordre: number;
}

const FRIGO = (n: number): ValeurAttendue => ({ label: `Frigo ${n}`, min: 0, max: 4, unite: "°C" });

export const TACHES: TacheInitiale[] = [
  {
    titre: "Ouverture cuisine : sécurité et matériel",
    consigne: "Fiche 03.1 du manuel. Tout point non conforme : bloquer la tâche et prévenir la manager.",
    poste: "Responsable cuisine",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "08:00",
    heureWeekend: "09:00",
    preuve: "aucune",
    points: [
      "Vannes de gaz et flexibles vérifiés, aucune odeur",
      "Plaque smash allumée, montée en température",
      "Friteuses : niveau et température de l'huile",
      "Toaster et four allumés et fonctionnels",
      "Frigos et congélateur fermés, voyants normaux",
      "Extincteur et couverture anti-feu accessibles",
      "Sols secs, passages dégagés",
    ],
    ordre: 1,
  },
  {
    titre: "Relevé des températures des 6 frigos",
    consigne: "À l'ouverture. Une valeur hors plage : ne rien jeter, ne rien utiliser, prévenir la manager.",
    poste: "Responsable cuisine",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "08:05",
    heureWeekend: "09:05",
    preuve: "valeurs",
    valeurs: [FRIGO(1), FRIGO(2), FRIGO(3), FRIGO(4), FRIGO(5), FRIGO(6)],
    structurante: true,
    ordre: 2,
  },
  {
    titre: "Stocks et dates : DLC, rotation, niveaux",
    consigne: "Fiche 03.2 du manuel.",
    poste: "Responsable cuisine",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "08:15",
    heureWeekend: "09:15",
    preuve: "aucune",
    points: [
      "DLC de la viande contrôlées",
      "DLC des sauces maison contrôlées (étiquettes datées)",
      "DLC des crudités taillées contrôlées",
      "Rotation premier entré, premier sorti respectée",
      "Niveau de pain pour le service",
      "Niveau de cheddar et d'emballages",
      "Produits entamés filmés et datés",
      "Rien au sol dans la chambre froide",
    ],
    ordre: 3,
  },
  {
    titre: "Comptage du matin",
    consigne: "Compter le frais et les préparations maison dans l'écran de comptage. Le stock théorique n'est pas affiché : compter réellement.",
    poste: "Responsable cuisine",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "08:45",
    heureWeekend: "09:45",
    preuve: "aucune",
    ecranLie: "comptage",
    famille: "Frais et préparations maison",
    ordre: 4,
  },
  {
    titre: "Hygiène d'ouverture",
    consigne: "Fiche 03.3 du manuel. Photos des plans de travail et du lave-mains.",
    poste: "Responsable cuisine",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "08:45",
    heureWeekend: "09:45",
    preuve: "photos",
    photosMin: 1,
    points: [
      "Lave-mains : savon, papier, eau chaude",
      "Plans de travail désinfectés",
      "Planches et ustensiles propres par couleur",
      "Poubelles vidées, sacs en place",
      "Tenues propres, cheveux attachés, pas de bijoux",
      "Produits chimiques rangés à l'écart des aliments",
    ],
    ordre: 5,
  },
  {
    titre: "Lancement de la mise en place",
    consigne: "Répartir la fiche des préparations du jour entre les postes MEP.",
    poste: "Responsable cuisine",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "09:00",
    heureWeekend: "10:00",
    preuve: "aucune",
    points: [
      "Fiche des préparations consultée, restes de la veille saisis",
      "Boulettes lancées (MEP viande et fromage)",
      "Crudités et frites lancées (MEP légumes et frites)",
      "Sauces, pâte à cookies et citronnade vérifiées (MEP pâtisserie et boissons)",
      "Pains du jour lancés",
    ],
    ordre: 6,
  },
  {
    titre: "Réception des livraisons",
    consigne: "Une réception par livraison, comptée à l'aveugle, photo du bon de livraison.",
    poste: "Manager",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "10:30",
    heureWeekend: "11:30",
    delaiRemonteeMin: 90,
    preuve: "aucune",
    ecranLie: "reception",
    ordre: 7,
  },
  {
    titre: "Ouverture salle : propreté, ambiance, consommables",
    consigne: "Fiche 03.4 du manuel. Photo de la salle prête.",
    poste: "Responsable salle",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "11:45",
    heureWeekend: "12:45",
    preuve: "photos",
    photosMin: 1,
    points: [
      "Tables et chaises propres et alignées",
      "Sol de salle et entrée propres",
      "Sanitaires propres, savon et papier",
      "Musique, éclairage, climatisation réglés",
      "Serviettes, couverts, sauces en libre-service remplis",
      "Vitrine et comptoir propres",
    ],
    ordre: 8,
  },
  {
    titre: "Ouverture de la caisse : fonds compté, caisse et terminal testés",
    poste: "Responsable salle",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "12:00",
    heureWeekend: "13:00",
    preuve: "valeurs",
    valeurs: [{ label: "Fonds de caisse", min: 0, max: null, unite: "DH" }],
    points: ["Caisse ouverte et imprimante testée", "Terminal de paiement testé"],
    ordre: 9,
  },
  {
    titre: "Brief de début de service",
    consigne: "Effectif, prévisionnel du jour, ruptures, consignes.",
    poste: "Manager",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "12:15",
    heureWeekend: "13:15",
    preuve: "aucune",
    ordre: 10,
  },
  {
    titre: "Passer les commandes fournisseurs",
    consigne: "Vérifier les lignes proposées, envoyer sur WhatsApp avant l'heure limite de chaque fournisseur.",
    poste: "Responsable achats",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "16:00",
    heureWeekend: "16:00",
    delaiRemonteeMin: 60,
    preuve: "aucune",
    ecranLie: "commandes",
    ordre: 11,
  },
  {
    titre: "Nettoyage de la plaque smash — après le midi",
    poste: "Grill et montage",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "15:45",
    heureWeekend: "18:45",
    preuve: "photos",
    photosMin: 1,
    ordre: 12,
  },
  {
    titre: "Nettoyage de la plaque smash — après le soir",
    poste: "Grill et montage",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "22:45",
    heureWeekend: "23:45",
    preuve: "photos",
    photosMin: 1,
    ordre: 13,
  },
  {
    titre: "Sol de cuisine — fin du service du midi",
    poste: "Plonge et desserts",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "15:45",
    heureWeekend: "18:45",
    preuve: "photos",
    photosMin: 1,
    ordre: 14,
  },
  {
    titre: "Sol de cuisine — fin du service du soir",
    poste: "Plonge et desserts",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "22:45",
    heureWeekend: "23:45",
    preuve: "photos",
    photosMin: 1,
    ordre: 15,
  },
  {
    titre: "Filtration de l'huile de friture, couleur et niveau",
    poste: "Frites et sides",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "22:45",
    heureWeekend: "23:45",
    preuve: "photos",
    photosMin: 1,
    points: ["Huile filtrée", "Couleur acceptable (sinon changement d'huile)", "Niveau complété"],
    ordre: 16,
  },
  {
    titre: "Toaster, four, siphons, cycle de la machine soft serve",
    consigne: "Plan de nettoyage 03.8.",
    poste: "Plonge et desserts",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "22:45",
    heureWeekend: "23:45",
    preuve: "photos",
    photosMin: 2,
    points: ["Toaster nettoyé", "Four nettoyé", "Siphons débouchés et nettoyés", "Cycle de nettoyage de la machine soft serve lancé"],
    ordre: 17,
  },
  {
    titre: "Déclaration des pertes du service",
    consigne: "Déclarer ce qui a été jeté dans l'écran des pertes : article, quantité, motif.",
    poste: "Responsable cuisine",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "22:45",
    heureWeekend: "23:45",
    preuve: "aucune",
    ecranLie: "pertes",
    ordre: 18,
  },
  {
    titre: "Fermeture cuisine : produits filmés, étiquetés, datés",
    consigne: "Fiche 03.6 du manuel.",
    poste: "Responsable cuisine",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "22:50",
    heureWeekend: "23:50",
    preuve: "aucune",
    points: ["Viande et boulettes filmées et datées", "Sauces maison filmées et datées", "Crudités taillées filmées et datées", "Chambre froide rangée, rien au sol"],
    ordre: 19,
  },
  {
    titre: "Comptage de fermeture des 5 produits critiques",
    consigne: "Viande, pains, fromage, pommes de terre, poulet : comptage limité aux produits critiques, pour le coût matière du jour.",
    poste: "Responsable cuisine",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "23:00",
    heureWeekend: "23:55",
    preuve: "aucune",
    ecranLie: "comptage",
    famille: "Frais et préparations maison",
    ordre: 20,
  },
  {
    titre: "Relevé final des températures (4 équipements)",
    poste: "Responsable cuisine",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "23:05",
    heureWeekend: "23:55",
    preuve: "valeurs",
    valeurs: [
      { label: "Chambre froide", min: 0, max: 4, unite: "°C" },
      { label: "Frigo viande", min: 0, max: 4, unite: "°C" },
      { label: "Congélateur", min: -25, max: -18, unite: "°C" },
      { label: "Machine soft serve", min: 0, max: 4, unite: "°C" },
    ],
    structurante: true,
    ordre: 21,
  },
  {
    titre: "Sécurité de fermeture : gaz, plaque, friteuses, toaster, four, frigos, éclairage",
    poste: "Responsable cuisine",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "23:10",
    heureWeekend: "23:59",
    preuve: "aucune",
    points: ["Gaz coupé", "Plaque éteinte", "Friteuses éteintes et couvertes", "Toaster éteint", "Four éteint", "Frigos fermés, températures normales", "Éclairage et climatisation de cuisine éteints"],
    structurante: true,
    ordre: 22,
  },
  {
    titre: "Fermeture salle : tables, sol, sanitaires, vitrine, consommables",
    poste: "Ménage et débarrassage",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "22:45",
    heureWeekend: "23:45",
    preuve: "photos",
    photosMin: 2,
    points: ["Tables nettoyées et chaises relevées", "Sol balayé et lavé", "Sanitaires nettoyés et réapprovisionnés", "Vitrine et comptoir nettoyés", "Consommables réapprovisionnés pour le lendemain"],
    ordre: 23,
  },
  {
    titre: "Caisse de fermeture, comptée à deux",
    poste: "Manager",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "23:00",
    heureWeekend: "23:50",
    preuve: "valeurs",
    valeurs: [
      { label: "Total caisse", min: 0, max: null, unite: "DH" },
      { label: "Espèces", min: 0, max: null, unite: "DH" },
      { label: "Carte", min: 0, max: null, unite: "DH" },
      { label: "Manquant", min: null, max: null, unite: "DH" },
    ],
    ordre: 24,
  },
  {
    titre: "Clôture de journée et rapport quotidien",
    consigne: "Écran de clôture : CA, couverts, espèces, carte, manquant, fait marquant. Envoyer le rapport au groupe de la direction.",
    poste: "Manager",
    recurrence: "chaque_jour_ouvert",
    heureSemaine: "23:15",
    heureWeekend: "23:59",
    delaiRemonteeMin: 120,
    preuve: "aucune",
    ecranLie: "cloture",
    structurante: true,
    ordre: 25,
  },
  {
    titre: "Hebdomadaire : filtres de hotte, intérieur des frigos, étagères et réserve, démontage de la machine soft serve",
    consigne: "Plan de nettoyage 03.8.",
    poste: "Plonge et desserts",
    recurrence: "hebdomadaire",
    joursSemaine: [2],
    heureSemaine: "15:45",
    heureWeekend: "15:45",
    delaiRemonteeMin: 180,
    preuve: "photos",
    photosMin: 3,
    points: ["Filtres de hotte dégraissés", "Intérieur des frigos nettoyé", "Étagères et réserve nettoyées", "Machine soft serve démontée et nettoyée"],
    ordre: 26,
  },
  {
    titre: "Hebdomadaire : chaises et banquettes",
    poste: "Ménage et débarrassage",
    recurrence: "hebdomadaire",
    joursSemaine: [2],
    heureSemaine: "15:45",
    heureWeekend: "15:45",
    delaiRemonteeMin: 180,
    preuve: "photos",
    photosMin: 1,
    ordre: 27,
  },
  {
    titre: "Mensuel : dégivrage du congélateur, luminaires et hauteurs",
    consigne: "Plan de nettoyage 03.8.",
    poste: "Plonge et desserts",
    recurrence: "mensuelle",
    heureSemaine: "15:45",
    heureWeekend: "15:45",
    delaiRemonteeMin: 240,
    preuve: "photos",
    photosMin: 2,
    points: ["Congélateur dégivré et nettoyé", "Luminaires et hauteurs dépoussiérés"],
    ordre: 28,
  },
  { titre: "Comptage hebdomadaire : épicerie et crémerie", poste: "Responsable cuisine", recurrence: "hebdomadaire", joursSemaine: [3], heureSemaine: "15:45", heureWeekend: "15:45", delaiRemonteeMin: 120, preuve: "aucune", ecranLie: "comptage", famille: "Épicerie et crémerie", ordre: 29 },
  { titre: "Comptage hebdomadaire : surgelés", poste: "Responsable cuisine", recurrence: "hebdomadaire", joursSemaine: [3], heureSemaine: "15:45", heureWeekend: "15:45", delaiRemonteeMin: 120, preuve: "aucune", ecranLie: "comptage", famille: "Surgelés", ordre: 30 },
  { titre: "Comptage hebdomadaire : huile de friture", poste: "Responsable cuisine", recurrence: "hebdomadaire", joursSemaine: [3], heureSemaine: "15:45", heureWeekend: "15:45", delaiRemonteeMin: 120, preuve: "aucune", ecranLie: "comptage", famille: "Huile de friture", ordre: 31 },
  { titre: "Comptage hebdomadaire : emballages et stickers", poste: "Responsable achats", recurrence: "hebdomadaire", joursSemaine: [3], heureSemaine: "15:45", heureWeekend: "15:45", delaiRemonteeMin: 120, preuve: "aucune", ecranLie: "comptage", famille: "Emballages et stickers", ordre: 32 },
  { titre: "Comptage hebdomadaire : consommables de salle", poste: "Responsable achats", recurrence: "hebdomadaire", joursSemaine: [3], heureSemaine: "15:45", heureWeekend: "15:45", delaiRemonteeMin: 120, preuve: "aucune", ecranLie: "comptage", famille: "Consommables de salle", ordre: 33 },
  { titre: "Comptage hebdomadaire : entretien et hygiène", poste: "Responsable achats", recurrence: "hebdomadaire", joursSemaine: [3], heureSemaine: "15:45", heureWeekend: "15:45", delaiRemonteeMin: 120, preuve: "aucune", ecranLie: "comptage", famille: "Entretien et hygiène", ordre: 34 },
  { titre: "Comptage mensuel : tenues", poste: "Responsable achats", recurrence: "mensuelle", joursSemaine: [3], heureSemaine: "15:45", heureWeekend: "15:45", delaiRemonteeMin: 240, preuve: "aucune", ecranLie: "comptage", famille: "Tenues", ordre: 35 },
  { titre: "Comptage mensuel : petit matériel", poste: "Responsable achats", recurrence: "mensuelle", joursSemaine: [3], heureSemaine: "15:45", heureWeekend: "15:45", delaiRemonteeMin: 240, preuve: "aucune", ecranLie: "comptage", famille: "Petit matériel", ordre: 36 },
];

/** Fournisseurs de départ : la section 15 (catalogue) n'étant pas jointe au brief, ces fiches sont « à vérifier ». */
export interface FournisseurInitial {
  nom: string;
  contact?: string;
  joursLivraison: number[];
  heureLimite?: string;
  delaiJours?: number;
  validationRequise?: boolean;
  achatDirect?: boolean;
  statut: "actif" | "a_verifier";
  /** Articles fournis : noms d'articles, avec unité de commande et quantité d'unités de comptage par unité de commande. */
  articles: [string, string, number][];
}

export const FOURNISSEURS: FournisseurInitial[] = [
  {
    nom: "Boucherie (viande)",
    joursLivraison: [1, 2, 3, 4, 5, 6],
    heureLimite: "17:00",
    statut: "a_verifier",
    articles: [["Viande hachée fraîche (80/20)", "kg", 1]],
  },
  {
    nom: "Primeur (fruits et légumes)",
    joursLivraison: [0, 1, 2, 3, 4, 5, 6],
    heureLimite: "18:00",
    statut: "a_verifier",
    articles: [
      ["Salade iceberg", "kg", 1],
      ["Tomates", "kg", 1],
      ["Pommes de terre", "sac de 25 kg", 25],
      ["Oignons", "kg", 1],
      ["Citrons", "kg", 1],
    ],
  },
  {
    nom: "Grossiste épicerie et surgelés",
    joursLivraison: [2, 5],
    heureLimite: "16:00",
    statut: "a_verifier",
    articles: [
      ["Cheddar en tranches", "carton de 400 tranches", 400],
      ["Cheddar râpé", "kg", 1],
      ["Mix soft serve", "L", 1],
      ["Frites de patates douces surgelées", "carton de 10 kg", 10],
      ["Chicken tenders surgelés", "carton de 5 kg", 5],
      ["Mayonnaise", "seau de 5 kg", 5],
      ["Ketchup Heinz", "bidon de 5 kg", 5],
      ["Moutarde américaine", "kg", 1],
      ["Cornichons", "seau de 5 kg", 5],
      ["Parmesan râpé", "kg", 1],
      ["Crispy onions", "kg", 1],
      ["Sauce fromage", "kg", 1],
      ["Nutella", "kg", 1],
      ["Miel", "kg", 1],
      ["Sauce BBQ", "kg", 1],
      ["Sel", "kg", 1],
      ["Poivre noir", "kg", 1],
      ["Maïzena", "kg", 1],
      ["Sucre blanc", "sac de 50 kg", 50],
      ["Sucre roux", "kg", 1],
      ["Farine", "sac de 50 kg", 50],
      ["Chocolat noir", "kg", 1],
      ["Œufs", "plateau de 30", 30],
      ["Beurre", "kg", 1],
      ["Glutamate", "kg", 1],
      ["Paprika", "kg", 1],
      ["Oignon en poudre", "kg", 1],
      ["Huile de friture", "bidon", 1],
      ["Coca Cola", "pack de 24", 24],
      ["Coca Zero", "pack de 24", 24],
      ["Sprite", "pack de 24", 24],
      ["Hawai", "pack de 24", 24],
      ["Eau", "pack de 12", 12],
    ],
  },
  {
    nom: "Emballages et stickers",
    joursLivraison: [3],
    heureLimite: "12:00",
    delaiJours: 2,
    validationRequise: true,
    statut: "a_verifier",
    articles: [
      ["Boîte burger", "carton de 500", 500],
      ["Barquette frites", "carton de 500", 500],
      ["Sac papier", "paquet de 250", 250],
      ["Gobelet 33 cl", "carton de 1000", 1000],
      ["Stickers", "rouleau de 500", 500],
    ],
  },
  {
    nom: "Tenues",
    joursLivraison: [],
    delaiJours: 7,
    validationRequise: true,
    statut: "a_verifier",
    articles: [
      ["T-shirt Easy Burger", "unité", 1],
      ["Tablier", "unité", 1],
    ],
  },
  {
    nom: "Achat direct",
    contact: "Achat de dépannage payé en espèces",
    joursLivraison: [0, 1, 2, 3, 4, 5, 6],
    achatDirect: true,
    statut: "actif",
    articles: [],
  },
];

/** Articles hors moteur (emballages, consommables, entretien, tenues, matériel) : stock minimum et cible fixes. */
export const ARTICLES_HORS_VENTES: { nom: string; famille: string; nature: "emballage" | "consommable" | "tenue" | "materiel"; unite: string; stockMinimum: number; stockCible: number; structurant?: boolean }[] = [
  { nom: "Boîte burger", famille: "Emballages et stickers", nature: "emballage", unite: "unité", stockMinimum: 1500, stockCible: 4000, structurant: true },
  { nom: "Barquette frites", famille: "Emballages et stickers", nature: "emballage", unite: "unité", stockMinimum: 1500, stockCible: 4000, structurant: true },
  { nom: "Sac papier", famille: "Emballages et stickers", nature: "emballage", unite: "unité", stockMinimum: 500, stockCible: 1500 },
  { nom: "Gobelet 33 cl", famille: "Emballages et stickers", nature: "emballage", unite: "unité", stockMinimum: 1000, stockCible: 3000 },
  { nom: "Stickers", famille: "Emballages et stickers", nature: "emballage", unite: "unité", stockMinimum: 500, stockCible: 2000 },
  { nom: "Serviettes", famille: "Consommables de salle", nature: "consommable", unite: "paquet", stockMinimum: 10, stockCible: 40 },
  { nom: "Couverts jetables", famille: "Consommables de salle", nature: "consommable", unite: "paquet", stockMinimum: 5, stockCible: 20 },
  { nom: "Assiettes", famille: "Consommables de salle", nature: "consommable", unite: "unité", stockMinimum: 100, stockCible: 300 },
  { nom: "Dégraissant", famille: "Entretien et hygiène", nature: "consommable", unite: "bidon", stockMinimum: 2, stockCible: 6 },
  { nom: "Gants jetables", famille: "Entretien et hygiène", nature: "consommable", unite: "boîte", stockMinimum: 5, stockCible: 20 },
  { nom: "Sacs poubelle", famille: "Entretien et hygiène", nature: "consommable", unite: "rouleau", stockMinimum: 5, stockCible: 20 },
  { nom: "T-shirt Easy Burger", famille: "Tenues", nature: "tenue", unite: "unité", stockMinimum: 10, stockCible: 30 },
  { nom: "Tablier", famille: "Tenues", nature: "tenue", unite: "unité", stockMinimum: 10, stockCible: 25 },
  { nom: "Spatule", famille: "Petit matériel", nature: "materiel", unite: "unité", stockMinimum: 4, stockCible: 8 },
  { nom: "Bac gastro", famille: "Petit matériel", nature: "materiel", unite: "unité", stockMinimum: 20, stockCible: 40 },
  { nom: "Pince", famille: "Petit matériel", nature: "materiel", unite: "unité", stockMinimum: 6, stockCible: 12 },
];
