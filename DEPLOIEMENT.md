# Guide de déploiement

Pile recommandée par le brief : **Vercel** (application), **Supabase** (PostgreSQL managé et
stockage privé des photos), **GitHub** (dépôt), le tout sur des comptes appartenant à Easy Burger.
Deux environnements : **recette** et **production**, chacun avec sa propre base et son propre bucket.

Une autre pile convient si elle tient les mêmes exigences (voir « Serveur classique » à la fin).

---

## 1. Base de données et stockage (Supabase)

Pour chaque environnement (recette, puis production) :

1. Créer un projet Supabase (région la plus proche : Europe de l'Ouest).
2. **Connect → Connection string** : copier l'URI du *Transaction pooler* (port **6543**, hôte
   `aws-…pooler.supabase.com`). C'est la valeur de `DATABASE_URL`. Le *Session pooler* (port 5432)
   ne convient pas à Vercel : il limite à 15 connexions au total et chaque instance garde les
   siennes ouvertes (pages en erreur au bout de 30 s). En mode transaction, l'application ne lance
   jamais plus de requêtes simultanées que de connexions ouvertes (`DB_CONNEXIONS_MAX`, 10 par
   défaut) : le pooler ne gère pas les requêtes enchaînées sur une même connexion.
3. **Storage → New bucket** : nom `photos`, **Public : désactivé**. Les photos ne sont jamais
   publiques : l'application les sert elle-même après contrôle de la session.
4. **Settings → API** : copier l'URL du projet (`SUPABASE_URL`) et la clé `service_role`
   (`SUPABASE_SERVICE_ROLE_KEY`). Cette clé reste côté serveur, jamais dans le navigateur.

Neon convient aussi pour la base ; il faut alors un stockage objet pour les photos (Supabase Storage
seul, ou adapter `lib/services/photos.ts` à S3).

## 2. Variables d'environnement

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | URI PostgreSQL de l'environnement |
| `APP_SECRET` | 32 caractères aléatoires minimum (`openssl rand -hex 32`), différent par environnement |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé `service_role` (secret) |
| `SUPABASE_BUCKET` | `photos` |
| `CRON_SECRET` | Chaîne aléatoire ; Vercel l'envoie au planificateur |
| `TZ` | `Africa/Casablanca` |

`APP_SECRET` signe les cookies : le changer déconnecte tous les téléphones (ils devront être
enrôlés de nouveau).

## 3. Application (Vercel)

1. **Add New → Project**, importer le dépôt GitHub.
2. Framework : Next.js (détecté). **Build Command** :
   `npm run db:migrate && npm run build`
   Les migrations s'appliquent ainsi à chaque déploiement, avant la construction.
3. Renseigner les variables d'environnement (Production et Preview séparément : la recette
   utilise la base de recette).
4. Déployer, puis rattacher le domaine d'Easy Burger (**Settings → Domains**). HTTPS est automatique.
5. **Une seule fois par environnement**, charger les données initiales depuis un poste de travail :

```bash
DATABASE_URL="postgres://…" npm run db:seed
```

Le script affiche le code d'enrôlement et les codes PIN de départ. Il est rejouable : il ne crée
aucun doublon et n'écrase pas les réglages déjà modifiés.

### Planificateur

`vercel.json` déclare un appel à `/api/cron/tick` toutes les 10 minutes (génération des tâches du
jour, remontées, fin de journée à 4 h, livraisons non réceptionnées, recalcul hebdomadaire des
coefficients, purge des photos). Vercel ajoute l'en-tête `Authorization: Bearer $CRON_SECRET`.

Sur une offre Vercel qui limite la fréquence des tâches planifiées, deux possibilités :
l'application exécute aussi ce traitement à chaque chargement de page (une fois par minute au plus),
ce qui suffit pendant les heures d'ouverture ; ou un planificateur externe appelle l'URL :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://ops.easyburger.ma/api/cron/tick
```

## 4. Sauvegardes et restauration

- **Supabase** sauvegarde la base chaque jour (offre Pro : restauration à un instant donné).
- En plus, une sauvegarde indépendante, à lancer chaque jour depuis une machine d'Easy Burger :

```bash
DATABASE_URL="postgres://…" npm run sauvegarde -- /chemin/des/sauvegardes
```

Le script garde les 30 dernières sauvegardes. Une sauvegarde n'a de valeur que si sa restauration a
été testée : une fois par mois, restaurer la dernière dans une base temporaire et vérifier son contenu.

```bash
ADMIN_URL="postgres://utilisateur:motdepasse@hote:5432/postgres" npm run restauration:test -- /chemin/easyburger-AAAAMMJJ-HHMMSS.dump
```

Le script crée une base temporaire, y restaure la sauvegarde, affiche les volumes (postes,
articles, mouvements, tâches, journal) et supprime la base. Les photos sont dans le bucket
Supabase, à sauvegarder selon la politique de stockage de l'environnement.

Pour restaurer réellement la production : créer une base vide, `pg_restore --no-owner
--dbname=<nouvelle base> <fichier>`, puis pointer `DATABASE_URL` vers elle et redéployer.

## 5. Recette avant chaque mise en production

```bash
npm run typecheck
```

```bash
npm test
```

Les tests d'intégration utilisent la base `DATABASE_URL_TEST` (par défaut
`postgres://eb:eb@localhost:5432/easyburger_test`), **vidée à chaque exécution** : ne jamais la faire
pointer vers la recette ou la production. Le dépôt contient une intégration continue GitHub
(`.github/workflows/tests.yml`) qui lance ces contrôles sur un PostgreSQL éphémère à chaque envoi.

Parcours navigateur, sur une base de recette fraîchement chargée et un serveur lancé :

```bash
DATABASE_URL="postgres://…/easyburger_e2e" E2E_URL=http://localhost:3100 npm run test:e2e
```

Playwright doit être installé sur la machine qui lance ces parcours ; il ne fait pas partie des
dépendances de l'application.

## 6. Serveur classique (alternative)

Sur un serveur Linux avec Node.js 22 et PostgreSQL :

```bash
npm ci
```

```bash
npm run db:migrate && npm run build
```

```bash
npm run start
```

Laisser `SUPABASE_URL` vide : les photos vont dans `DATA_DIR` (disque persistant, à sauvegarder).
Placer un proxy HTTPS devant (Caddy ou Nginx) et appeler le planificateur toutes les 10 minutes
par la crontab système (`npm run cron:tick` ou l'URL ci-dessus).
