---
name: run
description: Start the karttamaster-webv2 app locally for manual testing or verification. Use this whenever the user wants to run, start, launch, or test the app in a browser. Two processes needed: Bun backend (port 3001) + Vite frontend (port 5173). Also use when verifying a fix works in the real app, or when asked to "käynnistä sovellus", "testaa selaimessa", "aja sovellus".
---

# Karttamaster — paikallinen käynnistys

## Stack

- **Frontend:** Vite dev server (`bun run dev`) — port 5173 (tai 5174 jos varattu)
- **Backend:** Hono + Bun + SQLite (`bun server/index.ts`) — port 3001
- **Proxy:** `vite.config.ts` proxytaa `/api/*` → `http://localhost:3001`

## Käynnistys

```bash
# 1. Tarkista .env — tarvitaan backendille
cat .env
# Pitää sisältää: ADMIN_USERNAME + ADMIN_PASSWORD (tai ADMIN_PASSWORD_HASH)

# 2. Käynnistä backend
ADMIN_USERNAME=admin ADMIN_PASSWORD=admin123 bun server/index.ts &>/tmp/karttamaster-server.log &
echo "Backend PID=$!"
sleep 2 && curl -s http://localhost:3001/api/health   # pitää palauttaa {"ok":true}

# 3. Käynnistä frontend
bun run dev &>/tmp/karttamaster-dev.log &
echo "Frontend PID=$!"
sleep 3 && cat /tmp/karttamaster-dev.log | grep "Local:"
```

## Muuttujat .env:stä

```bash
source .env 2>/dev/null || true
ADMIN_USERNAME=${ADMIN_USERNAME:-admin} ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123} bun server/index.ts ...
```

## Terveyspisteet

| Prosessi | URL | Odotettu vastaus |
|---|---|---|
| Backend | `http://localhost:3001/api/health` | `{"ok":true}` |
| Frontend | `http://localhost:5173` tai `5174` | HTML-sivu |
| Auth | `http://localhost:5173/api/auth/me` | 401 (ei kirjautunut) |

## Oletustunnukset (kehitys)

- Järjestäjä: `admin` / `admin123` (tai .env:n arvot)
- Talkoolainen: koodi jonka järjestäjä loi (esim. `/s/rara`)

## Lokit

```bash
tail -f /tmp/karttamaster-server.log   # backend
tail -f /tmp/karttamaster-dev.log      # frontend
```

## Pysäytys

```bash
pkill -f "bun server/index.ts"
pkill -f "vite"
```

## Huomiot

- Port 5173 saattaa olla käytössä → Vite valitsee 5174 automaattisesti. Lue oikea portti logista.
- Backend **täytyy** käynnistää ennen frontendia, muuten `/api/auth/me` palauttaa 502.
- SQLite-tietokanta: `:memory:` (kehitys, häviää käynnistyksessä) tai tiedostopolku env:stä.
- E2E-testit (`bunx playwright test e2e/`): vaatii käynnissä olevan dev-serverin.
