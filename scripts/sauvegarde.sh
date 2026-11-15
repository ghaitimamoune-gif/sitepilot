#!/usr/bin/env bash
# Sauvegarde de la base Easy Burger Ops (format personnalisé pg_dump, compressé).
#
#   DATABASE_URL=postgres://… ./scripts/sauvegarde.sh [dossier]
#
# À lancer chaque jour (cron du serveur ou planificateur externe). Garde 30 sauvegardes.
# Avec Supabase ou Neon, les sauvegardes automatiques du fournisseur s'ajoutent à celle-ci.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL manquant}"
DOSSIER="${1:-./sauvegardes}"
mkdir -p "$DOSSIER"
FICHIER="$DOSSIER/easyburger-$(date -u +%Y%m%d-%H%M%S).dump"

pg_dump --format=custom --no-owner --no-privileges --file="$FICHIER" "$DATABASE_URL"
echo "Sauvegarde écrite : $FICHIER ($(du -h "$FICHIER" | cut -f1))"

# Rotation : on garde les 30 plus récentes.
ls -1t "$DOSSIER"/easyburger-*.dump 2>/dev/null | tail -n +31 | xargs -r rm -f
