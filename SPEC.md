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
- `localStorage['karttamaster-markers']` — marker data: `{ version: 1, markers: SignMarker[], lastSyncAt?: string }`
- `GET /api/markers?event=<id>` — hae kaikki merkit tapahtumalle
- `PUT /api/markers/:id` — luo tai päivitä merkki (upsert)
- `DELETE /api/markers/:id` — poista merkki
- `GET /api/events/:id` — tapahtuman metatiedot (GPX-polut jne.)
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
| V15 | Merkki on drag-siirrettävissä kartalla — siirto laskee bearing + routeIds uudelleen uudesta sijainnista (sama logiikka kuin add) |
| V16 | Rotation arm ei häviä tahattomalla karttaklikillä — arm pitää poistaa vain explicit dismiss (Esc, toinen merkki, uusi lisäys) |
| V17 | Merkin tyyppi on vaihdettavissa jälkikäteen ilman delete+redo — kontekstivalikko tai lista |
| V18 | Kun backend käytössä: server on source of truth. localStorage on cache-only. App yrittää aina serveriltä ensin — localStorage fallback vain verkkovian aikana. |
| V19 | Offline-muutos saa `pendingSync: true` flagin. Kun yhteys palaa, `pushPending()` lähettää muutokset serverille automaattisesti ennen muuta operaatiota. |
| V20 | Merge-konflikti (pendingSync > 0 && server muuttunut): käyttäjä päättää — "vaihda kaikki serveriltä" tai "pidä omat muutokset". Ei automaattista merge-logiikkaa per field. |
| V21 | Merkki jonka routeIds on tyhjä ei saa tallentua hiljaa — `MarkerManager.add()` pakottaa vähintään lähimmän reitin routeIds:ään riippumatta etäisyydestä. Näytetään varoitus jos klikki >500m lähimmältä reitiltä. Ei koskaan hiljainen katoaminen. |
| V22 | Kartta-tila 'luonnos' → `GET /api/markers` palauttaa 403 talkoolaiselle. Client näyttää "Kartta valmisteilla" -bannerin. Järjestäjä ja admin pääsevät aina. |
| V23 | Snapshot luodaan automaattisesti aina kun kartta siirtyy 'hyväksytty'-tilaan. Ei voi hyväksyä ilman snapshottia. |
| V24 | Snapshot restore on atominen (SQLite transaction) — kaikki merkit korvataan tai operaatio peruuntuu kokonaan. Restore luo uuden snapshottia ("Palautus: [alkuperäinen label]"). |

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
| T9  | ✓ | Ikonilähde-research: päätös Lucide — TypeScript-natiivi, tree-shakeable, MIT. `lucide` npm-paketti. SignTemplate.iconId = Lucide icon name string. T22 voi edetä. | V10 |
| T10 | ✓ | MarkerStatus type + tila-siirtymälogiikka (Vitest-pure): suunniteltu→asetettu→tarkistettu→kerätty\|ei_tarpeen. Tyyppi `src/logic/types.ts`, logiikka `src/logic/marker-status.ts`. `transitionStatus/canTransition/validActions/isTerminal`. Normalisointi persistence.ts:ssä vanhalle datalle. | V9 |
| T11 | ✓ | Paikkaohjeet: `locationNote?: string` SignMarker-tyyppiin, `updateNote(id, text)` MarkerManageriin, inline-input marker-listassa, tallentuu automaattisesti (blur/Enter), XSS-safe (DOM-assign) | §G |
| T12 | ✓ | Rooli-state + toggle UI. Logiikka: `src/logic/role.ts` — `type Role = 'järjestäjä' \| 'talkoolainen'`, `getRole(): Role` (localStorage, default `'järjestäjä'`), `setRole(r: Role): void` (persist). Toggle-nappi toolbariin: `src/ui/role-selector.ts`, vaihtaa roolia yhdellä klikillä, active = accent-highlight (DESIGN.md §K role-toggle). Ei piilota/näytä mitään vielä — se on T32. localStorage: vi.stubGlobal-mock (CLAUDE.md). Testattavuus: Vitest-pure (logic), Vitest-jsdom (toggle). Käyttäjä: molemmat. Avaa: T24, T32. | V13 |
| T13 | . | Pätkä data model: alku/loppu distanceFromStart per route, jatkuvuus-validointi (Vitest-pure) | V11 |
| T14 | . | Talkoolaisen pätkänäkymä: filtteröity kartta + merkkilista omalta pätkältä | V11,T12,T13 |
| T15 | . | Tilannekuva-logiikka: laske % per status per reitti (Vitest-pure) | V9 |
| T16 | ✓ | Navigointilogiikka: uusi `src/logic/navigation.ts`. `nearestUnsetMarker(markers: SignMarker[], currentDist: number, routeId: string): SignMarker | null` — pienin |distanceFromStart−currentDist| jolla status==='suunniteltu' JA routeIds sisältää routeId. `distanceToNext(markers: SignMarker[], currentDist: number, routeId: string): number | null` — etäisyys metreinä lähimpään 'suunniteltu'-merkkiin, null jos ei löydy. Testattavuus: Vitest-pure (pakollinen). Käyttäjä: talkoolainen. Avaa: T31. | V9 |
| T17 | . | Jälkikäteinen kuittaus: talkoolainen merkkaa listasta useita kerralla | V9,T10 |
| T18 | . | Offline-tuki: oma pätkä ladattavissa (PWA + service worker) | §C |
| T19 | . | Purkupätkä: lähtösuunnan valinta, merkit kerätään käänteisessä järjestyksessä | V11,T10 |
| T20 | . | Kasauspisteet: erikoismerkki "kasa tässä", merkitään haetuksi kerralla | V9,T10 |
| T21 | . | Live tracking v1: laitteen GPS-sijainti näkyvissä itselle kartalla | §C,T30 |
| T22 | . | SignLibrary UI paneeli: järjestäjä luo/muokkaa/poistaa SignTemplateja | T8,T9 |
| T23 | ✓ | Merkin status-kuvake kartalla: `createSignIcon(type, bearing, status)` — opacity 0.45 suunniteltu / 1.0 muut + 8px status-piste oik. alakulmaan (`#4ade80` asetettu, `#93c5fd` tarkistettu, `#fbbf24` ei_tarpeen, piilotettu suunniteltu). Ei muotomuutosta, ei tekstiä merkillä. | T10 |
| T24 | ✓ | Talkoolaisen kuittaus-UI: 1 iso nappi (asetettu / ei_tarpeen) — max 2 toimintoa | T10,T12 |
| T25 | . | Pätkä UI kartalla: järjestäjä piirtää välin, visualisoitu viivana reitillä | T13 |
| T26 | . | Pätkä-assign: järjestäjä linkittää pätkän talkoolaiselle (roolitunnus) | T12,T25 |
| T27 | . | Varustelista: auto-laskuri per SignTemplate + manuaali-rivit + ohjeteksti | T8,T14 |
| T28 | . | Tilannekuva-kartta UI: merkit värikoodattu + % per reitti näkyvissä | T15,T23 |
| T29 | ✓ | Merkkien persistointi: `src/logic/persistence.ts` — saveMarkers/loadMarkers, tallennus joka add/remove/updateBearing, lataus init:ssä ennen karttaa, format `{version:1,markers:[]}`, routeIds säilyy vaikka reitti puuttuisi | V12,V14,§I |
| T30 | ✓ | Geolocation API: laitteen sijainti pisteenä kartalla (itselle, ei muille) | §C |
| T31 | . | GPS-drive UI: navigointi lähimpään asettamattomaan merkkiin + kuittaus | T16,T24,T30 |
| T32 | ✓ | Rooli-näkymävalinta UI: toolbar + paneelit eriytyvät roolin mukaan | T12,V13 |
| T33 | ✓ | Arkkitehtuurirefaktorointi: src/logic/, src/map/, src/ui/ hakemistot — siirrä tiedostot | §C |
| T34 | . | GPX-korvaus: varoitus + merge/discard-valinta olemassa oleville merkeille | V1,V2 |
| T35 | . | Yhteinen osuus -visualisointi: korostus kartalla missä reitit jakavat merkin | V2 |
| T36 | ✓ | Auth-reittit + käyttäjähallinta: `POST /api/auth/login` (username+password → httpOnly cookie sessio, bcrypt), `POST /api/auth/code-login` (talkoolainen-koodi → 24h sessio, uusittavissa), `POST /api/auth/logout`, `GET /api/auth/me`. Invite-flow järjestäjälle: `POST /api/admin/invites` (admin luo token), `GET /api/auth/invite/:token`, `POST /api/auth/register` (one-time). Talkoolainen-koodit: `POST /api/admin/codes` (bulk, `{code,display_name,segment_id?}`), `GET /api/admin/codes`, `DELETE /api/admin/codes/:code`. `GET /api/admin/users` (admin). `server/routes/auth.ts`. Bun integraatiotestit. Vaatii T41. Käyttäjä: molemmat. Avaa: T51. | T41,V13 |
| T37 | ✓ | Drag-to-move merkki: `marker.options.draggable = true` MarkerManager.add()-vaiheessa. `dragend` → uusi LatLng → `assignRoutesToMarker` (V21: pakota lähimmän reitin id jos [] palautuu) → päivitä routeIds + laske bearing uudelleen → päivitä Leaflet-ikoni → `saveMarkers`. Varoitusbanneri jos >500m reitistä (sama kuin T44). `src/map/markers.ts`. Käyttäjä: järjestäjä (desktop/hiiri). Testattavuus: Playwright — drag-testi `e2e/critical-paths.spec.ts`. | V15,V1,V2,V21 |
| T38 | . | Vaihda merkin tyyppi: kontekstivalikosta tai listasta — ei delete+redo. Päivittää ikonia kartalla + listaa | V17 |
| T39 | . | Drive mode "hyppää seuraavaan merkkiin": nappi joka siirtyy seuraavan merkin distanceFromStart-kohtaan aktiivisella reitillä — ei GPS-riippuvainen, toimii jo nyt ilman T30 | T4 |
| T40 | ✓ | Rotation arm sticky: poista `handleArmOutsideClick` document-mousedown/touchstart kokonaan. Lisää `handleEscKey` (keydown Escape → `disarm()`). `arm(id)` kutsuu `this.disarm()` alussa → "toinen merkki" + "uusi lisäys" hoidettu automaattisesti. Arm poistuu vain: Esc / arm() uudelleen. Ei poistu karttaklikistä. `src/map/marker-interaction.ts`. Käyttäjä: järjestäjä (desktop). Testattavuus: Playwright — arm-sticky-testi `e2e/critical-paths.spec.ts` (karttaklikki ei poista armia, Esc poistaa). | V16 |
| T41 | ✓ | Backend server-perusta: Hono + Bun + SQLite. `server/index.ts` (Hono app + routes wiring), `server/db.ts` (SQLite yhteys + schema init, idempotent). Schema: `users, sessions, talkoolainen_codes, markers, map_state, snapshots` — katso `docs/components/backend.md`. Seed admin: luo 'admin'-käyttäjä env:stä (`ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`) jos ei ole — idempotent deploy. Auth-middleware: `server/middleware/auth.ts` (session cookie check + role gate). `GET /api/health` → 200. Bun integraatiotestit, in-memory SQLite. Avaa: T36, T47, T48. | V18,V19 |
| T42 | ✓ | Sync-logiikka: `src/logic/sync.ts` — online-first, localStorage cache. `syncMarkers()`: fetch serveriltä → päivitä localStorage → palauta. `pushPending()`: lähetä pendingSync-merkit serverille. Vitest-pure (mock fetch). | V18,V19,T41 |
| T43 | . | Merge-konflikti UI: jos `pendingSync > 0` ja server on muuttunut → dialog: "X merkkiä muuttunut serverillä — vaihda kaikki / pidä omat X muutosta". Per-marker merge ei MVP:ssä. Vitest-jsdom. | V20,T42 |
| T44 | ✓ | Ghost marker fix: `MarkerManager.add()` pakottaa lähimmän reitin id routeIds:ään jos assignRoutesToMarker palauttaa []. Näytä varoitusbanneri kartalla jos merkki >500m reitistä. Vitest-pure (logiikka), Playwright (banneri). | V21,V1 |
| T45 | ✓ | Touch targets mobile: route-tab-napit (35km/55km) ja eye-icon-toggle ≥44px korkeus mobiililla. Playwright (375px viewport, kaikki napit ≥44px). | §C |
| T46 | ✓ | Playwright E2E -perusta: `playwright.config.ts` webServer-config, `e2e/`-hakemisto, 3 kriittistä polkua: (1) merkki asetetaan kartalle → näkyy listassa, (2) drive mode käynnistyy + navigoi, (3) rooli-toggle muuttaa toolbaria. | §C |
| T47 | ✓ | Markers REST API role-gatella: `GET /api/markers` (403 jos luonnos+talkoolainen, V22), `POST /api/markers` (järjestäjä+), `PUT /api/markers/:id` (status: kaikki autentikoidut; lat/lon/bearing/type: järjestäjä+), `DELETE /api/markers/:id` (järjestäjä+). `updated_by = session.display_name`. `server/routes/markers.ts`. Bun integraatiotestit (role gate per endpoint). Vaatii T41, T36. Käyttäjä: molemmat. Avaa: T42. | V18,V19,V22 |
| T48 | ✓ | Kartta-tila API: `GET /api/admin/map-state` → `{status,approved_at?,approved_by?}`. `POST /api/admin/map-state {status}` (järjestäjä+) → jos 'hyväksytty': luo automaattinen snapshot (V23) + tallentaa `approved_at` + `approved_by`. `server/routes/admin.ts`. Bun integraatiotestit (approve luo snapshot). Vaatii T41, T36, T47. Käyttäjä: järjestäjä. Avaa: T49, T50. | V22,V23 |
| T49 | . | Kartta-tila UI: 'LUONNOS'/'HYVÄKSYTTY' -badge toolbariin (järjestäjä näkee tilan). Järjestäjälle 'Hyväksy kartta' -nappi (confirm dialog → `POST /api/admin/map-state`). `PersistenceLayer.syncMarkers()` saa 403 → näyttää 'Kartta valmisteilla' -bannerin talkoolaiselle (sama tyyli kuin distance-warning). `src/ui/map-state-badge.ts`. Vitest-jsdom. Vaatii T48, T32. Käyttäjä: järjestäjä (badge + approve), talkoolainen (banneri). | V22,V13 |
| T50 | . | Snapshot API + UI: `GET /api/admin/snapshots` (max 20, vanhimmat poistetaan automaattisesti), `POST /api/admin/snapshots` (manual, `{label?}`), `POST /api/admin/snapshots/:id/restore` (atominen transaction: korvaa kaikki merkit + luo "Palautus: ..."-snapshot, V24). Auto-snapshot: yöllinen (Bun setInterval klo 03:00 UTC). UI: `src/ui/snapshot-panel.ts` — lista + 'Palauta tämä versio' -nappi. Vitest-jsdom. Vaatii T41, T36, T48. Käyttäjä: järjestäjä. | V23,V24 |
| T51 | ✓ | Auth screen ennen karttaa: `src/ui/auth-screen.ts`. App käynnistyy → `GET /api/auth/me` → 401 → näytä login-lomake (toggle: 'Järjestäjä' username+password / 'Talkoolainen' koodi-kenttä). Onnistunut login → piilota lomake, näytä kartta + set role. Virheviesti väärästä tunnuksesta/koodista. Vitest-jsdom (lomake + toggle + virheviesti). Playwright: login-flow kriittinen polku (`e2e/critical-paths.spec.ts`). Vaatii T36. Käyttäjä: molemmat. | V13,T36 |

## §UX Kenttämuistio

UX-simulaatio 2026-06-07. Kaksi roolia läpikäyty — löydöt kirjattu taskeihin ja invariantteihin.

### Talkoolainen metsässä — kriittiset kitkat

| kitka | vakavuus | task |
|-------|----------|------|
| Ei GPS-pistettä — ei tiedä missä on kartalla | kriittinen | T30 |
| Ei kuittaustoimintoa — ei voi merkitä asetetuksi | kriittinen | T24 |
| Kaikki merkit näyttää samalta — ei status-värikoodausta | suuri | T23 |
| Ei "seuraava asettamaton" -navigointia — selaa koko lista | suuri | T16, T31 |
| Drive mode 50m askeleet = hidas hypätä merkkien välillä | pieni | T39 |
| Tupla-klik hanskat kädessä — epätarkka kohdennus | pieni | — |

### Järjestäjä toimistossa — kriittiset kitkat

| kitka | vakavuus | task |
|-------|----------|------|
| Drag-to-move puuttuu — väärässä paikassa → delete + redo | suuri | T37 |
| Rotation arm häviää ulkoklikillä — turha reset | suuri | T40 |
| Ei tyypin vaihto-toimintoa — väärä tyyppi → delete + redo | suuri | T38 |
| Ei kokonaistilannekuvaa — ei merkkimäärää per reitti helposti | suuri | T15, T28 |

### Hyvää (säilytä)

- Tupla-klik + floating picker — nopea desktop-flow ✓
- Automaattinen bearing — ei tarvitse säätää manuaalisesti ✓
- Rotation arm aktivoituu heti lisäyksen jälkeen ✓
- Marker-lista etäisyysjärjestyksessä ✓
- Escape-chain toimii loogisesti läpi koko UI:n ✓
- Reitin vaihto + näkyvyystoggle toimii ✓

---

## §B Bugs

| id | date | cause | fix |
|----|------|-------|-----|
| B1 | 2026-06-07 | `MarkerManager.add()` käyttää `assignRoutesToMarker` (100m threshold) routeIds:lle mutta ei fallback-logiikkaa — klikki >100m reitistä → routeIds:[], merkki tallentuu mutta katoaa hiljaa | V21 → T44 |
| B2 | 2026-06-07 | `PlaceMode.exit()` asettaa btnAddSign.textContent = '+ Lisää merkki' eikä alkuperäiseen '+ Merkki' — teksti ei resetoidu oikeaksi | T44 (samalla korjauksella) |
| B3 | 2026-06-07 | Route-tab-napit ja eye-icon-toggle ≤30px korkeus mobiililla (375px viewport) — alle 44px touch target | V21→T45 |
