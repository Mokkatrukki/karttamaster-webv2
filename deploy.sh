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

# Pre-deploy safety-backup (T343/V249): kriittisellä polulla VAIN volume-snapshot — nopea eikä
# vaadi käynnissä olevaa konetta. Off-site-kopio (herätys + 4 ssh-roundtrippiä kylmään koneeseen)
# ajetaan deployn JÄLKEEN, jolloin kone on hereillä joka tapauksessa.
if [ "${SKIP_BACKUP:-}" != "1" ]; then
  echo "[deploy] pre-deploy volume-snapshot…"
  if ! ./backup.sh --snapshot-only; then
    echo "⚠️  PRE-DEPLOY SNAPSHOT EPÄONNISTUI — jatketaan silti (fly:n päivittäiset auto-snapshotit varalla). Selvitä backup.sh." >&2
  fi
fi

fly deploy --build-arg VITE_MML_API_KEY="$MML_KEY" "$@"

# Post-deploy off-site-kopio. Ajetaan synkronisesti (ei taustalle) jotta output ja lopputulos
# näkyvät — hiljaa epäonnistunut backup = ei backupia lainkaan.
if [ "${SKIP_BACKUP:-}" != "1" ]; then
  echo "[deploy] post-deploy off-site-kopio…"
  if ./backup.sh --offsite-only; then
    echo "[deploy] ✓ deploy OK + off-site-kopio OK"
  else
    echo "⚠️  DEPLOY OK MUTTA OFF-SITE-KOPIO EPÄONNISTUI — aja käsin: ./backup.sh --offsite-only" >&2
  fi
fi
