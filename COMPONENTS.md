# COMPONENTS.md — Karttamaster komponenttirekisteri (indeksi)

Totuus **arkkitehtuurista**: komponentit, kerrokset, pilkkoliput.
Task-statukset: SPEC.md §T (ainoa totuus). Periaatteet: VISION.md.

**Yksityiskohdat hakemistossa:** `docs/components/`

**Ei rivimääriä tähän tiedostoon** — ne vanhenevat päivissä. `/karttamaster-arkkitehtuuri analysoi`
laskee ne livenä (`wc -l`). Tila-soluun vain: tila + viimeisin T-id + korkeintaan yksi elävä huomio.
Historia on gitissä ja SPEC §T/§B:ssä.

---

## Hakemistorakenne

```
src/logic/    ← puhtaat funktiot, ei Leafletia — Vitest-pure
src/map/      ← Leaflet-glue, ohut kerros — Playwright
src/ui/       ← DOM-komponentit ilman Leafletia — Vitest-jsdom
src/main.ts   ← vain init + wiring
src/devtools/ ← kehitystyökalut, ei tuotantoon
server/       ← Hono + Bun + SQLite
```

---

## Komponenttitaulukko

**E2E-sarake:** tiedosto `e2e/`-hakemistossa joka testaa tätä komponenttia. `—` = ei E2E-testiä.
**Muuta komponenttia → tarkista E2E-sarake → päivitä testi ennen ✓.**

| Komponentti | Moduuli | Tila | E2E | Docs |
|---|---|---|---|---|
| RouteGeoMath | `src/logic/bearing.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| GpxLoader | `src/logic/gpx.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| MultiRouteAssigner | `src/logic/multi-route.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| SignTypes | `src/logic/sign-picker.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| SignIdSlug | `src/logic/sign-id-slug.ts` | ✓ T161 | — | [logic.md](docs/components/logic.md) |
| TileLayers | `src/logic/tile-layers.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| BasemapDim | `src/logic/basemap-dim.ts` | ✓ T287 (pohjan näkyvyys: clamp 0–1 + persist + slider-map, V201) | tests/t287-basemap-dim.test.ts | [logic.md](docs/components/logic.md) |
| Types | `src/logic/types.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| Uid | `src/logic/uid.ts` | ✓ T238 (turva-genId, guard+insecure-fallback B103) | — | [logic.md](docs/components/logic.md) |
| SignLibrary | `src/logic/sign-library.ts` | ✓ T171 | — | [logic.md](docs/components/logic.md) |
| MarkerStatus | `src/logic/marker-status.ts` | ✓ T10 | — | [logic.md](docs/components/logic.md) |
| SegmentManager | `src/logic/segments.ts` | ✓ T153 | — | [logic.md](docs/components/logic.md) |
| TaskMarkers | `src/logic/task-markers.ts` | ✓ T214 | — | [logic.md](docs/components/logic.md) |
| MarkerFocus | `src/logic/marker-focus.ts` | ✓ T334 (focusState: fokus/dim per merkki, jäsenyys TaskMarkersista V243) | tests/marker-focus.test.ts | [logic.md](docs/components/logic.md) |
| InventoryLogic | `src/logic/inventory.ts` | ✓ T244 (v2: ehdollinen name V161 + resolveItemName V165 + adjustQty + InventoryLocation; T241 validate/build) | — | [logic.md](docs/components/logic.md) |
| InventoryUndoLogic | `src/logic/inventory-undo.ts` | ✓ T252 (UndoAction-tyyppi + describeUndo toast-teksti, client-only V172) | — | [logic.md](docs/components/logic.md) |
| VarustarkastusLogic | `src/logic/varustarkastus.ts` | ✓ T258/R2 (talkoolaisen "otin nämä" checkoff, client-only localStorage per pätkä V180) | tests/t258-varustarkastus.test.ts | [logic.md](docs/components/logic.md) |
| EquipmentCounts | `src/logic/equipment-counts.ts` | ✓ T393/V285 (varustelistan phase-tietoinen tyyppilaskuri: iso luku = `take` "ota mukaan", meta = "N/M asetettu"/"kerätty"; `ei_tarpeen` pois kaikista luvuista; JAETTU SegmentEquipment + EquipmentModal + SegmentDetailsModal — ⊥ kolmea laskentaa) | tests/t393-equipment-counts.test.ts, tests/t394-equipment-counts-ui.test.ts | [logic.md](docs/components/logic.md) |
| InventorySync | `src/logic/inventory-sync.ts` | ✓ T399 (varastorivien haku + linkitys merkkipohjaan; KAIKKI virheet → tyhjä lista/false ∴ picker jää pois hiljaa V289) | tests/t399-inventory-link-picker.test.ts | [logic.md](docs/components/logic.md) |
| InventoryLink | `src/logic/inventory-link.ts` | ✓ T398 (käänteinen T386: `rankInventoryRows` rankkaa VARASTORIVIT kirjoitettua labelia vasten + `cleanDisplayName` pudottaa irtokyltti/lisäkilpi-suffiksin merkkipohjan nimestä; `unlinkedItems`/`unlinkedCount` siirretty tänne UI-moduulista — kaksi kuluttajaa) | tests/t398-inventory-link.test.ts | [logic.md](docs/components/logic.md) |
| TemplateMatch | `src/logic/template-match.ts` | ✓ T384 (inventaarion nimi→merkkipohja EHDOTUS, ⊥ liitos: `normalizeName` V278-suffiksipoisto + Levenshtein-toleranssi; liitos on aina templates.id V276, kirjoitus vaatii kuittauksen V277) | tests/t384-template-match.test.ts | [logic.md](docs/components/logic.md) |
| MarkerStock | `src/logic/marker-stock.ts` | ✓ T387 (kartalla/varastossa per template_id — liitos AINA template_id ⊥ nimivertailu V276; `kerätty`/`ei_tarpeen` ⊥ ole kartalla; vaatii T383-backfillin ∴ luku on oikea ⊥ vain vajaa) | tests/t387-marker-stock.test.ts, tests/t387-marker-stock-badge.test.ts | [logic.md](docs/components/logic.md) |
| PhaseView | `src/logic/phase-view.ts` | ✓ T148 | — | [logic.md](docs/components/logic.md) |
| RoleController | `src/logic/role.ts` | ✓ T12 (V80: rooli backendistä, toggle dead code) | critical-paths: "Rooli backendistä" | [logic.md](docs/components/logic.md) |
| SituationLogic | `src/logic/situation.ts` *(ei vielä)* | ○ T15 | — | [logic.md](docs/components/logic.md) |
| NavigationLogic | `src/logic/navigation.ts` | ✓ T16, T327, T328 (pätkäkontekstin funktiot saavat `segment`in ⊥ `routeId`-parametria, V237; drive-funktiot pitävät `routeId`:n — eri omistaja), T413/V304 (`nearestUnsetByGps` + `defaultUnsetSelection`: reitittömän tehtävän oletusvalinta metrisesti GPS-fixistä, lista & valittu merkki pysyvät vakaina) | tests/navigation.test.ts; tests/t413-gps-nearest.test.ts | [logic.md](docs/components/logic.md) |
| NavLink | `src/logic/nav-link.ts` | ✓ T395 (ulkoinen nav-handoff: `navUrl` Google Maps universal URL + `navTarget` = kohteen AINOA laajennuskohta, V286) | tests/t395-nav-link.test.ts | [logic.md](docs/components/logic.md) |
| SegmentOrder | `src/logic/segment-order.ts` | ✓ T359 (`segmentKm` lukee jäljen akselia kun jälki on, V259; aiemmin T328: pätkä omistaa km-akselin: `segmentKm`/`orderMarkersInSegment`/`displayKm`, suunta phasesta, "ei reitillä" -ryhmä; V237/V238/B129) | tests/segment-order.test.ts | [logic.md](docs/components/logic.md) |
| SegmentTrack | `src/logic/segment-track.ts` | ✓ T358 (pätkän oma jälki: johto rajoista/ankkureista, kohtisuora etäisyys + km jäljen akselilla; V258/V261. T359–T363 kuluttajat kesken) | tests/segment-track.test.ts | [logic.md](docs/components/logic.md) |
| SegmentBackfill | `src/logic/segment-backfill.ts` | ✓ T361 (legacy-pätkä saa jäljen rajoistaan kun GPX:t ladattu; ei ylikirjoita, idempotentti; V260) | e2e/segments.spec.ts | [logic.md](docs/components/logic.md) |
| SegmentMembership | `src/logic/segment-membership.ts` | ✓ T359 (kuka omistaa merkin: lähin jälki voittaa, eksklusiivinen per vaihe, linked/excluded ohittaa geometrian; V259/B143) | tests/segment-membership.test.ts | [logic.md](docs/components/logic.md) |
| MapFilter | `src/logic/map-filter.ts` | ✓ T376 (kanoninen suodatinpredikaatti: markerVisibility/segmentVisibility → full\|dim\|hidden, 4 akselia + dimLevel, localStorage-persistointi; V271/V272/V243-amend) | tests/map-filter.test.ts | [logic.md](docs/components/logic.md) |
| MarkerOverview | `src/logic/marker-overview.ts` | ✓ T400 (järjestäjän merkkijonon ryhmittely status→pätkä; KOOSTAA V259-jäsenyyden + V237/V238-järjestyksen + V271-näkyvyyden, ⊥ omaa sääntöä; suodatetut omaan ryhmään V290) | tests/t400-marker-overview.test.ts | [logic.md](docs/components/logic.md) |
| SegmentVisibility | `src/logic/segment-visibility.ts` | ✓ T374 (`segmentVisibleOnRoutes`: reittinäkyvyys koskee myös pätkäviivoja & nimilappuja, jäsenyys primarysta V211, reititön ⊥ katoa V139; V269/B157), ✓ T419 (nimilapun zoom-käytös SIIRTYI `marker-scale.ts`:ään — T418:n `segmentLabelVisible` poistettu, lappu ⊥ katoa vaan kutistuu; V309-amend) | tests/t374-segment-visible-routes.test.ts; e2e/segments.spec.ts | [logic.md](docs/components/logic.md) |
| SegmentSync | `src/logic/segment-sync.ts` | ✓ T62 | — | [logic.md](docs/components/logic.md) |
| AreaTypes | `src/logic/area-types.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| AreaGeometry | `src/logic/area-geometry.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| AreaSync | `src/logic/area-sync.ts` | ✓ T154 | — | [logic.md](docs/components/logic.md) |
| TemplateSync | `src/logic/template-sync.ts` | ✓ T193 | — | [logic.md](docs/components/logic.md) |
| IconSet | `src/logic/icon-set.ts` | ✓ T159 | — | [logic.md](docs/components/logic.md) |
| MarkerAssign | `src/logic/marker-assign.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| RouteStatus | `src/logic/route-status.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| SegmentActions | `src/logic/segment-actions.ts` | ✓ (bulkCollect V28), T414/V305 (`addMarkersToSegment`/`removeMarkersFromSegment` — additiivinen & idempotentti merkkiliitos, sama polku reitittömälle & reitilliselle; kolme kutsupaikkaa: T415 merkkijono, T416 kartta, serverin unioni V307) | tests/t414-add-markers.test.ts | [logic.md](docs/components/logic.md) |
| SignVisual | `src/logic/sign-visual.ts` | ✓ T171 | — | [logic.md](docs/components/logic.md) |
| SignImages | `src/logic/sign-images.ts` | ✓ T158 (Vite glob, 89 kuvaa T161:stä) | — | [logic.md](docs/components/logic.md) |
| Sync | `src/logic/sync.ts` | ✓ T226 (createdBy-mäppäys) | — | [logic.md](docs/components/logic.md) |
| AuditSync | `src/logic/audit-sync.ts` | ✓ T320 (+ fetchAuditLog suodattimin + undoAuditEntry eritellyin virhein) | tests/audit-sync.test.ts, tests/t320-audit-log.test.ts | [logic.md](docs/components/logic.md) |
| AuditLog | `src/logic/audit-log.ts` | ✓ T320 (verbit + poikkeama metreinä + suodatinpredikaatit + ketjut), T417/V308 (`link`/`unlink`-verbit + `isUndoableAction` jaettuna porttina serverin whitelistin kanssa + `linkTargetName` payloadista) | tests/t320-audit-log.test.ts; tests/t417-link-audit-ui.test.ts | [logic.md](docs/components/logic.md) |
| TalkooIdentity | `src/logic/talkoo-identity.ts` | ✓ T317 (nimen validointi + muistaminen laitteessa) | tests/t317-talkoo-nimi.test.ts | [logic.md](docs/components/logic.md) |
| WriteOutbox | `src/logic/write-outbox.ts` + `outbox-instance.ts` | ✓ T183 (durable kirjoitusjono, V116) | — | [logic.md](docs/components/logic.md) |
| MarkerScale | `src/logic/marker-scale.ts` | ✓ T175/T210 (`markerScaleForZoom` 0,3→1,2 @ zoom 11→19; V109/V138/B93), ✓ T419 (`segmentLabelScaleForZoom` 0,4→1,0 @ zoom 12→16 — nimilappu skaalautuu kuten merkki & ⊥ katoa; V309-amend) | tests/t419-segment-label-scale.test.ts; t419: skaala mitattuna pikseleinä (`e2e/t419-label-scale.spec.ts`) | [logic.md](docs/components/logic.md) |
| SegmentZoom | `src/logic/segment-zoom.ts` | ✓ T224 (planSegmentZoom: fit vs anchor pätkän latauksessa) | tests/t224-segment-zoom.test.ts | [logic.md](docs/components/logic.md) |
| SignIcon | `src/map/icons.ts` | ✓ T172 | critical-paths: "toolbar-dropdown", "yhdistelmämerkki" | [map.md](docs/components/map.md) |
| DriveMode | `src/map/drive.ts` | ✓ | critical-paths: "Drive mode" | [map.md](docs/components/map.md) |
| MarkerManager | `src/map/markers.ts` | ✓ T335 (setFocusSegment: himmennä muut kuin pätkän merkit, V243; reapplyElementState kokoaa setIconin pudottamat luokat) | critical-paths: "Merkki kartalle", "Drag-to-move", "Merkin zoom-skaalaus", "tallennus epäonnistuu", "merkkien korostus" | [map.md](docs/components/map.md) |
| RouteBar | `src/map/route-bar.ts` | ✓ (T224: piilotettu talkoolaiselta, `#route-bar` hidden) | — | [map.md](docs/components/map.md) |
| RouteVisibilityControl | `src/map/route-visibility-control.ts` | ✓ T377 (DOM luovutettu MapFilterBarille; jäljellä sovellus: polylinet + merkit + pätkäviivat + getActiveRoute-sopimus, V271) | tests/t204-route-visibility-control.test.ts | [map.md](docs/components/map.md) |
| BasemapDimControl | `src/map/basemap-dim-control.ts` | ✓ T287 (pohjan näkyvyys-slider ⋯-valikossa, tilePane-opacity, V201) | — | [map.md](docs/components/map.md) |
| ~~NextMarkerHighlight~~ | POISTETTU T256/R6 | accent-rengas → ikoni-hehku (`MarkerManager.setNextHighlight` + `.marker-next-highlight` CSS-glow, V178) | — | — |
| GpsNavigator | `src/map/gps-navigator.ts` | ✓ T30, T341 (tilakone haetaan/päällä/pois + näkyvät virheet, V247), T397 (oma `gps`-pane z675 — piste yli pätkä-/reittiviivojen, V287/B166), T406 (seuranta+tarkkuushalo+stale-vahti 45s+visibility-restart+wake lock, V295/V296), T413 (`getPosition()` — viimeisin fix ulos ∴ `src/ui/` saa sijainnin ilman Leaflet-instanssia) | t406-gps-navigator; critical-paths: "GPS-paikannin" · t341-gps-no-segment · t406-t407-gps-follow | [map.md](docs/components/map.md) |
| GpsFollow | `src/logic/gps-follow.ts` | ✓ T405 (seurantatilan päätös puhtaana: ohjelmallinen pan ≠ käyttäjän ele; `GpsState`×seuranta → 4 UI-tilaa + labelit + napautuksen merkitys, V294/V295) | tests/t405-gps-follow.test.ts | [logic.md](docs/components/logic.md) |
| GpsControl | `src/ui/gps-control.ts` | ✓ T407 (paikannus KARTALLE 1 napautuksella; laukaisin ON tilanäyttö, 4 tilaa; hero väistetään ResizeObserverilla, V294) | tests/t407-gps-control.test.ts; e2e t406-t407-gps-follow | [ui.md](docs/components/ui.md) |
| AreaOverlay | `src/map/area-overlay.ts` | ✓ | area-interaction | [map.md](docs/components/map.md) |
| MapRectEditor | `src/map/map-rect-editor.ts` | ✓ T117 | area-interaction | [map.md](docs/components/map.md) |
| SegmentOverlay | `src/map/segment-overlay.ts` | ✓ T152, T217 (reititön skip), T347 (nimilappu klikattava), T348 (valmis = vihreä + ✓-lappu), T419 (nimilappu KUTISTUU kuten merkki-ikoni ⊥ katoa; `--label-scale` + `tooltip.update()`, `zoomend` + render-loppu; V309/V310); t419: skaala mitattuna pikseleinä (`t419-label-scale.spec.ts`) | segments: "viivatyyli koodaa statuksen" (dashArray-ARVO, V252) + "valmis pätkä = vihreä ehjä viiva + ✓-nimilappu (T348)"; t217: routeless gap-safety (Taso-1, Playwright post-T216); t347: nimilapun klikkaus + drag-panorointi + V142-dim (`critical-paths.spec.ts`); t349: karttapinnan teemariippumattomuus — sama näkymä light+dark, värit identtiset (`t349-map-surface-theme.spec.ts`, V253); t336: casing 3 kerrosta (Taso-1 `t336-segment-casing.test.ts`) | [map.md](docs/components/map.md) |
| CssParseGuard | `tests/css-parse.test.ts` | ✓ B168 (∀ CSS-tiedosto postcss-parsitaan + sulkutasapaino + merge-konfliktimerkit; Vitest ⊥ muuten katso CSS:ää ∴ rikkinäinen tyylitiedosto pääsi läpi 1984 vihreän testin) | — | — |
| ~~MarkerListUI~~ | POISTETTU T404 | `marker-list.ts` + `#marker-modal` poistettu 2026-07-30 — korvaaja MarkerOverviewPanel. `renderSignDots` siirtyi `src/ui/route-sign-dots.ts`:ään (ProgressBarin riippuvuus). | — | — |
| MarkerOverviewPanel | `src/ui/marker-overview-panel.ts` | ✓ T402/T403/T404 (telakoitu merkkijono järjestäjälle, korvaa `#marker-modal`in; oikea reuna ⊥ modaali koska rivin klikkaus panoroi karttaa V114; parity: haku + bulk-status + V117-pending; DESIGN §K), T412/V303 (checkbox 44×44 — jaettu sääntö, oli 13×13 B171), T415/V305 (toinen polku valituille: kohdevalitsin + "Lisää valitut tehtävään" — natiivi select ⊥ oma popup, DESIGN §K) | tests/t402-marker-overview-panel.test.ts; e2e/t412-checkbox-touch-target.spec.ts | [ui.md](docs/components/ui.md) |
| SegmentRowMenu | `src/ui/segment-row-menu.ts` | ✓ T345 (pätkärivin ···-pikavalikko: kartta/korostus/linkki/lisätiedot, V250) | tests/t345-segment-row-menu.test.ts; critical-paths: "···-valikosta korostus" | [ui.md](docs/components/ui.md) |
| SegmentFit | `src/map/segment-fit.ts` | ✓ T345 (kartan rajaus yhteen pätkään, jaettu talkoolaisen latauszoomin & järjestäjän "Näytä kartalla" kesken) | critical-paths: "Näytä kartalla siirtää karttaa" | [map.md](docs/components/map.md) |
| MapFilterBar | `src/ui/map-filter-bar.ts` | ✓ T377/T379 (kartan suodatinbar: reitit·pätkät·merkit·himmennys, aktiivilaskuri+banneri+nollaus, talkoolaiselle kapea "Näytä"; V272/V271) | critical-paths: "T377 — suodatinbar", "T379"; segments: "T374" | [ui.md](docs/components/ui.md) |
| MarkerClaimSheet | `src/ui/marker-claim-sheet.ts` | ✓ T416/V306 (himmennetyn merkin AINOA toiminto talkoolaiselle: "Lisää tehtävääni"; bottom sheet, TASAN 2 nappia & ⊥ muokkauskenttiä — ⊥ ole karsittu MarkerDetailModal, DESIGN §K) | tests/t416-claim-sheet.test.ts; e2e/t416-claim-marker.spec.ts | [ui.md](docs/components/ui.md) |
| MarkerFocusPill | `src/ui/marker-focus-pill.ts` | ✓ T335 (korostustilan poistumis-affordanssi kartalla, V243/V219-kuvio) | tests/t335-focus-toggle-pill.test.ts; critical-paths: "merkkien korostus" | [ui.md](docs/components/ui.md) |
| ProgressBar | `src/ui/progress-bar.ts` | ✓ | critical-paths: "Drive mode" | [ui.md](docs/components/ui.md) |
| PlaceMode | `src/ui/place-mode.ts` | ✓ T172 | critical-paths: "Merkki kartalle", "dblclick", "sivupalkin merkkikirjastosta" | [ui.md](docs/components/ui.md) |
| AppController | `src/main.ts` | ✓ T155 | critical-paths: kaikki | [ui.md](docs/components/ui.md) |
| MapInit | `src/app/map-init.ts` | ✓ T179 | critical-paths: kaikki (kartan pohja); e2e/t179-map-invalidate-size.spec.ts | [ui.md](docs/components/ui.md) |
| RoleView | `src/app/role-view.ts` | ✓ T155, T274 (AccountMenu saa role → crossover-linkki) | critical-paths: "Auth screen", "Rooli backendistä" | [ui.md](docs/components/ui.md) |
| TalkoolainenMode | `src/app/talkoolainen-mode.ts` | ✓ T254 (R1 keystone: koti↔kartta -moodikehys, #app[data-view-mode]) | tests/t254-talkoolainen-mode.test.ts; e2e/segments.spec.ts "T254" | [ui.md](docs/components/ui.md) |
| AreasWiring | `src/app/areas-wiring.ts` | ✓ T155 | area-interaction | [ui.md](docs/components/ui.md) |
| SegmentsWiring | `src/app/segments-wiring.ts` | ✓ T155 | e2e/segments.spec.ts | [ui.md](docs/components/ui.md) |
| MarkersWiring | `src/app/markers-wiring.ts` | ✓ T182,T224 (zoom-to-segment, alapalkki piilotettu, next-highlight, gps-drive-panel poistettu) | critical-paths: "Merkki kartalle", "Drive mode", "tallennus epäonnistuu" | [ui.md](docs/components/ui.md) |
| SectionHeader | `src/ui/section-header.ts` | ✓ T371 (left-panelin section-headerin AINOA toteutus, V267 — 3 kopiota poistettu; kuluttajat: SignLibraryPanel, SegmentPanel, AreaPanel) | tests/t371-section-header.test.ts | [ui.md](docs/components/ui.md) |
| SignLibraryPanel | `src/ui/sign-library-panel.ts` | ✓ T176, T235 (194r lista/grid; modaali irrotettu), T371 (header jaetusta apurista) | critical-paths: "sivupalkin merkkikirjastosta" | [ui.md](docs/components/ui.md) |
| SignTemplateModal | `src/ui/sign-template-modal.ts` | ✓ T235 (malli-detalji/muokkaus-modaali, irrotettu SignLibraryPanelista; XSS-escape B19/V44) | (kattaa sign-library-panel-testit) | [ui.md](docs/components/ui.md) |
| RoleSelector | `src/ui/role-selector.ts` | ✓ T12 (V80: toggle dead code) | critical-paths: "Rooli backendistä" | [ui.md](docs/components/ui.md) |
| SegmentPanel | `src/ui/segment-panel.ts` | ✓ T362 (klik-klik-ankkuriketju: reitti lukittuu 1. klikistä & näkyy, haku etenee eteenpäin; B144) | e2e/segments.spec.ts ".segment-km näyttää status-lukumäärän" | [ui.md](docs/components/ui.md) |
| SegmentCreationModal | `src/ui/segment-creation-modal.ts` | ✓ T362 (polku-tila: ankkurilista + Poista viimeinen + Valmis; DESIGN §K) | — | [ui.md](docs/components/ui.md) |
| SegmentDetailsModal | `src/ui/segment-details-modal.ts` | ✓ T354/T355/T356 (kolme välilehteä 🎒 Varustelista/Kaikki merkit/Asetukset jaetulla SegmentKotiTabsilla; footer = jaettu modal-footer, secondary "Sulje" + destructive "Poista pätkä"; korostuskytkin headerissa; valmis-toggle T352/V255 Kaikki merkit -tabissa kuten talkoolaisella; T394/V285 yhteenveto-chipit = `getEquipmentCounts`, samat luvut kuin talkoolaisella) · V250 yksi tallennusmalli ⚠️ pilkko: T346:n ryhmät = moduulirajat | tests/t69-segment-details-modal.test.ts, tests/t199-segment-markers-list.test.ts, tests/t344-segment-row-name.test.ts, tests/t346-modal-groups.test.ts, tests/t354-modal-tabs.test.ts, tests/t335-focus-toggle-pill.test.ts; e2e/segments.spec.ts | [ui.md](docs/components/ui.md) |
| SegmentView | `src/ui/segment-view.ts` | ✓ T228, T218 (dynaaminen keräyslista), T234 (562r koordinaattori; hero irrotettu) | tests/t14-segment-view.test.ts, tests/t224-segment-view.test.ts, tests/t218-collection-list.test.ts; e2e/segments.spec.ts | [ui.md](docs/components/ui.md) |
| SegmentHero | `src/ui/segment-hero.ts` | ✓ T234 (seuraava-merkki-hero + ◀▶-nav + selectedNavId V159, irrotettu SegmentViewsta), T327 (järjestys pätkän primary-reitin km:llä, V235), T413/V304 (oletusvalinta `defaultUnsetSelection`illa: reitittömällä tehtävällä lähin GPS-fixiin; hysteresis tulee V159-reconcilesta) | tests/t232-segment-view-hero.test.ts; tests/t413-hero-gps-selection.test.ts | [ui.md](docs/components/ui.md) |
| EquipmentModal | `src/ui/equipment-modal.ts` | ✓ T224/C (talkoolaisen varustelista tilavana modaalina) · T394/V285 sama `getEquipmentCounts`-lähde kuin inline-listalla | tests/t224-equipment-modal.test.ts | [ui.md](docs/components/ui.md) |
| SegmentEquipment | `src/ui/segment-equipment.ts` | ✓ T262/V182 (KOTI-inline-varustelista + varustarkastus-checkoff; hero kartta-only; "Muokkaa"→EquipmentModal) · T394/V285 laskuri = `getEquipmentCounts` (ota mukaan + "N/M asetettu" -meta + sektiorivi; täysi tyyppi pois varustarkastuksen nimittäjästä) | tests/t262-segment-equipment.test.ts; e2e/segments.spec.ts | [ui.md](docs/components/ui.md) |
| SegmentMarkerList | `src/ui/segment-marker-list.ts` | ✓ T263/V183, T264 (KOTI "Kaikki merkit" -tab, ryhmitelty asetetut/asettamatta/ei tarpeen; rivi→MarkerDetailModal), T409/V292 (valikoiva bulk-kuittaus: checkbox/ei-terminaali rivi + `.bulk-action-bar` → `bulkSetStatus`) | tests/t263-segment-marker-list.test.ts, tests/t409-segment-bulk-status.test.ts; e2e/segments.spec.ts, e2e/t409-bulk-status.spec.ts | [ui.md](docs/components/ui.md) |
| SegmentKotiTabs | `src/ui/segment-koti-tabs.ts` | ✓ T264/V184 (koti-välilehdet: Varustelista·Kaikki merkit — Kommentit poistettu T380/V275) · T354/V257 JAETTU: sama komponentti myös järjestäjän SegmentDetailsModalissa, scrollerSelector-parametri erottaa kuoret — ⊥ toista tabitoteutusta | tests/t264-segment-koti-tabs.test.ts; e2e/segments.spec.ts | [ui.md](docs/components/ui.md) |
| PhaseSwitcher | `src/ui/phase-switcher.ts` | ✓ T148,T180 (stopPropagation, B80) | e2e/t180-phase-switcher-menu.spec.ts | [ui.md](docs/components/ui.md) |
| AuthScreen | `src/ui/auth-screen.ts` | ✓ T51, T272 (Model B: talkoolainen=yleissalasana, deep-link pending→login→avaa pätkä) | critical-paths: "yleissalasana" | [ui.md](docs/components/ui.md) |
| AuditLogPage | `src/ui/audit-log-page.ts` | ✓ T332 (vahvistus selviää uudelleenlatauksesta V241/B130), T321 (globaali loki + per-rivi undo, /loki) | e2e/t321-audit-log.spec.ts, tests/t321-audit-log-page.test.ts | [ui.md](docs/components/ui.md) |
| NamePrompt | `src/ui/name-prompt.ts` | ✓ T322 (nimi kesken session, ohitettava) | — | [ui.md](docs/components/ui.md) |
| SnapshotPanel | `src/ui/snapshot-panel.ts` | ✓ T164 (lataa/palauta tiedostosta) | — | [ui.md](docs/components/ui.md) |
| LeftPanel | `src/ui/left-panel.ts` | ✓ T73,T179 (onToggle callback),T181 (mobiili-drawer, default-collapsed ≤480px) | critical-paths: "Left panel"; e2e/t179-map-invalidate-size.spec.ts; e2e/t181-left-panel-mobile-drawer.spec.ts | [ui.md](docs/components/ui.md) |
| StatusPanel | `src/ui/status-panel.ts` | ✓ T28 | sprint-features: "T28" | [ui.md](docs/components/ui.md) |
| ModalHelpers | `src/ui/modal-helpers.ts` | ✓ T172 | — | [ui.md](docs/components/ui.md) |
| MarkerVisualRow | `src/ui/marker-visual-row.ts` | ✓ T198 | tests/t198-marker-visual-row.test.ts | [ui.md](docs/components/ui.md) |
| ImageLightbox | `src/ui/image-lightbox.ts` | ✓ T337 (jaettu kuori: valokuvat + kylttivisuaali, V246/B132) | tests/t337-image-lightbox.test.ts | [ui.md](docs/components/ui.md) |
| Toast | `src/ui/toast.ts` | ✓ T253 (jaettu "Kumoa"-toast, client-only undo V172; auto-dismiss, yksi kerrallaan, 44px §R) | tests/t253-toast.test.ts | [ui.md](docs/components/ui.md) |
| AreaDetailsModal | `src/ui/area-details-modal.ts` | ✓ | — | [ui.md](docs/components/ui.md) |
| AreaPanel | `src/ui/area-panel.ts` | ✓ | area-interaction | [ui.md](docs/components/ui.md) |
| AreaView | `src/ui/area-view.ts` | ✓ | — | [ui.md](docs/components/ui.md) |
| GpkgControls | `src/ui/gpkg-controls.ts` | ✓ T127 | — | [ui.md](docs/components/ui.md) |
| MarkerDetailModal | `src/ui/marker-detail-modal.ts` | ✓ T225 (talkoolaisen kova-poisto vain oma itse-luoma, V151), T396 (📍 Navigoi tähän -ankkuri bodyn alussa, href = `nav-link.ts`, V286) | screenshots: "marker-detail-modal"; tests/t396-nav-link-ui.test.ts | [ui.md](docs/components/ui.md) |
| FeedbackWidget | `src/devtools/feedback-widget.ts` | ✓ devtools | feedback-widget | — |
| BackendServer | `server/index.ts` | ✓ T41 | — | [backend.md](docs/components/backend.md) |
| DatabaseLayer | `server/db.ts` | ✓ | — | [backend.md](docs/components/backend.md) |
| SegmentsAPI | `server/routes/segments.ts` | ✓ T360 (track + excluded_marker_ids kuljetus; PUT säilyttää jäljen jos patch ei mainitse sitä), T416/V307 (talkoolaisen `linkedMarkerIds` = UNIONI ⊥ korvaus; vanhentunut client ⊥ typistä listaa), T417/V308 (jäsenyysdelta lokiin samassa transaktiossa) | server/t416-linked-markers.test.ts; server/t417-link-audit.test.ts | [backend.md](docs/components/backend.md) |
| AuthRoutes | `server/routes/auth.ts` | ✓ T317/T322 (talkoo-login vaatii nimen + POST /api/auth/name kesken session) | — | [backend.md](docs/components/backend.md) |
| Settings | `server/settings.ts` | ✓ T267 (settings-taulu key-value: talkoo_password_hash + faq_markdown; getSetting/setSetting) | — | [backend.md](docs/components/backend.md) |
| AdminRoutes | `server/routes/admin.ts` | ✓ T121, T267/T269 (talkoo-salasana + FAQ PUT) | — | [backend.md](docs/components/backend.md) |
| FaqRoutes | `server/routes/faq.ts` | ✓ T269 (GET /api/faq, ∀ autentikoitu; PUT admin.ts) | — | [backend.md](docs/components/backend.md) |
| MarkersAPI | `server/routes/markers.ts` | ✓ T226 (kanoninen ownership + audit-kirjaus + created_by) | — | [backend.md](docs/components/backend.md) |
| MarkerAudit | `server/marker-audit.ts` | ✓ T360 (allSegments + ownerSegmentIds: lähin jälki voittaa, peilaa clientin segment-membershipiä V259; aiemmin T316 segmentCodeForMarker V227), T417/V308 (`link`/`unlink`-actionit + `segmentCode`-ohitus: jäsenyysrivillä pätkää ⊥ johdeta merkin sijainnista) | server/t417-link-audit.test.ts | [backend.md](docs/components/backend.md) |
| TrackGeo | `server/track-geo.ts` | ✓ T360 (kohtisuora piste→jälki-etäisyys, TARKOITUKSELLINEN duplikaatti src/logic/segment-track.ts:stä; V261, oma peilitesti) | — | [backend.md](docs/components/backend.md) |
| AuditAPI | `server/routes/audit.ts` | ✓ T319 (+ per-rivi-undo /undo/:auditId + GET-suodattimet), T417/V308 (undo-whitelist: link/unlink → 400 not_undoable ⊥ hiljainen no-op) | server/t417-link-audit.test.ts | [backend.md](docs/components/backend.md) |
| InventoryAPI | `server/routes/inventory.ts` | ✓ T243 (v2: paikat `inventory_locations`-CRUD + `template_id`-merkkilinkki V165 + location_id-suodatus V166; snapshot-name; V161/V162/V163) | — | [backend.md](docs/components/backend.md) |
| TemplatesAPI | `server/routes/templates.ts` | ✓ T192 | — | [backend.md](docs/components/backend.md) |
| AreasAPI | `server/routes/areas.ts` | ✓ | area-interaction | [backend.md](docs/components/backend.md) |
| DevFeedbackAPI | `server/routes/devfeedback.ts` | ✓ | — | [backend.md](docs/components/backend.md) |
| CronRoutes | `server/routes/cron.ts` | ✓ T163 | — | [backend.md](docs/components/backend.md) |
| GpkgGeoJSON | `server/gpkg/geojson.ts` | ✓ T124 | — | [backend.md](docs/components/backend.md) |
| GpkgConvert | `server/gpkg/convert.ts` | ✓ T125 | — | [backend.md](docs/components/backend.md) |
| GpkgRoutes | `server/routes/gpkg.ts` | ✓ T126 | — | [backend.md](docs/components/backend.md) |
| AuthMiddleware | `server/middleware/auth.ts` | ✓ | — | [backend.md](docs/components/backend.md) |
| SnapshotScheduler | `server/snapshot-scheduler.ts` | ✓ T162 (best-effort, ks. V101) | — | [backend.md](docs/components/backend.md) |
| SnapshotData | `server/snapshot-data.ts` | ✓ T162 | — | [backend.md](docs/components/backend.md) |
| ServerTypes | `server/types.ts` | ✓ | — | [backend.md](docs/components/backend.md) |
| MapStateAPI | `server/routes/admin.ts` | ⚠️ dead T48 — approval poistettu (V22/B46/V79), poisto T211 | — | [backend.md](docs/components/backend.md) |
| OfflineManager | `public/sw.js` *(ei vielä)* | ○ T18 | — | [backend.md](docs/components/backend.md) |
| AdminPage | `admin.html` + `src/admin.ts` + `src/ui/admin-page.ts` | ✓ T122, T268 (renderAdminSettings: talkoo-salasana) | — | [ui.md](docs/components/ui.md) |
| PatkatPage | `patkat.html` + `src/patkat.ts` + `src/ui/patkat-page.ts` | ✓ T271 (talkoolais-hub: hero+FAQ+pätkälista+Kartalle; sanitizeHtml V190; auth-gate) | e2e: — (jsdom t271; Playwright deferred) | [ui.md](docs/components/ui.md) |
| InventoryLinkPicker | `src/ui/inventory-link-picker.ts` | ✓ T399 (merkkipohjaa LUOTAESSA: top-3 varastoehdotusta kirjoitetun nimen alle + haettava täyslista; valinta täyttää nimen siivottuna & PUT ajetaan vasta tallennuksessa V288; callback/haku puuttuu → osio pois hiljaa V289) | tests/t399-inventory-link-picker.test.ts | [ui.md](docs/components/ui.md) |
| InventoryMergePanel | `src/ui/inventory-merge-panel.ts` | ✓ T386 (järjestäjän "Yhdistä"-työkalu: linkittämättömät rivit → top-3 ehdotusta (T384) + Linkitä/Luo merkkipohja/Ei merkki, saman paikan duplikaatti → merge (T385); jokainen kuittaus persistoituu heti — ⊥ massanappia (V277), ⊥ "Tallenna kaikki") | tests/t386-inventory-merge-panel.test.ts | [ui.md](docs/components/ui.md) |
| InventoryPage | `inventory.html` + `src/inventory.ts` + `src/ui/inventory-page.ts` | ✓ T253 (client-only "Kumoa"-undo: poisto/qty/siirto/paikan poisto → toast, revert olemassa oleviin reitteihin V172/V173), T251 (v2.3: read/edit-viewMode — oletus read tiivis katselu, edit paljastaa mutaatiot, sessiokohtainen reload→read, V169-V171; v2: paikkatabit+Kaikki-koonti, muokkaus-mode V166, merkki-visuaali+zoom V167, nimi→SignTemplateModal, siirto; picker-reuse V165; V163/V164) | e2e/inv-undo.spec.ts (undo-revert V173a/b/c), e2e/inv-mobile.spec.ts | [ui.md](docs/components/ui.md) |

**Tila:** ✓ = valmis (+ viimeisin T-id) | ○ T-id = tulossa | ⚠️ pilkko = pilkkolippu

---

## MVP-vaiheet

Task-statukset ja sisällöt: **SPEC.md §T**. Tässä vain vaihejako ja avoimet task-id:t.

- **Vaihe 1 — Suunnittelu + merkinnät** (yksi laite): **VALMIS ✓**
- **Vaihe 2 — Multi-device + auth** (backend totuus): **VALMIS ✓**
  *(Huom 2026-06-25: offline-first/localStorage-arkkitehtuuri korvattu — backend on ainoa totuus (V18). T42/T43 vanhentuneet.)*
- **Vaihe 3 — Talkoolainen metsässä** (täysi kenttätyöflow): T74, T78, T79, T75, T72, T134
- **Vaihe 4 — POI + purku:** T76, T19, T20, T80, T103
- **Myöhemmin / tarvittaessa:** T7, T18, T21, T34, T39, T102

Lisää: [backend.md — Vaiheistus](docs/components/backend.md)

---

## Pilkkohälytykset

Rivimäärät laskee `/karttamaster-arkkitehtuuri analysoi` livenä (`wc -l`) — ei lukuja tähän.
Lippu ilman toimenpidettä on hukkaa: ⚠️-tason lippu → varmista pilkko-§T-task SPEC:ssä.

| Moduuli | Lippu | Peruste |
|---|---|---|
| `src/ui/sign-library-panel.ts` | ✓ T235 | PILKOTTU 2026-07-10: modaali → `sign-template-modal.ts` (729r); panel 194r lista/grid |
| `src/ui/segment-view.ts` | ✓ T234 | PILKOTTU 2026-07-10: hero → `segment-hero.ts` (248r); view 562r koordinaattori |
| `src/ui/segment-details-modal.ts` | ⚠️ | monta vastuuta. T346 päätti moduulirajat: Tiedot / Sisältö / Jako / Kartta / Vaiheet — pilkkominen seuraa näitä, ei keksi uusia. T354 teki rajat NÄKYVIKSI (Sisältö = kaksi tabia, loput Asetukset-tabin sisäotsikoita) ∴ pilkko-§T voi seurata tabijakoa suoraan |
| `src/ui/area-panel.ts` | ⚠️ | ylittää 400 riv -kynnyksen (analysoi 2026-07-04) |
| `src/ui/inventory-page.ts` | ⚠️ | suurin UI-moduuli; vastuut eriytyneet: read/edit-viewMode + paikkatabit + add-form + undo-toast (analysoi 2026-07-25) |
| `src/map/markers.ts` | evaluoitu → KEEP | T236 2026-07-10: API-glue JO eriytetty V116-outboxiin; reconcile/addImage ovat domain-mutaattoreita → irrotus jakaisi totuuslähteen. Ei pilkota. |
| `src/ui/marker-detail-modal.ts` | seuraa | kasvoi T103/T137:ssä |
| `src/map/map-rect-editor.ts` | seuraa | erota drag-logiikka jos vastuut eriytyvät |
| `src/map/area-overlay.ts` | seuraa | — |
| `src/devtools/feedback-widget.ts` | ei pilkota | devtools, ei tuotantoon — mutta ei kasvateta |

---

## Päivitysohjeet skilleille

**`/karttamaster-arkkitehtuuri`** — uusi komponentti:
1. Lisää rivi komponenttitaulukkoon (tila ○)
2. Lisää yksityiskohdat oikeaan `docs/components/`-tiedostoon
3. Ei rivimääriä eikä changelog-tekstiä taulukkosoluihin

**`/ck:spec`** — uusi §T-task:
1. Tarkista onko komponentti taulukossa (○ tai ✓); jos ei, lisää ensin
2. Task valmis → tila ✓ + T-id (src/logic/: vain jos Taso 1 -testi olemassa, ks. sync-spec)

**Synkronointi:** `sync-spec` päivittää statukset SPEC §T:stä; `analysoi` päivittää pilkkoliput
live-rivimääristä. Kumpaakaan ei ylläpidetä käsin muistin varassa.
