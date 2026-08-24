# 🍔 Easy Burger — commande en ligne + fidélité

Casablanca. Un restaurant. PWA installable, distribuée par lien et QR code.

**But n°1 du projet** : basculer les clients qui commandent aujourd'hui sur la
marketplace Glovo vers notre canal direct, et savoir enfin qui ils sont.

---

## État : Phase 0 — fondations ✅

| Phase | Contenu | État |
|---|---|---|
| **0** | Projet, tokens de design, PWA, composants de base | ✅ terminée |
| 1 | Menu, panier, commande en espèces, file admin | à venir |
| 2 | Auth téléphone + OTP, ledger de points | à venir |
| 3 | Boutique de récompenses, codes à 6 chiffres | à venir |
| 4 | Back-office complet | à venir |
| 5 | Écran caisse, codes Glovo, tickets Lacaisse | à venir |
| 6 | Paiement en ligne (Payzone puis CMI) | à venir |
| 7 | Messages (SMS puis WhatsApp) | à venir |

Le livrable de la Phase 0 est la page **`/design-system`** : elle affiche tous
les composants et renvoie, bloc par bloc, à la section du brief qui les définit.

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

## Trois règles qui tiennent tout le reste

**1. Aucune règle métier en dur.** Tout montant, seuil, ratio ou délai vit dans
la table `settings` et se modifie depuis le back-office. `SETTING_DEFAULTS` dans
`lib/settings.ts` n'est pas la règle : c'est le filet quand la base n'est pas
branchée. La table est créée par la toute première migration, avant le premier
calcul — sinon la règle ne tient pas.

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
