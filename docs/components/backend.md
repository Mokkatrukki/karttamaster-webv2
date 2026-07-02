# Komponentit — server/ + backend-arkkitehtuuri

Jaettu tilannekuva vaatii backendin. **"Kaikki näkevät kaikkien statuksen"** (VISION) ei onnistu pelkällä localStorage:lla.

---

## Miksi backend tarvitaan

| Ilman backendiä | Backendillä |
|---|---|
| Talkoolainen näkee vain oman puhelimensa tiedot | Talkoolainen näkee muiden kuittaukset reaaliajassa |
| Järjestäjä ei näe kenttätyön edistymistä | Tilannekuva päivittyy automaattisesti |
| localStorage per-laite, ei sync | Kaikki laitteet synkassa |
| Auth ei ole mahdollinen (ei sessioita) | Rooli + oikeudet verifioidaan serverillä |

---

## Teknologiapäätökset

```
Runtime:    Bun (sama kuin frontend)
Framework:  Hono (kevyt, TypeScript-native)
DB:         SQLite (bun:sqlite — ei erillistä prosessia)
Auth:       httpOnly cookie session (turvallinen mobiililla)
Proxy:      nginx → /api/* → Hono (Fly.io)
```

---

## Hakemistorakenne

```
server/
  index.ts            ← Hono app + routes wiring
  db.ts               ← SQLite yhteys + schema init + migrations
  types.ts            ← jaetut tyypit: Role, SessionData, User
  test-fixtures.ts    ← testiapurit (seedTestUsers, authHeaders, makeTestSession)
  middleware/
    auth.ts           ← session check, role gate
  routes/
    markers.ts        ← CRUD merkeille
    auth.ts           ← login, logout, me
    admin.ts          ← käyttäjähallinta, kartta-tila, snapshots
    poi.ts            ← info-pisteet (POI)
  types.ts            ← jaetut server-tyypit
```

---

## SQLite-schema

```sql
-- Käyttäjät
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,      -- bcrypt, null-proof
  role TEXT NOT NULL,               -- 'admin' | 'järjestäjä' | 'talkoolainen'
  invite_token TEXT UNIQUE,         -- admin luo järjestäjälle, one-time (sama mekaniikka reset-passwordille, V76)
  display_name TEXT,                -- näytetään tilannekuvassa
  created_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1  -- 0 = deaktivoitu, requireAuth() 401 myös voimassa olevalla sessiolla (V75)
);

-- Talkoolais-koodit (ei pysyvä tunnus — event-scoped)
CREATE TABLE talkoolainen_codes (
  code TEXT PRIMARY KEY,            -- esim "SYÖTE-MATTI-7X"
  display_name TEXT NOT NULL,       -- "Matti Meikäläinen"
  segment_id TEXT,                  -- linkitys pätkään (optional)
  used_at TEXT,                     -- milloin käytettiin
  created_at TEXT NOT NULL
);

-- Sessiot
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- satunnainen token
  user_id TEXT,                     -- NULL jos talkoolainen-koodi
  talkoolainen_code TEXT,           -- NULL jos järjestäjä/admin
  role TEXT NOT NULL,
  display_name TEXT,
  expires_at TEXT NOT NULL
);

-- Merkit
CREATE TABLE markers (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  bearing REAL NOT NULL,
  distance_from_start REAL NOT NULL,
  route_ids TEXT NOT NULL,          -- JSON: ["35km","55km"]
  status TEXT NOT NULL DEFAULT 'suunniteltu',
  location_note TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,                  -- display_name kuka muutti
  description TEXT                  -- T103: lisäkuvaus, järjestäjä muokkaa
);

-- Merkkien kuvat (T103) — blob suoraan sqliteen, ei erillistä tiedostovarastoa
CREATE TABLE marker_images (
  id TEXT PRIMARY KEY,
  marker_id TEXT NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,               -- max 8MB per kuva (MAX_IMAGE_BYTES)
  created_at TEXT NOT NULL
);
-- GET /api/markers palauttaa images: string[] URLina (/api/markers/:id/images/:imageId)

-- Info-pisteet (POI) — sama logiikka kuin merkit, eri näkymä
CREATE TABLE poi (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,              -- "Ruokala", "Mökki A", "Parking"
  body TEXT,                        -- vapaa ohjeteksti
  category TEXT NOT NULL,           -- 'ruoka' | 'majoitus' | 'pysäköinti' | 'muu'
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  icon TEXT,                        -- Lucide icon name
  created_at TEXT NOT NULL,
  created_by TEXT
);

-- Kartta-tila
CREATE TABLE map_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Rivit: ('status', 'luonnos'|'hyväksytty'), ('approved_at', ISO8601), ('approved_by', display_name)

-- Snapshots (versiohistoria)
CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,              -- "Hyväksyntä 2026-06-08", "Päivittäinen backup"
  markers_json TEXT NOT NULL,       -- koko markers-taulun JSON-dump
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  trigger TEXT NOT NULL             -- 'manual' | 'approve' | 'auto'
);
```

---

## Auth-flow

### Admin (seed-tunnus)

```
Deploy → server/db.ts lukee ADMIN_USERNAME + ADMIN_PASSWORD_HASH env-muuttujat
       → luo admin-käyttäjä jos ei ole olemassa (idempotent)
Admin kirjautuu → /api/auth/login → httpOnly session cookie → rooli 'admin'
Admin vaihtaa salasanan → /api/admin/password
```

Seed env-muuttujat (fly.toml secrets):
```
ADMIN_USERNAME=karttamaster-admin
ADMIN_PASSWORD=vaihda-tämä-heti   ← tai ADMIN_PASSWORD_HASH=bcrypt(...)
```

### Järjestäjä (invite-flow)

```
Admin luo invite → POST /api/admin/invites → palauttaa token
Admin lähettää linkin: https://app.example.com/join?token=XYZ
Järjestäjä avaa linkin → syöttää salasanan → POST /api/auth/register
Token invalidoituu → järjestäjällä pysyvä tunnus
```

### Talkoolainen (event-koodi)

```
Admin/järjestäjä luo koodit → POST /api/admin/codes (bulk tai yksi)
  → koodi sidotaan nimeen + mahdollisesti pätkään
Talkoolainen syöttää koodin → POST /api/auth/code-login → sessio (24h)
  → sessio ei tallennu talkoolaiselle pysyvästi (koodi riittää uudelleenkirjautumiseen)
```

Talkoolaisella ei käyttäjätunnusta — koodi on "avain". Voi syöttää uudelleen jos sessio vanhenee.

---

## Kartta-tila: luonnos / hyväksytty

```
luonnos  → vain järjestäjät + admin näkevät merkit
         → talkoolaiset saavat "kartta ei vielä valmis" -viestin
hyväksytty → kaikki näkevät merkit
           → talkoolaiset voivat päivittää statusta (aseta/kuittaa)
           → järjestäjät voivat edelleen muokata sijaintia ja tyyppiä
```

**Server-enforcement (middleware):**
```typescript
// markers.ts — GET /api/markers
if (mapState === 'luonnos' && session.role === 'talkoolainen') {
  return c.json({ error: 'map_not_ready' }, 403)
}
```

**Client-side:**
- `PersistenceLayer.syncMarkers()` saa 403 → näyttää "Kartta valmisteilla" -bannerin
- Järjestäjä-näkymässä: badge "LUONNOS / HYVÄKSYTTY" toolbarissa

**Approve-flow:**
```
Järjestäjä klikkaa "Hyväksy kartta" → POST /api/admin/map-state {status: 'hyväksytty'}
  → server: tallentaa approved_at + approved_by
  → server: luo automaattinen snapshot (trigger: 'approve')
  → kaikki talkoolaiset saavat 200 seuraavalla sync-pollilla
```

---

## Backup / versiohistoria

### Milloin snapshot luodaan

| Trigger | Milloin |
|---------|---------|
| `approve` | Aina kun järjestäjä hyväksyy kartan |
| `auto` | Päivittäin klo 03:00 (Bun cron tai yksinkertainen interval) |
| `manual` | Järjestäjä klikkaa "Luo backup nyt" |

### Restore

```
Järjestäjä: lista snapshotseista → valitse → "Palauta tämä versio"
  → POST /api/admin/snapshots/:id/restore
  → server: korvaa kaikki merkit snapshot-datalla (transaction)
  → server: luo uusi snapshot ("Palautus: [alkuperäinen label]")
```

**Retention:** pidetään max 20 snapshottia, vanhin poistetaan automaattisesti.

---

## Info-pisteet (POI)

Sama karttalogiikka kuin merkeillä — sama snap, sama lista, eri ikoni.

**Frontend-arkkitehtuuri:**
- `src/logic/poi.ts` — POI-tyypit ja logiikka (Vitest-pure)
- `src/map/poi-layer.ts` — Leaflet-renderöinti (Playwright)
- `src/ui/poi-list.ts` — lista-näkymä (Vitest-jsdom)

**Kategoriat ja ikonit (Lucide):**

| Kategoria | Lucide-ikoni | Esimerkki |
|-----------|-------------|-----------|
| ruoka | `utensils` | "Ruokala 12-14h" |
| majoitus | `bed` | "Mökki A — varattu Virtanen" |
| pysäköinti | `parking-circle` | "Huoltopiste P1" |
| muu | `info` | "Ensiapupiste" |

**POI kartalla:**
- Oma layer (voidaan toggle pois kuten reittinäkyvyys)
- Ikoni: Lucide-ikoni värjättynä (ei bearing-nuolia)
- Klikkaus: popup jossa title + body
- Listanäkymässä: erillinen välilehti tai suodatin

**POI on vaihe 3** — ei tarvita SyöteMTB 2026 merkintätyöhön, mutta arkkitehtuuri ei estä.

---

## REST API — täydellinen lista

```
# Auth
POST   /api/auth/login              → username+password → session cookie
POST   /api/auth/code-login         → talkoolainen-koodi → session cookie
POST   /api/auth/logout             → poista sessio
GET    /api/auth/me                 → nykyinen sessio + rooli

# Admin
GET    /api/admin/users             → lista käyttäjistä + is_active (admin)
PATCH  /api/admin/users/:id         → {is_active: 0|1} — deaktivoi/aktivoi (admin, V74/V75)
POST   /api/admin/users/:id/reset-password → uusi invite-token → {inviteUrl} (admin, V76)
POST   /api/admin/invites           → luo invite-token järjestäjälle
POST   /api/admin/codes             → luo talkoolainen-koodeja (bulk)
DELETE /api/admin/codes/:code       → poista koodi
POST   /api/admin/password          → vaihda oma salasana (admin/järjestäjä)
GET    /api/admin/map-state         → luonnos | hyväksytty
POST   /api/admin/map-state         → vaihda tila (järjestäjä+)
GET    /api/admin/snapshots         → lista snapshotseista
POST   /api/admin/snapshots         → luo manual snapshot
POST   /api/admin/snapshots/:id/restore → palauta versio

# Auth rekisteröinti (invite-flow)
GET    /api/auth/invite/:token      → tarkista token
POST   /api/auth/register           → rekisteröidy invite-tokenilla

# Merkit
GET    /api/markers                 → kaikki merkit (403 jos luonnos + talkoolainen)
POST   /api/markers                 → uusi merkki (järjestäjä+)
PUT    /api/markers/:id             → päivitä (status: kaikki, sijainti+description: järjestäjä+)
DELETE /api/markers/:id             → poista (järjestäjä+)
POST   /api/markers/:id/images      → lataa kuva (multipart, field "image", järjestäjä+, max 8MB) (T103)
GET    /api/markers/:id/images/:imageId → palauttaa kuvan blobina (kaikki autentikoidut) (T103)

# POI (vaihe 3)
GET    /api/poi                     → kaikki POI:t
POST   /api/poi                     → uusi POI (järjestäjä+)
PUT    /api/poi/:id                 → päivitä
DELETE /api/poi/:id                 → poista
```

---

## Roolimatriisi (mitä kukin saa tehdä)

| Toiminto | talkoolainen | järjestäjä | admin |
|----------|:---:|:---:|:---:|
| Näe merkit (hyväksytty) | ✓ | ✓ | ✓ |
| Näe merkit (luonnos) | ✗ | ✓ | ✓ |
| Päivitä merkin status | ✓ | ✓ | ✓ |
| Lisää/poista/siirrä merkki | ✗ | ✓ | ✓ |
| Hyväksy kartta | ✗ | ✓ | ✓ |
| Luo snapshots | ✗ | ✓ | ✓ |
| Palauta snapshot | ✗ | ✓ | ✓ |
| Hallitse käyttäjiä | ✗ | ✗ | ✓ |
| Luo invite / talkoolainen-koodit | ✗ | ✓ | ✓ |

---

## Sync-malli (frontend ↔ backend)

```
Online:
  App käynnistyy → GET /api/markers → tallenna localStorage → renderöi
  Käyttäjä muuttaa merkkiä → PUT /api/markers/:id → päivitä localStorage

Offline (talkoolainen metsässä):
  PUT /api/markers/:id epäonnistuu → tallenna localStorage + merkitse pendingSync: true
  Yhteys palaa → pushPending() → lähetä kaikki pendingSync-merkit
  Konflikti (server muuttunut) → V20: käyttäjä päättää

Polling (tilannekuva):
  Järjestäjän tilannekuva-näkymä pollaa GET /api/markers 30s välein
  Talkoolainen pollaa vain kun drive mode aktiivinen
```

---

## Vaiheistus

**Vaihe 2a — Backend core (T41 uudelleenspeksattu):**
- Hono + SQLite setup
- Markers CRUD
- Seed admin + session auth
- Talkoolainen-koodi login
- Invite-flow järjestäjälle
- Kartta-tila luonnos/hyväksytty
- Automaattinen snapshot approve-vaiheessa

**Vaihe 2b — Sync:**
- PersistenceLayer online-first (T42)
- Merge-konflikti UI (T43)
- Polling tilannekuvaan

**Vaihe 2c — Offline:**
- PWA + service worker (T18)
- Tile pre-fetch
- ActionBuffer

**Vaihe 3 — POI:**
- poi taulu + API
- Frontend POI-layer + lista
- Kategoriat + ikonit

---

## Testiapurit — `server/test-fixtures.ts`

**Kaikki server-testit käyttävät näitä.** Älä kirjoita boilerplate setup-koodia suoraan testeihin.

```typescript
import { createDb } from './db'
import { seedTestUsers, authHeaders, makeTestSession, TEST_USERS } from './test-fixtures'

// Setup joka testissä:
let db: Database
beforeEach(() => { db = createDb(':memory:'); seedTestUsers(db) })
afterEach(() => db.close())

// Auth headerit:
authHeaders(db, 'admin')          // { Cookie: 'session=...' }
authHeaders(db, 'järjestäjä')
authHeaders(db, 'talkoolainen')

// Vanhentunut sessio:
makeTestSession(db, 'admin', -1)  // expiresOffset negatiivinen

// Vakiotunnukset:
TEST_USERS.admin.username         // 'test-admin'
TEST_USERS.järjestäjä.displayName // 'Testi Järjestäjä'
TEST_USERS.talkoolainen.code      // 'TEST-KOODI-1'
```

**Ajotapa:** `bun test server/` — ei Vitest.

---

## BackendAPI

**Vastuu:** Merkkidatan, auth-sessionien ja kartta-tilan hallinta
**Käyttäjä:** molemmat (läpinäkyvä — PersistenceLayer kutsuu)
**Moduuli:** `server/`
**Testattavuus:** Bun integraatiotestit (in-memory SQLite) — käytä `test-fixtures.ts`

### Valmis (T41 ✓)
- [x] Hono + SQLite setup + schema (T41)
- [x] Seed admin env-muuttujista — idempotent (T41)
- [x] Auth-middleware: session cookie check + role gate (T41)
- [x] `GET /api/health` → 200 (T41)

### Tulossa (Vaihe 2a)
- [ ] Session auth: admin/järjestäjä + talkoolainen-koodi (T36)
- [ ] Invite-flow järjestäjälle (T36)
- [ ] Kartta-tila luonnos/hyväksytty (T48)
- [ ] Snapshot approve-vaiheessa + manual (T50)
- [ ] Snapshot restore (T50)

### Käyttäjätarkistus
> Talkoolainen: syöttää koodin → suoraan omaan pätkänäkymään. Koodi riittää uudelleenkirjautumiseen. ✓
> Järjestäjä: invite-linkki → rekisteröinti → kaikki työkalut. Admin näkee ketkä ovat kirjautuneena. ✓

---

## GpkgGeoJSON

**Vastuu:** Muuntaa markerit GeoJSON-muotoon (id, type, bearing, description + Point-geometria) ja takaisin — GPKG-export/import-featuren rakennuspalikka.
**Käyttäjä:** järjestäjä (vie/tuo kylttidataa kaverin QGIS-sovellukseen).
**Moduuli:** `server/gpkg/geojson.ts`
**Testattavuus:** Bun-integraatiotesti (`server/gpkg/geojson.test.ts`) — ei DB:tä, puhdas muunnos

### Ominaisuudet
- ✓ `markersToGeoJSON(rows)` — MarkerRow[] → FeatureCollection<Point>, vain id/type/bearing/description (ei color/status/routeIds/locationNote/images)
- ✓ `geoJSONToMarkers(fc)` — käänteinen parsinta, puuttuva description → null

### Ominaisuudet (T125, T126)
- ✓ `server/gpkg/convert.ts` — `geoJSONToGpkg`/`gpkgToGeoJSON`, ogr2ogr subprocess (tempdir per kutsu, siivoaa jälkensä)
- ✓ `GET /api/gpkg/export` (`server/routes/gpkg.ts`) — järjestäjä+, koko markerdata → `.gpkg`-lataus (layer "kyltit"). 503 jos GDAL ei asennettu palvelimella.
- ✓ `POST /api/gpkg/import` — multipart upload `.gpkg`, upsert id:n perusteella: olemassa oleva id päivittää `type/bearing/lat/lon/description` (status+routeIds koskematta), uusi id luo `status='suunniteltu'`-merkin. Palauttaa `{created, updated}`.

### Tulossa
- [ ] UI-napit järjestäjän näkymään (T127)
- [ ] `apk add gdal` Dockerfileen (T128)

### Tunnettu rajaus: uusien tuotujen merkkien väri/lyhenne
`color`/`short_label` eivät kuulu GPKG-attribuutteihin (tietoinen rajaus, ks. §I / SPEC.md T124). Olemassa oleva id säilyttää nämä kentät ennallaan importissa (ei kosketa niitä). Täysin uusi id (kaverin lisäämä merkki) saa `color=null, short_label=null` → kartalla harmaa `?`-ympyrä (`src/map/icons.ts` default-haara) kunnes järjestäjä liittää sen merkkikirjaston tyyppiin manuaalisesti. Tietoinen päätös — toimii visuaalisena "vaatii käsittelyn" -vihjeenä, ei automaattista täsmäytystä.

### Käyttäjätarkistus
> Järjestäjä: round-trip toimii nyt palvelinpuolella (export + import). Ei vielä UI:ta — testattu suoraan API:n kautta. UI-napit T127.

---

## OfflineManager *(tulossa — T18)*

**Vastuu:** PWA service worker + offline-tuki omalle pätkälle
**Käyttäjä:** talkoolainen metsässä (ei nettiä)
**Moduuli:** `public/sw.js` + `src/logic/offline.ts` *(ei vielä)*
**Testattavuus:** Playwright (offline mode)

### Arkkitehtuuri

```
Normaali: kuittaus → PersistenceLayer → localStorage + PUT /api/markers/:id
Offline:  kuittaus → PersistenceLayer → localStorage + ActionBuffer (queue)
          Yhteys palaa → ActionBuffer flush → PUT kaikki jonossa
```

Service Worker cachettaa:
- App shell (HTML, JS, CSS)
- Karttatiiliset omalle pätkälle (pre-fetch ennen kenttätyötä)
- Oman pätkän merkit (localStorage / IndexedDB)

---

## AuthController *(tulossa — T36 uudelleenspeksattu)*

**Vastuu:** Session-pohjainen auth + rooliassertio
**Käyttäjä:** molemmat
**Moduuli:** `server/routes/auth.ts` + `server/middleware/auth.ts`
**Testattavuus:** Bun integraatiotesti

### Flow
```
Seed admin → vaihda salasana → luo invitet järjestäjille → luo koodit talkoolaisille
Järjestäjä → invite-linkki → rekisteröinti → pysyvä tunnus
Talkoolainen → koodi → 24h sessio (uusittavissa samalla koodilla)
```
