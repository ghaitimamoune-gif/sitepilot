/**
 * Schéma de la base Easy Burger Ops.
 *
 * Deux principes imposés par le brief :
 *  - le stock se déduit d'un journal de mouvements (table mouvements_stock) ;
 *  - tout ce que le métier appelle un paramètre vit en base (table parametres,
 *    familles, articles, coefficients, recettes...), jamais dans le code.
 */
import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  boolean,
  numeric,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Énumérations
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", [
  "proprietaire",
  "manager",
  "resp_achats",
  "resp_cuisine",
  "resp_salle",
  "employe",
]);

export const zoneEnum = pgEnum("zone", ["direction", "cuisine", "salle"]);

export const typeJourneeEnum = pgEnum("type_journee", ["semaine", "weekend"]);

export const rythmeComptageEnum = pgEnum("rythme_comptage", [
  "quotidien",
  "hebdomadaire",
  "mensuel",
]);

export const natureArticleEnum = pgEnum("nature_article", [
  "matiere_premiere",
  "preparation",
  "emballage",
  "consommable",
  "tenue",
  "materiel",
]);

export const statutFicheEnum = pgEnum("statut_fiche", ["actif", "a_verifier", "archive"]);

export const origineCaEnum = pgEnum("origine_ca", ["estime", "saisi"]);

export const sourceClotureEnum = pgEnum("source_cloture", ["saisie", "import"]);

export const natureMouvementEnum = pgEnum("nature_mouvement", [
  "comptage",
  "reception",
  "consommation",
  "perte",
  "correction",
  "production",
]);

export const statutComptageEnum = pgEnum("statut_comptage", ["en_cours", "valide"]);

export const motifPerteEnum = pgEnum("motif_perte", [
  "perime",
  "rate",
  "offert",
  "refait",
  "casse",
  "chaine_du_froid",
]);

export const statutCommandeEnum = pgEnum("statut_commande", [
  "brouillon",
  "en_attente_validation",
  "refusee",
  "prete",
  "envoyee",
  "recue_partiellement",
  "recue",
  "cloturee",
]);

export const origineLigneEnum = pgEnum("origine_ligne", [
  "moteur",
  "comptage",
  "rupture",
  "reception",
  "manuel",
]);

export const statutReceptionEnum = pgEnum("statut_reception", ["brouillon", "validee"]);

export const decisionReceptionEnum = pgEnum("decision_reception", [
  "accepte",
  "accepte_reserve",
  "refuse",
]);

export const etatLigneReceptionEnum = pgEnum("etat_ligne_reception", [
  "conforme",
  "ecart",
  "non_livre",
  "en_plus",
]);

export const recurrenceEnum = pgEnum("recurrence", [
  "ponctuelle",
  "chaque_jour_ouvert",
  "jours_semaine",
  "hebdomadaire",
  "mensuelle",
]);

export const preuveEnum = pgEnum("preuve", ["aucune", "photos", "valeurs"]);

export const ecranLieEnum = pgEnum("ecran_lie", [
  "comptage",
  "reception",
  "commandes",
  "cloture",
  "pertes",
]);

export const statutTacheEnum = pgEnum("statut_tache", [
  "a_faire",
  "faite",
  "verifiee",
  "a_refaire",
  "bloquee",
  "en_retard",
  "non_faite",
  "annulee",
]);

export const niveauAlerteEnum = pgEnum("niveau_alerte", [
  "critique",
  "avertissement",
  "a_traiter",
  "information",
]);

export const typeAlerteEnum = pgEnum("type_alerte", [
  "rupture",
  "ecart_stock",
  "temperature",
  "tache_structurante",
  "ecart_reception",
  "livraison_non_receptionnee",
  "hausse_prix",
  "cout_matiere",
  "commande_a_valider",
  "fiche_a_verifier",
  "coefficient_variation",
  "quantite_forcee",
  "tache_remontee",
  "import_libelle_inconnu",
]);

// ---------------------------------------------------------------------------
// Comptes, appareils, sessions
// ---------------------------------------------------------------------------

export const postes = pgTable("postes", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  role: roleEnum("role").notNull(),
  zone: zoneEnum("zone").notNull().default("cuisine"),
  pinHash: text("pin_hash").notNull(),
  posteSuperieurId: integer("poste_superieur_id"),
  voitPreparations: boolean("voit_preparations").notNull().default(false),
  planNettoyage: boolean("plan_nettoyage").notNull().default(false),
  actif: boolean("actif").notNull().default(true),
  ordre: integer("ordre").notNull().default(100),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const personnes = pgTable(
  "personnes",
  {
    id: serial("id").primaryKey(),
    posteId: integer("poste_id")
      .notNull()
      .references(() => postes.id),
    prenom: text("prenom").notNull(),
    prenomNorm: text("prenom_norm").notNull(),
    archivee: boolean("archivee").notNull().default(false),
    fusionneeDans: integer("fusionnee_dans"),
    premiereConnexion: timestamp("premiere_connexion", { withTimezone: true }).notNull().defaultNow(),
    derniereConnexion: timestamp("derniere_connexion", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("personnes_poste_prenom_idx").on(t.posteId, t.prenomNorm)],
);

export const appareils = pgTable("appareils", {
  id: serial("id").primaryKey(),
  jetonHash: text("jeton_hash").notNull().unique(),
  libelle: text("libelle"),
  enroleLe: timestamp("enrole_le", { withTimezone: true }).notNull().defaultNow(),
  dernierVuLe: timestamp("dernier_vu_le", { withTimezone: true }).notNull().defaultNow(),
  revoque: boolean("revoque").notNull().default(false),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  jetonHash: text("jeton_hash").notNull().unique(),
  posteId: integer("poste_id")
    .notNull()
    .references(() => postes.id),
  personneId: integer("personne_id")
    .notNull()
    .references(() => personnes.id),
  appareilId: integer("appareil_id")
    .notNull()
    .references(() => appareils.id),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  derniereActivite: timestamp("derniere_activite", { withTimezone: true }).notNull().defaultNow(),
  fermeeLe: timestamp("fermee_le", { withTimezone: true }),
});

/**
 * Invitation à usage unique pour un poste : le lien enrôle le téléphone et ouvre la session.
 * Pour un compte personnel (propriétaire, encadrement), l'invité choisit lui-même le code PIN.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: serial("id").primaryKey(),
    posteId: integer("poste_id")
      .notNull()
      .references(() => postes.id),
    jetonHash: text("jeton_hash").notNull(),
    expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
    utiliseeLe: timestamp("utilisee_le", { withTimezone: true }),
    utiliseeParPersonneId: integer("utilisee_par_personne_id"),
    annuleeLe: timestamp("annulee_le", { withTimezone: true }),
    creeParPosteId: integer("cree_par_poste_id"),
    creeParPersonneId: integer("cree_par_personne_id"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invitations_jeton_idx").on(t.jetonHash)],
);

export const tentativesPin = pgTable(
  "tentatives_pin",
  {
    id: serial("id").primaryKey(),
    appareilId: integer("appareil_id")
      .notNull()
      .references(() => appareils.id),
    reussie: boolean("reussie").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tentatives_appareil_idx").on(t.appareilId, t.at)],
);

// ---------------------------------------------------------------------------
// Référentiel
// ---------------------------------------------------------------------------

export const parametres = pgTable("parametres", {
  cle: text("cle").primaryKey(),
  valeur: text("valeur").notNull(),
  libelle: text("libelle"),
  modifiePar: text("modifie_par"),
  modifieLe: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow(),
});

export const calendrier = pgTable("calendrier", {
  date: date("date").primaryKey(),
  ouvert: boolean("ouvert").notNull(),
  typeJournee: typeJourneeEnum("type_journee").notNull(),
  note: text("note"),
});

/** Familles de comptage (section 7). */
export const familles = pgTable("familles", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull().unique(),
  rythme: rythmeComptageEnum("rythme").notNull(),
  roleCompteur: roleEnum("role_compteur").notNull(),
  joursSecurite: integer("jours_securite").notNull().default(1),
  ordre: integer("ordre").notNull().default(100),
});

/** Familles de perte (section 14.3) : viande, pain, fromage... */
export const famillesPerte = pgTable("familles_perte", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull().unique(),
  pertePct: numeric("perte_pct", { precision: 6, scale: 3 }).notNull().default("0"),
});

export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    nom: text("nom").notNull(),
    familleId: integer("famille_id").references(() => familles.id),
    famillePerteId: integer("famille_perte_id").references(() => famillesPerte.id),
    nature: natureArticleEnum("nature").notNull(),
    uniteComptage: text("unite_comptage").notNull(),
    /** Pour une pièce : équivalent en kg ou en litre (0,07 pour une boulette de 70 g). */
    poidsUnitaire: numeric("poids_unitaire", { precision: 12, scale: 6 }),
    unitePoids: text("unite_poids"),
    structurant: boolean("structurant").notNull().default(false),
    dlcJours: integer("dlc_jours"),
    rendementParage: numeric("rendement_parage", { precision: 6, scale: 4 }),
    lieAuxVentes: boolean("lie_aux_ventes").notNull().default(true),
    stockMinimum: numeric("stock_minimum", { precision: 12, scale: 3 }),
    stockCibleFixe: numeric("stock_cible_fixe", { precision: 12, scale: 3 }),
    /** Préparations maison */
    partAvance: numeric("part_avance", { precision: 6, scale: 4 }),
    rendementBatch: numeric("rendement_batch", { precision: 12, scale: 4 }),
    uniteBatch: text("unite_batch"),
    coutRevient: numeric("cout_revient", { precision: 12, scale: 4 }),
    critiqueCoutMatiere: boolean("critique_cout_matiere").notNull().default(false),
    statut: statutFicheEnum("statut").notNull().default("actif"),
    aConfirmer: boolean("a_confirmer").notNull().default(false),
    creeParPosteId: integer("cree_par_poste_id"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("articles_nom_idx").on(t.nom)],
);

export const fournisseurs = pgTable("fournisseurs", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull().unique(),
  raisonSociale: text("raison_sociale"),
  ice: text("ice"),
  contact: text("contact"),
  whatsapp: text("whatsapp"),
  /** Jours de livraison, 0 = dimanche ... 6 = samedi */
  joursLivraison: integer("jours_livraison").array().notNull().default([]),
  heureLimite: text("heure_limite"),
  delaiJours: integer("delai_jours").notNull().default(1),
  validationRequise: boolean("validation_requise").notNull().default(false),
  achatDirect: boolean("achat_direct").notNull().default(false),
  statut: statutFicheEnum("statut").notNull().default("actif"),
  creeParPosteId: integer("cree_par_poste_id"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const articleFournisseurs = pgTable(
  "article_fournisseurs",
  {
    id: serial("id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id),
    fournisseurId: integer("fournisseur_id")
      .notNull()
      .references(() => fournisseurs.id),
    reference: text("reference"),
    designation: text("designation"),
    uniteCommande: text("unite_commande").notNull(),
    qteParUniteCommande: numeric("qte_par_unite_commande", { precision: 12, scale: 4 })
      .notNull()
      .default("1"),
    actif: boolean("actif").notNull().default(true),
  },
  (t) => [uniqueIndex("article_fournisseur_idx").on(t.articleId, t.fournisseurId)],
);

export const prix = pgTable(
  "prix",
  {
    id: serial("id").primaryKey(),
    articleFournisseurId: integer("article_fournisseur_id")
      .notNull()
      .references(() => articleFournisseurs.id),
    prixHt: numeric("prix_ht", { precision: 12, scale: 4 }).notNull(),
    tvaPct: numeric("tva_pct", { precision: 6, scale: 3 }).notNull().default("0"),
    date: date("date").notNull(),
    photoId: integer("photo_id"),
    saisiParPosteId: integer("saisi_par_poste_id"),
    saisiParPersonneId: integer("saisi_par_personne_id"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("prix_af_date_idx").on(t.articleFournisseurId, t.date)],
);

// ---------------------------------------------------------------------------
// Moteur
// ---------------------------------------------------------------------------

export const produitsVendus = pgTable("produits_vendus", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull().unique(),
  libellesCaisse: text("libelles_caisse").array().notNull().default([]),
  categorie: text("categorie"),
  actif: boolean("actif").notNull().default(true),
  ordre: integer("ordre").notNull().default(100),
});

export const coefficients = pgTable(
  "coefficients",
  {
    id: serial("id").primaryKey(),
    produitId: integer("produit_id")
      .notNull()
      .references(() => produitsVendus.id),
    typeJournee: typeJourneeEnum("type_journee").notNull(),
    valeurMesuree: numeric("valeur_mesuree", { precision: 12, scale: 4 }).notNull().default("0"),
    valeurPerso: numeric("valeur_perso", { precision: 12, scale: 4 }),
    fige: boolean("fige").notNull().default(false),
    periodeMesure: text("periode_mesure"),
    modifieLe: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("coef_produit_type_idx").on(t.produitId, t.typeJournee)],
);

/** Proposition de coefficient en forte variation, soumise aux propriétaires. */
export const coefficientsProposes = pgTable("coefficients_proposes", {
  id: serial("id").primaryKey(),
  produitId: integer("produit_id")
    .notNull()
    .references(() => produitsVendus.id),
  typeJournee: typeJourneeEnum("type_journee").notNull(),
  ancienneValeur: numeric("ancienne_valeur", { precision: 12, scale: 4 }).notNull(),
  nouvelleValeur: numeric("nouvelle_valeur", { precision: 12, scale: 4 }).notNull(),
  periode: text("periode"),
  statut: text("statut").notNull().default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  decideLe: timestamp("decide_le", { withTimezone: true }),
  decideParPosteId: integer("decide_par_poste_id"),
});

export const nomenclature = pgTable(
  "nomenclature",
  {
    id: serial("id").primaryKey(),
    produitId: integer("produit_id")
      .notNull()
      .references(() => produitsVendus.id),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id),
    /** Quantité dans l'unité de comptage du composant. */
    quantite: numeric("quantite", { precision: 12, scale: 6 }).notNull(),
    aConfirmer: boolean("a_confirmer").notNull().default(false),
  },
  (t) => [uniqueIndex("nomenclature_produit_article_idx").on(t.produitId, t.articleId)],
);

/** Lignes de recette d'une préparation maison : ingrédient et quantité par batch. */
export const recetteLignes = pgTable(
  "recette_lignes",
  {
    id: serial("id").primaryKey(),
    preparationId: integer("preparation_id")
      .notNull()
      .references(() => articles.id),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => articles.id),
    quantiteParBatch: numeric("quantite_par_batch", { precision: 12, scale: 6 }).notNull(),
  },
  (t) => [uniqueIndex("recette_prep_ingredient_idx").on(t.preparationId, t.ingredientId)],
);

export const previsionsCa = pgTable("previsions_ca", {
  date: date("date").primaryKey(),
  montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
  origine: origineCaEnum("origine").notNull(),
  saisiParPosteId: integer("saisi_par_poste_id"),
  saisiParPersonneId: integer("saisi_par_personne_id"),
  modifieLe: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow(),
});

export const cloturesJournee = pgTable("clotures_journee", {
  date: date("date").primaryKey(),
  caRealise: numeric("ca_realise", { precision: 12, scale: 2 }).notNull(),
  caMidi: numeric("ca_midi", { precision: 12, scale: 2 }),
  caSoir: numeric("ca_soir", { precision: 12, scale: 2 }),
  couverts: integer("couverts"),
  especes: numeric("especes", { precision: 12, scale: 2 }),
  carte: numeric("carte", { precision: 12, scale: 2 }),
  manquant: numeric("manquant", { precision: 12, scale: 2 }),
  faitMarquant: text("fait_marquant"),
  source: sourceClotureEnum("source").notNull().default("saisie"),
  rapport: text("rapport"),
  posteId: integer("poste_id"),
  personneId: integer("personne_id"),
  modifieLe: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow(),
});

export const importsVentes = pgTable("imports_ventes", {
  id: serial("id").primaryKey(),
  fichier: text("fichier").notNull(),
  format: text("format").notNull(),
  dateDebut: date("date_debut"),
  dateFin: date("date_fin"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  lignes: integer("lignes").notNull(),
  lignesIgnorees: integer("lignes_ignorees").notNull().default(0),
  posteId: integer("poste_id"),
  personneId: integer("personne_id"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const ventes = pgTable(
  "ventes",
  {
    id: serial("id").primaryKey(),
    importId: integer("import_id")
      .notNull()
      .references(() => importsVentes.id),
    date: date("date").notNull(),
    heure: text("heure"),
    ticket: text("ticket"),
    categorie: text("categorie"),
    libelle: text("libelle").notNull(),
    produitId: integer("produit_id").references(() => produitsVendus.id),
    quantite: numeric("quantite", { precision: 12, scale: 3 }).notNull(),
    montant: numeric("montant", { precision: 12, scale: 2 }).notNull(),
    typeVente: text("type_vente"),
  },
  (t) => [index("ventes_date_idx").on(t.date), index("ventes_produit_idx").on(t.produitId, t.date)],
);

/** Saisies du jour sur la fiche des préparations : reste de la veille, forçage. */
export const preparationsJour = pgTable(
  "preparations_jour",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id),
    resteVeille: numeric("reste_veille", { precision: 12, scale: 3 }),
    resteSaisiParPersonneId: integer("reste_saisi_par_personne_id"),
    resteSaisiLe: timestamp("reste_saisi_le", { withTimezone: true }),
    forcee: numeric("forcee", { precision: 12, scale: 3 }),
    motifForcage: text("motif_forcage"),
    forceParPersonneId: integer("force_par_personne_id"),
    forceLe: timestamp("force_le", { withTimezone: true }),
  },
  (t) => [uniqueIndex("preparations_jour_idx").on(t.date, t.articleId)],
);

// ---------------------------------------------------------------------------
// Stocks et achats
// ---------------------------------------------------------------------------

export const mouvementsStock = pgTable(
  "mouvements_stock",
  {
    id: serial("id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    nature: natureMouvementEnum("nature").notNull(),
    /** Quantité signée dans l'unité de comptage. Pour un comptage : écart appliqué. */
    quantite: numeric("quantite", { precision: 14, scale: 4 }).notNull(),
    /** Pour un comptage : le stock après recalage. */
    stockApres: numeric("stock_apres", { precision: 14, scale: 4 }),
    origineType: text("origine_type"),
    origineId: integer("origine_id"),
    posteId: integer("poste_id"),
    personneId: integer("personne_id"),
    note: text("note"),
  },
  (t) => [index("mouvements_article_at_idx").on(t.articleId, t.at)],
);

export const comptages = pgTable("comptages", {
  id: serial("id").primaryKey(),
  familleId: integer("famille_id")
    .notNull()
    .references(() => familles.id),
  date: date("date").notNull(),
  /** Comptage de fermeture limité aux produits critiques (coût matière). */
  fermeture: boolean("fermeture").notNull().default(false),
  posteId: integer("poste_id").notNull(),
  personneId: integer("personne_id").notNull(),
  statut: statutComptageEnum("statut").notNull().default("en_cours"),
  modeConsommation: text("mode_consommation"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  valideLe: timestamp("valide_le", { withTimezone: true }),
});

export const comptageLignes = pgTable(
  "comptage_lignes",
  {
    id: serial("id").primaryKey(),
    comptageId: integer("comptage_id")
      .notNull()
      .references(() => comptages.id),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id),
    quantiteComptee: numeric("quantite_comptee", { precision: 14, scale: 4 }),
    stockTheorique: numeric("stock_theorique", { precision: 14, scale: 4 }),
    ecart: numeric("ecart", { precision: 14, scale: 4 }),
    ecartPct: numeric("ecart_pct", { precision: 10, scale: 4 }),
    ecartValeur: numeric("ecart_valeur", { precision: 12, scale: 2 }),
    saisiLe: timestamp("saisi_le", { withTimezone: true }),
    personneId: integer("personne_id"),
  },
  (t) => [uniqueIndex("comptage_ligne_idx").on(t.comptageId, t.articleId)],
);

export const pertes = pgTable("pertes", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id),
  date: date("date").notNull(),
  quantite: numeric("quantite", { precision: 14, scale: 4 }).notNull(),
  motif: motifPerteEnum("motif").notNull(),
  commentaire: text("commentaire"),
  valeur: numeric("valeur", { precision: 12, scale: 2 }),
  posteId: integer("poste_id").notNull(),
  personneId: integer("personne_id").notNull(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});

export const commandes = pgTable("commandes", {
  id: serial("id").primaryKey(),
  fournisseurId: integer("fournisseur_id")
    .notNull()
    .references(() => fournisseurs.id),
  dateLivraison: date("date_livraison").notNull(),
  statut: statutCommandeEnum("statut").notNull().default("brouillon"),
  montantEstime: numeric("montant_estime", { precision: 12, scale: 2 }),
  soumiseLe: timestamp("soumise_le", { withTimezone: true }),
  valideeParPosteId: integer("validee_par_poste_id"),
  valideeParPersonneId: integer("validee_par_personne_id"),
  valideeLe: timestamp("validee_le", { withTimezone: true }),
  commentaireValidation: text("commentaire_validation"),
  envoyeeLe: timestamp("envoyee_le", { withTimezone: true }),
  envoyeeParPersonneId: integer("envoyee_par_personne_id"),
  message: text("message"),
  creeParPosteId: integer("cree_par_poste_id"),
  creeParPersonneId: integer("cree_par_personne_id"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  modifieLe: timestamp("modifie_le", { withTimezone: true }).notNull().defaultNow(),
});

export const commandeLignes = pgTable(
  "commande_lignes",
  {
    id: serial("id").primaryKey(),
    commandeId: integer("commande_id")
      .notNull()
      .references(() => commandes.id),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id),
    articleFournisseurId: integer("article_fournisseur_id").references(() => articleFournisseurs.id),
    /** Quantités en unité de commande (colis, sac...). */
    qteProposee: numeric("qte_proposee", { precision: 12, scale: 3 }).notNull(),
    qteCommandee: numeric("qte_commandee", { precision: 12, scale: 3 }).notNull(),
    /** Quantité en unité de comptage, pour le stock. */
    qteComptage: numeric("qte_comptage", { precision: 14, scale: 4 }).notNull(),
    qteRecue: numeric("qte_recue", { precision: 14, scale: 4 }).notNull().default("0"),
    prixEstime: numeric("prix_estime", { precision: 12, scale: 4 }),
    origine: origineLigneEnum("origine").notNull().default("moteur"),
    prioritaire: boolean("prioritaire").notNull().default(false),
    detail: text("detail"),
  },
  (t) => [index("commande_lignes_commande_idx").on(t.commandeId)],
);

export const receptions = pgTable("receptions", {
  id: serial("id").primaryKey(),
  fournisseurId: integer("fournisseur_id")
    .notNull()
    .references(() => fournisseurs.id),
  commandeId: integer("commande_id").references(() => commandes.id),
  date: date("date").notNull(),
  posteId: integer("poste_id").notNull(),
  personneId: integer("personne_id").notNull(),
  parSuppleant: boolean("par_suppleant").notNull().default(false),
  achatDirect: boolean("achat_direct").notNull().default(false),
  montantPaye: numeric("montant_paye", { precision: 12, scale: 2 }),
  statut: statutReceptionEnum("statut").notNull().default("brouillon"),
  temperature: numeric("temperature", { precision: 6, scale: 2 }),
  dlcOk: boolean("dlc_ok"),
  emballagesOk: boolean("emballages_ok"),
  aspectOk: boolean("aspect_ok"),
  decision: decisionReceptionEnum("decision"),
  reserve: text("reserve"),
  rectifieId: integer("rectifie_id"),
  motifRectification: text("motif_rectification"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  valideeLe: timestamp("validee_le", { withTimezone: true }),
});

export const receptionLignes = pgTable(
  "reception_lignes",
  {
    id: serial("id").primaryKey(),
    receptionId: integer("reception_id")
      .notNull()
      .references(() => receptions.id),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id),
    qteRecue: numeric("qte_recue", { precision: 14, scale: 4 }).notNull().default("0"),
    qteRefusee: numeric("qte_refusee", { precision: 14, scale: 4 }).notNull().default("0"),
    motifRefus: text("motif_refus"),
    qteCommandee: numeric("qte_commandee", { precision: 14, scale: 4 }),
    etat: etatLigneReceptionEnum("etat"),
    prixHt: numeric("prix_ht", { precision: 12, scale: 4 }),
    tvaPct: numeric("tva_pct", { precision: 6, scale: 3 }),
    saisiLe: timestamp("saisi_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reception_ligne_idx").on(t.receptionId, t.articleId)],
);

export const ruptures = pgTable("ruptures", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id),
  signaleeParPosteId: integer("signalee_par_poste_id").notNull(),
  signaleeParPersonneId: integer("signalee_par_personne_id").notNull(),
  signaleeLe: timestamp("signalee_le", { withTimezone: true }).notNull().defaultNow(),
  leveeLe: timestamp("levee_le", { withTimezone: true }),
  commentaire: text("commentaire"),
});

export const photos = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    objetType: text("objet_type").notNull(),
    objetId: integer("objet_id").notNull(),
    chemin: text("chemin").notNull(),
    mime: text("mime").notNull().default("image/jpeg"),
    taille: integer("taille").notNull().default(0),
    priseLe: timestamp("prise_le", { withTimezone: true }).notNull().defaultNow(),
    posteId: integer("poste_id"),
    personneId: integer("personne_id"),
    /** Conservation : date au-delà de laquelle le fichier peut être purgé. */
    conserverJusquau: date("conserver_jusquau"),
    supprimeeLe: timestamp("supprimee_le", { withTimezone: true }),
  },
  (t) => [index("photos_objet_idx").on(t.objetType, t.objetId)],
);

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------

export type ValeurAttendue = { label: string; min?: number | null; max?: number | null; unite?: string };
export type ValeurSaisie = { label: string; valeur: number | null; horsPlage?: boolean };

export const tacheModeles = pgTable("tache_modeles", {
  id: serial("id").primaryKey(),
  titre: text("titre").notNull(),
  consigne: text("consigne"),
  posteId: integer("poste_id")
    .notNull()
    .references(() => postes.id),
  recurrence: recurrenceEnum("recurrence").notNull().default("chaque_jour_ouvert"),
  /** Pour « jours_semaine » et « hebdomadaire » : 0 = dimanche ... 6 = samedi */
  joursSemaine: integer("jours_semaine").array().notNull().default([]),
  /** Pour « mensuelle » : jour du mois (1..28), sinon premier jour ouvert du mois. */
  jourDuMois: integer("jour_du_mois"),
  heureCibleSemaine: text("heure_cible_semaine").notNull().default("09:00"),
  heureCibleWeekend: text("heure_cible_weekend").notNull().default("10:00"),
  delaiRemonteeMin: integer("delai_remontee_min").notNull().default(30),
  points: text("points").array().notNull().default([]),
  preuve: preuveEnum("preuve").notNull().default("aucune"),
  photosMin: integer("photos_min").notNull().default(1),
  valeurs: jsonb("valeurs").$type<ValeurAttendue[]>().notNull().default([]),
  structurante: boolean("structurante").notNull().default(false),
  ecranLie: ecranLieEnum("ecran_lie"),
  /** Pour l'écran comptage : famille à compter. */
  familleId: integer("famille_id"),
  actif: boolean("actif").notNull().default(true),
  ordre: integer("ordre").notNull().default(100),
});

export const taches = pgTable(
  "taches",
  {
    id: serial("id").primaryKey(),
    modeleId: integer("modele_id").references(() => tacheModeles.id),
    posteId: integer("poste_id")
      .notNull()
      .references(() => postes.id),
    journee: date("journee").notNull(),
    echeance: timestamp("echeance", { withTimezone: true }).notNull(),
    delaiRemonteeMin: integer("delai_remontee_min").notNull().default(30),
    titre: text("titre").notNull(),
    consigne: text("consigne"),
    points: text("points").array().notNull().default([]),
    pointsCoches: boolean("points_coches").array().notNull().default([]),
    preuve: preuveEnum("preuve").notNull().default("aucune"),
    photosMin: integer("photos_min").notNull().default(1),
    valeurs: jsonb("valeurs").$type<ValeurAttendue[]>().notNull().default([]),
    valeursSaisies: jsonb("valeurs_saisies").$type<ValeurSaisie[]>().notNull().default([]),
    structurante: boolean("structurante").notNull().default(false),
    ecranLie: ecranLieEnum("ecran_lie"),
    familleId: integer("famille_id"),
    ponctuelle: boolean("ponctuelle").notNull().default(false),
    statut: statutTacheEnum("statut").notNull().default("a_faire"),
    creeParPosteId: integer("cree_par_poste_id"),
    creeParPersonneId: integer("cree_par_personne_id"),
    faiteParPersonneId: integer("faite_par_personne_id"),
    faiteLe: timestamp("faite_le", { withTimezone: true }),
    verifieeParPersonneId: integer("verifiee_par_personne_id"),
    verifieeLe: timestamp("verifiee_le", { withTimezone: true }),
    commentaireVerif: text("commentaire_verif"),
    motifBlocage: text("motif_blocage"),
    remonteeNiveau: integer("remontee_niveau").notNull().default(0),
    remonteeLe: timestamp("remontee_le", { withTimezone: true }),
    reporteeDe: integer("reportee_de"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("taches_poste_journee_idx").on(t.posteId, t.journee),
    uniqueIndex("taches_modele_journee_idx").on(t.modeleId, t.journee),
  ],
);

// ---------------------------------------------------------------------------
// Pilotage
// ---------------------------------------------------------------------------

export const alertes = pgTable(
  "alertes",
  {
    id: serial("id").primaryKey(),
    type: typeAlerteEnum("type").notNull(),
    niveau: niveauAlerteEnum("niveau").notNull(),
    titre: text("titre").notNull(),
    detail: text("detail"),
    objetType: text("objet_type"),
    objetId: integer("objet_id"),
    roles: text("roles").array().notNull().default([]),
    /** Alerte adressée à un poste précis (en plus des rôles). */
    posteId: integer("poste_id"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    traiteeParPosteId: integer("traitee_par_poste_id"),
    traiteeParPersonneId: integer("traitee_par_personne_id"),
    traiteeLe: timestamp("traitee_le", { withTimezone: true }),
    note: text("note"),
    /** Clé d'unicité fonctionnelle pour éviter les doublons. */
    cleUnique: text("cle_unique"),
  },
  (t) => [index("alertes_ouvertes_idx").on(t.traiteeLe, t.creeLe), uniqueIndex("alertes_cle_idx").on(t.cleUnique)],
);

export const journal = pgTable(
  "journal",
  {
    id: serial("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    posteId: integer("poste_id"),
    personneId: integer("personne_id"),
    entite: text("entite").notNull(),
    entiteId: integer("entite_id"),
    action: text("action").notNull(),
    avant: jsonb("avant"),
    apres: jsonb("apres"),
  },
  (t) => [index("journal_at_idx").on(t.at), index("journal_entite_idx").on(t.entite, t.entiteId)],
);

export const tachesJob = pgTable("taches_job", {
  cle: text("cle").primaryKey(),
  derniereExecution: timestamp("derniere_execution", { withTimezone: true }).notNull().defaultNow(),
});
