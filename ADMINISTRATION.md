# Guide d'administration — propriétaires

Ce guide s'adresse aux quatre associés. Il décrit la mise en service, puis les réglages du
quotidien. Tout se fait depuis l'application, menu **Plus**.

---

## 1. Mise en service (une fois)

1. **Changer les codes PIN de départ.** Plus → Comptes et postes. Chaque propriétaire change son
   propre code (6 chiffres). Un propriétaire change ceux de l'encadrement (4 chiffres). Deux postes
   ne peuvent pas avoir le même code : c'est le code qui désigne le poste.
2. **Renouveler le code d'enrôlement** (même écran) et le donner à la manager. Ce code long permet
   d'enrôler un téléphone ; sans lui, l'écran du code PIN ne s'affiche pas.
3. **Compléter les fournisseurs** (Plus → Fournisseurs et articles). Les six fiches de départ sont
   « à vérifier » : renseigner le numéro WhatsApp au format international (+212…), les jours de
   livraison, l'heure limite de commande, et cocher « validation propriétaire requise » pour ceux qui
   doivent passer par vous (emballages et tenues par défaut). Pour chaque article fourni, vérifier le
   conditionnement (« carton de 400 tranches = 400 tranches ») : les quantités commandées sont
   arrondies à ce conditionnement.
4. **Saisir les prix d'achat** (Plus → Prix d'achat), hors taxe ou TTC avec le taux : l'application
   stocke le hors taxe. Les écarts de stock et le coût matière sont valorisés au dernier prix.
5. **Recopier les points des checklists** du manuel (fichiers 03.1 à 03.9) dans Plus → Modèles de
   tâches : les points de départ sont provisoires.
6. **Fixer la cible du coût matière** (Plus → Paramètres, « Cible du coût matière », 0,30 = 30 %).
7. **Enrôler les téléphones** de l'équipe : à la première ouverture, saisir le code d'enrôlement,
   puis installer l'application sur l'écran d'accueil (Android : menu ⋮ → « Ajouter à l'écran
   d'accueil » ; iPhone : Partager → « Sur l'écran d'accueil »).
8. **Faire un premier comptage complet** : tant qu'un article n'a jamais été compté, son stock est
   inconnu et il n'est pas proposé dans les commandes (il apparaît dans la liste « jamais compté »).

## 2. Comptes, postes et prénoms

- Un compte est attaché à un **poste**, pas à une personne. À la connexion, chacun tape son prénom ;
  ensuite l'application propose les prénoms déjà utilisés sur ce poste, en un appui.
- **Départ d'un employé** : la manager change le code PIN du poste (les sessions ouvertes sont fermées).
- **Doublon de prénom** (« Youssef » et « Yousef ») : la manager fusionne ou archive un prénom.
- Les propriétaires créent les comptes d'encadrement ; la manager crée et désactive les postes
  employés. Le **poste supérieur** d'un poste règle la remontée de ses tâches.
- **Téléphone perdu** : Comptes et postes → Appareils enrôlés → révoquer. Renouveler ensuite le
  code d'enrôlement.
- Cinq codes erronés bloquent la saisie du PIN 5 minutes sur ce téléphone ; chaque tentative est
  journalisée.

## 3. Prévisionnel de chiffre d'affaires

C'est la seule donnée d'entrée du moteur (Prévisionnel, dans la barre du bas).

- Sans saisie, chaque jour est **estimé** : médiane du CA réalisé des 4 derniers mêmes jours de la
  semaine (fériés et fermetures exclus), ou moyennes de départ (18 760 DH en semaine, 28 315 DH le
  week-end) tant que l'historique est trop court.
- Saisir la semaine à venir ; une valeur se corrige jusqu'au matin même. Une valeur **saisie** n'est
  jamais écrasée par l'estimation (« revenir à l'estimation » l'efface).
- Toute correction recalcule aussitôt les préparations et les commandes non envoyées ; si une
  commande est déjà partie, l'écran des commandes affiche le complément.
- En bas de page : prévu, réalisé et écart des 14 derniers jours (plus de 5 % mis en évidence).

## 4. Réglages du moteur

Plus → Paramètres, Produits et coefficients, Articles. Chaque modification est journalisée avec
l'ancienne et la nouvelle valeur.

- **Marge de sécurité générale** : 10 % depuis les ruptures de fin octobre. À faire redescendre vers
  0 % après plusieurs jours sans rupture.
- **Pertes par famille**, **DLC**, **rendements de parage**, **part d'avance** et **rendement des
  batchs** : sur la fiche de chaque article ou préparation.
- **Coefficients de vente** (unités vendues pour 1 000 DH) : mesurés, puis recalculés chaque semaine
  à partir des ventes importées. Une variation de plus de 20 % vous est soumise avant application.
  Pour un produit qui arrive à la carte (Truffle Parmesan Burger, Cheesy Overload), saisir un
  **coefficient personnalisé**. « Figer » empêche tout recalcul.
- **Nomenclature** : composants par unité vendue (Produits → ouvrir un produit). Ajouter les
  emballages (une boîte par burger, une barquette par frites) quand le catalogue est validé.
- **Articles structurants** (viande, cheddar, pommes de terre, emballages principaux) : alerte si
  l'écart de stock dépasse 3 % (10 % tant que la consommation est estimée depuis le CA), alerte si
  le prix monte de plus de 3 %, tâche « Appeler les propriétaires » en cas de rupture.
- **Articles sans lien avec les ventes** (entretien, tenues, petit matériel) : stock minimum et stock
  cible fixes ; sous le minimum, l'article est proposé à la commande.
- **Familles de comptage** : rythme (quotidien, hebdomadaire, mensuel), compteur, jours de sécurité.
- **Calendrier** : jours fériés (type « week-end » par défaut) et fermetures exceptionnelles.

## 5. Tâches

- Les tâches récurrentes se créent seules chaque jour ouvert à partir des **modèles** (Plus →
  Modèles de tâches) : poste, récurrence, heure cible (semaine et week-end), délai de remontée,
  points à cocher, preuve (photos ou valeurs avec plage cible), caractère structurant, écran lié.
- Une tâche en retard (heure cible + délai) ou bloquée remonte d'une strate : poste de cuisine →
  responsable cuisine ; poste de salle → responsable salle ; responsables → manager ; manager →
  propriétaires. Une tâche **structurante** non faite vous remonte aussi, avec une alerte.
- Une valeur hors plage (température d'un frigo) alerte immédiatement la manager.
- Vous pouvez ajouter une tâche ponctuelle pour n'importe quel poste (« + Tâche » sur le Pilotage).
- Plus → Activité par personne : tâches faites, en retard, renvoyées à refaire, par prénom ; export
  du relevé mensuel des températures (pièce demandée en cas de contrôle ONSSA).

## 6. Commandes, réceptions, prix

- La responsable achats ne calcule rien : l'application propose les lignes par fournisseur. Elle
  envoie sur WhatsApp ; la commande ne passe « envoyée » qu'après sa confirmation.
- **Commandes à valider** : sur le Pilotage. Vous voyez le montant estimé et les hausses de prix ;
  refuser demande un commentaire.
- Les réceptions sont comptées **à l'aveugle** par la manager (le responsable cuisine en suppléance),
  jamais par la responsable achats. Une réception validée ne se modifie plus : une erreur se corrige
  par une réception rectificative, avec un motif, qui vous est signalée.
- **Fiches à vérifier** : un fournisseur ou un article créé sur le terrain est utilisable aussitôt
  et vous est signalé. Complétez la fiche puis passez son statut à « Actif ».

## 7. Alertes

Pilotage → Alertes ouvertes, les critiques en tête. Une alerte passe à « traitée » quand l'un des
destinataires la clôt, avec une note facultative ; l'historique reste consultable.

## 8. Import des ventes de la caisse

Plus → Importer les ventes. Déposer le **rapport détaillé des ventes** (.xlsx) de lacaisse.ma.

- Le total doit égaler la feuille SYNTHESE, sinon l'import est refusé.
- Le CA de chaque journée vient alors du fichier (la saisie manuelle disparaît) et la consommation
  théorique devient exacte à l'article près.
- Un libellé inconnu de la caisse est bloqué et vous est signalé : le rattacher au bon produit sur
  le même écran (c'est ainsi qu'on repère une erreur de saisie en caisse).
- Le fichier « ventes par produit » (.csv) sert seulement à proposer des coefficients.

## 9. Exports et journal

- Plus → Exports : stocks, commandes, réceptions, prix, tâches, températures (CSV pour Excel).
- Plus → Journal complet : toutes les actions, avec poste, prénom, date et heure. Rien ne se supprime.
- Les sauvegardes de la base sont décrites dans DEPLOIEMENT.md.
