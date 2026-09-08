# Mise en ligne — Easy Burger

Compte 20 minutes. Deux comptes à créer, rien à installer.

**Tes clés ne passent jamais par une conversation.** Deux chemins possibles :

- **Par GitHub Actions** (§6) — tu déposes les clés dans les secrets du
  dépôt, et le déploiement se déclenche depuis l'onglet Actions. C'est le
  chemin à prendre si tu veux que quelqu'un d'autre puisse relancer le
  déploiement sans avoir accès à tes clés.
- **Par l'interface Netlify** (§2) — tu saisis les clés directement chez
  Netlify. Plus court si tu déploies toi-même, une fois.

Dans les deux cas, une chose reste irréductible : **créer le projet Supabase
et le site Netlify demande ton adresse e-mail.** Aucun mécanisme ne
contourne ça.

---

## 1. Supabase — la base

1. [supabase.com](https://supabase.com) → **New project**.
   Région : **Europe (Frankfurt)** ou **Paris**, les plus proches du Maroc.
   Note le mot de passe de la base, tu n'en auras pas besoin ensuite.

2. **SQL Editor** → coller **tout** le contenu de `supabase/bootstrap.sql` →
   *Run*. C'est l'ensemble des migrations en un seul fichier : 22 tables, le
   menu, les récompenses, les réglages.

3. **Project Settings → API** → noter :
   - `Project URL`
   - clé `anon public`
   - clé `service_role` ⚠️ **secrète**, jamais dans le navigateur

4. Créer ton compte superadmin :
   **Authentication → Users → Add user** (e-mail + mot de passe,
   « Auto Confirm User » coché). Copier l'UUID, puis dans **SQL Editor** :

   ```sql
   insert into public.staff_users (id, name, role)
   values ('<uuid-copié>', 'Mamoune', 'superadmin');
   ```

---

## 2. Netlify — l'application

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an
   existing project** → GitHub → dépôt `sitepilot`.

2. Branche à déployer : `claude/great-cray-xa52gx`.

3. **Base directory : `easy-burger`** ← sans ça, Netlify construit SitePilot.
   Le reste (build command, publish directory) est lu depuis `netlify.toml`.

4. **Environment variables** :

   | Variable | Valeur | Portée |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL | toutes |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé anon | toutes |
   | `SUPABASE_SERVICE_ROLE_KEY` | clé service_role | **Functions uniquement** |
   | `CRON_SECRET` | une longue chaîne au hasard | Functions uniquement |

5. **Deploy**. Puis dans Supabase → **Authentication → URL Configuration**,
   ajouter l'URL Netlify en *Site URL* et en *Redirect URL*.

---

## 3. Ce qui marche tout de suite

| | |
|---|---|
| Menu, panier, commande | ✅ |
| Paiement | espèces à la livraison ou au comptoir |
| Suivi de commande | ✅ |
| Back-office `/admin` | ✅ avec ton compte superadmin |
| Écran caisse `/staff` | ✅ crédit par ticket, validation de récompense |
| Codes de sac `/sac` | ✅ sans compte client |
| Tableau de bord, journal, réglages | ✅ |

## 4. Messages : SMS ou WhatsApp

Il y a **deux flux de messages distincts**, et ils ne passent pas par le même
endroit. C'est la chose à comprendre avant de choisir un fournisseur.

### a) L'OTP de connexion — passe par Supabase Auth

C'est le code à 6 chiffres qui identifie le client. Il est envoyé par
Supabase, pas par notre code : on ne choisit donc pas librement le canal.

**Sans fournisseur configuré, personne ne peut se connecter côté client** —
donc pas d'écran Fidélité, pas de compte, pas d'échange de récompense en
ligne.

Ça n'empêche rien du reste : on commande en invité, les points se créditent
quand même sur le numéro, et le comptoir fonctionne entièrement. Les points
attendent simplement leur propriétaire.

Pour l'activer : **Supabase → Authentication → Providers → Phone**, brancher
Twilio, MessageBird ou Vonage.

Sur WhatsApp pour l'OTP : Supabase accepte **Twilio Verify** comme
fournisseur, et Twilio Verify sait envoyer par WhatsApp. Le chemin existe
donc probablement, mais je ne l'ai pas vérifié en conditions réelles — à
tester avant de compter dessus. Le SMS, lui, est le chemin balisé.

### b) Les messages transactionnels — passent par notre code

Confirmation de commande, commande prête, points crédités, code de
récompense, alerte d'expiration. Ceux-là sont à nous, et le canal est
librement choisi par les variables d'environnement :

| Renseigné | Canal utilisé |
|---|---|
| `WHATSAPP_*` | WhatsApp Business |
| `SMS_*` seulement | SMS |
| ni l'un ni l'autre | journalisé, rien n'est envoyé |

WhatsApp est préféré quand il est disponible : moins cher au Maroc, et le
client retrouve ses messages dans un fil plutôt que noyés dans ses SMS.

**Mais WhatsApp n'est pas un SMS avec un autre transport.** Un message
envoyé à l'initiative du commerce, hors de la fenêtre de 24 h ouverte par le
client, doit utiliser un **gabarit approuvé par Meta** — pas de texte libre.
Il faut donc, dans l'ordre :

1. un compte Meta Business **vérifié** ;
2. un numéro **dédié** à WhatsApp — il ne pourra plus servir au SMS ;
3. créer les huit gabarits listés dans `lib/notify/templates.ts`
   (`TEMPLATE_NAMES`) dans WhatsApp Manager, catégorie « Utilitaire », et
   attendre leur validation — comptez quelques jours.

L'ordre des variables `{{1}}`, `{{2}}` de chaque gabarit doit correspondre à
celui déclaré dans `templates.ts` : c'est un contrat, le changer d'un côté
seulement envoie les bonnes valeurs aux mauvais endroits.

Tant que rien n'est configuré, les messages sont mis en file et journalisés :
la file se vide, le contenu reste vérifiable, et rien ne se perd.

## 5. Le job quotidien

Une fois par jour, un `POST` sur `https://<ton-site>/api/jobs` avec
l'en-tête `Authorization: Bearer <CRON_SECRET>`.

Il fait : expiration des codes de récompense (les points reviennent au
client), expiration des points, cadeaux d'anniversaire, rapprochement des
tickets réclamés, alertes à 30 jours, envoi de la file de messages.

Le plus simple : [cron-job.org](https://cron-job.org), gratuit. Rien ne casse
si un jour saute — chaque tâche est idempotente et rattrape le retard.

---

## Avant d'ouvrir aux vrais clients

- [ ] Vérifier les prix du menu (ils viennent du brief, pas de la caisse)
- [ ] Déclaration CNDP
- [ ] Photos manquantes : soft serve, cheesy frites, burger du mois, beignets,
      soda — ils s'affichent en texte en attendant, ce qui est propre mais
      moins vendeur
- [ ] Fournisseur SMS, et son coût unitaire vers le Maroc


---

## 6. Déployer depuis GitHub Actions

Trois workflows sont en place dans `.github/workflows/`. Les clés vivent
dans **Settings → Secrets and variables → Actions** du dépôt : elles ne
transitent par aucune conversation, ne sont pas dans le code, et GitHub les
masque dans les logs.

### Secrets à créer

| Secret | Où le trouver | Utilisé par |
|---|---|---|
| `SUPABASE_DB_URL` | Supabase → Settings → Database → Connection string (URI) | Amorçage |
| `NETLIFY_AUTH_TOKEN` | Netlify → User settings → Applications → New access token | Déploiement |
| `NETLIFY_SITE_ID` | Netlify → Site configuration → Site ID | Déploiement |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Déploiement |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Déploiement |

La clé `service_role` et `CRON_SECRET` ne se mettent **pas** dans GitHub :
elles se saisissent côté Netlify, en portée « Functions », pour ne jamais
approcher d'un build front.

### Les trois workflows

| Workflow | Déclenchement | Ce qu'il fait |
|---|---|---|
| **CI** | à chaque poussée | typage, lint, build, 146 contrôles SQL |
| **Amorcer la base** | manuel, taper `AMORCER` | joue `bootstrap.sql` sur Supabase |
| **Déploiement** | manuel | construit et publie sur Netlify |

L'amorçage refuse de tourner si la table `customers` existe déjà :
`bootstrap.sql` crée les tables, il n'est pas rejouable, et mieux vaut un
refus net qu'une base à moitié faite.
