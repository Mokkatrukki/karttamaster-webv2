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
server/       ← Hono + Bun + SQLite (tulossa)
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
| SignIcon | `src/map/icons.ts` | ✓ valmis | critical-paths: "toolbar-dropdown" | [map.md](docs/components/map.md) |
| DriveMode | `src/map/drive.ts` | ✓ valmis | critical-paths: "Drive mode" | [map.md](docs/components/map.md) |
| MarkerManager | `src/map/markers.ts` | ✓+T38,B1 | critical-paths: "Merkki kartalle", "Drag-to-move" | [map.md](docs/components/map.md) |
| MarkerInteraction | `src/map/marker-interaction.ts` 192 riv | ✓ | critical-paths: "dblclick", "Rotation arm sticky" | [map.md](docs/components/map.md) |
| MarkerListUI | `src/ui/marker-list.ts` | ✓ T11,T24 | — | [ui.md](docs/components/ui.md) |
| RouteBar | `src/map/route-bar.ts` 108 riv | ✓ pilkko | — | [map.md](docs/components/map.md) |
| ProgressBar | `src/ui/progress-bar.ts` | ✓ pilkko | critical-paths: "Drive mode" | [ui.md](docs/components/ui.md) |
| PlaceMode | `src/ui/place-mode.ts` | ✓+B2 | critical-paths: "Merkki kartalle", "dblclick" | [ui.md](docs/components/ui.md) |
| AppController | `src/main.ts` 143 riv | ✓ valmis | critical-paths: kaikki | [ui.md](docs/components/ui.md) |
| PersistenceLayer | `src/logic/persistence.ts` | ○ T29 | — | [logic.md](docs/components/logic.md) |
| SignLibrary | `src/logic/sign-library.ts` | ○ T8 | — | [logic.md](docs/components/logic.md) |
| MarkerStatus | `src/logic/marker-status.ts` | ✓ T10 | — | [logic.md](docs/components/logic.md) |
| SegmentManager | `src/logic/segments.ts` | ○ T13 | — | [logic.md](docs/components/logic.md) |
| RoleController | `src/logic/role.ts` | ✓ T12 | critical-paths: "Rooli-toggle" | [logic.md](docs/components/logic.md) |
| SituationLogic | `src/logic/situation.ts` | ○ T15 | — | [logic.md](docs/components/logic.md) |
| NavigationLogic | `src/logic/navigation.ts` | ✓ T16 | — | [logic.md](docs/components/logic.md) |
| SignLibraryPanel | `src/ui/sign-library-panel.ts` | ✓ T22 | — | [ui.md](docs/components/ui.md) |
| RoleSelector | `src/ui/role-selector.ts` | ✓ T12 | critical-paths: "Rooli-toggle" | [ui.md](docs/components/ui.md) |
| SegmentPanel | `src/ui/segment-panel.ts` | ○ T25 | — | [ui.md](docs/components/ui.md) |
| SituationDashboard | `src/ui/situation-dashboard.ts` | ○ T28 | — | [ui.md](docs/components/ui.md) |
| EquipmentList | `src/ui/segment-panel.ts` + `src/ui/segment-view.ts` | ✓ T27 | — | [ui.md](docs/components/ui.md) |
| SegmentSync | `src/logic/segment-sync.ts` | ✓ T62 | — | [logic.md](docs/components/logic.md) |
| AuthScreen | `src/ui/auth-screen.ts` | ○ T51 | — | [ui.md](docs/components/ui.md) |
| MapStateBadge | `src/ui/map-state-badge.ts` | ○ T49 | — | [ui.md](docs/components/ui.md) |
| SnapshotPanel | `src/ui/snapshot-panel.ts` | ✓ T50 | — | [ui.md](docs/components/ui.md) |
| LeftPanel | `src/ui/left-panel.ts` | ✓ T73 | critical-paths: "Left panel" | [ui.md](docs/components/ui.md) |
| GpsNavigator | `src/map/gps-navigator.ts` | ✓ T30 | critical-paths: "GPS-paikannin" | [map.md](docs/components/map.md) |
| BackendServer | `server/index.ts` | ✓ T41 | — | [backend.md](docs/components/backend.md) |
| SegmentsAPI | `server/routes/segments.ts` | ✓ T61 | — | [backend.md](docs/components/backend.md) |
| AuthRoutes | `server/routes/auth.ts` | ✓ T36 | — | [backend.md](docs/components/backend.md) |
| AdminRoutes | `server/routes/admin.ts` | ✓ T36 (users/invites/codes) | — | [backend.md](docs/components/backend.md) |
| MarkersAPI | `server/routes/markers.ts` | ✓ T47 | — | [backend.md](docs/components/backend.md) |
| MapStateAPI | `server/routes/admin.ts` | ○ T48 | — | [backend.md](docs/components/backend.md) |
| OfflineManager | `public/sw.js` | ○ T18 | — | [backend.md](docs/components/backend.md) |

**Tila:** ✓ = valmis, ○ = tulossa, B# = avoin bugi, pilkko = rivimäärä kasvaa

---

## MVP-rajaus

> **Huom 2026-06-25:** Vaihe 1/2a/2b-jako poistettu — se kuvasi offline-first/localStorage-arkkitehtuuria joka on korvattu. Backend on ainoa totuus (V18). localStorage ei enää käytetä merkeille eikä segmenteille (T63–T65). T42 sync-logiikka ja T43 merge-UI ovat vanhentuneita — backend-write on synkronointi.

---

**Vaihe 1 — Suunnittelu + merkinnät** (yksi laite, perustoiminnot): **VALMIS ✓**
GPX-lataus, merkit kartalle, bearing, drive mode, sign library, persistointi.
Taskit: T1–T6, T8–T12, T15–T16, T22–T23, T29–T33, T37–T38, T40, T44–T46.

**Vaihe 2 — Multi-device + auth** (backend totuus, useampi laite): **VALMIS ✓**
Backend, auth, markers API, segments backend, direct-write, snapshot, auth screen.
Taskit: T36, T41, T47–T55, T59–T68, T70–T73, T81–T101, T104–T105.

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
| `src/map/marker-interaction.ts` | 189 | Seuraa — jos kasvaa >250 riv, erota rotation omaksi |

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
