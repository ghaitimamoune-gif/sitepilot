# Easy Burger Ops

Outil de travail quotidien du restaurant Easy Burger (Casablanca) : achats, stocks, réceptions,
préparations et tâches. Application web installée sur l'écran d'accueil des téléphones, conçue
pour 360 pixels de large et une seule main. Français uniquement.

Ce dépôt implémente la **version 1** du brief de développement du 12 novembre 2026 (lots 0 à 4).
Le manuel de procédures dans l'application reste prévu en version 2.

| Document | Pour qui |
| --- | --- |
| [README.md](README.md) | Développeurs : installation, architecture, tests, choix d'implémentation |
| [DEPLOIEMENT.md](DEPLOIEMENT.md) | Mise en ligne (Vercel + Supabase), sauvegardes, environnements |
| [ADMINISTRATION.md](ADMINISTRATION.md) | Propriétaires : mise en service et réglages au quotidien |

---

## Ce que fait l'application

1. **Chaque matin, les quantités à préparer**, calculées depuis le chiffre d'affaires prévu
   (fiche consultable dès la veille au soir, restes de la veille, forçage motivé par la manager).
2. **Des comptages par famille**, au rythme de chaque famille, sans afficher le stock théorique ;
   écarts en quantité et en dirhams, alerte aux propriétaires sur les articles structurants.
3. **Des commandes préparées par fournisseur**, couvrant les jours de service jusqu'à la livraison
   suivante, validées si besoin, puis envoyées sur WhatsApp en un geste (message pré-rempli).
4. **Des réceptions comptées à l'aveugle**, avec photo du bon, contrôles qualité et mise à jour du stock.
5. **Une liste de tâches par poste**, preuves (points, photos, valeurs), vérification par le
   responsable, remontée par strates des tâches en retard ou bloquées.
6. **Pour les propriétaires** : alertes (ruptures, écarts, hausses de prix, températures, tâches
   structurantes…), la veille en quatre chiffres, coût matière, prévu contre réalisé, journal, exports.

## Démarrage en local

Prérequis : Node.js 22, PostgreSQL 14 ou plus.

```bash
cp .env.example .env
```

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Le chargement des données initiales affiche le **code d'enrôlement** des téléphones et les
**codes PIN de départ** (propriétaires `111111` à `444444`, manager `1000`, responsable achats
`2000`, responsable cuisine `3000`, responsable salle `4000`, postes employés `1001` à `1009`).
Ils sont à changer dès la mise en service.

Ouvrir http://localhost:3000, saisir le code d'enrôlement, puis un code PIN et un prénom.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `build` / `start` | Développement, construction, serveur de production |
| `npm run typecheck` | Contrôle des types TypeScript |
| `npm test` | Tests du moteur, des règles et d'intégration (PostgreSQL requis pour ces derniers) |
| `npm run test:e2e` | Parcours dans un navigateur à 360 px (serveur lancé, base fraîchement chargée) |
| `npm run db:migrate` | Applique les migrations SQL du dossier `drizzle/` |
| `npm run db:seed` | Charge les données initiales (sections 14 et 15) ; rejouable sans doublon |
| `npm run db:reset` | Vide le schéma (refusé en production) |
| `npm run cron:tick` | Exécute une fois le planificateur interne |
| `npm run sauvegarde` / `restauration:test` | Sauvegarde `pg_dump` et test de restauration |
| `npm run icons` | Régénère les icônes de l'application |

## Architecture

- **Next.js 15 (App Router) et TypeScript**, rendu côté serveur, actions serveur pour les écritures.
- **PostgreSQL** avec **Drizzle ORM** (`lib/db/schema.ts`, migrations dans `drizzle/`).
- **Authentification spécifique** : enrôlement de l'appareil (cookie httpOnly d'un an), puis code
  PIN qui désigne le poste, puis prénom. Session par cookie httpOnly, fermée après 12 h d'inactivité.
- **Photos** : compressées sur le téléphone (1 600 px, JPEG), envoyées avec reprise, stockées dans un
  bucket privé Supabase ou sur disque, servies uniquement par `/api/photos/[id]` après contrôle de session.
- **Planificateur interne** (`lib/services/jobs.ts`) : génération des tâches du jour, remontées,
  fin de journée d'exploitation (4 h), livraisons non réceptionnées, recalcul hebdomadaire des
  coefficients, purge des photos. Exécuté à chaque chargement de page (une fois par minute au plus)
  et par `/api/cron/tick`.

```
app/(app)/…            écrans connectés (une page par module)
app/actions/…          actions serveur : chaque action vérifie le droit côté serveur
app/api/…              photos, exports CSV, planificateur
components/…           composants d'écran (saisie ligne à ligne, photos, WhatsApp…)
lib/engine/…           moteur de calcul pur (préparations, stocks cibles, commandes)
lib/services/…         règles métier sur la base (stock, comptages, commandes, réceptions, tâches…)
lib/import/…           lecture des fichiers de lacaisse.ma
lib/auth/…             enrôlement, PIN, sessions, matrice des droits
lib/donnees-initiales/ données des sections 14 et 15, postes et tâches de départ
tests/…                tests du moteur, des règles, d'intégration et parcours navigateur
```

Deux principes du brief sont respectés partout :

- **Le stock se déduit d'un journal de mouvements** (`mouvements_stock` : comptage, réception,
  production, consommation, perte, correction). Rien ne se supprime : une correction crée une
  nouvelle écriture, et chaque action est journalisée (`journal`) avec poste, prénom, date et heure.
- **Tout ce que le métier appelle un paramètre vit en base** : marge, pertes, DLC, coefficients,
  recettes, seuils, calendrier, familles, modèles de tâches, modèle du message WhatsApp…

### Correspondance avec le brief

| Brief | Code |
| --- | --- |
| §3 Rôles, connexion, matrice des droits | `lib/auth/droits.ts`, `lib/auth/session.ts`, `middleware.ts` |
| §4 Calendrier, journée d'exploitation (4 h), Africa/Casablanca | `lib/dates.ts`, `lib/engine/calendrier.ts` |
| §5 Prévisionnel, estimation par médiane, CA réalisé | `lib/services/previsions.ts`, `app/(app)/previsionnel`, `app/(app)/cloture` |
| §6 Moteur de calcul (étapes 1 à 6), fiche des préparations | `lib/engine/moteur.ts`, `app/(app)/preparations` |
| §7 Stocks, comptages, stock théorique, ruptures, pertes | `lib/services/stock.ts`, `comptages.ts`, `ruptures.ts`, `pertes.ts`, `consommation.ts` |
| §8 Commandes, choix du fournisseur, WhatsApp, prix | `lib/engine/commandes.ts`, `lib/services/commandes.ts`, `catalogue.ts` |
| §9 Réceptions à l'aveugle, contrôles, rectificatives | `lib/services/receptions.ts`, `app/(app)/receptions` |
| §10 Tâches, preuves, vérification, remontée par strates | `lib/services/taches.ts`, `app/(app)/taches`, `app/(app)/equipe` |
| §11 Alertes, tableau de bord, coût matière, clôture et rapport | `lib/services/alertes.ts`, `cloture.ts`, `app/(app)/pilotage` |
| §13 Import des ventes de la caisse | `lib/import/caisse.ts`, `lib/import/classeur.ts`, `lib/services/imports.ts` |
| §14 Données initiales du moteur | `lib/donnees-initiales/moteur.ts` |
| §16 Jeux d'essai et critères d'acceptation | `tests/moteur.test.ts`, `tests/integration/*`, `tests/e2e/parcours.ts` |

## Tests et recette

- **Moteur contre le classeur** (`tests/moteur.test.ts`) : les jeux d'essai A et B de la section 16
  (préparations, avances, batchs, stocks cibles) sont rejoués à 0,5 % près. Tous passent.
- **Intégration sur PostgreSQL** (`tests/integration/`) : base dédiée (`easyburger_test`, ou
  `DATABASE_URL_TEST`), vidée à chaque exécution. Cycle complet comptage → commande → WhatsApp →
  réception, non livré, fournisseur créé sur le terrain, rupture, hausse de prix, pertes, tâches et
  remontées, températures, import du rapport du 24 au 30 octobre (131 671 DH et le CA de chaque
  journée), prévisionnel sans saisie, coût matière, moteur chargé depuis la base contre le jeu A.
  Ces tests sont ignorés si PostgreSQL n'est pas joignable.
- **Parcours navigateur** (`tests/e2e/parcours.ts`, Playwright, 360 × 780) : téléphone non enrôlé,
  verrouillage après cinq codes, « youssef » et « Youssef », réceptions interdites à la responsable
  achats même par adresse directe, forçage visible des propriétaires, photos de tâche, contrôle du
  défilement horizontal et des zones tactiles de 44 px.

### Critères d'acceptation de la section 16

| Critère | Vérifié par |
| --- | --- |
| Téléphone non enrôlé sans écran PIN ; 5 codes erronés bloquent 5 minutes | parcours navigateur |
| « youssef » = « Youssef » | tests unitaires et parcours navigateur |
| Responsable achats sans accès aux réceptions, même par adresse directe | parcours navigateur (pages et API photos) |
| Responsable cuisine ne modifie aucune quantité ; forçage de la manager visible des propriétaires | parcours navigateur |
| Viande du vendredi couvrant samedi et dimanche, jamais livrée un dimanche | tests unitaires et d'intégration |
| Réception : aucune quantité commandée avant validation, photo obligatoire | intégration et parcours |
| Article non saisi → « non livré » et retour dans les lignes à commander | intégration |
| Fournisseur créé en réception utilisable aussitôt, signalé « à vérifier » | intégration |
| WhatsApp pré-rempli ; « envoyée » seulement après confirmation | intégration |
| Tâche à photos : minimum exigé, plusieurs acceptées | intégration et parcours |
| Tâche créée par un responsable : visible aussitôt, ni modifiable ni annulable par le poste | intégration |
| Remontée au responsable cuisine ; structurante aussi aux propriétaires | intégration |
| Température hors plage : alerte immédiate à la manager | intégration |
| Rupture structurante : alerte et tâche « Appeler les propriétaires » | intégration |
| Hausse de prix de plus de 3 % : alerte avec ancien et nouveau prix | intégration |
| Comptage validé : recalage, écart en quantité et en dirhams, alerte au-dessus du seuil | intégration |
| Import du rapport du 24 au 30 octobre : 131 671 DH et le CA de chaque jour | intégration (fichier reconstitué) |
| Prévisionnel des 14 jours rempli sans saisie | intégration |
| Parcours à une main sur 360 px | parcours navigateur (aucun défilement horizontal, cibles ≥ 44 px) |

Le rapport réel de lacaisse.ma n'étant pas joint au brief, l'import est testé sur un fichier
reconstitué au même format et aux mêmes totaux. À refaire avec le vrai fichier à la mise en service.

## Choix d'implémentation à valider

Là où le brief laissait une latitude, voici ce qui a été retenu. Tout est réglable en base.

1. **Le code PIN désigne le poste** : un code erroné ne désigne aucun poste, le verrouillage après
   cinq erreurs s'applique donc à la saisie du PIN sur cet appareil, pendant 5 minutes.
2. **Stock théorique** : dernier comptage validé, plus les mouvements postérieurs seulement. Une
   consommation enregistrée en retard (clôture faite le lendemain) ne fausse pas un comptage déjà fait.
3. **Consommation des préparations maison** : la vente consomme le stock de la préparation
   (boulettes, sauces, pains), et la production du jour (quantité « à préparer » de la fiche) entre
   en stock et consomme les ingrédients. Sans cela, la viande paraîtrait consommée à la vente des
   burgers alors qu'elle l'est au pressage des boulettes, et l'avance de 30 % créerait chaque
   mercredi un faux écart d'environ 30 % sur un article structurant.
4. **Premier comptage d'un article** : c'est une initialisation, il ne déclenche pas d'alerte d'écart.
5. **Commandes** : un article jamais compté n'est pas proposé (stock inconnu) ; il est listé à part
   sur l'écran des commandes. Une rupture signalée est toujours proposée en priorité.
6. **Jours jusqu'à la prochaine livraison** (stock cible) : comptés en jours de service, à partir des
   jours de livraison réels des fournisseurs ; l'intervalle du classeur sert de valeur de repli.
7. **Coût matière** : le stock du matin vient du comptage du matin ; pour un article compté chaque
   semaine (cheddar, tenders), du dernier comptage, en pratique celui de fermeture de la veille.
   Le pain, fait sur place, entre par sa production de la fiche et sort à son coût de revient.
8. **Remontée des tâches** : une tâche ordinaire en retard ou bloquée remonte en tête de l'écran du
   supérieur (compteur sur l'onglet « Équipe ») ; seule une tâche structurante crée une alerte, aux
   propriétaires, comme le prévoit le tableau des alertes.
9. **Prix saisis en réception** : par unité de comptage (kg, tranche…), convertis en prix par unité
   de commande pour le catalogue. Prix stockés hors taxe avec leur taux.
10. **Contrôle de l'import** : le total doit égaler la feuille SYNTHESE au centime près.
11. **Comptage mensuel** : le premier mercredi du mois, avec le premier comptage hebdomadaire.

## Données à compléter avant la mise en service

- **Catalogue fournisseurs (section 15)** : la section n'est pas jointe au brief. Six fournisseurs de
  départ sont créés « à vérifier » (boucherie, primeur, grossiste, emballages, tenues, achat direct),
  avec des conditionnements plausibles mais non confirmés, sans numéro WhatsApp ni prix. À compléter
  dans Fournisseurs à partir des factures 2026.
- **Points à cocher des checklists** : le texte des fichiers 03.1 à 03.9 du manuel n'est pas joint ;
  les modèles de tâches contiennent des points provisoires à remplacer mot pour mot (Paramètres →
  Modèles de tâches).
- **Valeurs « à confirmer »** du brief (grammages, rendements, DLC des préparations) : reprises
  telles quelles et marquées « à confirmer » sur les fiches articles.
- **Recettes incomplètes** dans le brief : mayo truffe non formalisée, quantité de beurre et
  inclusions des cookies Double Trouble et Caramel non communiquées.
- **Emballages** : à ajouter à la nomenclature (une boîte par burger, une barquette par frites)
  une fois le catalogue validé, comme le prévoit le §14.2.
- **Cible du coût matière** : 30 % par défaut, à fixer par la direction (Paramètres).
- **Codes PIN et code d'enrôlement** : à changer dès la mise en service.

## Hors périmètre de la version 1 (rappel du brief)

Pilotage automatique de WhatsApp, notifications push, mode hors ligne complet (une coupure brève
est tolérée : chaque ligne est gardée sur le téléphone et renvoyée, et une page d'attente remplace
l'erreur du navigateur), autres langues, comptabilité, paiement des fournisseurs, paie.
