#!/usr/bin/env bash
# =============================================================================
# Monte PostgREST + le proxy Supabase devant le Postgres de test.
# Suppose que ../supabase/tests/run.sh a déjà créé la base et les migrations.
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PGPORT="${PGPORT:-5439}"
PGRST_VERSION=v12.2.3
BIN="$HERE/.bin"

mkdir -p "$BIN"
if [ ! -x "$BIN/postgrest" ]; then
  echo "→ téléchargement de PostgREST $PGRST_VERSION"
  curl -sSL -o "$BIN/pgrst.tar.xz" \
    "https://github.com/PostgREST/postgrest/releases/download/$PGRST_VERSION/postgrest-$PGRST_VERSION-linux-static-x64.tar.xz"
  tar xf "$BIN/pgrst.tar.xz" -C "$BIN"
  rm "$BIN/pgrst.tar.xz"
fi

SECRET="${JWT_SECRET:-un-secret-de-test-suffisamment-long-pour-postgrest-0123456789}"

# PostgREST se connecte en superutilisateur et bascule vers anon/authenticated ;
# ce sont les policies RLS qui décident, exactement comme chez Supabase.
psql -h /tmp -p "$PGPORT" -U postgres -q <<'SQL'
do $$ begin create role anon;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant anon, authenticated to postgres;
SQL

cat > "$HERE/.bin/postgrest.conf" <<CONF
db-uri = "postgres://postgres@/postgres?host=/tmp&port=$PGPORT"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = 3002
CONF

pkill -f "$BIN/postgrest" 2>/dev/null || true
pkill -f supabase-proxy.mjs 2>/dev/null || true
sleep 1

"$BIN/postgrest" "$HERE/.bin/postgrest.conf" > /tmp/pgrst.log 2>&1 &
sleep 4

STAFF_ID="$(psql -h /tmp -p "$PGPORT" -U postgres -tAc \
  "select id from staff_users where role = 'superadmin' limit 1" | tr -d '[:space:]')"

STAFF_USER_ID="$STAFF_ID" node "$HERE/supabase-proxy.mjs" > /tmp/proxy.log 2>&1 &
sleep 2

ANON="$(node "$HERE/keys.mjs" anon)"
node "$HERE/keys.mjs" authenticated "$STAFF_ID" > "$HERE/.bin/staff.jwt"

cat <<EOF

À mettre dans easy-burger/.env.local :

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3003
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON

Superadmin de test : $STAFF_ID
Jeton personnel     : e2e/.bin/staff.jwt
EOF
