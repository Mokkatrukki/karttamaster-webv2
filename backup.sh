#!/usr/bin/env bash
# Tuotanto-backup — KAKSI tasoa:
#   1. FLY-PUOLI: on-demand volume-snapshot → fly:n snapshot-storage (erillään volumesta, selviää
#      volumen hajotessa). LISÄKSI fly tekee omat päivittäiset auto-snapshotit (5 kpl, 5pv retention).
#   2. OFF-SITE: konsistentti kopio (VACUUM INTO, eheä myös WAL-moodissa) → lokaali backups/-hakemisto.
#
# Deploy.sh kutsuu tätä ENNEN julkaisua (pre-deploy safety). Voi ajaa myös käsin: ./backup.sh
set -uo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.fly/bin:$PATH"

APP=karttamaster-web
VOLUME=vol_rnzj3jw0km338xkr        # karttamaster_data — päivitä jos volume luodaan uusiksi (fly volumes list)
REMOTE_DB=/data/karttamaster.db
REMOTE_TMP=/data/backup.db
HEALTH=https://karttamaster-web.fly.dev/api/health
KEEP=20
TS=$(date +%Y%m%d-%H%M%S)
OUT="backups/karttamaster-$TS.db"
mkdir -p backups

command -v fly >/dev/null 2>&1 || { echo "[backup] VIRHE: fly-CLI puuttuu ($HOME/.fly/bin)." >&2; exit 1; }

# ── 1. FLY-PUOLEN snapshot (ei vaadi käynnissä olevaa konetta — volume-taso) ──────────────────
echo "[backup] fly volume-snapshot (on-demand)…"
if fly volumes snapshots create "$VOLUME" >/dev/null 2>&1; then
  echo "[backup] ✓ fly-snapshot ajastettu (volume $VOLUME)"
  FLY_OK=1
else
  echo "⚠️  [backup] fly-snapshot EPÄONNISTUI (volume $VOLUME) — tarkista fly volumes list" >&2
  FLY_OK=0
fi

# ── 2. LOKAALI off-site kopio (vaatii käynnissä olevan koneen → herätä + retry) ───────────────
echo "[backup] herätä kone (health)…"
curl -fsS -m 40 "$HEALTH" >/dev/null 2>&1 || true
LOCAL_OK=0
for i in 1 2 3 4 5; do
  fly ssh console -a "$APP" -C "true" >/dev/null 2>&1 && { LOCAL_OK=1; break; }
  sleep 3
done

if [ "$LOCAL_OK" = 1 ]; then
  if fly ssh console -a "$APP" -C "bun -e \"const{Database}=require('bun:sqlite');const db=new Database('$REMOTE_DB');db.exec(\\\"VACUUM INTO '$REMOTE_TMP'\\\");db.close()\"" >/dev/null 2>&1 \
     && fly ssh sftp get "$REMOTE_TMP" "$OUT" -a "$APP" >/dev/null 2>&1; then
    fly ssh console -a "$APP" -C "rm -f $REMOTE_TMP" >/dev/null 2>&1 || true
    # eheystarkistus
    if bun -e "const{Database}=require('bun:sqlite');const db=new Database('$OUT',{readonly:true});const r=db.query('PRAGMA integrity_check').get();if(r.integrity_check!=='ok')process.exit(1);const inv=db.query('SELECT COUNT(*) c FROM inventory_items').get().c;const tpl=db.query('SELECT COUNT(*) c FROM templates').get().c;console.log('[backup] ✓ lokaali: '+inv+' inventaariota, '+tpl+' merkkiä → '+process.argv[1])" "$OUT"; then
      ls -1t backups/*.db 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
    else
      echo "⚠️  [backup] lokaalikopio KORRUPTOITUNUT — poistetaan $OUT" >&2; rm -f "$OUT"
    fi
  else
    echo "⚠️  [backup] lokaali kopio EPÄONNISTUI (VACUUM/sftp)" >&2; rm -f "$OUT" 2>/dev/null || true
  fi
else
  echo "⚠️  [backup] kone ei herännyt — lokaalikopio ohitettu (fly-snapshot silti tehty jos ✓ yllä)" >&2
fi

echo "[backup] valmis. Lokaalibackupit: $(ls -1 backups/*.db 2>/dev/null | wc -l | tr -d ' ') kpl."
# Onnistuu jos EDES fly-snapshot meni läpi (deploy voi jatkaa turvallisesti).
[ "$FLY_OK" = 1 ] || [ "$LOCAL_OK" = 1 ]
