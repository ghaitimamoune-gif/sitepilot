# 🚀 Déploiement SitePilot sur Netlify

Guide complet pour mettre SitePilot en ligne sur Netlify.

**Architecture :**
- **Netlify** → héberge l'application Next.js (build automatique)
- **Supabase** → base de données + authentification + storage (gratuit, séparé)

---

## 📋 Prérequis

1. Un compte [Netlify](https://netlify.com) (gratuit)
2. Un compte [Supabase](https://supabase.com) (gratuit)
3. *(optionnel)* Un compte GitHub pour le déploiement automatique

---

## ⚙️ Étape 1 — Configurer Supabase

1. Créer le projet sur [supabase.com](https://supabase.com) → **New project**
2. Aller dans **SQL Editor** → exécuter dans l'ordre :
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls.sql`
3. Aller dans **Storage** → **New bucket** → nommer `sitepilot-files` → cocher **Public**
4. Aller dans **Settings → API** → noter :
   - **Project URL** (ex: `https://abcd.supabase.co`)
   - **anon public key**

---

## 🚀 Étape 2 — Déployer sur Netlify

### Méthode A — Glisser-déposer (la plus simple)

⚠️ **Important** : Netlify Drop ne fonctionne PAS directement avec le dossier source pour Next.js (il faut un build). Utilise plutôt la méthode B ou C ci-dessous. Si tu veux vraiment le drag & drop, il faut d'abord builder en local :

```bash
npm install
npm run build
```
Puis glisser le dossier complet du projet (pas seulement `.next`) sur [app.netlify.com/drop](https://app.netlify.com/drop). Le plugin Next.js sera détecté via `netlify.toml`.

### Méthode B — Via GitHub (recommandée — déploiement auto)

1. Pousse le code sur un repo GitHub :
   ```bash
   git init
   git add .
   git commit -m "SitePilot v1"
   git remote add origin https://github.com/TON_USER/sitepilot.git
   git push -u origin main
   ```
2. Sur [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**
3. Connecte GitHub → choisis ton repo `sitepilot`
4. Netlify détecte automatiquement Next.js (grâce à `netlify.toml`)
5. **Avant de déployer**, clique sur **Add environment variables** :
   - `NEXT_PUBLIC_SUPABASE_URL` = ton Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = ta anon key
6. Clique **Deploy site**

### Méthode C — Via Netlify CLI

```bash
npm install -g netlify-cli
netlify login

# Depuis le dossier sitepilot/
netlify init
# Suivre les instructions

# Ajouter les variables d'environnement
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://VOTRE_ID.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "VOTRE_ANON_KEY"

# Déployer
netlify deploy --build --prod
```

---

## ⚙️ Étape 3 — Autoriser l'URL dans Supabase

**IMPORTANT** : sinon la connexion échoue.

Une fois déployé, tu obtiens une URL type `https://sitepilot-xxx.netlify.app`.

Supabase → **Authentication → URL Configuration** :
- **Site URL** : `https://sitepilot-xxx.netlify.app`
- **Redirect URLs** : ajouter la même URL

---

## 👤 Étape 4 — Créer ton compte super admin

1. Ouvre ton URL Netlify → ajoute `/auth/register`
2. Inscris-toi avec ton email professionnel
3. Pour le rôle admin global : Supabase → **Table Editor → profiles** → ta ligne → change `role` en `admin`
4. Crée ton premier projet chantier → tu en es automatiquement owner/admin

---

## 👥 Étape 5 — Ajouter des collaborateurs

Tes collaborateurs s'inscrivent via `/auth/register`, puis tu les ajoutes au projet :

Supabase → **Table Editor → project_members** → **Insert row** :
- `project_id` : ID de ton projet (table `projects`)
- `user_id` : ID du collaborateur (table `profiles`)
- `role` : `conducteur`, `admin`, etc.

*(Pour une page d'invitation par email intégrée, c'est possible de l'ajouter — demande-le.)*

---

## 🔄 Mises à jour

Si tu as déployé via GitHub (méthode B), chaque `git push` redéploie automatiquement.

Sinon : `netlify deploy --build --prod`

---

## 🌍 Domaine personnalisé

Netlify → **Domain settings → Add custom domain** → `chantier.tonentreprise.com`
Puis configure les DNS comme indiqué.
N'oublie pas de mettre à jour les URLs autorisées dans Supabase Auth.

---

## 💰 Coûts

- **Netlify** : gratuit jusqu'à 100 Go bande passante + 300 min build/mois
- **Supabase** : gratuit jusqu'à 500 Mo DB + 1 Go storage + 50k utilisateurs actifs

Pour un usage chantier normal, tu restes **dans le free tier**.

---

## 🐛 Dépannage

| Problème | Solution |
|----------|----------|
| Build échoue | Vérifier que `npm run build` passe en local |
| Page blanche / erreur Supabase | Vérifier les env vars dans Netlify Site settings |
| 403 / erreur à la connexion | Ajouter l'URL Netlify dans Supabase → Auth → URL Configuration |
| Plugin Next.js non détecté | Vérifier que `netlify.toml` est à la racine |
| Variables non prises en compte | Re-déclencher un deploy après ajout des env vars |
