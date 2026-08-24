# EASY BURGER — Brief de développement

**Destinataire : Claude Code**
**Projet : commande en ligne + fidélité Easy Burger (Casablanca)**
**Version : 1.0**

---

## 0. Comment utiliser ce document

Ce document est le cahier des charges complet. Il est découpé en phases (§13). Ne construis **pas** tout d'un coup.

Au démarrage : lis l'intégralité du document, puis produis un plan d'implémentation de la Phase 0 uniquement, et attends validation. À chaque phase terminée : récapitule ce qui est fait, ce qui reste, et attends validation avant la suivante.

Règle absolue : **aucune règle métier en dur dans le code.** Tout ce qui est un montant, un seuil, un ratio ou un délai vit dans la table `settings` et se modifie depuis le back-office.

---

## 1. Contexte réel — à ne pas surdimensionner

- **Un seul restaurant**, à Casablanca. L'architecture doit permettre d'en ajouter d'autres, mais on n'en construit pas la complexité maintenant.
- **Volume actuel : ~600 commandes Glovo par mois**, auxquelles s'ajoutent les ventes au comptoir. C'est un volume qui justifie de bien construire : ~7 200 commandes livrées par an, soit plusieurs milliers de clients à identifier.
- **Caisse en place : Lacaisse.ma** (iPad). Voir §11 pour la stratégie d'intégration — conçue pour fonctionner même sans API.
- Le budget est serré. Le projet est développé en interne. Chaque ligne de code non écrite est une victoire.
- **La livraison est déjà résolue** : Glovo assure les courses en sous-traitance à tarif réduit quand la commande vient de nos canaux. On n'a donc **aucun système de dispatch, de tracking coursier ou de gestion de flotte à construire.** Une commande livrée = une course commandée manuellement auprès de Glovo par le staff.
- **Pas d'application native.** PWA installable, distribuée par lien et QR code. Pas d'App Store, pas de Play Store, pas de push natives.

**Le but n°1 du projet** : basculer les clients qui commandent aujourd'hui sur la marketplace Glovo vers notre canal direct, et savoir enfin qui ils sont.

---

## 2. Objectifs produit, dans l'ordre

1. Permettre de commander directement (livraison ou à emporter) sans friction.
2. Identifier chaque client par son **numéro de téléphone**, quel que soit le canal.
3. Créditer des points automatiquement, en ligne comme au comptoir.
4. Donner une raison concrète de revenir.
5. Constituer une base clients exploitable (nom, téléphone, historique, préférences).

---

## 3. Stack imposée

| Couche | Choix | Raison |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript | PWA, SSR pour le SEO du menu |
| Style | Tailwind CSS + tokens custom | rapidité, cohérence |
| Backend / DB | Supabase (Postgres + Auth + Storage + RLS) | tout-en-un, coût quasi nul au démarrage |
| Auth | Supabase Auth — téléphone + OTP | le téléphone est la clé d'identité |
| Hébergement | Netlify | déjà maîtrisé |
| Paiement | couche d'abstraction + adaptateurs | voir §11 |
| Messagerie | abstraction `notify()` + adaptateur SMS puis WhatsApp | voir §12 |

**Contraintes techniques :**
- Toute logique de points est **côté serveur** (Postgres functions ou Supabase Edge Functions). Le client n'écrit jamais un solde.
- RLS activée sur toutes les tables. Un client ne lit que ses propres lignes.
- Manifest PWA + service worker : menu et images en cache, l'app doit s'ouvrir en moins d'une seconde en 4G.
- Mobile-first strict. Le desktop est un bonus.

---

## 4. Design system — identité Easy Burger

L'univers de marque existe et fait déjà le travail. **Ne le réinvente pas, applique-le.**

### 4.0 Logo — fichiers fournis

Cinq déclinaisons vectorielles sont livrées dans `/logo`, extraites du fichier de marque officiel, détourées et prêtes à l'emploi :

| Fichier | Usage |
|---|---|
| `easy-burger-noir.svg` | fond clair, usage par défaut |
| `easy-burger-blanc.svg` | fond noir ou photo sombre |
| `easy-burger-noir-orange.svg` | version signature : « easy » noir, « burger » orange |
| `easy-burger-orange.svg` | fond crème ou blanc, usage accent |
| `easy-burger-blanc-orange.svg` | fond noir ou photo |

Ce sont des SVG à tracés purs, sans texte, sans police à embarquer, sans fond. Ils se recolorent en changeant l'attribut `fill`. Le ratio est fixe (~3,13:1) — ne jamais déformer, ne jamais retypographier, ne jamais ajouter d'effet.

Zone de protection : une hauteur de « e » minuscule sur les quatre côtés. Taille minimale à l'écran : 88 px de large.

### 4.1 Couleurs

Valeurs relevées directement dans le fichier de marque :

```
--eb-orange     #FF421D   /* orange officiel Easy Burger — valeur exacte du logo */
--eb-black      #111111   /* fond des blocs forts, typographie */
--eb-white      #FFFFFF
--eb-cream      #F2EDE4   /* fond secondaire, rappel du packaging papier */
--eb-grey       #6B6B6B   /* texte secondaire uniquement */
--eb-grey-line  #E4E0D8   /* filets, séparateurs */
```

Règle : **une seule couleur d'accent**. L'orange signale l'action ou la récompense, jamais la décoration. Un écran a au maximum un aplat orange plein.

Attention au contraste : `#FF421D` sur blanc ne passe pas les seuils d'accessibilité pour du texte petit. L'orange sert de **fond** avec du texte blanc dessus, ou de couleur de titre en grande taille — jamais de texte courant sur fond clair.

### 4.2 Typographie

| Rôle | Police | Usage |
|---|---|---|
| Logo | SVG fourni | jamais retypographié |
| Display | **Anton** (Google Fonts) | titres en capitales, très serrés, `letter-spacing: -0.01em`. C'est la voix « TAKE IT EASY // TAKE IT SMASHY » |
| Texte | **Inter** | corps, formulaires, listes |
| Utilitaire | **Archivo** en capitales, 11-12px, `letter-spacing: 0.08em` | eyebrows, labels, statuts |

Échelle : 44 / 32 / 24 / 17 / 15 / 13 / 11.

Les prix sont en Inter **tabular-nums**, jamais en display.

### 4.3 Éléments signature de la marque

Trois motifs existent déjà dans le packaging. Ils constituent l'identité de l'interface :

1. **Le pavage « easy » miroité** — les mots répétés, alternés à l'endroit et retournés, comme le papier d'emballage. Utilisé en fond de la carte de fidélité, des écrans vides et de l'écran de chargement. C'est la signature visuelle de l'app.
2. **Le mot « burger » pivoté à 90°** collé au wordmark. Réutilisé comme micro-étiquette verticale en marge de section.
3. **Le sticker orange à coins arrondis** « take it easy / take it smashy ». Devient le composant des récompenses et des badges. Rien d'autre dans l'interface n'a ce rayon de bordure : il est réservé à ce qui a de la valeur.

Rayons : `0px` partout sauf boutons (`8px`) et sticker récompense (`14px`).

### 4.4 Ton de l'interface

Direct, minuscules pour la marque, capitales pour les titres. Verbes d'action précis : « commander », « payer », « utiliser ma récompense ». Jamais « soumettre », jamais d'excuse dans un message d'erreur — on dit ce qui s'est passé et ce qu'il faut faire.

### 4.5 Ce qu'il ne faut pas faire

Pas de dégradés. Pas d'ombres portées molles. Pas de coins arrondis génériques. Pas d'illustration. La photo de burger, en pleine largeur et en gros, fait tout le travail émotionnel — l'interface autour doit être silencieuse.

---

## 5. Le menu (à charger en seed, prix à vérifier avant mise en ligne)

**SMASH BURGERS** — cheeseburger 60 · double cheeseburger 75 · home made burger 80 · burger du mois 80
**SALAD & SIDES** — salade césar sauce maison 60 · frites maison 25 · frites de patates douces 30 · cheesy frites 30 · cheesy bacon frites 50
**DESSERTS** — beignets nutella/sucre/miel 40 · soft serve 45
**DRINKS** — soda 20 · milkshake 45

Le menu vit en base, jamais dans le code. Chaque produit : nom, description, prix (en centimes, entier), photo, catégorie, ordre d'affichage, disponible oui/non, options.

---

## 6. Le moteur de fidélité

### 6.1 Règle unique, compréhensible en une phrase

> **1 dirham dépensé = 1 point. 10 points = 1 dirham de récompense.**

C'est tout. Pas de niveaux, pas de multiplicateurs, pas de VIP en V1.

### 6.2 Boutique de récompenses (valeurs par défaut, éditables)

| Récompense | Points | Valeur menu |
|---|---|---|
| Sauce maison supplémentaire | 120 | ~12 MAD |
| Soda | 200 | 20 MAD |
| Frites maison | 250 | 25 MAD |
| Beignets nutella | 400 | 40 MAD |
| Milkshake ou soft serve | 450 | 45 MAD |
| Cheeseburger | 600 | 60 MAD |
| Double cheeseburger | 750 | 75 MAD |

Avec un panier moyen autour de 100 MAD, la première récompense tombe **à la deuxième visite**. C'est délibéré : un client qui touche sa première récompense tôt reste ; un client qui doit attendre douze visites décroche.

Coût réel pour le restaurant : ~10 % de la valeur menu, soit environ 3 % du chiffre d'affaires en coût matière — et seulement sur les points effectivement utilisés.

### 6.3 Règles complémentaires

- **Bienvenue** : frites maison offertes à la première commande ≥ 70 MAD. Une seule fois par numéro de téléphone.
- **Anniversaire** : un dessert offert, valable 7 jours autour de la date. La date de naissance n'est modifiable qu'une fois.
- **Expiration** : les points expirent 12 mois après leur acquisition. Consommation en FIFO.
- **Notification** : alerte 30 jours avant expiration d'un lot de points.

### 6.4 Comment les points sont crédités — les trois canaux

**a) Commande sur l'app** — automatique, au passage de la commande au statut `completed`. Rien à faire pour le client.

**b) Au comptoir** — le client donne son numéro. Le caissier ouvre l'écran staff, saisit le numéro + le montant du ticket + la référence du ticket, valide. Les points tombent et le client reçoit une confirmation par message. Si le numéro n'existe pas, le compte est créé à la volée avec le seul téléphone : le client complètera son profil plus tard. Le rapprochement avec la caisse est traité au §11.

**c) Commande Glovo marketplace** — chaque sac part avec un sticker : un QR + un code unique à usage unique. Le client scanne, entre son téléphone, récupère ses points. C'est notre machine à convertir les clients Glovo en clients Easy Burger. Les codes sont générés par lots depuis le back-office.

### 6.5 Anti-fraude

- Toute écriture de points passe par une fonction serveur. Jamais depuis le client.
- Chaque crédit au comptoir enregistre : caissier, horodatage, référence ticket. Table d'audit non modifiable.
- Plafond configurable de points crédités par caissier et par jour ; alerte au-delà.
- Une récompense utilisée génère un code à 6 chiffres valable 15 minutes, à usage unique, marqué consommé côté serveur.
- Un numéro de téléphone = un compte. La récompense de bienvenue est verrouillée sur le numéro, pas sur le compte.

---

## 7. Modèle de données

```sql
-- Identité
customers            id, phone (unique), first_name, last_name, email, birthdate,
                     points_balance, lifetime_spend, orders_count, last_order_at,
                     marketing_consent, created_at
addresses            id, customer_id, label, street, details, lat, lng, is_default

-- Catalogue
restaurants          id, name, address, phone, is_open, opening_hours (jsonb)
categories           id, name, sort_order, is_active
products             id, category_id, name, description, price_cents, image_url,
                     sort_order, is_available, is_featured
product_options       id, product_id, name, type (single|multi), is_required
product_option_values id, option_id, name, price_delta_cents, is_available

-- Commandes
orders               id, customer_id, restaurant_id, channel (app|counter|glovo),
                     mode (delivery|pickup), status, subtotal_cents, delivery_fee_cents,
                     discount_cents, total_cents, payment_method, payment_status,
                     address_id, note, placed_at, completed_at
order_items          id, order_id, product_id, name_snapshot, unit_price_cents, qty
order_item_options   id, order_item_id, option_value_id, name_snapshot, price_delta_cents

-- Fidélité
loyalty_transactions id, customer_id, order_id, type (earn|redeem|bonus|adjust|expire),
                     points, expires_at, source, created_by, note, created_at
rewards              id, title, description, image_url, points_cost, product_id,
                     min_order_cents, max_per_customer, valid_from, valid_to, is_active
reward_redemptions   id, customer_id, reward_id, order_id, code, status
                     (issued|used|expired), issued_at, used_at, expires_at
claim_codes          id, code (unique), batch, points, status, redeemed_by, redeemed_at

-- Système
staff_users          id, name, phone, role (cashier|manager|admin), is_active
audit_log            id, actor_id, action, entity, entity_id, payload (jsonb), created_at
settings             key (pk), value (jsonb), updated_at, updated_by
messages_log         id, customer_id, channel, template, status, sent_at
```

**Notes d'implémentation :**
- Tous les montants en **centimes, entiers**. Jamais de flottant sur de l'argent.
- `points_balance` est un cache entretenu par trigger, recalculable à tout moment depuis `loyalty_transactions`. Le ledger fait foi.
- `name_snapshot` et `unit_price_cents` sur les lignes de commande : une commande passée ne doit jamais changer parce qu'un prix a bougé.
- Un job quotidien passe les lots de points échus en `type = expire`.

### Clés attendues dans `settings`

`points_per_mad` · `redemption_rate` · `points_expiry_months` · `welcome_reward_enabled` · `welcome_min_order_cents` · `birthday_reward_product_id` · `delivery_fee_cents` · `free_delivery_threshold_cents` · `min_order_cents` · `opening_hours` · `is_accepting_orders` · `cashier_daily_points_cap`

---

## 8. Parcours client

```
Ouverture (menu visible immédiatement, sans compte)
  → Ajout au panier
  → Choix livraison / à emporter
  → Téléphone + OTP          ← seul moment où on demande une identification
  → Adresse (si livraison)
  → Récompense disponible ? proposée ici
  → Paiement (espèces ou carte)
  → Confirmation + points crédités affichés
```

Points de vigilance :
- Le menu est consultable sans compte. On ne demande le téléphone qu'au moment de valider.
- La session dure 1 an. Un client ne doit ressaisir un OTP qu'exceptionnellement — chaque SMS coûte de l'argent et chaque OTP perd des commandes.
- Prénom demandé **après** la première commande réussie, pas avant.
- « Commander à nouveau » en haut de l'accueil dès la deuxième visite, avec vérification du prix et de la disponibilité avant paiement.

---

## 9. Écrans

**Navigation : 3 onglets.** Menu · Fidélité · Compte. Pas plus.

**Accueil / Menu**
Bandeau : solde de points + progression vers la prochaine récompense atteignable. Bouton commander à nouveau si historique. Catégories en navigation collante, produits en grandes vignettes photo.

**Produit**
Photo pleine largeur, options, quantité, ajout au panier avec prix mis à jour en temps réel.

**Panier / Paiement**
Récapitulatif, mode, adresse, récompense applicable, moyen de paiement, total. Trois écrans maximum entre le panier et la commande passée.

**Fidélité**
Carte de fidélité en fond « easy » miroité, solde en très gros caractères display. Boutique de récompenses en grille photo, celles à portée en couleur, les autres en gris avec les points manquants. Historique des points. Date de la prochaine expiration.

**Utilisation d'une récompense au comptoir**
Écran plein orange, code à 6 chiffres en display, compte à rebours 15 minutes.

**Compte**
Profil, adresses, historique de commandes, préférences de messages, suppression du compte.

**Suivi de commande**
Volontairement simple : reçue → en préparation → prête / en livraison → livrée. Pas de carte, pas de position coursier — c'est Glovo qui livre.

---

## 10. Back-office

Accès par rôle, sur la même base de code, route `/admin`.

- **Commandes** — file du jour en temps réel, changement de statut, impression, annulation.
- **Clients** — recherche par téléphone, fiche 360 (commandes, dépense cumulée, points, dernière visite), ajustement manuel de points avec motif obligatoire.
- **Menu** — produits, prix, photos, disponibilité, rupture en un clic.
- **Fidélité** — boutique de récompenses, ratio de points, expiration, offre de bienvenue.
- **Codes Glovo** — génération de lots, suivi des scans.
- **Réglages** — horaires, seuils de livraison, ouverture/fermeture des commandes.
- **Tableau de bord** — commandes du jour, CA, panier moyen, part du canal direct, nouveaux clients identifiés, points émis vs utilisés.

**Écran caisse (`/staff`)** — interface minimale sur téléphone : saisie numéro + montant + référence ticket → points crédités. Et validation d'un code de récompense.

---

## 11. Intégration de la caisse (Lacaisse.ma)

La caisse en place est **Lacaisse.ma**, solution marocaine sur iPad. Elle intègre déjà des partenaires externes (channel managers, paiement QR Maroc Pay), donc les intégrations sont techniquement possibles chez eux — mais **aucune documentation d'API publique n'existe.** Il faut la demander directement.

### 11.1 Règle de conception

**Rien dans ce projet ne doit dépendre d'une API Lacaisse.** L'intégration, si elle arrive, est une optimisation qui supprime de la saisie manuelle. Elle n'est jamais un prérequis. Construis les trois niveaux ci-dessous dans cet ordre : chacun fonctionne seul.

### 11.2 Niveau 1 — Saisie caisse (à construire, aucune dépendance)

Le caissier ouvre `/staff` sur un téléphone ou dans un onglet de l'iPad, saisit numéro + montant + n° de ticket, valide. Deux gestes, cinq secondes. Ça marche dès le premier jour, quelle que soit la réponse de Lacaisse.

Contrainte opérationnelle réelle : le personnel oubliera de demander le numéro. Prévoir un rappel physique en caisse et un suivi du taux d'identification dans le tableau de bord (`commandes identifiées / commandes totales`), par caissier. Ce taux est l'indicateur de succès du programme.

### 11.3 Niveau 2 — Réclamation par ticket (filet de sécurité)

Pour le client qui a oublié de donner son numéro. Il saisit dans l'app : **numéro de ticket + montant + date**. Le crédit part en statut `pending`.

Chaque nuit, on importe l'export des ventes de Lacaisse (fichier CSV/Excel, déposé manuellement ou récupéré automatiquement selon ce que la caisse permet) dans une table `pos_tickets`. Un job rapproche les réclamations en attente : ticket trouvé + montant correspondant + non déjà réclamé → crédit confirmé. Sinon → rejet avec motif.

```sql
pos_tickets   id, ticket_ref (unique), amount_cents, ticket_date, source, imported_at
pos_claims    id, customer_id, ticket_ref, amount_cents, ticket_date,
              status (pending|matched|rejected), matched_ticket_id, created_at
```

Contrainte d'unicité sur `ticket_ref` : un ticket ne peut être réclamé qu'une seule fois. Fenêtre de réclamation configurable, 7 jours par défaut.

Ce mécanisme fonctionne **sans aucune API**, tant que Lacaisse permet d'exporter les ventes — ce que toute caisse fait.

### 11.4 Niveau 3 — Intégration directe (si Lacaisse le permet)

Trois questions précises à poser à leur équipe technique, dans l'ordre de valeur décroissante :

1. **Existe-t-il un webhook déclenché à la clôture d'un ticket ?** C'est l'idéal : les points tombent tout seuls, en temps réel, sans que le caissier ait à faire quoi que ce soit d'autre que saisir un numéro dans un champ « client ».
2. **Existe-t-il une API REST de lecture des ventes ?** Suffisant pour automatiser le niveau 2 et supprimer l'import manuel.
3. **Le pied de ticket est-il personnalisable, avec un QR code dynamique ou au minimum le numéro de ticket imprimé ?** C'est ce qui rend le niveau 2 utilisable par le client sans effort. Un QR imprimé sur chaque ticket qui ouvre directement l'écran de réclamation pré-rempli, c'est la meilleure expérience possible sans intégration profonde.

Demander aussi : la caisse gère-t-elle déjà une notion de **compte client** rattaché à un numéro de téléphone ? Si oui, le caissier saisit le numéro dans un champ qui existe déjà, et on récupère l'association dans l'export — c'est le meilleur rapport effort/résultat.

Si une API existe, encapsuler dans une interface `PosProvider` (`fetchTickets`, `onTicketClosed`) pour que le reste du code ignore l'existence de Lacaisse.

---

## 12. Paiement

Architecture obligatoire : une interface `PaymentProvider` avec les méthodes `createPayment`, `verifyPayment`, `refund`. Aucun nom de prestataire dans le code métier.

Adaptateurs, dans l'ordre de mise en œuvre :

1. **`CashProvider`** — paiement à la livraison ou au comptoir. À faire en premier : ce sera une part majoritaire des commandes au démarrage.
2. **`PayzoneProvider`** — activation rapide, sert de rampe de lancement.
3. **`CMIProvider`** — indispensable à terme pour les cartes marocaines et pour la crédibilité de la page de paiement. Le CMI propose l'enregistrement de carte pour les achats répétitifs chez un même marchand : c'est ce qui permettra le paiement en un tap. À demander explicitement lors de la souscription du contrat.

Règles :
- **On ne stocke jamais un numéro de carte.** On stocke un jeton renvoyé par le prestataire. Aucune donnée carte ne transite par notre base ni par nos logs.
- Le statut de paiement est confirmé par callback serveur, jamais par le retour navigateur du client.
- Toute commande a un état de paiement explicite et récupérable en cas d'interruption.

---

## 13. Messages clients

Abstraction `notify(customer, template, data)` avec un adaptateur unique au départ (SMS), remplaçable par WhatsApp Business plus tard sans toucher au code appelant.

Messages de la V1, uniquement transactionnels :
- OTP de connexion
- confirmation de commande
- commande prête / partie en livraison
- points crédités au comptoir
- récompense débloquée
- points expirant dans 30 jours

Le marketing viendra plus tard, et seulement vers les clients ayant donné leur accord. `marketing_consent` est stocké dès le départ, avec sa date.

**Conformité** : déclaration CNDP à effectuer avant la mise en production. Consentement transactionnel et consentement marketing séparés, désinscription en un clic, suppression de compte accessible depuis l'app.

---

## 14. Phases de développement

**Phase 0 — Fondations**
Projet Next.js + Supabase, tokens de design, layout PWA, manifest, polices, composants de base (bouton, sticker récompense, carte produit, motif « easy »). Livrable : une page de démonstration des composants.

**Phase 1 — Menu et commande**
Schéma catalogue + seed du menu réel, pages menu et produit, panier persistant, checkout en espèces, création de commande, écran de suivi, file de commandes admin. **À la fin de cette phase, on peut déjà prendre des commandes.**

**Phase 2 — Identité et points**
Auth téléphone + OTP, profil, adresses, ledger de points, crédit automatique sur commande, écran fidélité, historique.

**Phase 3 — Récompenses**
Boutique, utilisation en ligne et au comptoir, codes à 6 chiffres, offre de bienvenue, anniversaire, expiration.

**Phase 4 — Back-office complet**
Clients, menu, réglages, tableau de bord, journal d'audit.

**Phase 5 — Caisse et codes Glovo**
Écran staff, crédit au comptoir, génération et scan des codes de sac, import des tickets Lacaisse et rapprochement des réclamations (§11.2 et 11.3).

**Phase 6 — Paiement en ligne**
Payzone puis CMI, jetons de carte, gestion des échecs.

**Phase 7 — Messages**
Adaptateur SMS, puis WhatsApp, préférences client.

---

## 15. Ce qu'on ne construit pas

À écarter explicitement de cette version, malgré leur intérêt : application native, notifications push, statuts VIP, challenges, streaks, drops surprises, parrainage, segmentation avancée, groupes témoins, moteur prédictif, multi-restaurant, intégration POS.

Chacun de ces modules se justifiera quand la base clients identifiés dépassera quelques milliers de personnes. Le schéma de données ci-dessus les accueille sans refonte. **Les construire maintenant serait construire la piscine avant la maison.**

---

## 16. Décisions à trancher

- **Lacaisse.ma** : webhook de clôture de ticket ? API de lecture des ventes ? Pied de ticket personnalisable avec QR ? Champ client rattaché à un téléphone ? (§11.4)
- Fournisseur SMS retenu et coût unitaire vers le Maroc — cette donnée conditionne toute la stratégie d'OTP.
- Contrat CMI : le 3D Secure est-il exigé à chaque transaction, ou le paiement sur carte enregistrée est-il autorisé ? La réponse détermine s'il est possible de faire un paiement en un tap.
- Zones de livraison et grille tarifaire convenues avec Glovo pour les courses issues de nos canaux.
- Jeu de photos produit en haute définition : sans photos, l'interface perd l'essentiel de sa force. Le logo, lui, est fourni (§4.0).
- Le prix affiché en livraison directe est-il identique au prix en salle ?
