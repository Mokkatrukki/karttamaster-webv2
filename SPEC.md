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
- `localStorage['karttamaster-layer']` — tile-layer preference
- `localStorage['karttamaster-markers']` — marker data: `{ version: 1, markers: SignMarker[] }`
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
| V12 | Merkit persistoidaan sessioiden yli — ei kadota sivun päivityksellä |
| V13 | Rooli (järjestäjä\|talkoolainen) ohjaa näkymää — ei kahta sovellusta, vain eri toolbar + paneelit |
| V14 | Korruptoitunut tai tuntematon versio localStorage-datassa → silent reset: console.warn + removeItem + tyhjä tila; ei kaatumista |

## §T Tasks

| id | status | task | cites |
|----|--------|------|-------|
| T1 | ✓ | GPX lataus, reittiviivat kartalla, fitBounds | V7 |
| T2 | ✓ | Perusmerkit 4 tyyppiä: asetus dblclick/toolbar, poisto, bearing-snap | V1,V2,V3,V8 |
| T3 | ✓ | Multi-route: merkki kuuluu useammalle reitille (100m threshold) | V2 |
| T4 | ✓ | Drive mode: 50m step, keyboard nav, progress bar drag, polyline click | V4 |
| T5 | ✓ | Tile-layer vaihto MML/OSM, persistoi | V5 |
| T6 | ✓ | Route tabs: näkyvyys toggle, drive-reitti vaihto, eye-icon | V6 |
| T7  | . | Lisää puuttuvat 2 GPX-reittiä (4 reittiä yhteensä) | §C |
| T8  | ✓ | SignTemplate data model + CRUD logiikka — `src/logic/sign-library.ts`. Tyyppi: `SignTemplate{id,label,shortLabel,color,description}`. Funktiot: createTemplate/updateTemplate/deleteTemplate/listTemplates, in-memory (ei localStorage). SignTemplate on superset SignTypeInfo:lle (sign-picker.ts) — korvaa sen T22-vaiheessa. Testattavuus: Vitest-pure. Käyttäjä: järjestäjä rakentaa, talkoolainen käyttää. Avaa: T9,T22,T27 | V10 |
| T9  | . | Ikonilähde-research: Lucide / Heroicons / custom SVG — päätä ennen T22 | V10 |
| T10 | . | MarkerStatus type + tila-siirtymälogiikka (Vitest-pure): suunniteltu→asetettu→tarkistettu→kerätty\|ei_tarpeen | V9 |
| T11 | . | Paikkaohjeet: vapaa tekstikenttä per merkkiinstanssi (lisätään SignMarker-tyyppiin + UI) | §G |
| T12 | . | Rooli-state localStorage (järjestäjä\|talkoolainen), toggle UI — ei backendiä vielä | V13 |
| T13 | . | Pätkä data model: alku/loppu distanceFromStart per route, jatkuvuus-validointi (Vitest-pure) | V11 |
| T14 | . | Talkoolaisen pätkänäkymä: filtteröity kartta + merkkilista omalta pätkältä | V11,T12,T13 |
| T15 | . | Tilannekuva-logiikka: laske % per status per reitti (Vitest-pure) | V9 |
| T16 | . | Navigointilogiikka: nearestUnsetMarker, distanceToNext (Vitest-pure) | V9 |
| T17 | . | Jälkikäteinen kuittaus: talkoolainen merkkaa listasta useita kerralla | V9,T10 |
| T18 | . | Offline-tuki: oma pätkä ladattavissa (PWA + service worker) | §C |
| T19 | . | Purkupätkä: lähtösuunnan valinta, merkit kerätään käänteisessä järjestyksessä | V11,T10 |
| T20 | . | Kasauspisteet: erikoismerkki "kasa tässä", merkitään haetuksi kerralla | V9,T10 |
| T21 | . | Live tracking v1: laitteen GPS-sijainti näkyvissä itselle kartalla | §C,T30 |
| T22 | . | SignLibrary UI paneeli: järjestäjä luo/muokkaa/poistaa SignTemplateja | T8,T9 |
| T23 | . | Merkin status-kuvake kartalla: SignIcon värikoodi + muoto statuksen mukaan | T10 |
| T24 | . | Talkoolaisen kuittaus-UI: 1 iso nappi (asetettu / ei_tarpeen) — max 2 toimintoa | T10,T12 |
| T25 | . | Pätkä UI kartalla: järjestäjä piirtää välin, visualisoitu viivana reitillä | T13 |
| T26 | . | Pätkä-assign: järjestäjä linkittää pätkän talkoolaiselle (roolitunnus) | T12,T25 |
| T27 | . | Varustelista: auto-laskuri per SignTemplate + manuaali-rivit + ohjeteksti | T8,T14 |
| T28 | . | Tilannekuva-kartta UI: merkit värikoodattu + % per reitti näkyvissä | T15,T23 |
| T29 | ✓ | Merkkien persistointi: `src/logic/persistence.ts` — saveMarkers/loadMarkers, tallennus joka add/remove/updateBearing, lataus init:ssä ennen karttaa, format `{version:1,markers:[]}`, routeIds säilyy vaikka reitti puuttuisi | V12,V14,§I |
| T30 | . | Geolocation API: laitteen sijainti pisteenä kartalla (itselle, ei muille) | §C |
| T31 | . | GPS-drive UI: navigointi lähimpään asettamattomaan merkkiin + kuittaus | T16,T24,T30 |
| T32 | . | Rooli-näkymävalinta UI: toolbar + paneelit eriytyvät roolin mukaan | T12,V13 |
| T33 | ✓ | Arkkitehtuurirefaktorointi: src/logic/, src/map/, src/ui/ hakemistot — siirrä tiedostot | §C |
| T34 | . | GPX-korvaus: varoitus + merge/discard-valinta olemassa oleville merkeille | V1,V2 |
| T35 | . | Yhteinen osuus -visualisointi: korostus kartalla missä reitit jakavat merkin | V2 |
| T36 | . | Kutsukoodi-auth backend: admin generoi koodit, koodi → rooli-assert | T12,V13 |

## §B Bugs

| id | date | cause | fix |
|----|------|-------|-----|
