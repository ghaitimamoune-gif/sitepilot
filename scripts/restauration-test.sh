#!/usr/bin/env bash
# Test de restauration : restaure une sauvegarde dans une base temporaire et vérifie son contenu.
# Une sauvegarde n'a de valeur que si sa restauration a été testée (section 13 du brief).
#
#   ADMIN_URL=postgres://utilisateur:motdepasse@hote:5432/postgres ./scripts/restauration-test.sh fichier.dump
#
# ADMIN_URL doit pouvoir créer et supprimer une base. La base temporaire est supprimée à la fin.
set -euo pipefail

: "${ADMIN_URL:?ADMIN_URL manquant (connexion avec droit de créer une base)}"
FICHIER="${1:?Indiquez le fichier de sauvegarde}"
BASE="eb_restauration_$(date -u +%Y%m%d%H%M%S)"
URL_TEST="${ADMIN_URL%/*}/$BASE"

nettoyer() { psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS $BASE" >/dev/null 2>&1 || true; }
trap nettoyer EXIT

psql "$ADMIN_URL" -qc "CREATE DATABASE $BASE"
pg_restore --no-owner --no-privileges --dbname="$URL_TEST" "$FICHIER"

echo "Contrôles sur la base restaurée :"
psql "$URL_TEST" -At <<'SQL'
select 'postes actifs        : ' || count(*) from postes where actif;
select 'articles             : ' || count(*) from articles;
select 'mouvements de stock  : ' || count(*) from mouvements_stock;
select 'tâches               : ' || count(*) from taches;
select 'journal (écritures)  : ' || count(*) from journal;
select 'dernière écriture    : ' || coalesce(max(at)::text, '—') from journal;
SQL
N=$(psql "$URL_TEST" -At -c "select count(*) from postes")
if [ "$N" -eq 0 ]; then
  echo "ÉCHEC : la base restaurée ne contient aucun poste." >&2
  exit 1
fi
echo "Restauration réussie ($FICHIER)."
