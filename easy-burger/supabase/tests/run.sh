#!/usr/bin/env bash
# =============================================================================
# Rejoue toutes les migrations puis la suite de tests sur un Postgres jetable.
#
# Vérifie ce qui ne doit jamais casser :
#   — un ticket ne peut être crédité qu'une seule fois
#   — les prix d'une commande sont recalculés en base, jamais reçus du client
#   — seul un superadmin ajuste des points, motif obligatoire, tracé
#
#   ./supabase/tests/run.sh                    # Postgres local sur :5439
#   PGURL=postgres://... ./supabase/tests/run.sh   # base existante
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"

if [ -n "${PGURL:-}" ]; then
  PSQL=(psql "$PGURL" -q -v ON_ERROR_STOP=1)
else
  PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
  PGDATA="${PGDATA:-/var/lib/pgtest}"
  PGPORT="${PGPORT:-5439}"

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "→ initdb dans $PGDATA"
    "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 --locale=C >/dev/null
  fi
  "$PGBIN/pg_ctl" -D "$PGDATA" -l /tmp/pg.log -o "-p $PGPORT -k /tmp" start >/dev/null 2>&1 || true
  sleep 2
  PSQL=(psql -h /tmp -p "$PGPORT" -U postgres -q -v ON_ERROR_STOP=1)
fi

echo "→ base repartie de zéro"
"${PSQL[@]}" -c "drop schema if exists public cascade; create schema public; drop schema if exists auth cascade;" >/dev/null 2>&1

echo "→ émulation Supabase (auth.users, auth.uid, rôles)"
"${PSQL[@]}" -f "$HERE/00_supabase_shim.sql" >/dev/null 2>&1

echo "→ migrations"
for f in "$MIGRATIONS"/*.sql; do
  printf '   %s\n' "$(basename "$f")"
  "${PSQL[@]}" -f "$f" >/dev/null 2>&1
done

echo "→ tests"
"${PSQL[@]}" -f "$HERE/01_loyalty_and_orders.sql" 2>&1 \
  | grep -oP '(NOTICE:  |ERROR:  |=====.*|--- .*).*' \
  | sed 's/NOTICE:  //'
