# Mise en ligne — Easy Burger

Compte 20 minutes. Deux comptes à créer, rien à installer.

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

## 4. Ce qui attend le fournisseur SMS

**La connexion client passe par un code SMS. Sans fournisseur, personne ne
peut se connecter côté client** — donc pas d'écran Fidélité, pas de compte,
pas d'échange de récompense en ligne.

Ça n'empêche rien du reste : on commande en invité, les points se créditent
quand même sur le numéro, et le comptoir fonctionne entièrement. Les points
attendent simplement leur propriétaire.

Pour l'activer plus tard : **Supabase → Authentication → Providers → Phone**,
brancher Twilio, MessageBird ou Vonage. Rien à changer dans le code.

Les messages transactionnels (confirmation, commande prête, points crédités)
sont déjà mis en file et journalisés ; ils partiront dès qu'une passerelle
sera renseignée dans les variables `SMS_*`.

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
