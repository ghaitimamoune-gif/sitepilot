# 🍔 Easy Burger — commande en ligne + fidélité

Casablanca. Un restaurant. PWA installable, distribuée par lien et QR code.

**But n°1 du projet** : basculer les clients qui commandent aujourd'hui sur la
marketplace Glovo vers notre canal direct, et savoir enfin qui ils sont.

---

## État : Phase 0 — fondations ✅

| Phase | Contenu | État |
|---|---|---|
| **0** | Projet, tokens de design, PWA, composants de base | ✅ terminée |
| **1** | Menu, panier, commande en espèces, file admin | ✅ terminée |
| **2** | Auth téléphone + OTP, fidélité, profil, adresses | ✅ terminée |
| 3 | Boutique de récompenses, codes à 6 chiffres | à venir |
| 4 | Back-office complet (menu, réglages, tableau de bord) | à venir |
| 5 | Codes Glovo, import et rapprochement des tickets Lacaisse | à venir |
| 6 | Paiement en ligne (Payzone puis CMI) | à venir |
| 7 | Messages (SMS puis WhatsApp) | à venir |

**À la fin de la Phase 1, on peut prendre des commandes.** Le parcours va du
menu au suivi, la file de commandes tourne, et les points tombent tout seuls.

Le client s'identifie par son téléphone, voit ses points et retrouve ses
adresses. Les rôles du personnel et le superadmin ont été avancés depuis la
Phase 4, sur demande : gérer les points d'un client à la main ne doit dépendre
d'aucune API de caisse.

Le livrable de la Phase 0 reste visible sur **`/design-system`**.

---

## Démarrer

```bash
npm install
npm run dev          # http://localhost:3000
```

La Phase 0 tourne **sans Supabase**. Aucune variable d'environnement n'est
nécessaire pour voir tourner le design system.

```bash
npm run build        # build de production
npm run typecheck    # tsc --noEmit
npm run lint
npm run icons        # régénère les icônes PWA depuis le logo
```

---

## Brancher Supabase

Nécessaire à partir de la **Phase 1** (le menu vient de la base).

1. Créer un projet sur [supabase.com](https://supabase.com) — région **Europe
   (Francfort ou Paris)**, la plus proche du Maroc.
2. **SQL Editor** → exécuter `supabase/migrations/000_settings.sql`.
3. **Project Settings → API** → copier `Project URL` et la clé `anon public`.
4. `cp .env.local.example .env.local` et remplir les deux valeurs.

Sans ces variables, `lib/supabase/*` renvoie `null` et `getSettings()` sert les
valeurs d'amorçage : rien ne casse, la base n'est simplement pas lue.

---

## Déployer sur Netlify

Le dépôt contient deux applications ; Easy Burger vit dans le sous-dossier
`easy-burger/`.

1. **Add new site → Import an existing project**, choisir le dépôt.
2. **Base directory** : `easy-burger` ← indispensable, sinon Netlify build SitePilot.
3. Build command et publish directory sont lus depuis `netlify.toml`.
4. **Environment variables** : ajouter `NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Phase 1 et suivantes).
5. Après déploiement, ajouter l'URL Netlify dans Supabase →
   **Authentication → URL Configuration**.

---

## Architecture

```
easy-burger/
├── app/
│   ├── layout.tsx            polices, métadonnées PWA, enregistrement du SW
│   ├── globals.css           tokens de marque (§4.1) + classes utilitaires
│   ├── page.tsx              page d'attente → devient le menu en Phase 1
│   └── design-system/        ← livrable de la Phase 0, non indexé
├── components/
│   ├── brand/                Logo · EasyPattern · BurgerTag
│   ├── ui/                   Button · RewardSticker · Price · Eyebrow · Field · Sheet
│   ├── product/              ProductCard
│   └── pwa/                  ServiceWorker
├── lib/
│   ├── money.ts              centimes entiers, formatage MAD
│   ├── settings.ts           lecture de la table `settings` + cache 60 s
│   ├── cn.ts                 clsx + tailwind-merge configuré pour nos tokens
│   └── supabase/             clients navigateur et serveur
├── public/
│   ├── logo/                 5 déclinaisons + wordmarks extraits
│   ├── pattern/              tuiles du pavage « easy » miroité
│   ├── photos/               photos produit et lifestyle
│   ├── icons/                icônes PWA générées depuis le logo
│   ├── manifest.json
│   └── sw.js                 service worker écrit à la main
├── supabase/migrations/
│   └── 000_settings.sql      la table `settings`, avant tout le reste
└── scripts/generate-icons.mjs
```

---

## Un ticket = un crédit, jamais deux

C'est une garantie de la **base de données**, pas du code applicatif :

```sql
create unique index loyalty_unique_source_ref
  on public.loyalty_transactions (source, source_ref)
  where source_ref is not null;
```

Que le crédit vienne d'une commande de l'app, d'un ticket de caisse saisi au
comptoir ou d'un code de sac Glovo, une seconde tentative sur la même
référence est rejetée par Postgres. Deux caissiers qui saisissent le même
ticket au même instant : le second reçoit une erreur, pas un doublon.

Les références sont normalisées avant contrôle (`A-1042`, `a 1042` et `A1042`
sont le même ticket), sinon l'unicité se contournerait avec un espace.

Les ajustements manuels ont `source_ref` nul et restent donc répétables :
c'est leur raison d'être.

## Le superadmin ne dépend d'aucun système externe

Quatre rôles hiérarchisés — `cashier`, `manager`, `admin`, `superadmin` — et
une fonction `adjust_points` réservée au superadmin : motif obligatoire, solde
négatif refusé, écriture dans un journal d'audit que personne ne peut modifier
depuis l'application.

Quoi qu'il arrive à la caisse, à Glovo ou au réseau, le patron reprend la main
sur le solde d'un client depuis `/admin/clients`.

Le premier superadmin se crée à la main, une seule fois : la procédure est en
commentaire à la fin de `supabase/migrations/001_staff.sql`. Il n'existe aucun
chemin applicatif pour le créer — ce serait une porte ouverte.

## Écrans

| Route | Qui | Quoi |
|---|---|---|
| `/` | tout le monde | menu, catégories collantes |
| `/p/[slug]` | tout le monde | produit, options, ajout au panier |
| `/panier` | tout le monde | panier persistant |
| `/commande` | tout le monde | mode, téléphone, adresse, paiement espèces |
| `/suivi/[token]` | porteur du lien | suivi en quatre états, prénom demandé après |
| `/connexion` | tout le monde | téléphone + code SMS |
| `/fidelite` | client connecté | solde, progression, récompenses, historique |
| `/compte` | client connecté | profil, adresses, commandes, suppression |
| `/admin` | caissier + | file du jour, changement de statut |
| `/admin/clients` | admin + | recherche par téléphone, fiche 360 |
| `/staff` | caissier + | crédit au comptoir par numéro de ticket |
| `/design-system` | — | référence visuelle, non indexée |

## L'identité tient au numéro, pas au compte

Le téléphone est la clé (§2). Une fiche client créée au comptoir, puis
retrouvée par le client quand il s'inscrit, reste **la même fiche** : ses
points le suivent. Un nouveau téléphone, un nouveau compte Auth, le même
numéro — la fiche bascule sur le compte qui vient de prouver le numéro.

Le numéro utilisé pour le rattachement vient du **jeton**, jamais du
navigateur : personne ne peut se rattacher à la fiche de quelqu'un d'autre.

La session dure un an. Chaque SMS coûte de l'argent et chaque OTP perd des
commandes : à régler dans le projet Supabase (Authentication → Sessions,
« JWT expiry » et durée du refresh token).

## Ce qu'un client authentifié peut écrire

RLS filtre les **lignes**, pas les **colonnes**. Une policy « le client
modifie sa propre fiche » laisse donc passer
`update customers set points_balance = 999999`. Tant qu'aucun client n'avait
de session, c'était inatteignable ; l'auth par OTP le rendait exploitable.

La migration `007_auth.sql` retire le droit d'update global et ne rend que
les champs de profil :

```sql
revoke update on public.customers from authenticated;
grant update (first_name, last_name, email, birthdate,
              marketing_consent, consent_at)
  on public.customers to authenticated;
```

Même logique, en défense en profondeur, sur le ledger et l'insertion de
commandes : les droits sont retirés, de sorte qu'une policy permissive
ajoutée par distraction plus tard ne rouvre rien.

## Trois règles qui tiennent tout le reste

**1. Aucune règle métier en dur.** Tout montant, seuil, ratio ou délai vit dans
la table `settings` et se modifie depuis le back-office. `SETTING_DEFAULTS` dans
`lib/settings.ts` n'est pas la règle : c'est le filet quand la base n'est pas
branchée. La table est créée par la toute première migration, avant le premier
calcul — sinon la règle ne tient pas.

**1 bis. Le client ne calcule aucun montant.** `place_order` est le seul
chemin d'écriture d'une commande. Le navigateur n'envoie que des identifiants
de produits, des identifiants d'options et des quantités ; chaque prix est relu
en base. Un panier trafiqué dans le stockage local ne change aucun total.

**2. L'argent est en centimes entiers.** Jamais un flottant, ni en base, ni en
mémoire. `lib/money.ts` est le seul endroit qui formate un montant, et
`<Price>` le seul composant qui l'affiche. Un prix est toujours en Inter
`tabular-nums`, jamais en display.

**3. Une seule couleur d'accent.** L'orange signale l'action ou la récompense,
jamais la décoration. `#FF421D` ne passe pas les seuils de contraste en petit
texte sur fond clair : il n'existe donc **aucune** variante « orange sur clair »
dans l'API de `<Button>` ni de `<Eyebrow>`. La règle est appliquée par le
typage, pas par la discipline.

Corollaire de design : le rayon `14px` est réservé au sticker de récompense.
Rien d'autre dans l'interface ne l'a. C'est ce qui lui donne sa force.

---

## Tests

```bash
./supabase/tests/run.sh   # migrations + 63 vérifications SQL sur un Postgres jetable
```

Vérifie ce qui ne doit jamais casser : le double crédit sous toutes ses formes,
le recalcul des prix, le plafond par caissier, le gel du rôle superadmin, le
compteur de commandes qui ne doit pas gonfler à chaque repassage en
« terminée », et ce qu'un client authentifié n'a pas le droit d'écrire.

Pour faire tourner l'app entière contre une vraie base, sans Docker ni projet
Supabase : voir `e2e/README.md`.

## Service worker

Écrit à la main, sans `next-pwa` (qui traîne systématiquement derrière Next).
Trois stratégies, choisies pour qu'un déploiement ne puisse jamais laisser un
client sur d'anciens prix :

| Ressource | Stratégie | Pourquoi |
|---|---|---|
| Documents HTML | network-first | menu et prix toujours frais dès qu'il y a du réseau |
| `/_next/static/*` | cache-first | URL hachées : un déploiement produit de nouvelles URL |
| Images, logo, motif | stale-while-revalidate | affichage instantané, mise à jour en arrière-plan |

`/admin`, `/staff`, `/api` et toute requête non-`GET` ne touchent jamais le cache.

---

## Photos produit

Treize photos sont en place dans `public/photos/`. Manquent encore, pour la
Phase 1 : **salade césar, milkshake, soft serve, cheesy frites (sans bacon),
burger du mois**. `<ProductCard imageUrl={null}>` affiche un placeholder
« photo à venir » au bon ratio : le passage aux vraies photos est un simple
remplacement de fichiers.
