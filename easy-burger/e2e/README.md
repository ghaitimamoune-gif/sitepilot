# Banc d'essai bout en bout

Fait tourner l'app complète contre une vraie base, **sans Docker et sans
projet Supabase**. C'est ce montage qui a révélé deux bugs que ni le
typage ni le build ne voyaient : une redirection en course après commande,
et un compteur de commandes qui gonflait à chaque repassage en « terminée ».

## Ce que ça remplace

| Supabase | Ici |
|---|---|
| Postgres | Postgres 16 local, base jetable |
| PostgREST | le vrai PostgREST, binaire statique |
| GoTrue (auth) | un bouchon dans `supabase-proxy.mjs` |
| `auth.uid()`, `auth.users` | `../supabase/tests/00_supabase_shim.sql` |

Le proxy réécrit `/rest/v1/*` vers PostgREST et sert une session bidon sur
`/auth/v1/user`, de sorte que `@supabase/supabase-js` ne voit aucune
différence.

## Utilisation

```bash
# 1. Postgres + migrations + suite SQL
../supabase/tests/run.sh

# 2. PostgREST + proxy + clés JWT
./up.sh                       # affiche les variables à mettre dans .env.local

# 3. L'app
cd .. && npm run build && npx next start -p 3220

# 4. Les parcours
node e2e/journey.mjs          # menu → produit → panier → commande → suivi
node e2e/ticket.mjs           # crédit au comptoir et refus du double crédit
```

`up.sh` télécharge PostgREST au premier lancement (~4 Mo).

## Limite

GoTrue n'est pas émulé : la **connexion** du personnel (`/admin/login`) ne
peut pas être testée ici, seulement la session une fois établie. Le reste
du back-office tourne pour de vrai, RLS et contrôles de rôle compris.
