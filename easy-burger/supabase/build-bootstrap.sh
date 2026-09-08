#!/usr/bin/env bash
# Reconstruit supabase/bootstrap.sql à partir des migrations.
# À relancer après toute nouvelle migration.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

{
  echo "-- ==========================================================================="
  echo "-- Easy Burger — amorçage complet de la base"
  echo "--"
  echo "-- FICHIER GÉNÉRÉ. Ne pas modifier à la main : il est reconstruit par"
  echo "--   ./supabase/build-bootstrap.sh"
  echo "-- à partir des migrations, qui restent la source de vérité."
  echo "--"
  echo "-- À coller en une fois dans Supabase → SQL Editor, sur un projet neuf."
  echo "-- ==========================================================================="
  echo
  for f in "$HERE"/migrations/*.sql; do
    echo
    echo "-- ─── $(basename "$f") ───────────────────────────────────────────────"
    echo
    cat "$f"
  done
} > "$HERE/bootstrap.sql"

echo "bootstrap.sql reconstruit ($(wc -l < "$HERE/bootstrap.sql") lignes)"
