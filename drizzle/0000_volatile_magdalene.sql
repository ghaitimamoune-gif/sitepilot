CREATE TYPE "public"."decision_reception" AS ENUM('accepte', 'accepte_reserve', 'refuse');--> statement-breakpoint
CREATE TYPE "public"."ecran_lie" AS ENUM('comptage', 'reception', 'commandes', 'cloture', 'pertes');--> statement-breakpoint
CREATE TYPE "public"."etat_ligne_reception" AS ENUM('conforme', 'ecart', 'non_livre', 'en_plus');--> statement-breakpoint
CREATE TYPE "public"."motif_perte" AS ENUM('perime', 'rate', 'offert', 'refait', 'casse', 'chaine_du_froid');--> statement-breakpoint
CREATE TYPE "public"."nature_article" AS ENUM('matiere_premiere', 'preparation', 'emballage', 'consommable', 'tenue', 'materiel');--> statement-breakpoint
CREATE TYPE "public"."nature_mouvement" AS ENUM('comptage', 'reception', 'consommation', 'perte', 'correction');--> statement-breakpoint
CREATE TYPE "public"."niveau_alerte" AS ENUM('critique', 'avertissement', 'a_traiter', 'information');--> statement-breakpoint
CREATE TYPE "public"."origine_ca" AS ENUM('estime', 'saisi');--> statement-breakpoint
CREATE TYPE "public"."origine_ligne" AS ENUM('moteur', 'comptage', 'rupture', 'reception', 'manuel');--> statement-breakpoint
CREATE TYPE "public"."preuve" AS ENUM('aucune', 'photos', 'valeurs');--> statement-breakpoint
CREATE TYPE "public"."recurrence" AS ENUM('ponctuelle', 'chaque_jour_ouvert', 'jours_semaine', 'hebdomadaire', 'mensuelle');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('proprietaire', 'manager', 'resp_achats', 'resp_cuisine', 'resp_salle', 'employe');--> statement-breakpoint
CREATE TYPE "public"."rythme_comptage" AS ENUM('quotidien', 'hebdomadaire', 'mensuel');--> statement-breakpoint
CREATE TYPE "public"."source_cloture" AS ENUM('saisie', 'import');--> statement-breakpoint
CREATE TYPE "public"."statut_commande" AS ENUM('brouillon', 'en_attente_validation', 'refusee', 'prete', 'envoyee', 'recue_partiellement', 'recue', 'cloturee');--> statement-breakpoint
CREATE TYPE "public"."statut_comptage" AS ENUM('en_cours', 'valide');--> statement-breakpoint
CREATE TYPE "public"."statut_fiche" AS ENUM('actif', 'a_verifier', 'archive');--> statement-breakpoint
CREATE TYPE "public"."statut_reception" AS ENUM('brouillon', 'validee');--> statement-breakpoint
CREATE TYPE "public"."statut_tache" AS ENUM('a_faire', 'faite', 'verifiee', 'a_refaire', 'bloquee', 'en_retard', 'non_faite', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."type_alerte" AS ENUM('rupture', 'ecart_stock', 'temperature', 'tache_structurante', 'ecart_reception', 'livraison_non_receptionnee', 'hausse_prix', 'cout_matiere', 'commande_a_valider', 'fiche_a_verifier', 'coefficient_variation', 'quantite_forcee', 'tache_remontee', 'import_libelle_inconnu');--> statement-breakpoint
CREATE TYPE "public"."type_journee" AS ENUM('semaine', 'weekend');--> statement-breakpoint
CREATE TYPE "public"."zone" AS ENUM('direction', 'cuisine', 'salle');--> statement-breakpoint
CREATE TABLE "alertes" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "type_alerte" NOT NULL,
	"niveau" "niveau_alerte" NOT NULL,
	"titre" text NOT NULL,
	"detail" text,
	"objet_type" text,
	"objet_id" integer,
	"roles" text[] DEFAULT '{}' NOT NULL,
	"poste_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"traitee_par_poste_id" integer,
	"traitee_par_personne_id" integer,
	"traitee_le" timestamp with time zone,
	"note" text,
	"cle_unique" text
);
--> statement-breakpoint
CREATE TABLE "appareils" (
	"id" serial PRIMARY KEY NOT NULL,
	"jeton_hash" text NOT NULL,
	"libelle" text,
	"enrole_le" timestamp with time zone DEFAULT now() NOT NULL,
	"dernier_vu_le" timestamp with time zone DEFAULT now() NOT NULL,
	"revoque" boolean DEFAULT false NOT NULL,
	CONSTRAINT "appareils_jeton_hash_unique" UNIQUE("jeton_hash")
);
--> statement-breakpoint
CREATE TABLE "article_fournisseurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"fournisseur_id" integer NOT NULL,
	"reference" text,
	"designation" text,
	"unite_commande" text NOT NULL,
	"qte_par_unite_commande" numeric(12, 4) DEFAULT '1' NOT NULL,
	"actif" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"famille_id" integer,
	"famille_perte_id" integer,
	"nature" "nature_article" NOT NULL,
	"unite_comptage" text NOT NULL,
	"poids_unitaire" numeric(12, 6),
	"unite_poids" text,
	"structurant" boolean DEFAULT false NOT NULL,
	"dlc_jours" integer,
	"rendement_parage" numeric(6, 4),
	"lie_aux_ventes" boolean DEFAULT true NOT NULL,
	"stock_minimum" numeric(12, 3),
	"stock_cible_fixe" numeric(12, 3),
	"part_avance" numeric(6, 4),
	"rendement_batch" numeric(12, 4),
	"unite_batch" text,
	"cout_revient" numeric(12, 4),
	"critique_cout_matiere" boolean DEFAULT false NOT NULL,
	"statut" "statut_fiche" DEFAULT 'actif' NOT NULL,
	"a_confirmer" boolean DEFAULT false NOT NULL,
	"cree_par_poste_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendrier" (
	"date" date PRIMARY KEY NOT NULL,
	"ouvert" boolean NOT NULL,
	"type_journee" "type_journee" NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "clotures_journee" (
	"date" date PRIMARY KEY NOT NULL,
	"ca_realise" numeric(12, 2) NOT NULL,
	"ca_midi" numeric(12, 2),
	"ca_soir" numeric(12, 2),
	"couverts" integer,
	"especes" numeric(12, 2),
	"carte" numeric(12, 2),
	"manquant" numeric(12, 2),
	"fait_marquant" text,
	"source" "source_cloture" DEFAULT 'saisie' NOT NULL,
	"rapport" text,
	"poste_id" integer,
	"personne_id" integer,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coefficients" (
	"id" serial PRIMARY KEY NOT NULL,
	"produit_id" integer NOT NULL,
	"type_journee" "type_journee" NOT NULL,
	"valeur_mesuree" numeric(12, 4) DEFAULT '0' NOT NULL,
	"valeur_perso" numeric(12, 4),
	"fige" boolean DEFAULT false NOT NULL,
	"periode_mesure" text,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coefficients_proposes" (
	"id" serial PRIMARY KEY NOT NULL,
	"produit_id" integer NOT NULL,
	"type_journee" "type_journee" NOT NULL,
	"ancienne_valeur" numeric(12, 4) NOT NULL,
	"nouvelle_valeur" numeric(12, 4) NOT NULL,
	"periode" text,
	"statut" text DEFAULT 'en_attente' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"decide_le" timestamp with time zone,
	"decide_par_poste_id" integer
);
--> statement-breakpoint
CREATE TABLE "commande_lignes" (
	"id" serial PRIMARY KEY NOT NULL,
	"commande_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"article_fournisseur_id" integer,
	"qte_proposee" numeric(12, 3) NOT NULL,
	"qte_commandee" numeric(12, 3) NOT NULL,
	"qte_comptage" numeric(14, 4) NOT NULL,
	"qte_recue" numeric(14, 4) DEFAULT '0' NOT NULL,
	"prix_estime" numeric(12, 4),
	"origine" "origine_ligne" DEFAULT 'moteur' NOT NULL,
	"prioritaire" boolean DEFAULT false NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "commandes" (
	"id" serial PRIMARY KEY NOT NULL,
	"fournisseur_id" integer NOT NULL,
	"date_livraison" date NOT NULL,
	"statut" "statut_commande" DEFAULT 'brouillon' NOT NULL,
	"montant_estime" numeric(12, 2),
	"soumise_le" timestamp with time zone,
	"validee_par_poste_id" integer,
	"validee_par_personne_id" integer,
	"validee_le" timestamp with time zone,
	"commentaire_validation" text,
	"envoyee_le" timestamp with time zone,
	"envoyee_par_personne_id" integer,
	"message" text,
	"cree_par_poste_id" integer,
	"cree_par_personne_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comptage_lignes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comptage_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"quantite_comptee" numeric(14, 4),
	"stock_theorique" numeric(14, 4),
	"ecart" numeric(14, 4),
	"ecart_pct" numeric(10, 4),
	"ecart_valeur" numeric(12, 2),
	"saisi_le" timestamp with time zone,
	"personne_id" integer
);
--> statement-breakpoint
CREATE TABLE "comptages" (
	"id" serial PRIMARY KEY NOT NULL,
	"famille_id" integer NOT NULL,
	"date" date NOT NULL,
	"fermeture" boolean DEFAULT false NOT NULL,
	"poste_id" integer NOT NULL,
	"personne_id" integer NOT NULL,
	"statut" "statut_comptage" DEFAULT 'en_cours' NOT NULL,
	"mode_consommation" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"valide_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "familles" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"rythme" "rythme_comptage" NOT NULL,
	"role_compteur" "role" NOT NULL,
	"jours_securite" integer DEFAULT 1 NOT NULL,
	"ordre" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "familles_nom_unique" UNIQUE("nom")
);
--> statement-breakpoint
CREATE TABLE "familles_perte" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"perte_pct" numeric(6, 3) DEFAULT '0' NOT NULL,
	CONSTRAINT "familles_perte_nom_unique" UNIQUE("nom")
);
--> statement-breakpoint
CREATE TABLE "fournisseurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"raison_sociale" text,
	"ice" text,
	"contact" text,
	"whatsapp" text,
	"jours_livraison" integer[] DEFAULT '{}' NOT NULL,
	"heure_limite" text,
	"delai_jours" integer DEFAULT 1 NOT NULL,
	"validation_requise" boolean DEFAULT false NOT NULL,
	"achat_direct" boolean DEFAULT false NOT NULL,
	"statut" "statut_fiche" DEFAULT 'actif' NOT NULL,
	"cree_par_poste_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fournisseurs_nom_unique" UNIQUE("nom")
);
--> statement-breakpoint
CREATE TABLE "imports_ventes" (
	"id" serial PRIMARY KEY NOT NULL,
	"fichier" text NOT NULL,
	"format" text NOT NULL,
	"date_debut" date,
	"date_fin" date,
	"total" numeric(12, 2) NOT NULL,
	"lignes" integer NOT NULL,
	"lignes_ignorees" integer DEFAULT 0 NOT NULL,
	"poste_id" integer,
	"personne_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"poste_id" integer,
	"personne_id" integer,
	"entite" text NOT NULL,
	"entite_id" integer,
	"action" text NOT NULL,
	"avant" jsonb,
	"apres" jsonb
);
--> statement-breakpoint
CREATE TABLE "mouvements_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"nature" "nature_mouvement" NOT NULL,
	"quantite" numeric(14, 4) NOT NULL,
	"stock_apres" numeric(14, 4),
	"origine_type" text,
	"origine_id" integer,
	"poste_id" integer,
	"personne_id" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "nomenclature" (
	"id" serial PRIMARY KEY NOT NULL,
	"produit_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"quantite" numeric(12, 6) NOT NULL,
	"a_confirmer" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parametres" (
	"cle" text PRIMARY KEY NOT NULL,
	"valeur" text NOT NULL,
	"libelle" text,
	"modifie_par" text,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personnes" (
	"id" serial PRIMARY KEY NOT NULL,
	"poste_id" integer NOT NULL,
	"prenom" text NOT NULL,
	"prenom_norm" text NOT NULL,
	"archivee" boolean DEFAULT false NOT NULL,
	"fusionnee_dans" integer,
	"premiere_connexion" timestamp with time zone DEFAULT now() NOT NULL,
	"derniere_connexion" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pertes" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"date" date NOT NULL,
	"quantite" numeric(14, 4) NOT NULL,
	"motif" "motif_perte" NOT NULL,
	"commentaire" text,
	"valeur" numeric(12, 2),
	"poste_id" integer NOT NULL,
	"personne_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"objet_type" text NOT NULL,
	"objet_id" integer NOT NULL,
	"chemin" text NOT NULL,
	"mime" text DEFAULT 'image/jpeg' NOT NULL,
	"taille" integer DEFAULT 0 NOT NULL,
	"prise_le" timestamp with time zone DEFAULT now() NOT NULL,
	"poste_id" integer,
	"personne_id" integer,
	"conserver_jusquau" date,
	"supprimee_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "postes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"role" "role" NOT NULL,
	"zone" "zone" DEFAULT 'cuisine' NOT NULL,
	"pin_hash" text NOT NULL,
	"poste_superieur_id" integer,
	"voit_preparations" boolean DEFAULT false NOT NULL,
	"plan_nettoyage" boolean DEFAULT false NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"ordre" integer DEFAULT 100 NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preparations_jour" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"article_id" integer NOT NULL,
	"reste_veille" numeric(12, 3),
	"reste_saisi_par_personne_id" integer,
	"reste_saisi_le" timestamp with time zone,
	"forcee" numeric(12, 3),
	"motif_forcage" text,
	"force_par_personne_id" integer,
	"force_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "previsions_ca" (
	"date" date PRIMARY KEY NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"origine" "origine_ca" NOT NULL,
	"saisi_par_poste_id" integer,
	"saisi_par_personne_id" integer,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prix" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_fournisseur_id" integer NOT NULL,
	"prix_ht" numeric(12, 4) NOT NULL,
	"tva_pct" numeric(6, 3) DEFAULT '0' NOT NULL,
	"date" date NOT NULL,
	"photo_id" integer,
	"saisi_par_poste_id" integer,
	"saisi_par_personne_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produits_vendus" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"libelles_caisse" text[] DEFAULT '{}' NOT NULL,
	"categorie" text,
	"actif" boolean DEFAULT true NOT NULL,
	"ordre" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "produits_vendus_nom_unique" UNIQUE("nom")
);
--> statement-breakpoint
CREATE TABLE "reception_lignes" (
	"id" serial PRIMARY KEY NOT NULL,
	"reception_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"qte_recue" numeric(14, 4) DEFAULT '0' NOT NULL,
	"qte_refusee" numeric(14, 4) DEFAULT '0' NOT NULL,
	"motif_refus" text,
	"qte_commandee" numeric(14, 4),
	"etat" "etat_ligne_reception",
	"prix_ht" numeric(12, 4),
	"tva_pct" numeric(6, 3),
	"saisi_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"fournisseur_id" integer NOT NULL,
	"commande_id" integer,
	"date" date NOT NULL,
	"poste_id" integer NOT NULL,
	"personne_id" integer NOT NULL,
	"par_suppleant" boolean DEFAULT false NOT NULL,
	"achat_direct" boolean DEFAULT false NOT NULL,
	"montant_paye" numeric(12, 2),
	"statut" "statut_reception" DEFAULT 'brouillon' NOT NULL,
	"temperature" numeric(6, 2),
	"dlc_ok" boolean,
	"emballages_ok" boolean,
	"aspect_ok" boolean,
	"decision" "decision_reception",
	"reserve" text,
	"rectifie_id" integer,
	"motif_rectification" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"validee_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recette_lignes" (
	"id" serial PRIMARY KEY NOT NULL,
	"preparation_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	"quantite_par_batch" numeric(12, 6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ruptures" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"signalee_par_poste_id" integer NOT NULL,
	"signalee_par_personne_id" integer NOT NULL,
	"signalee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"levee_le" timestamp with time zone,
	"commentaire" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"jeton_hash" text NOT NULL,
	"poste_id" integer NOT NULL,
	"personne_id" integer NOT NULL,
	"appareil_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"derniere_activite" timestamp with time zone DEFAULT now() NOT NULL,
	"fermee_le" timestamp with time zone,
	CONSTRAINT "sessions_jeton_hash_unique" UNIQUE("jeton_hash")
);
--> statement-breakpoint
CREATE TABLE "tache_modeles" (
	"id" serial PRIMARY KEY NOT NULL,
	"titre" text NOT NULL,
	"consigne" text,
	"poste_id" integer NOT NULL,
	"recurrence" "recurrence" DEFAULT 'chaque_jour_ouvert' NOT NULL,
	"jours_semaine" integer[] DEFAULT '{}' NOT NULL,
	"jour_du_mois" integer,
	"heure_cible_semaine" text DEFAULT '09:00' NOT NULL,
	"heure_cible_weekend" text DEFAULT '10:00' NOT NULL,
	"delai_remontee_min" integer DEFAULT 30 NOT NULL,
	"points" text[] DEFAULT '{}' NOT NULL,
	"preuve" "preuve" DEFAULT 'aucune' NOT NULL,
	"photos_min" integer DEFAULT 1 NOT NULL,
	"valeurs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"structurante" boolean DEFAULT false NOT NULL,
	"ecran_lie" "ecran_lie",
	"famille_id" integer,
	"actif" boolean DEFAULT true NOT NULL,
	"ordre" integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taches" (
	"id" serial PRIMARY KEY NOT NULL,
	"modele_id" integer,
	"poste_id" integer NOT NULL,
	"journee" date NOT NULL,
	"echeance" timestamp with time zone NOT NULL,
	"delai_remontee_min" integer DEFAULT 30 NOT NULL,
	"titre" text NOT NULL,
	"consigne" text,
	"points" text[] DEFAULT '{}' NOT NULL,
	"points_coches" boolean[] DEFAULT '{}' NOT NULL,
	"preuve" "preuve" DEFAULT 'aucune' NOT NULL,
	"photos_min" integer DEFAULT 1 NOT NULL,
	"valeurs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"valeurs_saisies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"structurante" boolean DEFAULT false NOT NULL,
	"ecran_lie" "ecran_lie",
	"famille_id" integer,
	"ponctuelle" boolean DEFAULT false NOT NULL,
	"statut" "statut_tache" DEFAULT 'a_faire' NOT NULL,
	"cree_par_poste_id" integer,
	"cree_par_personne_id" integer,
	"faite_par_personne_id" integer,
	"faite_le" timestamp with time zone,
	"verifiee_par_personne_id" integer,
	"verifiee_le" timestamp with time zone,
	"commentaire_verif" text,
	"motif_blocage" text,
	"remontee_niveau" integer DEFAULT 0 NOT NULL,
	"remontee_le" timestamp with time zone,
	"reportee_de" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taches_job" (
	"cle" text PRIMARY KEY NOT NULL,
	"derniere_execution" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentatives_pin" (
	"id" serial PRIMARY KEY NOT NULL,
	"appareil_id" integer NOT NULL,
	"reussie" boolean NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ventes" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_id" integer NOT NULL,
	"date" date NOT NULL,
	"heure" text,
	"ticket" text,
	"categorie" text,
	"libelle" text NOT NULL,
	"produit_id" integer,
	"quantite" numeric(12, 3) NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"type_vente" text
);
--> statement-breakpoint
ALTER TABLE "article_fournisseurs" ADD CONSTRAINT "article_fournisseurs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_fournisseurs" ADD CONSTRAINT "article_fournisseurs_fournisseur_id_fournisseurs_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_famille_id_familles_id_fk" FOREIGN KEY ("famille_id") REFERENCES "public"."familles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_famille_perte_id_familles_perte_id_fk" FOREIGN KEY ("famille_perte_id") REFERENCES "public"."familles_perte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coefficients" ADD CONSTRAINT "coefficients_produit_id_produits_vendus_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits_vendus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coefficients_proposes" ADD CONSTRAINT "coefficients_proposes_produit_id_produits_vendus_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits_vendus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commande_lignes" ADD CONSTRAINT "commande_lignes_commande_id_commandes_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commande_lignes" ADD CONSTRAINT "commande_lignes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commande_lignes" ADD CONSTRAINT "commande_lignes_article_fournisseur_id_article_fournisseurs_id_fk" FOREIGN KEY ("article_fournisseur_id") REFERENCES "public"."article_fournisseurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_fournisseur_id_fournisseurs_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comptage_lignes" ADD CONSTRAINT "comptage_lignes_comptage_id_comptages_id_fk" FOREIGN KEY ("comptage_id") REFERENCES "public"."comptages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comptage_lignes" ADD CONSTRAINT "comptage_lignes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comptages" ADD CONSTRAINT "comptages_famille_id_familles_id_fk" FOREIGN KEY ("famille_id") REFERENCES "public"."familles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nomenclature" ADD CONSTRAINT "nomenclature_produit_id_produits_vendus_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits_vendus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nomenclature" ADD CONSTRAINT "nomenclature_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnes" ADD CONSTRAINT "personnes_poste_id_postes_id_fk" FOREIGN KEY ("poste_id") REFERENCES "public"."postes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pertes" ADD CONSTRAINT "pertes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparations_jour" ADD CONSTRAINT "preparations_jour_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prix" ADD CONSTRAINT "prix_article_fournisseur_id_article_fournisseurs_id_fk" FOREIGN KEY ("article_fournisseur_id") REFERENCES "public"."article_fournisseurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reception_lignes" ADD CONSTRAINT "reception_lignes_reception_id_receptions_id_fk" FOREIGN KEY ("reception_id") REFERENCES "public"."receptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reception_lignes" ADD CONSTRAINT "reception_lignes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptions" ADD CONSTRAINT "receptions_fournisseur_id_fournisseurs_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptions" ADD CONSTRAINT "receptions_commande_id_commandes_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recette_lignes" ADD CONSTRAINT "recette_lignes_preparation_id_articles_id_fk" FOREIGN KEY ("preparation_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recette_lignes" ADD CONSTRAINT "recette_lignes_ingredient_id_articles_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ruptures" ADD CONSTRAINT "ruptures_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_poste_id_postes_id_fk" FOREIGN KEY ("poste_id") REFERENCES "public"."postes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_personne_id_personnes_id_fk" FOREIGN KEY ("personne_id") REFERENCES "public"."personnes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_appareil_id_appareils_id_fk" FOREIGN KEY ("appareil_id") REFERENCES "public"."appareils"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tache_modeles" ADD CONSTRAINT "tache_modeles_poste_id_postes_id_fk" FOREIGN KEY ("poste_id") REFERENCES "public"."postes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taches" ADD CONSTRAINT "taches_modele_id_tache_modeles_id_fk" FOREIGN KEY ("modele_id") REFERENCES "public"."tache_modeles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taches" ADD CONSTRAINT "taches_poste_id_postes_id_fk" FOREIGN KEY ("poste_id") REFERENCES "public"."postes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentatives_pin" ADD CONSTRAINT "tentatives_pin_appareil_id_appareils_id_fk" FOREIGN KEY ("appareil_id") REFERENCES "public"."appareils"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventes" ADD CONSTRAINT "ventes_import_id_imports_ventes_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports_ventes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventes" ADD CONSTRAINT "ventes_produit_id_produits_vendus_id_fk" FOREIGN KEY ("produit_id") REFERENCES "public"."produits_vendus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alertes_ouvertes_idx" ON "alertes" USING btree ("traitee_le","cree_le");--> statement-breakpoint
CREATE UNIQUE INDEX "alertes_cle_idx" ON "alertes" USING btree ("cle_unique");--> statement-breakpoint
CREATE UNIQUE INDEX "article_fournisseur_idx" ON "article_fournisseurs" USING btree ("article_id","fournisseur_id");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_nom_idx" ON "articles" USING btree ("nom");--> statement-breakpoint
CREATE UNIQUE INDEX "coef_produit_type_idx" ON "coefficients" USING btree ("produit_id","type_journee");--> statement-breakpoint
CREATE INDEX "commande_lignes_commande_idx" ON "commande_lignes" USING btree ("commande_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comptage_ligne_idx" ON "comptage_lignes" USING btree ("comptage_id","article_id");--> statement-breakpoint
CREATE INDEX "journal_at_idx" ON "journal" USING btree ("at");--> statement-breakpoint
CREATE INDEX "journal_entite_idx" ON "journal" USING btree ("entite","entite_id");--> statement-breakpoint
CREATE INDEX "mouvements_article_at_idx" ON "mouvements_stock" USING btree ("article_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "nomenclature_produit_article_idx" ON "nomenclature" USING btree ("produit_id","article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personnes_poste_prenom_idx" ON "personnes" USING btree ("poste_id","prenom_norm");--> statement-breakpoint
CREATE INDEX "photos_objet_idx" ON "photos" USING btree ("objet_type","objet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preparations_jour_idx" ON "preparations_jour" USING btree ("date","article_id");--> statement-breakpoint
CREATE INDEX "prix_af_date_idx" ON "prix" USING btree ("article_fournisseur_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "reception_ligne_idx" ON "reception_lignes" USING btree ("reception_id","article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recette_prep_ingredient_idx" ON "recette_lignes" USING btree ("preparation_id","ingredient_id");--> statement-breakpoint
CREATE INDEX "taches_poste_journee_idx" ON "taches" USING btree ("poste_id","journee");--> statement-breakpoint
CREATE UNIQUE INDEX "taches_modele_journee_idx" ON "taches" USING btree ("modele_id","journee");--> statement-breakpoint
CREATE INDEX "tentatives_appareil_idx" ON "tentatives_pin" USING btree ("appareil_id","at");--> statement-breakpoint
CREATE INDEX "ventes_date_idx" ON "ventes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "ventes_produit_idx" ON "ventes" USING btree ("produit_id","date");