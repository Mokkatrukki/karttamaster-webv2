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
| SignLibraryPanel | `src/ui/sign-library-panel.ts` | ○ T22 | — | [ui.md](docs/components/ui.md) |
| RoleSelector | `src/ui/role-selector.ts` | ✓ T12 | critical-paths: "Rooli-toggle" | [ui.md](docs/components/ui.md) |
| SegmentPanel | `src/ui/segment-panel.ts` | ○ T25 | — | [ui.md](docs/components/ui.md) |
| SituationDashboard | `src/ui/situation-dashboard.ts` | ○ T28 | — | [ui.md](docs/components/ui.md) |
| EquipmentList | `src/ui/equipment-list.ts` | ○ T27 | — | [ui.md](docs/components/ui.md) |
| AuthScreen | `src/ui/auth-screen.ts` | ○ T36 | — | [ui.md](docs/components/ui.md) |
| GpsNavigator | `src/map/gps-navigator.ts` | ✓ T30 | critical-paths: "GPS-paikannin" | [map.md](docs/components/map.md) |
| BackendAPI | `server/` | ○ ei taskia | — | [backend.md](docs/components/backend.md) |
| OfflineManager | `public/sw.js` | ○ T18 | — | [backend.md](docs/components/backend.md) |
| AuthController | `src/logic/auth.ts` | ○ T36 | — | [backend.md](docs/components/backend.md) |

**Tila:** ✓ = valmis, ○ = tulossa, B# = avoin bugi, pilkko = rivimäärä kasvaa

---

## MVP-rajaus

**Vaihe 1 — Frontend MVP** (ei backendiä, yksi laite):
Taskit: T7, T8, T9, T10, T11, T12, T29, T32

**Vaihe 2 — Jaettu tilannekuva** (backend lisätään):
BackendAPI + PersistenceLayer backend-sync + OfflineManager

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
