#!/usr/bin/env bash
# Deploy karttamaster-web fly.io:hin build-argeilla .env:stä (T167/B70 — VITE_* pitää
# antaa build-aikana, fly secrets ei riitä, ks. .claude/skills/karttamaster-julkaise).
set -euo pipefail
cd "$(dirname "$0")"

MML_KEY="$(grep '^VITE_MML_API_KEY=' .env | cut -d= -f2-)"
if [ -z "$MML_KEY" ]; then
  echo "VITE_MML_API_KEY puuttuu .env:stä — stop." >&2
  exit 1
fi

# Pre-deploy safety-backup: vedä tuotanto-DB ENNEN uuden koodin julkaisua (migraatio/bugi voi
# korruptoida). Ei blokkaa deployta jos backup epäonnistuu (fly-snapshotit varalla) mutta varoittaa.
if [ "${SKIP_BACKUP:-}" != "1" ]; then
  echo "[deploy] pre-deploy backup…"
  if ! ./backup.sh; then
    echo "⚠️  PRE-DEPLOY BACKUP EPÄONNISTUI — jatketaan silti (fly-volume-snapshotit varalla). Selvitä backup.sh." >&2
  fi
fi

fly deploy --build-arg VITE_MML_API_KEY="$MML_KEY" "$@"
