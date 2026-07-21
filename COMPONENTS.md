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
| Types | `src/logic/types.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| Uid | `src/logic/uid.ts` | ✓ T238 (turva-genId, guard+insecure-fallback B103) | — | [logic.md](docs/components/logic.md) |
| SignLibrary | `src/logic/sign-library.ts` | ✓ T171 | — | [logic.md](docs/components/logic.md) |
| MarkerStatus | `src/logic/marker-status.ts` | ✓ T10 | — | [logic.md](docs/components/logic.md) |
| SegmentManager | `src/logic/segments.ts` | ✓ T153 | — | [logic.md](docs/components/logic.md) |
| TaskMarkers | `src/logic/task-markers.ts` | ✓ T214 | — | [logic.md](docs/components/logic.md) |
| PhaseView | `src/logic/phase-view.ts` | ✓ T148 | — | [logic.md](docs/components/logic.md) |
| RoleController | `src/logic/role.ts` | ✓ T12 (V80: rooli backendistä, toggle dead code) | critical-paths: "Rooli backendistä" | [logic.md](docs/components/logic.md) |
| SituationLogic | `src/logic/situation.ts` *(ei vielä)* | ○ T15 | — | [logic.md](docs/components/logic.md) |
| NavigationLogic | `src/logic/navigation.ts` | ✓ T16 | — | [logic.md](docs/components/logic.md) |
| SegmentSync | `src/logic/segment-sync.ts` | ✓ T62 | — | [logic.md](docs/components/logic.md) |
| AreaTypes | `src/logic/area-types.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| AreaGeometry | `src/logic/area-geometry.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| AreaSync | `src/logic/area-sync.ts` | ✓ T154 | — | [logic.md](docs/components/logic.md) |
| TemplateSync | `src/logic/template-sync.ts` | ✓ T193 | — | [logic.md](docs/components/logic.md) |
| IconSet | `src/logic/icon-set.ts` | ✓ T159 | — | [logic.md](docs/components/logic.md) |
| MarkerAssign | `src/logic/marker-assign.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| RouteStatus | `src/logic/route-status.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| SegmentActions | `src/logic/segment-actions.ts` | ✓ | — | [logic.md](docs/components/logic.md) |
| SignVisual | `src/logic/sign-visual.ts` | ✓ T171 | — | [logic.md](docs/components/logic.md) |
| SignImages | `src/logic/sign-images.ts` | ✓ T158 (Vite glob, 89 kuvaa T161:stä) | — | [logic.md](docs/components/logic.md) |
| Sync | `src/logic/sync.ts` | ✓ T226 (createdBy-mäppäys) | — | [logic.md](docs/components/logic.md) |
| AuditSync | `src/logic/audit-sync.ts` | ✓ T227 (fetchSegmentAudit + undoSegmentActions) | tests/audit-sync.test.ts | [logic.md](docs/components/logic.md) |
| WriteOutbox | `src/logic/write-outbox.ts` + `outbox-instance.ts` | ✓ T183 (durable kirjoitusjono, V116) | — | [logic.md](docs/components/logic.md) |
| MarkerScale | `src/logic/marker-scale.ts` | ✓ T175 | — | [logic.md](docs/components/logic.md) |
| SegmentZoom | `src/logic/segment-zoom.ts` | ✓ T224 (planSegmentZoom: fit vs anchor pätkän latauksessa) | tests/t224-segment-zoom.test.ts | [logic.md](docs/components/logic.md) |
| SignIcon | `src/map/icons.ts` | ✓ T172 | critical-paths: "toolbar-dropdown", "yhdistelmämerkki" | [map.md](docs/components/map.md) |
| DriveMode | `src/map/drive.ts` | ✓ | critical-paths: "Drive mode" | [map.md](docs/components/map.md) |
| MarkerManager | `src/map/markers.ts` | ✓ T222 (setDraggablePredicate: vain oman pätkän merkit raahattavia talkoolaiselle, V150) | critical-paths: "Merkki kartalle", "Drag-to-move", "Merkin zoom-skaalaus", "tallennus epäonnistuu" | [map.md](docs/components/map.md) |
| RouteBar | `src/map/route-bar.ts` | ✓ (T224: piilotettu talkoolaiselta, `#route-bar` hidden) | — | [map.md](docs/components/map.md) |
| NextMarkerHighlight | `src/map/next-marker-highlight.ts` | ✓ T224/b1 (seuraava merkki korostuu kartalla) | — (Leaflet-glue) | [map.md](docs/components/map.md) |
| GpsNavigator | `src/map/gps-navigator.ts` | ✓ T30 | critical-paths: "GPS-paikannin" | [map.md](docs/components/map.md) |
| AreaOverlay | `src/map/area-overlay.ts` | ✓ | area-interaction | [map.md](docs/components/map.md) |
| MapRectEditor | `src/map/map-rect-editor.ts` | ✓ T117 | area-interaction | [map.md](docs/components/map.md) |
| SegmentOverlay | `src/map/segment-overlay.ts` | ✓ T152, T217 (reititön skip) | segments: "viivatyyli koodaa statuksen"; t217: routeless gap-safety (Taso-1, Playwright post-T216) | [map.md](docs/components/map.md) |
| MarkerListUI | `src/ui/marker-list.ts` | ✓ T24 | — | [ui.md](docs/components/ui.md) |
| ProgressBar | `src/ui/progress-bar.ts` | ✓ | critical-paths: "Drive mode" | [ui.md](docs/components/ui.md) |
| PlaceMode | `src/ui/place-mode.ts` | ✓ T172 | critical-paths: "Merkki kartalle", "dblclick", "sivupalkin merkkikirjastosta" | [ui.md](docs/components/ui.md) |
| AppController | `src/main.ts` | ✓ T155 | critical-paths: kaikki | [ui.md](docs/components/ui.md) |
| MapInit | `src/app/map-init.ts` | ✓ T179 | critical-paths: kaikki (kartan pohja); e2e/t179-map-invalidate-size.spec.ts | [ui.md](docs/components/ui.md) |
| RoleView | `src/app/role-view.ts` | ✓ T155 | critical-paths: "Auth screen", "Rooli backendistä" | [ui.md](docs/components/ui.md) |
| AreasWiring | `src/app/areas-wiring.ts` | ✓ T155 | area-interaction | [ui.md](docs/components/ui.md) |
| SegmentsWiring | `src/app/segments-wiring.ts` | ✓ T155 | e2e/segments.spec.ts | [ui.md](docs/components/ui.md) |
| MarkersWiring | `src/app/markers-wiring.ts` | ✓ T182,T224 (zoom-to-segment, alapalkki piilotettu, next-highlight, gps-drive-panel poistettu) | critical-paths: "Merkki kartalle", "Drive mode", "tallennus epäonnistuu" | [ui.md](docs/components/ui.md) |
| SignLibraryPanel | `src/ui/sign-library-panel.ts` | ✓ T176, T235 (194r lista/grid; modaali irrotettu) | critical-paths: "sivupalkin merkkikirjastosta" | [ui.md](docs/components/ui.md) |
| SignTemplateModal | `src/ui/sign-template-modal.ts` | ✓ T235 (malli-detalji/muokkaus-modaali, irrotettu SignLibraryPanelista; XSS-escape B19/V44) | (kattaa sign-library-panel-testit) | [ui.md](docs/components/ui.md) |
| RoleSelector | `src/ui/role-selector.ts` | ✓ T12 (V80: toggle dead code) | critical-paths: "Rooli backendistä" | [ui.md](docs/components/ui.md) |
| SegmentPanel | `src/ui/segment-panel.ts` | ✓ T148 | e2e/segments.spec.ts ".segment-km näyttää status-lukumäärän" | [ui.md](docs/components/ui.md) |
| SegmentCreationModal | `src/ui/segment-creation-modal.ts` | ✓ T150 | — | [ui.md](docs/components/ui.md) |
| SegmentDetailsModal | `src/ui/segment-details-modal.ts` | ✓ T146,T199,T227 (supervision: aktiviteettiloki + massaperuutus) ⚠️ pilkko | tests/t69-segment-details-modal.test.ts, tests/t199-segment-markers-list.test.ts | [ui.md](docs/components/ui.md) |
| SegmentView | `src/ui/segment-view.ts` | ✓ T228, T218 (dynaaminen keräyslista), T234 (562r koordinaattori; hero irrotettu) | tests/t14-segment-view.test.ts, tests/t224-segment-view.test.ts, tests/t218-collection-list.test.ts; e2e/segments.spec.ts | [ui.md](docs/components/ui.md) |
| SegmentHero | `src/ui/segment-hero.ts` | ✓ T234 (seuraava-merkki-hero + ◀▶-nav + selectedNavId V159, irrotettu SegmentViewsta) | tests/t232-segment-view-hero.test.ts | [ui.md](docs/components/ui.md) |
| EquipmentModal | `src/ui/equipment-modal.ts` | ✓ T224/C (talkoolaisen varustelista tilavana modaalina) | tests/t224-equipment-modal.test.ts | [ui.md](docs/components/ui.md) |
| PhaseSwitcher | `src/ui/phase-switcher.ts` | ✓ T148,T180 (stopPropagation, B80) | e2e/t180-phase-switcher-menu.spec.ts | [ui.md](docs/components/ui.md) |
| AuthScreen | `src/ui/auth-screen.ts` | ✓ T51 | — | [ui.md](docs/components/ui.md) |
| SnapshotPanel | `src/ui/snapshot-panel.ts` | ✓ T164 (lataa/palauta tiedostosta) | — | [ui.md](docs/components/ui.md) |
| LeftPanel | `src/ui/left-panel.ts` | ✓ T73,T179 (onToggle callback),T181 (mobiili-drawer, default-collapsed ≤480px) | critical-paths: "Left panel"; e2e/t179-map-invalidate-size.spec.ts; e2e/t181-left-panel-mobile-drawer.spec.ts | [ui.md](docs/components/ui.md) |
| StatusPanel | `src/ui/status-panel.ts` | ✓ T28 | sprint-features: "T28" | [ui.md](docs/components/ui.md) |
| ModalHelpers | `src/ui/modal-helpers.ts` | ✓ T172 | — | [ui.md](docs/components/ui.md) |
| MarkerVisualRow | `src/ui/marker-visual-row.ts` | ✓ T198 | tests/t198-marker-visual-row.test.ts | [ui.md](docs/components/ui.md) |
| AreaDetailsModal | `src/ui/area-details-modal.ts` | ✓ | — | [ui.md](docs/components/ui.md) |
| AreaPanel | `src/ui/area-panel.ts` | ✓ | area-interaction | [ui.md](docs/components/ui.md) |
| AreaView | `src/ui/area-view.ts` | ✓ | — | [ui.md](docs/components/ui.md) |
| GpkgControls | `src/ui/gpkg-controls.ts` | ✓ T127 | — | [ui.md](docs/components/ui.md) |
| MarkerDetailModal | `src/ui/marker-detail-modal.ts` | ✓ T225 (talkoolaisen kova-poisto vain oma itse-luoma, V151) | screenshots: "marker-detail-modal" | [ui.md](docs/components/ui.md) |
| FeedbackWidget | `src/devtools/feedback-widget.ts` | ✓ devtools | feedback-widget | — |
| BackendServer | `server/index.ts` | ✓ T41 | — | [backend.md](docs/components/backend.md) |
| DatabaseLayer | `server/db.ts` | ✓ | — | [backend.md](docs/components/backend.md) |
| SegmentsAPI | `server/routes/segments.ts` | ✓ T149 | — | [backend.md](docs/components/backend.md) |
| AuthRoutes | `server/routes/auth.ts` | ✓ T36 | — | [backend.md](docs/components/backend.md) |
| AdminRoutes | `server/routes/admin.ts` | ✓ T121 | — | [backend.md](docs/components/backend.md) |
| MarkersAPI | `server/routes/markers.ts` | ✓ T226 (kanoninen ownership + audit-kirjaus + created_by) | — | [backend.md](docs/components/backend.md) |
| MarkerAudit | `server/marker-audit.ts` | ✓ T226 (ownSegments + markerInOwnSegment-unioni V154 + logMarkerAudit) | — | [backend.md](docs/components/backend.md) |
| AuditAPI | `server/routes/audit.ts` | ✓ T227 (GET /api/audit + POST /api/audit/undo massaperuutus) | — | [backend.md](docs/components/backend.md) |
| TemplatesAPI | `server/routes/templates.ts` | ✓ T192 | — | [backend.md](docs/components/backend.md) |
| AreasAPI | `server/routes/areas.ts` | ✓ | area-interaction | [backend.md](docs/components/backend.md) |
| DevFeedbackAPI | `server/routes/devfeedback.ts` | ✓ | — | [backend.md](docs/components/backend.md) |
| CronRoutes | `server/routes/cron.ts` | ✓ T163 | — | [backend.md](docs/components/backend.md) |
| CommentsAPI | `server/routes/comments.ts` | ~ T221 (backend: comments-taulu + GET/POST/DELETE; UI-slice kesken) | — | [backend.md](docs/components/backend.md) |
| GpkgGeoJSON | `server/gpkg/geojson.ts` | ✓ T124 | — | [backend.md](docs/components/backend.md) |
| GpkgConvert | `server/gpkg/convert.ts` | ✓ T125 | — | [backend.md](docs/components/backend.md) |
| GpkgRoutes | `server/routes/gpkg.ts` | ✓ T126 | — | [backend.md](docs/components/backend.md) |
| AuthMiddleware | `server/middleware/auth.ts` | ✓ | — | [backend.md](docs/components/backend.md) |
| SnapshotScheduler | `server/snapshot-scheduler.ts` | ✓ T162 (best-effort, ks. V101) | — | [backend.md](docs/components/backend.md) |
| SnapshotData | `server/snapshot-data.ts` | ✓ T162 | — | [backend.md](docs/components/backend.md) |
| ServerTypes | `server/types.ts` | ✓ | — | [backend.md](docs/components/backend.md) |
| MapStateAPI | `server/routes/admin.ts` | ⚠️ dead T48 — approval poistettu (V22/B46/V79), poisto T211 | — | [backend.md](docs/components/backend.md) |
| OfflineManager | `public/sw.js` *(ei vielä)* | ○ T18 | — | [backend.md](docs/components/backend.md) |
| AdminPage | `admin.html` + `src/admin.ts` + `src/ui/admin-page.ts` | ✓ T122 | — | [ui.md](docs/components/ui.md) |

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
| `src/ui/segment-details-modal.ts` | ⚠️ | monta vastuuta: nimi/kuvaus/merkit/varusteet/assign/editpts/klooni/poisto |
| `src/ui/area-panel.ts` | ⚠️ | ylittää 400 riv -kynnyksen (analysoi 2026-07-04) |
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
