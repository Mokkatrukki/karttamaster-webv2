# COMPONENTS.md — Karttamaster komponenttirekisteri (indeksi)

Lähde totuus arkkitehtuurista. Päivitetään ennen kuin feature lisätään.
Ohjaavat periaatteet: VISION.md. Taskit ja invariantit: SPEC.md.

**Yksityiskohdat hakemistossa:** `docs/components/`

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
| BearingMath | `src/logic/bearing.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| GpxLoader | `src/logic/gpx.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| MultiRouteAssigner | `src/logic/multi-route.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| SignTypes | `src/logic/sign-picker.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| TileLayers | `src/logic/tile-layers.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| Types | `src/logic/types.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| PersistenceLayer | `src/logic/persistence.ts` | ✓ T29 | — | [logic.md](docs/components/logic.md) |
| SignLibrary | `src/logic/sign-library.ts` | ✓ T8 | — | [logic.md](docs/components/logic.md) |
| MarkerStatus | `src/logic/marker-status.ts` | ✓ T10 | — | [logic.md](docs/components/logic.md) |
| SegmentManager | `src/logic/segments.ts` | ✓ T13 | — | [logic.md](docs/components/logic.md) |
| RoleController | `src/logic/role.ts` | ✓ T12 | critical-paths: "Rooli-toggle" | [logic.md](docs/components/logic.md) |
| SituationLogic | `src/logic/situation.ts` *(ei vielä)* | ○ T15 | — | [logic.md](docs/components/logic.md) |
| NavigationLogic | `src/logic/navigation.ts` | ✓ T16 | — | [logic.md](docs/components/logic.md) |
| SegmentSync | `src/logic/segment-sync.ts` | ✓ T62 | — | [logic.md](docs/components/logic.md) |
| AreaTypes | `src/logic/area-types.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| AreaGeometry | `src/logic/area-geometry.ts` 126 riv | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| AreaSync | `src/logic/area-sync.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| IconSet | `src/logic/icon-set.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| MarkerAssign | `src/logic/marker-assign.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| RouteStatus | `src/logic/route-status.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| SegmentActions | `src/logic/segment-actions.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| SegmentPersistence | `src/logic/segment-persistence.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| Sync | `src/logic/sync.ts` | ✓ valmis | — | [logic.md](docs/components/logic.md) |
| SignIcon | `src/map/icons.ts` | ✓ valmis | critical-paths: "toolbar-dropdown" | [map.md](docs/components/map.md) |
| DriveMode | `src/map/drive.ts` | ✓ valmis | critical-paths: "Drive mode" | [map.md](docs/components/map.md) |
| MarkerManager | `src/map/markers.ts` 294 riv | ✓+B1 | critical-paths: "Merkki kartalle", "Drag-to-move" | [map.md](docs/components/map.md) |
| MarkerInteraction | `src/map/marker-interaction.ts` 179 riv | ✓ | critical-paths: "dblclick", "Rotation arm sticky" | [map.md](docs/components/map.md) |
| RouteBar | `src/map/route-bar.ts` 125 riv | ✓ pilkko | — | [map.md](docs/components/map.md) |
| GpsNavigator | `src/map/gps-navigator.ts` | ✓ T30 | critical-paths: "GPS-paikannin" | [map.md](docs/components/map.md) |
| AreaOverlay | `src/map/area-overlay.ts` 261 riv | ✓ valmis | area-interaction | [map.md](docs/components/map.md) |
| MapRectEditor | `src/map/map-rect-editor.ts` 316 riv | ✓ T117 | area-interaction | [map.md](docs/components/map.md) |
| SegmentOverlay | `src/map/segment-overlay.ts` 184 riv | ✓ valmis | — | [map.md](docs/components/map.md) |
| MarkerListUI | `src/ui/marker-list.ts` 261 riv | ✓ T11,T24 | — | [ui.md](docs/components/ui.md) |
| ProgressBar | `src/ui/progress-bar.ts` | ✓ pilkko | critical-paths: "Drive mode" | [ui.md](docs/components/ui.md) |
| PlaceMode | `src/ui/place-mode.ts` | ✓+B2 | critical-paths: "Merkki kartalle", "dblclick" | [ui.md](docs/components/ui.md) |
| AppController | `src/main.ts` 414 riv ⚠️ | ✓ pilkko | critical-paths: kaikki | [ui.md](docs/components/ui.md) |
| SignLibraryPanel | `src/ui/sign-library-panel.ts` 340 riv | ✓ T22 | — | [ui.md](docs/components/ui.md) |
| RoleSelector | `src/ui/role-selector.ts` | ✓ T12 | critical-paths: "Rooli-toggle" | [ui.md](docs/components/ui.md) |
| SegmentPanel | `src/ui/segment-panel.ts` 279 riv | ✓ T25 | — | [ui.md](docs/components/ui.md) |
| SegmentCreationModal | `src/ui/segment-creation-modal.ts` 195 riv | ✓ valmis | — | [ui.md](docs/components/ui.md) |
| SegmentDetailsModal | `src/ui/segment-details-modal.ts` 490 riv | ✓ valmis | — | [ui.md](docs/components/ui.md) |
| EquipmentList | `src/ui/segment-view.ts` | ✓ T27 | — | [ui.md](docs/components/ui.md) |
| AuthScreen | `src/ui/auth-screen.ts` 160 riv | ✓ T51 | — | [ui.md](docs/components/ui.md) |
| MapStateBadge | `src/ui/map-state-badge.ts` | ✓ T49 | sprint-features: "T49" | [ui.md](docs/components/ui.md) |
| SnapshotPanel | `src/ui/snapshot-panel.ts` 172 riv | ✓ T50 | — | [ui.md](docs/components/ui.md) |
| LeftPanel | `src/ui/left-panel.ts` | ✓ T73 | critical-paths: "Left panel" | [ui.md](docs/components/ui.md) |
| StatusPanel | `src/ui/status-panel.ts` | ✓ T28 | sprint-features: "T28" | [ui.md](docs/components/ui.md) |
| ModalHelpers | `src/ui/modal-helpers.ts` | ✓ valmis | — | [ui.md](docs/components/ui.md) |
| AreaDetailsModal | `src/ui/area-details-modal.ts` 370 riv | ✓ valmis | — | [ui.md](docs/components/ui.md) |
| AreaPanel | `src/ui/area-panel.ts` 367 riv | ✓ valmis | area-interaction | [ui.md](docs/components/ui.md) |
| AreaView | `src/ui/area-view.ts` | ✓ valmis | — | [ui.md](docs/components/ui.md) |
| GpsDrivePanel | `src/ui/gps-drive-panel.ts` | ✓ T30 | — | [ui.md](docs/components/ui.md) |
| MarkerDetailModal | `src/ui/marker-detail-modal.ts` 343 riv | ✓ T103 (kuvaus+kuvat) | — | [ui.md](docs/components/ui.md) |
| FeedbackWidget | `src/devtools/feedback-widget.ts` 494 riv | ✓ devtools | feedback-widget | — |
| BackendServer | `server/index.ts` | ✓ T41 | — | [backend.md](docs/components/backend.md) |
| DatabaseLayer | `server/db.ts` 151 riv | ✓ valmis | — | [backend.md](docs/components/backend.md) |
| SegmentsAPI | `server/routes/segments.ts` | ✓ T61 | — | [backend.md](docs/components/backend.md) |
| AuthRoutes | `server/routes/auth.ts` | ✓ T36 | — | [backend.md](docs/components/backend.md) |
| AdminRoutes | `server/routes/admin.ts` | ✓ T121 (users/invites/codes/is_active/reset-password) | — | [backend.md](docs/components/backend.md) |
| MarkersAPI | `server/routes/markers.ts` | ✓ T47+T103 (description+images) | — | [backend.md](docs/components/backend.md) |
| AreasAPI | `server/routes/areas.ts` 231 riv | ✓ valmis | area-interaction | [backend.md](docs/components/backend.md) |
| DevFeedbackAPI | `server/routes/devfeedback.ts` | ✓ valmis | — | [backend.md](docs/components/backend.md) |
| GpkgGeoJSON | `server/gpkg/geojson.ts` | ✓ T124 | — | [backend.md](docs/components/backend.md) |
| GpkgConvert | `server/gpkg/convert.ts` *(ei vielä)* | ○ T125,T126 | — | [backend.md](docs/components/backend.md) |
| GpkgRoutes | `server/routes/gpkg.ts` *(ei vielä)* | ○ T125,T126 | — | [backend.md](docs/components/backend.md) |
| AuthMiddleware | `server/middleware/auth.ts` | ✓ valmis | — | [backend.md](docs/components/backend.md) |
| SnapshotScheduler | `server/snapshot-scheduler.ts` | ✓ valmis | — | [backend.md](docs/components/backend.md) |
| ServerTypes | `server/types.ts` | ✓ valmis | — | [backend.md](docs/components/backend.md) |
| MapStateAPI | `server/routes/admin.ts` | ○ T48 | — | [backend.md](docs/components/backend.md) |
| OfflineManager | `public/sw.js` *(ei vielä)* | ○ T18 | — | [backend.md](docs/components/backend.md) |
| AdminPage | `admin.html` + `src/admin.ts` + `src/ui/admin-page.ts` | ✓ T122 | — | [ui.md](docs/components/ui.md) |

**Tila:** ✓ = valmis, ○ = tulossa, B# = avoin bugi, pilkko = rivimäärä kasvaa, ⚠️ = kriittinen pilkko

---

## MVP-rajaus

> **Huom 2026-06-25:** Vaihe 1/2a/2b-jako poistettu — se kuvasi offline-first/localStorage-arkkitehtuuria joka on korvattu. Backend on ainoa totuus (V18). localStorage ei enää käytetä merkeille eikä segmenteille (T63–T65). T42 sync-logiikka ja T43 merge-UI ovat vanhentuneita — backend-write on synkronointi.

---

**Vaihe 1 — Suunnittelu + merkinnät** (yksi laite, perustoiminnot): **VALMIS ✓**
GPX-lataus, merkit kartalle, bearing, drive mode, sign library, persistointi.
Taskit: T1–T6, T8–T12, T15–T16, T22–T23, T29–T33, T37–T38, T40, T44–T46.

**Vaihe 2 — Multi-device + auth** (backend totuus, useampi laite): **VALMIS ✓**
Backend, auth, markers API, segments backend, direct-write, snapshot, auth screen.
Taskit: T36, T41, T47–T55, T59–T68, T70–T73, T81–T101, T104–T105, T115–T117.

**Vaihe 3 — Talkoolainen metsässä** (täysi kenttätyöflow):
Kriittisin puuttuva: talkoolaisen UX viimeistely + reaaliaikainen sync järjestäjälle.
- **T74** CheckIn bottom sheet — kuittaus-UX talkoolaiselle
- **T78** Pätkän pituuden muokkaus kentällä
- **T79** Reaaliaikainen sync (SSE/polling) — järjestäjä näkee muutokset <15s
- **T75** Kommentti-systeemi (merkki/pätkä/vapaa piste)
- **T72** Teema-toggle (daylight-teema metsässä auringossa)

**Vaihe 4 — POI + purku:**
- **T76** POI-järjestelmä (huoltoalueet, noutopisteet, kasat)
- **T19** Purkupätkä (lähtösuunnan valinta)
- **T20** Kasauspisteet (bulk-kerätty)
- **T80** Materiaalien kirjaus purku-vaiheessa
- **T103** Kuva + lisäkuvaus per merkki

**Myöhemmin / tarvittaessa:**
- T7 (GPX-reitit 3+4 — tiedostot ei saatavilla)
- T18 (offline/PWA)
- T21 (live tracking — oma GPS muille näkyviin)
- T34 (GPX-korvaus merge-flow)
- T39 (drive mode "hyppää seuraavaan")
- T102 (merkkilista-haku — järjestäjälle)

Lisää: [backend.md — Vaiheistus](docs/components/backend.md)

---

## Pilkkohälytykset

| Moduuli | Rivit | Milloin pilkotaan |
|---|---|---|
| `src/ui/segment-details-modal.ts` | **490** | Seuraa |
| `src/ui/area-panel.ts` | **367** | Seuraa |
| `src/devtools/feedback-widget.ts` | **494** | Devtools, ei tuotantoon — ei pilkota mutta ei kasvateta |
| `src/main.ts` | **414** | ⚠️ KRIITTINEN — 5× liian iso init-tiedostolle, pilkottava (T12/T32) |
| `src/map/map-rect-editor.ts` | **316** | Seuraa — erota drag-logiikka jos kasvaa >400 riv |
| `src/ui/sign-library-panel.ts` | **340** | Seuraa |
| `src/ui/marker-detail-modal.ts` | **343** | Seuraa — kasvoi T103:ssa (kuvaus+kuvat), harkitse pilkkoa jos >400 riv |
| `src/map/area-overlay.ts` | **261** | Seuraa |
| `src/map/markers.ts` | **294** | Seuraa — pilkottava ennen T10 |
| `src/map/marker-interaction.ts` | **179** | Seuraa — jos kasvaa >250 riv, erota rotation omaksi |

---

## Päivitysohjeet skilleille

**`/karttamaster-arkkitehtuuri`** — kun lisätään uusi komponentti:
1. Lisää rivi komponenttitaulukkoon tähän tiedostoon
2. Lisää yksityiskohdat oikeaan `docs/components/`-tiedostoon

**`/ck:spec`** — kun uusi §T-task lisätään:
1. Tarkista onko komponentti jo COMPONENTS.md:ssä (○ tai ✓)
2. Jos ei ole, lisää komponenttitaulukkoon ensin
3. Päivitä status ✓ kun task valmis

**Synkronointi:** SPEC.md §T task-id:t vastaavat `docs/components/`-tiedostojen Tulossa-listoja. Kun task merkitään ✓ SPEC:issä, päivitä ominaisuus → ✓ ja status → ✓ tässä tiedostossa.
