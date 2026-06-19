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
- `POST /api/segments` — luo/upsert segmentti (järjestäjä+)
- `PUT /api/segments/:id` — päivitä segmentti (järjestäjä+)
- `DELETE /api/segments/:id` — poista segmentti (järjestäjä+)
- `GET /api/segments/by-code/:code` — talkoolaisen oma pätkä (auth vaaditaan)
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
| V13 | Järjestäjä ja talkoolainen ovat täysin erilliset näkymät ja flow — eri URL, eri autentikaatio, eri layout. Ei rooli-togglea kummallekaan. Järjestäjä ei näe talkoolaisen UI:ta. Talkoolainen avautuu suoraan omaan pätkänäkymään hash-URL:sta. |
| V14 | Korruptoitunut tai tuntematon versio localStorage-datassa → silent reset: console.warn + removeItem + tyhjä tila; ei kaatumista |
| V15 | Merkki on drag-siirrettävissä kartalla — siirto laskee bearing + routeIds uudelleen uudesta sijainnista (sama logiikka kuin add) |
| V16 | Rotation arm ei häviä tahattomalla karttaklikillä — arm pitää poistaa vain explicit dismiss (Esc, toinen merkki, uusi lisäys) |
| V17 | Merkin tyyppi on vaihdettavissa jälkikäteen ilman delete+redo — kontekstivalikko tai lista |
| V18 | Backend on ainoa totuus. Merkit kirjoitetaan suoraan `POST/PUT/DELETE /api/markers` — ei localStorage-välivaihetta. `GET /api/markers` palauttaa kaikki merkit kaikille autentikoituneille käyttäjille. |
| V21 | Merkki jonka routeIds on tyhjä ei saa tallentua hiljaa — `MarkerManager.add()` pakottaa vähintään lähimmän reitin routeIds:ään riippumatta etäisyydestä. Näytetään varoitus jos klikki >500m lähimmältä reitiltä. Ei koskaan hiljainen katoaminen. |
| V22 | Poistettu — kartta-tila-gate poistettu. Kaikki autentikoidut käyttäjät näkevät merkit aina. Snapshots ovat itsenäinen backup-mekanismi ilman hyväksymiskytkentää. |
| V24 | Snapshot restore on atominen (SQLite transaction) — kaikki merkit korvataan tai operaatio peruuntuu kokonaan. Restore luo uuden snapshottia ("Palautus: [alkuperäinen label]"). |
| V25 | Segment kattaa kaikki reitit (routeIds[]) jotka kulkevat sen fyysisen osuuden läpi. Talkoolainen käsittelee merkin kerran — kuittaus koskee koko merkkiä, ei per-route. Merkillä on yksi status riippumatta routeIds-määrästä. |
| V26 | Pätkällä on `phase: 'asettaminen' \| 'purku'`. Asettaminen ja purku ovat erillisiä pätkäjakoja — sama fyysinen osuus voi olla eri talkoolaisella eri vaiheissa. |
| V27 | `/s/<koodi>` URL ohjaa talkoolaisen suoraan omaan pätkänäkymään auto-autentikoinnilla — koodi pre-täyttää T51:n kirjautumislomakkeen ja skippaavat manuaalisen syötön. |
| V28 | Purku bulk-kuittaus on atominen: "merkitse kaikki kerätyksi" siirtää pätkän kaikki ei-terminal-merkit kerätty-tilaan yhdessä operaatiossa tai ei yhtään. |
| V29 | Auth-screen ei saa kutsua `onAuthenticated` ilman onnistunutta `/api/auth/me`- tai `/api/auth/login`-vastausta. Verkkovirhe tai non-401 → näytä kirjautumislomake. Ei silent skip. Dev-ympäristö ilman backendiä → lomake näkyy, ei ohita. |
| V30 | Segmentit persistoidaan backendiin. localStorage ei enää käytetä segmenteille — V36 on koko totuus. |
| V31 | Pätkän luontivaiheessa ensimmäinen klikattu piste visualisoidaan kartalla (väliaikainen markkeri) kunnes toinen piste klikataan tai luonti peruutetaan (Esc). |
| V32 | Pätkän startDist ja endDist ovat muokattavissa luonnin jälkeen — piste on siirrettävissä kartalla tai numeerisesti panelissa. Poista+redo ei ole ainoa vaihtoehto. |
| V33 | Kun rooli=talkoolainen JA talkoolainenCode on asetettu: merkki-modaali (☰ Lista) näyttää vain `getMarkersForSegment(seg, markers)` — ei globaalia listaa. Järjestäjälle näytetään aina kaikki. |
| V34 | Kun järjestäjä tallentaa `assignedCode` segmentille → `POST /api/admin/codes {code, display_name, segment_id}` kutsutaan välittömästi. Kun `assignedCode` poistetaan → `DELETE /api/admin/codes/:code`. `Segment.assignedCode` ja `talkoolainen_codes`-taulu pysyvät synkronissa — koodi löytyy backendistä ennen kuin URL jaetaan. API-virhe → älä päivitä localStoragea, näytä virheviesti. |
| V35 | `saveSegments` tallennusvirhe (quota exceeded tai write error) → älä ignoroi hiljaa. Kutsu virhe-callback tai heitä error; UI näyttää varoitusbannerin. Segment-data ei saa hävitä käyttäjältä näkymättömästi. |
| V36 | Segmentit persistoidaan backendiin (`segments`-taulu). Järjestäjä hallinnoi `/api/admin/segments` CRUD. Talkoolainen hakee oman pätkänsä `GET /api/segments/by-code/:code` auth-cookiella — ei tarvitse clientin localStoragea pätkädatan saamiseen. localStorage on vain cache. |
| V37 | Poistettu — inline expand/collapse korvattu modaaliksi (T69). Modal-pattern ei kärsi render()-nollausongelmasta. |
| V38 | Kaikki segment-kentän muutokset (description, equipment, assignedCode, startDist, endDist) tallentuvat sekä localStorage:en (`saveSegments`) että backendiin (`updateSegmentRemote`) — ei osittaisia tallennuksia. |
| V39 | Backend-sessio on roolin lähde. `RoleSelector`-nappi ei saa näkyä kummallekaan roolille kun `lockedRole` on asetettu — ei järjestäjälle eikä talkoolaiselle (V13). `setRole()` ei saa ylikirjoittaa backend-roolia. |
| V40 | `AuthScreen.start()` kutsuu `this.show()` ennen ensimmäistä `fetch`-kutsua — karttanäkymä ei saa olla näkyvissä ennen kuin auth on ratkaistu. Onnistunut `/api/auth/me` (200) → `this.hide()` ennen `onAuthenticated`-kutsua. |
| V41 | GPX-tiedostot voivat päivittyä milloin tahansa — reittimerkki (SignMarker) ei ole sidottu GPX-pisteisiin. Merkit säilyvät GPX-päivityksessä. `distanceFromStart` ja `bearing` lasketaan uudelleen uudesta GPX:stä (snap lähimpään pisteeseen). |
| V42 | Kaikki talkoolaisten URL:t ovat hash-pohjaisia — ei sekvenssimäisiä, ei arvattavissa. `/s/<hash>` pre-täyttää auth-screen koodi-kentän ja triggeraa auto-login. Järjestäjä generoi hash:n, jakaa WhatsAppilla tai QR-koodina. |
| V43 | Talkoolainen voi muokata hänelle assignatun pätkän `startDist`/`endDist` kentällä — laajentaa tai lyhentää. Järjestäjä voi yliajaa muutoksen milloin tahansa. Muutos tallentuu backendiin (`PUT /api/segments/:id`). |

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
| T13 | ✓ | Segment type + logiikka: `{id, routeIds: string[], startDist: number, endDist: number, assignedCode?: string, displayName?: string, description?: string, equipment: EquipmentItem[], phase: 'asettaminen'\|'purku'}`. `EquipmentItem: {name: string, count: number}`. Funktiot `src/logic/segments.ts`: `createSegment / updateSegment / deleteSegment / getSegmentsForPhase(segments, phase) / getSegmentForCode(segments, code) / getMarkersForSegment(segment, markers)` — filtteröi routeIds-leikkauksella + distanceFromStart-rangella. Jatkuvuus-validointi (V11). Vitest-pure. Käyttäjä: järjestäjä luo, talkoolainen kuluttaa. Avaa: T14,T25,T26,T27,T52. | V11,V25,V26 |
| T14 | ✓ | Talkoolaisen pätkänäkymä: filtteröity kartta + merkkilista vain oman pätkän merkeistä (`getMarkersForSegment` T13). Näyttää varustelistan (T27) + järjestäjän description-kentän. URL `/s/<koodi>` → auto-auth T51:n code-login → suoraan näkymään (V27, T53). Yhteinen osuus: kaikkien routeIds-reittien merkit yhdessä listassa — yksi merkki kerran (V25). `src/ui/segment-view.ts` (uusi komponentti). Vitest-jsdom. Käyttäjä: talkoolainen. §K-sopimus lisätään DESIGN.md:hen ennen rakennusta. | V11,V25,T12,T13 |
| T15 | ✓ | Tilannekuva-logiikka: laske % per status per reitti (Vitest-pure) | V9 |
| T16 | ✓ | Navigointilogiikka: uusi `src/logic/navigation.ts`. `nearestUnsetMarker(markers: SignMarker[], currentDist: number, routeId: string): SignMarker | null` — pienin |distanceFromStart−currentDist| jolla status==='suunniteltu' JA routeIds sisältää routeId. `distanceToNext(markers: SignMarker[], currentDist: number, routeId: string): number | null` — etäisyys metreinä lähimpään 'suunniteltu'-merkkiin, null jos ei löydy. Testattavuus: Vitest-pure (pakollinen). Käyttäjä: talkoolainen. Avaa: T31. | V9 |
| T17 | . | Jälkikäteinen kuittaus: talkoolainen merkkaa listasta useita kerralla | V9,T10 |
| T18 | . | Offline-tuki: oma pätkä ladattavissa (PWA + service worker) | §C |
| T19 | . | Purkupätkä: lähtösuunnan valinta, merkit kerätään käänteisessä järjestyksessä | V11,T10 |
| T20 | . | Kasauspisteet: erikoismerkki "kasa tässä", merkitään haetuksi kerralla | V9,T10 |
| T21 | . | Live tracking v1: laitteen GPS-sijainti näkyvissä itselle kartalla | §C,T30 |
| T22 | . | SignLibrary UI paneeli: järjestäjä luo/muokkaa/poistaa SignTemplateja | T8,T9 |
| T23 | ✓ | Merkin status-kuvake kartalla: `createSignIcon(type, bearing, status)` — opacity 0.45 suunniteltu / 1.0 muut + 8px status-piste oik. alakulmaan (`#4ade80` asetettu, `#93c5fd` tarkistettu, `#fbbf24` ei_tarpeen, piilotettu suunniteltu). Muoto on aina teardrop (ympyrä + kiinteä kärki). Ei status-perusteista muotomuutosta, ei tekstiä merkillä. | T10 |
| T24 | ✓ | Talkoolaisen kuittaus-UI: 1 iso nappi (asetettu / ei_tarpeen) — max 2 toimintoa | T10,T12 |
| T25 | ✓ | SegmentPanel + karttavisualisointi: (a) järjestäjä klikkaa kaksi pistettä reittiviivalta → luo pätkän, pisteitä voi siirtää jälkikäteen; (b) kaikki pätkät värillisinä kaistoina kartalla + talkoolaisen displayName-overlay; (c) aukot (ei-jaetut osuudet) harmaana. Leaflet polyline overlay `src/map/segment-overlay.ts`. Panel `src/ui/segment-panel.ts`. Playwright (karttainteraktio). Käyttäjä: järjestäjä. §K-sopimus lisätään DESIGN.md:hen ennen rakennusta. | T13,V11 |
| T26 | ✓ | Assign + URL-generointi: järjestäjä syöttää assignedCode + displayName → syntyy URL `/s/<koodi>` + kopiointinappi. Segment.assignedCode + displayName tallennetaan (T13). Assign-flow `src/ui/segment-panel.ts`:ssä (sama paneeli kuin T25). Vitest-jsdom. Käyttäjä: järjestäjä. | T12,T25,V27 |
| T27 | ✓ | Varustelista: auto-laskuri merkkityypeittäin per pätkä + manuaali-rivit (EquipmentItem[]) + ohjeteksti. Järjestäjä muokkaa `segment-panel.ts` "Lisätiedot & varusteet" -osiossa. Talkoolainen näkee readonly `segment-view.ts`:ssä. Vitest-pure (segment-sync), Vitest-jsdom (segment-persistence). | T8,T14 |
| T28 | ✓ | Tilannekuva-kartta UI: merkit värikoodattu + % per reitti näkyvissä | T15,T23 |
| T29 | ✓ | Merkkien persistointi: `src/logic/persistence.ts` — saveMarkers/loadMarkers, tallennus joka add/remove/updateBearing, lataus init:ssä ennen karttaa, format `{version:1,markers:[]}`, routeIds säilyy vaikka reitti puuttuisi | V12,V14,§I |
| T30 | ✓ | Geolocation API: laitteen sijainti pisteenä kartalla (itselle, ei muille) | §C |
| T31 | ✓ | GPS-drive UI: navigointi lähimpään asettamattomaan merkkiin + kuittaus | T16,T24,T30 |
| T32 | ✓ | Rooli-näkymävalinta UI: toolbar + paneelit eriytyvät roolin mukaan | T12,V13 |
| T33 | ✓ | Arkkitehtuurirefaktorointi: src/logic/, src/map/, src/ui/ hakemistot — siirrä tiedostot | §C |
| T34 | . | GPX-korvaus: varoitus + merge/discard-valinta olemassa oleville merkeille | V1,V2 |
| T35 | . | Yhteinen osuus -visualisointi: korostus kartalla missä reitit jakavat merkin | V2 |
| T36 | ✓ | Auth-reittit + käyttäjähallinta: `POST /api/auth/login` (username+password → httpOnly cookie sessio, bcrypt), `POST /api/auth/code-login` (talkoolainen-koodi → 24h sessio, uusittavissa), `POST /api/auth/logout`, `GET /api/auth/me`. Invite-flow järjestäjälle: `POST /api/admin/invites` (admin luo token), `GET /api/auth/invite/:token`, `POST /api/auth/register` (one-time). Talkoolainen-koodit: `POST /api/admin/codes` (bulk, `{code,display_name,segment_id?}`), `GET /api/admin/codes`, `DELETE /api/admin/codes/:code`. `GET /api/admin/users` (admin). `server/routes/auth.ts`. Bun integraatiotestit. Vaatii T41. Käyttäjä: molemmat. Avaa: T51. | T41,V13 |
| T37 | ✓ | Drag-to-move merkki: `marker.options.draggable = true` MarkerManager.add()-vaiheessa. `dragend` → uusi LatLng → `assignRoutesToMarker` (V21: pakota lähimmän reitin id jos [] palautuu) → päivitä routeIds + laske bearing uudelleen → päivitä Leaflet-ikoni → `saveMarkers`. Varoitusbanneri jos >500m reitistä (sama kuin T44). `src/map/markers.ts`. Käyttäjä: järjestäjä (desktop/hiiri). Testattavuus: Playwright — drag-testi `e2e/critical-paths.spec.ts`. | V15,V1,V2,V21 |
| T38 | ✓ | Vaihda merkin tyyppi: kontekstivalikosta tai listasta — ei delete+redo. Päivittää ikonia kartalla + listaa | V17 |
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
| T49 | ✓ | Kartta-tila UI: 'LUONNOS'/'HYVÄKSYTTY' -badge toolbariin (järjestäjä näkee tilan). Järjestäjälle 'Hyväksy kartta' -nappi (confirm dialog → `POST /api/admin/map-state`). `PersistenceLayer.syncMarkers()` saa 403 → näyttää 'Kartta valmisteilla' -bannerin talkoolaiselle (sama tyyli kuin distance-warning). `src/ui/map-state-badge.ts`. Vitest-jsdom. Vaatii T48, T32. Käyttäjä: järjestäjä (badge + approve), talkoolainen (banneri). | V22,V13 |
| T50 | ✓ | Snapshot API + UI: `GET /api/admin/snapshots` (max 20, vanhimmat poistetaan automaattisesti), `POST /api/admin/snapshots` (manual, `{label?}`), `POST /api/admin/snapshots/:id/restore` (atominen transaction: korvaa kaikki merkit + luo "Palautus: ..."-snapshot, V24). Auto-snapshot: yöllinen (Bun setInterval klo 03:00 UTC). UI: `src/ui/snapshot-panel.ts` — lista + 'Palauta tämä versio' -nappi. Vitest-jsdom. Vaatii T41, T36, T48. Käyttäjä: järjestäjä. | V23,V24 |
| T51 | ✓ | Auth screen ennen karttaa: `src/ui/auth-screen.ts`. App käynnistyy → `GET /api/auth/me` → 401 → näytä login-lomake (toggle: 'Järjestäjä' username+password / 'Talkoolainen' koodi-kenttä). Onnistunut login → piilota lomake, näytä kartta + set role. Virheviesti väärästä tunnuksesta/koodista. Vitest-jsdom (lomake + toggle + virheviesti). Playwright: login-flow kriittinen polku (`e2e/critical-paths.spec.ts`). Vaatii T36. Käyttäjä: molemmat. | V13,T36 |
| T52 | ✓ | Purku-pätkäjako + bulk-kuittaus: järjestäjä luo purku-vaiheen pätkäjaon (`phase: 'purku'`, T13) — eri jako kuin asettaminen. Talkoolainen voi kuitata merkit yksitellen (V9) TAI bulk: "Merkitse kaikki kerätyksi" -nappi → atominen `bulkCollect(segment, markers)` → kaikki ei-terminal-merkit → kerätty (V28). Retroaktiivinen: toimii jälkikäteen ilman per-merkki-kuittailua. `src/logic/segment-actions.ts` (`bulkCollect`). Bulk-UI: iso nappi `src/ui/segment-view.ts`:ssä (T14). Vitest-pure (logiikka) + Vitest-jsdom (UI). Käyttäjä: talkoolainen purku-vaiheessa. | V9,V26,V28,T13,T14 |
| T53 | ✓ | URL-reititys: `/s/<koodi>` deep-link → `src/ui/auth-screen.ts` lukee `window.location.pathname` käynnistyksessä, poimi koodi → pre-täytä koodi-kenttä + automaattinen submit → suoraan talkoolaisen pätkänäkymään (T14). Ei erillistä backend-reittiä — SPA client-side URL-handling, nginx fallback `try_files $uri /index.html`. Vitest-jsdom (URL-parsinta + auto-fill). Käyttäjä: talkoolainen. | V27,T51,T14 |
| T54 | ✓ | Auth fallback -korjaus: `auth-screen.ts` — poista silent skip (rivit 48–53). Verkkovirhe tai non-401 → `this.show()` (kirjautumislomake näkyviin), ei `onAuthenticated`. Dev-ympäristö ilman backendiä: käyttäjä näkee lomakkeen. Vitest-jsdom: testi jossa fetch heittää NetworkError → lomake näkyy, `onAuthenticated` ei kutsuta. | V29,T51 |
| T55 | ✓ | Segmenttien persistointi: `src/logic/segment-persistence.ts` — `saveSegments(store)/loadSegments(): SegmentStore`. Format `{version:1,segments:Segment[]}`. localStorage-avain `karttamaster-segments`. Korruptoitunut data → silent reset (V14). Kutsu `saveSegments` jokaisen `createSegment/updateSegment/deleteSegment`-kutsun jälkeen. Lataa `loadSegments()` `init()`-vaiheessa ennen karttaa. Vitest-pure (localStorage-mock). | V30,V14,T13 |
| T56 | ✓ | Pätkän luonti-UX: (a) ensimmäisen klikkauksen jälkeen näytä väliaikainen markkeri kartalla (L.circleMarker, punainen) — häviää kun toinen piste klikataan tai Esc. (b) Pätkärivillä "Muokkaa pisteitä" -nappi → siirrä overlay-pisteet drag-to-reposition -moodiin. `src/ui/segment-panel.ts` + `src/map/segment-overlay.ts`. Playwright (luonti-flow). | V31,V32,T25 |
| T57 | ✓ | Snapshot-paneeli collapsible: oletuksena supistettu (vain "Varmuuskopiot (N)" -otsikko + expand-nappi). Laajenee klikillä. Tieto-elementit eivät vie tilaa oletuksena. `src/ui/snapshot-panel.ts`. Vitest-jsdom. | T50 |
| T58 | ✓ | Talkoolaisen marker-modaali filtteröity: `openMarkerModal` `src/main.ts`:ssä — jos `talkoolainenCode` asetettu JA pätkä löytyy, kutsu `renderMarkerList(markerManager, highlightId, segmentMarkerIds)` jossa `segmentMarkerIds = Set<string>` pätkän merkki-id:t. `renderMarkerList` suodattaa: talkoolaiselle näytetään vain pätkän merkit. Vitest-jsdom (renderMarkerList suodatus). | V33,T13,T14,T25 |
| T59 | ✓ | Assign-sync fix: `segment-panel.ts` `saveBtn`-klikissä kutsu `POST /api/admin/codes {code, display_name, segment_id}` — vasta onnistuneen vastauksen jälkeen kutsu `updateSegment` + `saveSegments`. `Muuta`-napissa kutsu `DELETE /api/admin/codes/:code` — onnistumisen jälkeen `updateSegment(..., {assignedCode: undefined})`. API-virhe → näytä virheviesti assign-osiossa, älä päivitä localStoragea. Vitest-jsdom (fetch-mock: onnistunut save, save epäonnistuu → ei localStorage-muutosta, delete). Käyttäjä: järjestäjä. | V34,T26,T36 |
| T60 | ✓ | `saveSegments` error handling: `onError?: (err: unknown) => void` callback `saveSegments`-funktioon. Virhe catch-blokissa kutsuu `onError` eikä ignoroi hiljaa. `SegmentPanel` välittää `onSaveError`-callback `main.ts`:stä — virhe näyttää varoitusbannerin. Vitest-pure (saveSegments + onError-mock). | V35,T55 |
| T61 | ✓ | Segments backend: `segments`-taulu `server/db.ts`:ään. `POST /api/segments` (upsert, järjestäjä+), `PUT /api/segments/:id`, `DELETE /api/segments/:id`. `GET /api/segments/by-code/:code` (talkoolainen). `server/routes/segments.ts`. Bun integraatiotestit (9 testiä). | V36,T41,T36 |
| T62 | ✓ | Segment sync client: `src/logic/segment-sync.ts` — `fetchSegmentByCode/pushSegment/updateSegmentRemote/deleteSegmentRemote`. `segment-panel.ts` create/update/delete pushes to backend (best-effort). `init(code)` fetchaa segmentin serveriltä, päivittää localStorage-cachen. Vitest-pure (mock fetch, 9 testiä). | V36,T61,T55 |
| T63 | ✓ | Poista map-state gate: `GET /api/markers` palauttaa merkit kaikille autentikoituneille ilman map-state-tarkistusta. Poistettu: V22 (403-logiikka), `POST /api/admin/map-state`, `GET /api/admin/map-state`, `showMapNotReadyBanner`, `MapStateBadge` approve-nappi. Snapshots säilyy itsenäisenä. | V18,V22 |
| T64 | ✓ | Markers direct-write: `MarkerManager` kirjoittaa suoraan `POST/PUT/DELETE /api/markers` — ei localStorage-välivaihetta. `add()→POST`, `remove()→DELETE`, `updateStatus/Type/Note/dragend→PUT`. Bearing-tallennus: `MarkerInteraction.onSave(id)` → `PUT {bearing}`. | V18,T63 |
| T65 | ✓ | Poista localStorage marker/segment-cache: `persistence.ts` + `segment-persistence.ts` ovat no-op stubs. `init()` hakee merkit suoraan `fetchMarkers()`. Järjestäjä hakee kaikki segmentit `GET /api/segments` init:ssä (B16-korjaus). Talkoolainen hakee oman pätkän `fetchSegmentByCode`. | V18,V30,V36,T63 |
| T66 | ✓ | `fetchAllSegments()` lisätty `segment-sync.ts`:ään. `pendingSync`-kenttä poistettu `SignMarker`-tyypistä. `sync.ts` yksinkertaistettu: vain `fetchMarkers()`. | T65 |
| T67 | ✓ | Lukitse rooli-toggle backend-rooliin: `RoleSelector` ottaa `lockedRole?: Role`-parametrin — jos `'talkoolainen'`, nappi on `hidden`. `main.ts` välittää `onAuthenticated`-vastauksesta saadun roolin. `setRole()` ei kutsuta talkoolaiselle (localStorage ei ylikirjoita backend-roolia). Vitest-jsdom (nappi piilossa talkoolaisella, näkyy järjestäjällä). Käyttäjä: molemmat. | V39,V13,T12,T32,T36 |
| T68 | ✓ | Auth-screen ensin: `AuthScreen.start()` kutsuu `this.show()` heti alussa ennen `fetch('/api/auth/me')`. Onnistunut vastaus (200) → `this.hide()` ennen `onAuthenticated`. Muut haarat (401, virhe, polkukoodi) pysyvät ennallaan. Vitest-jsdom: testi jossa `start()` kutsutaan — overlay on näkyvissä ennen kuin fetch resolvoituu. | V40,V29,T51,T54 |
| T70 | ✓ | Teardrop-ikoni: terävä kärki ankkuripisteeksi. `src/map/icons.ts` — `H: 50→52`, `CY: 38→26` (ympyrä ylös), kiinteä tip-SVG (EI pyöri bearing-transform mukana, `position:absolute;bottom:0`) `path M8,0 L16,12 L24,0 fill=color stroke=white 1.5px`. `iconAnchor: [CX,52]`, `popupAnchor: [0,-56]`. Kärki osoittaa tarkan sijainnin kartalla — erityisesti talkoolaiselle metsässä. DESIGN.md §K SignIcon päivitetään. Testattavuus: Playwright — `iconAnchor` vastaa kärjen pikseliä (vertaa klikattuun karttakoordinaattiin). | T23 |
| T71 | ✓ | CSS token-migraatio: korvaa kaikki hardkoodatut hex-arvot `src/style.css`:ssä semanttisilla custom propertiesilla. Tokenit: `--surface-app/card/raised`, `--text-body/muted/meta`, `--accent/accent-text/accent-hover`, `--confirm/confirm-hover/confirm-text`, `--danger/danger-text/danger-soft`, `--border-subtle/card/default/strong`, `--hover/hover-strong`, `--overlay`, `--gps-active`, `--field-tint`, `--warn-highlight`. Radius konsolidoitu kolmeen: `--radius-sm:6px`, `--radius-md:10px`, `--radius-lg:14px` (poistaa U5). `prefers-reduced-motion` media query motion-muuttujille. Kaksi teemaa `:root/[data-theme="dark"]` (nykyinen dark) + `[data-theme="daylight"]` (vaalea, korkea kontrasti). DESIGN.md §C päivitetään uusilla token-nimillä. Vitest-jsdom: getComputedStyle tarkistaa key-tokenit molemmilla `data-theme`-arvoilla. Käyttäjä: molemmat. | - |
| T72 | . | Teema-toggle käyttäjäpreferenssinä: `prefers-color-scheme` OS-default (`dark`→dark, `light`→daylight). Manuaalinen override: `localStorage('karttamaster-theme')` tallentaa valinnan. `<html data-theme>` päivitetään käynnistyksessä + togglesta. Toggle-nappi overflow-valikossa (`⋯`) — kuvake sun/moon (Lucide). `src/ui/theme-toggle.ts` (uusi komponentti). Vitest-jsdom: OS-default dark → `data-theme="dark"`, localStorage override daylight → `data-theme="daylight"`. Käyttäjä: molemmat. | T71 |
| T73 | ✓ | Järjestäjän collapsible left panel: merkkikirjasto + pätkäjako sivupaneelissa (desktop, `#left-panel`). Avautuu/sulkeutuu `◀/▶`-tabilla paneelin reunassa (`min-width:44px min-height:44px`). Suljettu → kartta saa koko leveyden. Paneelin sisältö: §K-mukainen merkkikirjasto-grid + pätkäjako-lista (siirtää content `#segment-panel`:sta + `#sign-type-dropdown`:sta). `src/ui/left-panel.ts` (uusi komponentti). Vitest-jsdom: toggle avaa/sulkee, paneeli `hidden` kun suljettu. Playwright (1280px viewport): paneeli auki → kartta-alue pienempi, paneeli kiinni → kartta täyttää leveyden. Käyttäjä: järjestäjä. | T71 |
| T74 | . | CheckIn bottom sheet: talkoolaisen kuittaus-modaali bottom sheet -patterilla — nousee alhaalta, `border-radius:14px 14px 0 0`, `width:100%`. Sisältö: merkintunnus + nimi + km + `StatusBadge`, iso `CheckInButton` (asetettu/kerätty), sekundäärit "Ei tarpeen" + "Lisäsin toisen". Backdrop-klikki sulkee. `src/ui/checkin-sheet.ts` (uusi komponentti, korvaa nykyisen `openMarkerModal`-talkoolainen-haaran). Vitest-jsdom: avaus merkkiklikistä, kuittaus päivittää statuksen, backdrop sulkee. Käyttäjä: talkoolainen. | T71,T24 |
| T75 | . | Kommentti-systeemi design + tietomalli: yleiskäyttöinen kommentti/huomio joka voidaan kiinnittää merkkiin, pätkään tai vapaaseen karttapisteeseen. Kenttä: `{id, targetType: 'marker'\|'segment'\|'point', targetId?: string, lat?: number, lon?: number, text: string, iconId?: string, authorName?: string, createdAt: string}`. Backend: `comments`-taulu + `GET/POST/DELETE /api/comments`. UI: kommentti-nappi merkin/pätkän modaalissa → textarea + ikoni-valinta. Kartalla: kommentti-ikoni vapailla pisteillä. Vitest-pure (logiikka) + Vitest-jsdom (UI) + Bun integraatiotestit (API). Käyttäjä: molemmat. | V13,T41,T36 |
| T76 | . | POI-järjestelmä design + tietomalli: karttamerkki-POI on eri entiteetti kuin reittimerkki (SignMarker). Tyypit: `huoltoalue` (nimi + teksti + kuva[] + aukioloaika), `noutopiste`, `pudotuspiste`, `kasa`. Tietomalli: `{id, type, lat, lon, title, description?, imageUrls[]?, openHours?, createdBy, phase: 'asettaminen'\|'purku'\|'kaikki'}`. Backend: `pois`-taulu + CRUD API. Kartalla: oma symboli per tyyppi. Kasa: merkittävissä "kerätty" kenen toimesta tahansa. Suunnitellaan ennen toteutusta — vaikuttaa arkkitehtuuriin. Käyttäjä: molemmat. | V13,T41,T36 |
| T77 | . | Pätkä klikattavissa kartalta: `segment-overlay.ts` — klikkaus pätkän polylineen → avaa `SegmentDetailsModal` (T69) suoraan kartalta. Ei tarvitse etsiä listasta. Vitest ei riitä — Playwright: klikkaa pätkää kartalla → modaali avautuu. Käyttäjä: järjestäjä. | T25,T69 |
| T78 | . | Talkoolaisen pätkän pituuden muokkaus kentällä: `segment-view.ts` — nappi "Muokkaa pätkän rajoja" → sama drag-to-reposition UI kuin T56 mutta talkoolaiselle. Voi laajentaa endDist pidemmälle tai lyhentää startDist/endDist. Tallentuu `PUT /api/segments/:id`. Järjestäjä voi yliajaa (V43). Vitest-jsdom + Playwright. Käyttäjä: talkoolainen. | V43,T56,T25,T62 |
| T79 | . | Reaaliaikainen sync: talkoolaisen marker/segment-muutokset näkyvät järjestäjälle kartalla ilman sivun latausta. Toteutus: SSE (Server-Sent Events) tai polling (10s). `GET /api/events` stream tai `GET /api/markers?since=<timestamp>`. Client: `src/logic/realtime.ts` — subscribe, päivitä MarkerManager + SegmentOverlay. Playwright: talkoolainen kuittaa → järjestäjä näkee värimuutoksen <15s. Käyttäjä: järjestäjä (vastaanottaa), talkoolainen (lähettää). | V18,T41,T47 |
| T80 | . | Materiaalien kirjaus purkuvaiheessa: talkoolainen kirjaa paljonko materiaalia otettu mukaan ("10 keppiä", "5 rullaa nauhaa"). Kasa-toiminto: merkitsee kasapaikan kartalle (`POI type: kasa`, T76). Toinen henkilö merkkaa kasan kerätyksi. `segment-view.ts` purku-moodissa: "Kirjaa materiaalit" -osio. Vitest-jsdom. Käyttäjä: talkoolainen purku-vaiheessa. | V26,V28,T52,T76 |
| T81 | ✓ | Järjestäjän toolbar yksinkertaistaminen: toolbar = vain `[+ Merkki]` + `[⋯]`. (a) `index.html`: `#btn-gps` saa `data-role-hide="järjestäjä"` — piilossa järjestäjällä, näkyy talkoolaisella. (b) `src/ui/role-selector.ts`: `lockedRole`-parametri laajennetaan — järjestäjälläkin nappi `hidden` (V13: ei rooli-togglea kummallekaan; T67 teki saman talkoolaiselle). `main.ts` välittää `sessionRole` molemmille. (c) `src/main.ts` wiring päivittyy. Vitest-jsdom: järjestäjä-sessiolla toolbar näyttää vain 2 nappia; GPS ja role-toggle `hidden`. Käyttäjä: järjestäjä. | V13,V39,T67,T32 |
| T82 | ✓ | SnapshotPanel overflow-modaaliksi: `#snapshot-panel-container` poistetaan kartan yläpuolelta kiinteänä elementtinä — ei enää vie karttatilaa. `#btn-snapshot-panel` (overflow-valikossa) avaa `SnapshotModal`-modaalin (`position:fixed`, `bg-card`, `border-radius:14px`, `min(480px,92vw)`, `max-height:80vh` scrollable, backdrop-klikki + Esc sulkee). `src/ui/snapshot-panel.ts`: muokkaa renderöimään modal-containerin eikä inline-containerin. `index.html`: poista `#snapshot-panel-container` toolbarin alta. `main.ts` wiring päivittyy. §K-sopimus päivitetään DESIGN.md:hen (SnapshotModal korvaa SnapshotPanel inline). Vitest-jsdom: overflow → Varmuuskopiot-klikki → modal näkyy; backdrop-klikki → sulkee; kartan yläpuolella ei kiinteää paneelia. Käyttäjä: järjestäjä. | T50,T57,T73 |
| T69 | ✓ | SegmentDetailsModal: "Lisätiedot & varusteet" -nappi pätkärivillä avaa modaalin järjestäjälle. Korvaa `buildDetailsSection()`-inline-toggle `src/ui/segment-panel.ts`:ssä. Modaali sisältää: (1) pätkän nimi-kenttä (`displayName`, `<input>`, auto-save blur/Enter → `updateSegment` + `updateSegmentRemote`), (2) järjestäjän kuvaus-textarea (auto-save `change` → `updateSegment` + `updateSegmentRemote`), (3) merkit pätkällä readonly-lista statuksilla (`getMarkersForSegment`-tulos, status-värit §C DESIGN.md), (4) manuaali-varusteet add/remove/edit (`EquipmentItem[]`, sama logiikka kuin poistuva `buildEquipmentManualSection`). Modal DOM: `document.body`-lapsi, `position:fixed`, `bg-card`, `border-radius:14px`, `box-shadow:0 16px 48px rgba(0,0,0,0.5)`, backdrop `overlay`+`blur(2px)`, `width:min(480px,92vw)`, `max-height:80vh` scrollable. Sulje: ✕-nappi (`aria-label:"Sulje"`, `min-height:44px`) + Escape + backdrop-klikki — auto-save on change, ei hylkäysdialogi. §K-sopimus lisätty DESIGN.md §K SegmentPanel-osioon. Vitest-jsdom: avaus, sulkeminen (✕/Esc/backdrop), displayName-save, description-save, equipment-lisäys, equipment-poisto, merkkilista statuksilla. Käyttäjä: järjestäjä. | V38,T25,T27 |

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
| B4 | 2026-06-10 | `auth-screen.ts:48–53` — non-401 (esim. 404 Vite dev-server) tai verkkovirhe → `onAuthenticated` kutsutaan ilman kirjautumista. Sovellus aukeaa ilman autentikaatiota. | V29→T54 |
| B5 | 2026-06-10 | `createSegmentStore()` = `new Map()` — segmenteillä ei localStorageen tallennusta. Kaikki pätkäjako katoaa sivun päivityksellä. | V30→T55 |
| B6 | 2026-06-10 | Pätkän luonnissa ensimmäinen klikattu piste ei näy kartalla — ei visuaalista palautetta. Luonnin jälkeen startDist/endDist ei muokattavissa — ainoa vaihtoehto poista+redo. | V31,V32→T56 |
| B7 | 2026-06-10 | `snapshot-panel.ts` renderöi aina koko listan — vie liikaa tilaa admin-näkymästä kun varmuuskopioita on paljon. | T57 |
| B8 | 2026-06-10 | `main.ts:186-188` — `openMarkerModal` kutsuu `renderMarkerList(markerManager)` ilman pätkäfiltteriä. Talkoolainen näkee kaikki merkit eikä vain oman pätkän. | V33→T58 |
| B9 | 2026-06-11 | `segment-panel.ts buildAssignSection()` tallentaa `assignedCode` vain localStorageen — ei kutsu `POST /api/admin/codes`. Backend `talkoolainen_codes`-taulu pysyy tyhjänä → `/api/auth/code-login` palauttaa 401. Talkoolainen ei pääse sisään jaetulla linkillä. | V34→T59 |
| B10 | 2026-06-11 | `segment-persistence.ts saveSegments()` catch {} ignoroi localStorage quota/write virheet hiljaa — käyttäjä ei tiedä tallennuksen epäonnistuneen, pätkädata häviää näkymättömästi. | V35→T60 |
| B11 | 2026-06-11 | `segments`-taulua ei ole backendissä — segmentit ovat localStorage-only. Talkoolainen eri laitteella avaa `/s/<koodi>` → `loadSegments()` palauttaa tyhjän storen → `getSegmentForCode` → `undefined` → `segmentView` ei luoda → talkoolainen näkee tyhjän kartan ilman pätkänäkymää. | V36→T61,T62 |
| B12 | 2026-06-11 | `#map-state-banner` oli `position:fixed;top:64px` → peitti talkoolaisen `#segment-view` headerin (nimi, range, description näkymätön). | ✓ siirretty `#segment-view-container`:iin flow-elementtinä |
| B13 | 2026-06-11 | `SegmentPanel.render()` uudelleenrakentaa koko listan → "Lisätiedot & varusteet" -toggle-tila nollautuu aina — käyttäjä menettää avoimena olevan näkymän esim. assign-tallennuksen yhteydessä. | V37 |
| B14 | 2026-06-11 | Teksti `#segment-desc-input`:ssä (ei blur vielä) katoaa kun `this.render()` triggeröityy (esim. assign-tallennus) — `change`-event vaatii eksplisiittisen blurin/enterin ennen render-kutsua. Näppäin-flow: kirjoita desc → tallenna koodi heti klikkaamalla → textarea tyhjänä. | V38 |
| B15 | 2026-06-11 | Järjestäjä-segment-panel visuaalinen ilme on heikko — ei selkeää hierarkiaa, isot tyhjät alueet, kontrollit vaikeasti löydettävissä. | UX-parannustehtävä (ei kriittinen toiminnallisuus) |
| B16 | 2026-06-11 | `init()` hakee segmentit backendistä (`fetchSegmentByCode`) vain talkoolaiselle — järjestäjä näkee tyhjän pätkälistan uudessa selainistunnossa vaikka backend tietää segmenteistä. V36: localStorage on cache, ei lähde. | V36 — tarvitsee `GET /api/segments` kutsun järjestäjälle sivun latautuessa |
| B17 | 2026-06-11 | `RoleSelector` toggle-nappi näkyy kaikille — talkoolainen voi klikata järjestäjä-rooliin ja saada admin-UI:n (merkkien poisto, segment-hallinta, snapshots). `setRole()` kirjoittaa vain localStorage:n eikä tarkista backend-sessiota. Kriittinen tietoturvariski. | V39 → T67 |
| B18 | 2026-06-11 | `#auth-screen { display:none }` + `start()` kutsuu `fetch` ennen `show()` → karttanäkymä välähtää 100–300ms ennen kirjautumislomaketta. `main.ts:34` alustaa Leaflet-kartan moduulitasolla heti — kartta renderöityy ennen kuin auth ratkeaa. | V40 → T68 |
