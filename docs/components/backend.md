# Komponentit — server/ + backend-arkkitehtuuri

Jaettu tilannekuva vaatii backendin. **"Kaikki näkevät kaikkien statuksen"** (VISION) ei onnistu pelkällä localStorage:lla.

Backend ei ole vielä SPEC §T:ssä — lisätään ennen kuin T14/T28/T31/T36 saavat toteutettavan muodon.

---

## Miksi backend tarvitaan

| Ilman backendia | Backendillä |
|---|---|
| Talkoolainen näkee vain oman puhelimensa tiedot | Talkoolainen näkee muiden kuittaukset reaaliajassa |
| Järjestäjä ei näe kenttätyön edistymistä | Tilannekuva päivittyy automaattisesti |
| localStorage per-laite, ei sync | Kaikki laitteet synkassa |
| Auth ei ole mahdollinen (ei sessioita) | Kutsukoodi → rooli → oikeudet |

---

## BackendAPI *(tulossa — ei SPEC-taskia vielä)*
**Vastuu:** Merkkidatan + tilojen synkronointi eri laitteiden välillä
**Käyttäjä:** molemmat (läpinäkyvä — PersistenceLayer kutsuu)
**Moduuli:** `server/` *(erillinen hakemisto, ei vielä)*
**Testattavuus:** Vitest integraatiotestit

### Teknologiapäätökset

```
Runtime:    Bun (sama kuin frontend build-tooling)
Framework:  Hono (kevyt, TypeScript-native, no magic)
DB:         SQLite (bun:sqlite — ei erillistä prosessia)
Proxy:      nginx → /api/* → Hono (Fly.io)
```

Vaihtoehtoina harkittiin: Express (liikaa boilerplate), Fastify (hieman raskas), PostgreSQL (overkill yhdelle tapahtumalle).

### SQLite-schema (alustava)

```sql
-- Reitit (ladataan GPX:stä, tallennetaan viitteeksi)
CREATE TABLE routes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  gpx_file TEXT NOT NULL
);

-- Merkit
CREATE TABLE markers (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,               -- MarkerType
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  bearing REAL NOT NULL,
  distance_from_start REAL NOT NULL,
  route_ids TEXT NOT NULL,          -- JSON array: ["35km","55km"]
  status TEXT NOT NULL DEFAULT 'suunniteltu',
  notes TEXT,
  updated_at TEXT NOT NULL          -- ISO8601
);

-- Pätkät
CREATE TABLE segments (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  start_dist REAL NOT NULL,
  end_dist REAL NOT NULL,
  assigned_to TEXT                  -- user id tai roolitunnus
);

-- Käyttäjät (kutsukoodi-pohjainen)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,               -- järjestäjä | talkoolainen
  invite_code TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);
```

### REST API endpoints (suunniteltu)

```
GET    /api/markers              → kaikki merkit
POST   /api/markers              → uusi merkki
PUT    /api/markers/:id          → päivitä merkki (status, bearing, notes)
DELETE /api/markers/:id          → poista merkki

GET    /api/segments             → kaikki pätkät
POST   /api/segments             → uusi pätkä
PUT    /api/segments/:id         → päivitä assign

POST   /api/auth/login           → koodi → sessio + rooli
GET    /api/auth/me              → nykyinen sessio
```

### Tulossa (SPEC-taskit lisätään)
- [ ] Hono + Bun setup, SQLite yhteys, health check endpoint
- [ ] GET/POST/PUT/DELETE markers
- [ ] GET/POST segments + assign
- [ ] Auth: kutsukoodi → sessio (T36)
- [ ] PersistenceLayer käyttää API:a localStorage-cachen lisäksi
- [ ] Fly.io deploy: Dockerfile, fly.toml, nginx config

---

## OfflineManager *(tulossa — T18)*
**Vastuu:** PWA service worker + offline-tuki omalle pätkälle
**Käyttäjä:** talkoolainen metsässä (ei nettiä)
**Moduuli:** `public/sw.js` + `src/logic/offline.ts` *(ei vielä)*
**Testattavuus:** Playwright (offline mode)

### Arkkitehtuuri: Offline-first ActionBuffer

```
Normaali flow:
  Talkoolainen kuittaa → PersistenceLayer → localStorage + POST /api/markers/:id

Offline flow:
  Talkoolainen kuittaa → PersistenceLayer → localStorage + ActionBuffer (queue)
  Yhteys palaa → ActionBuffer flush → POST /api/markers/:id kaikki jonossa olevat
```

### Service Worker cachettaa
- Karttatiiliset omalle pätkälle (pre-fetch valmistelu-vaiheessa)
- App shell (HTML, JS, CSS)
- Oma pätkä + merkit (IndexedDB tai localStorage)

### Tulossa
- [ ] PWA manifest + service worker rekisteröinti (T18)
- [ ] Tile pre-fetch omalle pätkälle ennen kenttätyötä (T18)
- [ ] ActionBuffer: kuittaukset jonoon, sync yhteyden palautuessa (T18)

### Käyttäjätarkistus
> Talkoolainen: avaa sovelluksen kotona → lataa pätkä → sulkee netit → toimii metsässä ✓

---

## AuthController *(tulossa — T36)*
**Vastuu:** Kutsukoodi-pohjainen autentikointi + rooli-assert
**Käyttäjä:** molemmat
**Moduuli:** `src/logic/auth.ts` + BackendAPI (T36)
**Testattavuus:** Vitest-pure (logiikka)

### Flow

```
Admin luo koodeja → BackendAPI POST /api/admin/codes
Käyttäjä syöttää koodin → POST /api/auth/login → sessio + rooli
Sessio localStorage:issa → RoleController saa roolin
```

### Tulossa
- [ ] Admin-generointityökalu koodeihin (T36)
- [ ] Koodi → sessio → rooli (T36)
- [ ] Auth screen ennen karttaa (T36, AuthScreen UI)

### Käyttäjätarkistus
> Talkoolainen: syöttää koodin → suoraan omaan pätkänäkymään ✓
> Järjestäjä: admin-koodi → kaikki työkalut ✓

---

## Vaiheistus: milloin backend lisätään?

**MVP ilman backendiä** (vaihe 1):
- T7, T8, T9, T10, T11, T12, T29, T32 voi rakentaa ilman backendiä
- localStorage riittää yhden henkilön käyttöön
- Testaaminen ja kehitys helpompaa

**Backend lisätään kun** (vaihe 2):
- MVP toimii paikallisesti
- Useampi henkilö tarvitaan testaukseen
- Talkoolainen + järjestäjä -roolit halutaan oikeasti testata
- Arviolta: ennen tapahtumaa 2–3 kuukautta

**PersistenceLayer on avain** — se abstrahoi localStorage:n ja API:n saman rajapinnan taakse. Backend lisätään vaihtamalla PersistenceLayerin toteutus, ei muuttamalla MarkerManager:ia tai UI:ta.
