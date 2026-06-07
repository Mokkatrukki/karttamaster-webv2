# SPEC — Karttamaster SyöteMTB 2026

See VISION.md for product context and UX principles.

## §G Goal

SyöteMTB 2026 merkintätyökalu — suunnittelu, kenttätyö, purku yhdessä sovelluksessa. Korvaa paperinen kartta. Kaksi roolia: järjestäjä (suunnittelu + tilannekuva) ja talkoolainen (kenttätyö). Kaikki näkevät kaikkien statuksen.

## §C Constraints

- Stack: Vite + TypeScript + Leaflet + Bun. Ei frameworkkia.
- Scope: SyöteMTB 2026, yksi tapahtuma, 4 reittiä. Ei multi-event.
- Deploy: Fly.io, Docker, nginx. Basic auth tällä hetkellä.
- Offline: valinnainen, PWA myöhemmin.
- Ei PDF-tulostusta.
- Testit: Vitest (unit) + Playwright (e2e).

## §I Interfaces

- `public/route-*.gpx` — 4 GPX-tiedostoa (35km, 55km + 2 puuttuu?)
- `localStorage` — tile-layer preference
- Leaflet tile APIs: MML Taustakartta, MML Maastokartta, OSM
- `VISION.md` — product vision, luetaan suunnittelun ja testauksen referenssinä

## §V Invariants

| id | invariant |
|----|-----------|
| V1 | Merkki snappaa lähimpään reittipistettä (kaikista reiteistä) bearing-laskentaa varten |
| V2 | Merkki saa routeIds kaikista reiteistä joiden lähin piste on ≤100m |
| V3 | Merkit järjestetään distanceFromStart-arvon mukaan nousevasti |
| V4 | Drive mode step = lähimpään piste 50m eteenpäin/taaksepäin, clampaa [0, last] |
| V5 | Tile-layer valinta persistoi localStorageen, palautuu latauksessa |
| V6 | Vähintään yksi reitti on aina visible; viimeistä ei voi piilottaa |
| V7 | GPX-parsinta hylkää pisteet joissa lat tai lon ei ole numero |
| V8 | Bearing-laskenta: atan2(dx, -dy) merkistä kursoriin → asteet [0, 360) |
| V9 | Merkillä on elinkaari-status: suunniteltu → asetettu → tarkistettu → kerätty \| ei_tarpeen |
| V10 | Merkkikirjaston malli (SignTemplate) pitää sisältää: ikoni, teksti, kuvaus |
| V11 | Pätkä on jatkuva väli reitillä pisteestä Y pisteeseen X; ei voi olla epäjatkuva |

## §T Tasks

| id | status | task | cites |
|----|--------|------|-------|
| T1 | ✓ | GPX lataus, reittiviivat kartalla, fitBounds | V7 |
| T2 | ✓ | Perusmerkit 4 tyyppiä: asetus dblclick/toolbar, poisto, bearing-snap | V1,V2,V3,V8 |
| T3 | ✓ | Multi-route: merkki kuuluu useammalle reitille (100m threshold) | V2 |
| T4 | ✓ | Drive mode: 50m step, keyboard nav, progress bar drag, polyline click | V4 |
| T5 | ✓ | Tile-layer vaihto MML/OSM, persistoi | V5 |
| T6 | ✓ | Route tabs: näkyvyys toggle, drive-reitti vaihto, eye-icon | V6 |
| T7 | . | Lisää puuttuvat 2 GPX-reittiä (4 reittiä yhteensä) | §C |
| T8 | . | Merkkikirjasto: järjestäjä luo/muokkaa SignTemplate (ikoni+teksti+kuvaus) | V10 |
| T9 | . | Ikonilähde-research: Lucide / Heroicons / custom SVG upload | V10 |
| T10 | . | Merkin elinkaari-status UI: suunniteltu/asetettu/tarkistettu/kerätty/ei_tarpeen | V9 |
| T11 | . | Paikkaohjeet: vapaa tekstikenttä per merkkiinstanssi | §G |
| T12 | . | Auth v1: admin-tunnus, kutsukoodi → talkoolainen / järjestäjä rooli | §C |
| T13 | . | Pätkäjako: järjestäjä valitsee välin kartalla, assign talkoolaiselle | V11 |
| T14 | . | Talkoolaisen näkymä: oma pätkä + varustelista (auto-laskuri + manuaali) + ohjeteksti | V11 |
| T15 | . | Tilannekuva: värikoodattu kartta status-väreillä + prosenttiluvut | V9 |
| T16 | . | GPS-navigointi metsässä: "seuraava merkki 300m", kuittaus asetettu/ei_tarpeen | V9 |
| T17 | . | Jälkikäteinen kuittaus: talkoolainen merkkaa listasta useita kerralla | V9 |
| T18 | . | Offline-tuki: oma pätkä ladattavissa (PWA + service worker) | §C |
| T19 | . | Purkupätkä: sama logiikka kuin asettaminen, valittava lähtösuunta | V11 |
| T20 | . | Kasauspisteet: erikoismerkki "kasa tässä", merkitään haetuksi | V9 |
| T21 | . | Live tracking v1: oma GPS-sijainti näkyvissä itselle | §C |

## §B Bugs

| id | date | cause | fix |
|----|------|-------|-----|
