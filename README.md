# 🏗️ SitePilot — Application de gestion chantier

**SitePilot** combine la puissance de Finalcad (terrain), Asana (tâches) et Notion (organisation) dans une interface industrielle pensée pour les chefs de projet et conducteurs de travaux.

---

## 🚀 Mise en ligne en 15 minutes

👉 **Guide détaillé : voir `DEPLOY_NETLIFY.md`**

### Résumé rapide

### Étape 1 — Supabase (base de données)

1. Créer un compte sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet (noter le **Project URL** et la **anon key**)
3. Aller dans **SQL Editor** et exécuter dans l'ordre :
   - `supabase/migrations/001_schema.sql` ← tables + triggers
   - `supabase/migrations/002_rls.sql` ← sécurité
   - *(optionnel)* `supabase/migrations/003_seed.sql` ← données de démo

4. Dans Supabase → **Storage** → créer un bucket nommé `sitepilot-files` (Public: ✅)

### Étape 2 — Variables d'environnement

Copier `.env.example` → `.env.local` et remplir :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
```

### Étape 3 — Démarrer en local

```bash
npm install
npm run dev
# → http://localhost:3000
```

### Étape 4 — Déployer sur Netlify

```bash
# Option A : via GitHub (recommandé)
# 1. Pousser le code sur GitHub
# 2. app.netlify.com → Add new site → Import existing project
# 3. Ajouter les env vars (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY)
# 4. Deploy

# Option B : via CLI
npm install -g netlify-cli
netlify login
netlify init
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://xxx.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "votre_clé"
netlify deploy --build --prod
```

⚠️ Après déploiement : ajouter l'URL Netlify dans Supabase → Authentication → URL Configuration.

---

## 📁 Structure du projet

```
sitepilot/
├── app/
│   ├── auth/
│   │   ├── login/          ← Page connexion
│   │   └── register/       ← Page inscription
│   ├── dashboard/          ← Liste des projets
│   ├── project/[projectId]/
│   │   ├── layout.tsx      ← Charge toutes les données
│   │   ├── dashboard/      ← Vue synthèse projet
│   │   ├── plans/          ← Plans + localisation observations
│   │   ├── observations/   ← Observations terrain
│   │   ├── reserves/       ← Réserves chantier
│   │   ├── tasks/          ← Tâches Kanban
│   │   ├── documents/      ← GED projet
│   │   ├── intervenants/   ← Entreprises & acteurs
│   │   └── checklists/     ← Formulaires terrain
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── auth/               ← AuthForm, LogoutButton
│   ├── project/            ← ProjectShell (sidebar + nav)
│   └── views/              ← 8 vues de page
├── lib/supabase/           ← Clients browser + server
├── types/                  ← TypeScript + config constantes
├── supabase/migrations/    ← SQL schema + seed
├── public/                 ← Manifest PWA
├── middleware.ts            ← Protection des routes
└── vercel.json             ← Config déploiement
```

---

## 🗄️ Base de données

| Table | Description |
|-------|-------------|
| `profiles` | Utilisateurs (auto-créé à l'inscription) |
| `projects` | Projets chantier |
| `project_members` | Membres par projet |
| `intervenants` | Entreprises & acteurs |
| `plans` | Plans uploadés |
| `observations` | Observations terrain |
| `obs_photos` | Photos d'observations |
| `obs_comments` | Commentaires |
| `obs_history` | Historique traçable |
| `reserves` | Réserves chantier |
| `tasks` | Tâches assignées |
| `documents` | GED projet |
| `checklists` | Formulaires |
| `checklist_items` | Items de checklist |
| `notifications` | Notifications |

---

## ✨ Fonctionnalités

- ✅ Authentification Supabase (email/password)
- ✅ Multi-projets
- ✅ 8 modules : Dashboard, Plans, Observations, Réserves, Tâches, Documents, Intervenants, Checklists
- ✅ Localisation observations sur plan (clic → placement X/Y)
- ✅ Upload photos terrain (mobile-first, capture caméra)
- ✅ Upload documents (PDF, images)
- ✅ Workflow observations : Ouverte → En cours → Corrigée → Validée
- ✅ Réserves chantier avec priorité et entreprise assignée
- ✅ Tâches Kanban 3 colonnes
- ✅ Checklists interactives
- ✅ Historique complet de chaque observation
- ✅ Row Level Security (RLS) — données isolées par projet
- ✅ Progressive Web App (installable sur mobile)
- ✅ Design industriel (IBM Plex Mono + Barlow Condensed)

---

## 🔧 Développement

```bash
# Dev
npm run dev

# Build production
npm run build

# Lint
npm run lint
```

---

## 📱 Mobile

L'app est installable sur iOS et Android via "Ajouter à l'écran d'accueil".  
La prise de photo utilise `capture="environment"` pour ouvrir directement la caméra arrière.

---

## 🛡️ Sécurité

Toutes les tables sont protégées par Row Level Security (RLS) Supabase.  
Un utilisateur ne voit que les projets dont il est membre.  
Les fichiers dans le storage sont accessibles publiquement (liens signés à implémenter pour usage privé).

---

## 🩺 Dépannage — « l'application ne répond plus »

### Toutes les pages renvoient une erreur 500 (page de connexion comprise)

Cause quasi certaine : les variables Supabase sont absentes du déploiement.

Le middleware s'exécute sur **toutes** les requêtes. S'il ne peut pas créer de
client Supabase, l'application entière devient injoignable. Depuis le correctif,
ce cas n'entraîne plus d'erreur 500 : un écran **CONFIGURATION REQUISE** indique
précisément les variables manquantes.

Vérifier dans l'ordre :

1. Netlify → Site settings → Environment variables :
   `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont-elles présentes ?
2. **Relancer un déploiement.** Les variables `NEXT_PUBLIC_*` sont intégrées au
   bundle *au moment du build*. Les ajouter sans reconstruire ne change rien —
   c'est la cause d'échec la plus fréquente.
3. Supabase → le projet est-il en pause ? Un projet gratuit inactif est suspendu
   automatiquement et doit être réactivé depuis le tableau de bord.
4. La clé `anon` a-t-elle été régénérée ? Si oui, mettre à jour Netlify et redéployer.

### Une tâche créée n'apparaît pas dans le tableau

Corrigé. Le shell projet figeait les données au premier rendu : le serveur
rechargeait bien les données, mais l'interface ne les reflétait jamais.
Les erreurs Supabase (RLS, session expirée) sont désormais affichées à l'écran
au lieu d'être ignorées silencieusement.

### Je ne peux plus me connecter avec mes identifiants

Lancez d'abord le diagnostic de `supabase/recuperation_acces.sql` (section 1)
dans Supabase → SQL Editor. Il indique en une ligne laquelle de ces situations
s'applique.

La cause la plus fréquente est une **adresse e-mail jamais confirmée** :
Supabase refuse alors la connexion bien que le mot de passe soit correct.
La page de connexion affiche désormais ce motif précis et propose un bouton
« Renvoyer l'e-mail de confirmation ». (Auparavant, toute erreur de connexion
était présentée comme « Email ou mot de passe incorrect » — ce qui désignait à
tort les identifiants.)

Autre cas : la connexion réussit mais le tableau de bord est vide. Il ne s'agit
pas d'un problème de droits mais de rattachement — l'application ne montre que
les chantiers dont vous êtes propriétaire ou membre. Voir la section 4 du même
fichier.

> **À noter :** il n'existe pas de rôle « superadmin » dans cette application.
> La colonne `profiles.role` est renseignée mais n'est lue nulle part ; les
> droits réels découlent uniquement de l'appartenance au projet, via la
> politique RLS `is_project_member`.

### Empêcher la mise en veille

Un projet Supabase de l'offre gratuite est **suspendu après 7 jours sans
activité**, ce qui rend l'application inaccessible jusqu'à réactivation
manuelle depuis le tableau de bord Supabase.

Le workflow `.github/workflows/keepalive.yml` appelle chaque jour la route
`/api/health`, qui effectue une vraie requête vers la base. Le compteur
d'inactivité repart de zéro à chaque passage.

**Configuration — une seule fois :**

1. Repository → Settings → Secrets and variables → Actions → onglet **Variables**
2. *New repository variable* — Nom : `SITE_URL`, Valeur : l'URL publique du site
   (ex. `https://votre-site.netlify.app`, sans barre oblique finale)
3. Onglet Actions → « Maintien en éveil » → *Run workflow* pour vérifier tout de suite

Contrôle manuel à tout moment :

```bash
curl https://votre-site.netlify.app/api/health
# {"status":"ok","database":"reachable","latencyMs":42,...}
```

Si le workflow échoue, GitHub vous envoie une notification — c'est aussi une
alerte de panne.

**Limites à connaître :**

- GitHub désactive les workflows planifiés après **60 jours sans activité sur
  le dépôt**. Un e-mail prévient et un clic suffit à les réactiver.
- Les exécutions planifiées GitHub sont au mieux approximatives et peuvent être
  retardées de quelques dizaines de minutes aux heures de charge. Sans
  importance ici : la marge est de 7 jours.
- Ce dispositif empêche la mise en veille par inactivité. Il ne protège pas
  d'une suspension pour dépassement de quota ni d'un incident Supabase. La
  seule garantie contractuelle reste une offre payante.

### Vérifier avant de déployer

```bash
npm run build      # inclut la vérification des types
```

Le build échoue désormais en cas d'erreur de typage, au lieu de déployer du code cassé.

---

## 📞 Support

Ce projet a été généré avec Claude (Anthropic).  
Pour toute personnalisation : modifier `components/views/AllViews.tsx` pour les vues métier.
