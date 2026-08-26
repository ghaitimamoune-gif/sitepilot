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
| GoTrue (auth) | un bouchon dans `supabase-proxy.mjs` — **code OTP fixe : 123456** |
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
cd .. && npm run build && npx next start -p 3230

# 4. Les parcours
node e2e/journey.mjs          # invité : menu → panier → commande → prénom demandé après
node e2e/loyalty.mjs          # client : OTP → fidélité → compte → checkout prérempli
node e2e/ticket.mjs           # caisse : crédit par ticket, refus du double crédit
```

`up.sh` télécharge PostgREST au premier lancement (~4 Mo).

## Limites

Le bouchon GoTrue accepte **n'importe quel numéro avec le code `123456`**, et
signe une session comme le ferait Supabase. Tout ce qui vient après — le
rattachement de la fiche au numéro vérifié, RLS, les points — est réel.

Ce qui n'est donc pas couvert ici : l'envoi réel du SMS, l'expiration du code,
la limitation de débit, et la connexion du personnel par mot de passe
(`/admin/login`). Le reste du back-office tourne pour de vrai, contrôles de
rôle compris.
