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

fly deploy --build-arg VITE_MML_API_KEY="$MML_KEY" "$@"
