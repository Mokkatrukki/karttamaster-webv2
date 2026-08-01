# Komponentit — src/logic/ kerros

Puhtaat funktiot. Ei Leafletia, ei DOM:ia. **Testattavuus: Vitest-pure.**

---

## RouteGeoMath
**Vastuu:** Reittigeometria — etäisyys, reittipisteistö, sijaintiprosentti (bearing-laskenta poistettu T129, ks. SPEC.md V1/V15/V41/V52/V53/V60)
**Käyttäjä:** molemmat (taustalogiikka)
**Moduuli:** `src/logic/bearing.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `haversineDistance` — etäisyys metreinä
- ✓ `buildRoutePoints` — lat/lon-taulukosta RoutePoint[] kumulatiivisella etäisyydellä
- ✓ `nearestPointIndex` — lähin reittipisteindeksi koordinaatille
- ✓ `routePositionPct` — matka prosentteina (0–100) reitillä

### Tulossa
- [ ] Snap-to-route: palauta koordinaatti lähimmälle reittipisteelle (T31)

---

## GpxLoader
**Vastuu:** GPX-tiedostojen parsinta ja lataus
**Käyttäjä:** järjestäjä toimistossa
**Konteksti:** init-vaiheessa, hyvä yhteys
**Moduuli:** `src/logic/gpx.ts`
**Testattavuus:** Vitest-pure (parseGpx), Vitest-jsdom (loadGpx)

### Ominaisuudet
- ✓ `parseGpx` — XML-merkkijono → lat/lon-taulukko
- ✓ `loadGpx` — fetch URL → lat/lon-taulukko

### Tulossa
- [ ] GPX-korvaus olemassa olevilla merkeillä (T34) — merge/discard-valinta

---

## MultiRouteAssigner
**Vastuu:** Päättää mihin reitteihin merkki kuuluu (etäisyys <100m)
**Käyttäjä:** molemmat (taustalogiikka)
**Moduuli:** `src/logic/multi-route.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `assignRoutesToMarker` — palauttaa route-id:t joiden lähettyvillä merkki on
- ✓ `RouteConfig` — reittimääritys (id, label, color, file, routePoints)
- ✓ `SHARED_THRESHOLD_M` — 100m jako-etäisyys (vakio)

### Tulossa
- [ ] Yhteinen osuus -visualisointi (T35)

---

## SignTypes
**Vastuu:** Merkkityyppien rekisteri + picker-elementin sijoittelulogiikka
**Käyttäjä:** molemmat
**Moduuli:** `src/logic/sign-picker.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `SIGN_TYPES` — 4 tyyppiä: left, right, upcoming-left, upcoming-right
- ✓ `positionPicker` — picker-ikkunan sijainti viewport-rajojen sisään
- ✓ `SignTypeInfo` — type, label, shortLabel, color

### Tulossa
- [ ] Korvaa hardkoodattu lista SignLibrary-komponentilla (T8, T22)

---

## TileLayers
**Vastuu:** Karttatiilikonfiguraatiot ja URL-rakentaja
**Käyttäjä:** molemmat
**Moduuli:** `src/logic/tile-layers.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `TILE_LAYERS` — MML Taustakartta, MML Maastokartta, OpenStreetMap
- ✓ `buildMmlTileUrl` — MML WMTS URL-rakentaja z/y/x-koordinaateilla
- ✓ `TileLayerConfig` — id, label, urlTemplate, attribution, maxZoom
- ✓ Persistoi valittu layer localStorage:iin (`karttamaster-layer`)

### Tulossa
- [ ] Offline-tiililataamo (T18)

---

## PersistenceLayer ✓ (T29)
**Vastuu:** Merkkien tallennus/lataus — localStorage nyt, backend sync myöhemmin
**Käyttäjä:** molemmat (taustalogiikka)
**Moduuli:** `src/logic/persistence.ts`
**Testattavuus:** Vitest-jsdom (localStorage mock)

### Tallennusformaatti
```json
{ "version": 1, "markers": [ ...SignMarker[] ] }
```

### Ominaisuudet
- ✓ `saveMarkers(markers)` — JSON + versiointi → localStorage
- ✓ `loadMarkers()` — parsii, validoi versio → SignMarker[] tai []
- ✓ Silent reset korruptoituneella datalla (V14)
- ✓ Normalisoi `status: 'suunniteltu'` vanhoille merkeille (T10-compat)

### Tulossa
- [ ] POST/PUT palvelimelle (backend vaihe)

---

## SignLibrary ✓ (T8)
**Vastuu:** Merkkikirjaston data model + CRUD-logiikka
**Käyttäjä:** järjestäjä
**Moduuli:** `src/logic/sign-library.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `SignTemplate` type: id, label, shortLabel, color, description
- ✓ `createTemplate/updateTemplate/deleteTemplate/listTemplates` (in-memory)

### Tulossa
- [ ] Ikonilähde selvitetään: Lucide / Heroicons / custom SVG (T9)
- [ ] UI-paneeli järjestäjälle (T22)

---

## SignVisual ✓ (T158)
**Vastuu:** Puhdas valintafunktio sign-visualin precedenssille (V99)
**Käyttäjä:** molemmat (järjestäjä kirjastossa, talkoolainen kartalla)
**Moduuli:** `src/logic/sign-visual.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `signVisual(template, imageSrc?)` → `{kind:'image'|'icon'|'label', ...}`
- ✓ Precedence **kuva > ikoni > shortLabel** (V99) — DOM-riippumaton, imageSrc kutsujasta

---

## MarkerScale ✓ (T175)
**Vastuu:** Puhdas zoom→scale-kaava kartan merkki-ikonien zoom-skaalaukselle (V109)
**Käyttäjä:** molemmat (järjestäjä tilannekuva, talkoolainen kartta)
**Moduuli:** `src/logic/marker-scale.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `markerScaleForZoom(zoom)` → lineaarinen scale [0.3, 1.0] välillä zoom [11, 17], clamp rajojen ulkopuolella
- Kutsuja: `MarkerManager` (`src/map/markers.ts`) soveltaa scalen CSS-transformina marker-DOM:iin

---

## SignImages ✓ (T158)
**Vastuu:** Template-kuvien resolvointi (asset-konventio) + fallback-img-tag
**Käyttäjä:** molemmat
**Moduuli:** `src/logic/sign-images.ts`
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Vite glob `src/assets/signs/<id>.webp` → `signImageSrc(id)` (imageId-konventio = template.id)
- ✓ `signImageTag(id, style)` → `<img onerror="this.remove()">` (T103-fallback) tai `''`
- ⚠ Kuvia ei vielä ole → glob tyhjä, kaikki fallbackaa ikoniin/labeliin. Resize/resoluutio erillinen myöhempi §T.

---

## MarkerStatus ✓ (T10)
**Vastuu:** Merkin elinkaari-tila ja tila-siirtymälogiikka
**Käyttäjä:** molemmat
**Moduuli:** `src/logic/marker-status.ts`
**Testattavuus:** Vitest-pure

### Elinkaari
```
suunniteltu → asetettu → tarkistettu → kerätty
     ↘ ei_tarpeen ↗peru         ↗peru
```

### Ominaisuudet
- ✓ `MarkerStatus` type: suunniteltu | asetettu | tarkistettu | kerätty | ei_tarpeen
- ✓ `StatusAction` type: aseta | ohita | tarkista | kerää | peru
- ✓ `transitionStatus(status, action)` — palauttaa uuden statuksen tai heittää
- ✓ `canTransition(status, action)` — validoi siirtymä
- ✓ `validActions(status)` — lailliset toimet nykytilassa
- ✓ `isTerminal(status)` — onko tila päätepiste (kerätty = true)
- ✓ `DEFAULT_STATUS` = 'suunniteltu'
- ✓ Status lisätty `SignMarker`-tyyppiin (pakollinen kenttä)

### Tulossa
- [ ] Status-kuvake kartalla (T23)
- [ ] Kuittaus-UI talkoolaiselle (T24)

---

## SegmentManager — T464 ✓ ⚠️ pilkko
**Vastuu:** pätkän/tehtävän tietomalli + store-CRUD + jäsenyys/overlap + phase-progress + kartan värikieli.
**Käyttäjä:** järjestäjä luo ja jakaa, talkoolainen näkee oman
**Moduuli:** `src/logic/segments.ts`
**Testattavuus:** Vitest-pure (`tests/segments.test.ts`)

### Ominaisuudet
- ✓ `Segment`-tyyppi + V11/V25-validointi (T13); **route-optional** (T212/V139): reititön tehtävä jättää `routeIds`/`startDist`/`endDist` pois, route-validoinnit koskevat vain reitillisiä
- ✓ `primaryRouteId` (T299/V211) — MITÄ reittiä km:t mittaavat; `segmentPrimaryRouteId` on kanoninen lukija (legacy → `routeIds[0]`)
- ✓ `validateNoOverlap` vertaa PRIMARY-reittiä, ei jäsenyyttä (T299/V211/B114)
- ✓ `getPhaseProgress` / `segmentLineState` — vaiheen edistymä & viivatila; `completed` voittaa merkkilaskurin (T353/V256, B142)
- ✓ **Värikieli** — ks. alla

### Värikieli (T464/V352, V96-amend)
| Funktio | Palauttaa | Kuka lukee |
|---|---|---|
| `assignSegmentColors(segments)` | `Map<id, väri>` — naapuritietoinen jako | `segment-overlay.ts` (kerran per render) |
| `colorForSegment(id)` | hash-väri paletista | reitittömät tehtävät + fallback |
| `segmentLineColor(tunnisteväri, state)` | `valmis` → `SEGMENT_DONE_COLOR`, muuten tunnisteväri | kartta |

- **Väri on suhde naapureihin, ei funktio id:stä.** `hash(id) % 4` antoi vakauden mutta ei erottuvuutta: 13 purkupätkää + 4 väriä → kolme peräkkäistä samanväristä (B200). `assignSegmentColors` ryhmittelee (`phase` + primary-reitti), järjestää `startDist`in mukaan ja antaa pienimmän värin jota mikään **leikkaava tai koskettava** naapuri ei käytä.
- **Ahne värjäys aloitusjärjestyksessä on intervalligraafilla optimaalinen** ∴ 4 väriä riittää kunnes viisi pätkää on päällekkäin yhtä aikaa. Paletin loppuessa törmäys hyväksytään — ei kaadu, ei paletin ulkopuolista väriä (V244-ehdot pysyvät).
- **Jako on riippumaton `completed`-lipusta** vaikka valmis pätkä piirtyy vihreänä (T348): muuten yhden pätkän kuittaus vaihtaisi naapureiden värit kesken työpäivän.
- **Hinta (V96-amend):** lisäys/poisto saa vaihtaa naapureiden värejä. Erottuvuus voittaa vakauden.
- Vihreä on VARATTU status-kanavalle — `SEGMENT_COLORS` ei sisällä sitä (T304).

### Pilkkolippu
Ylitti 400 riviä T464:ssä & vastuut ovat eriytyneet. Luonteva ensimmäinen irrotus: **väritys + viivatila** omaksi moduulikseen — yksi kutsupaikka (`segment-overlay.ts`), oma testilohko, ei riippuvuutta store-CRUD:iin.

---

## SegmentSlice — T464 ✓
**Vastuu:** pätkän piirrettävä geometria km-rajoista — siivu reitistä + rajan rako.
**Käyttäjä:** molemmat (primitiivi kartalle)
**Moduuli:** `src/logic/segment-slice.ts`
**Testattavuus:** Vitest-pure (`tests/segment-slice.test.ts`)

### Rajapinta
| Funktio | Palauttaa |
|---|---|
| `sliceRoutePoints(points, start, end)` | reitin pisteet välillä, molemmat rajat mukaan lukien |
| `insetRoutePoints(points, start, end)` | sama siivu, molemmista päistä `SEGMENT_END_GAP_M` (12 m) lyhyempänä |

- **Miksi omana moduulinaan:** `insetRoutePoints`in rajatapaukset — lyhyt pätkä (`≤ 4 × rako`) ja harva GPX (kavennettu siivu < 2 pistettä) — ovat juuri niitä joita Playwright ei näe, koska tuotantoreitillä ei ole sellaista syötettä. Puhtaana funktiona ne ovat yhden testin päässä. Ennen tätä koodi asui `src/map/segment-overlay.ts`:ssä eli väärässä kerroksessa.
- **Rako on presentaatio, ei dataa.** `deriveTrackFromBounds` (V258/V260) käyttää `sliceRoutePoints`in kanssa täsmälleen samaa ehtoa ∴ jäljen migraatio ei siirrä karttaa pikselilläkään. Jos ehtoa muuttaa, se on muutettava molemmissa.
- **Molemmat peruutukset ovat tarkoituksellisia:** näkyvä väärä raja on parempi kuin näkymätön pätkä.

---

## MarkerFocus — T334 ✓
**Vastuu:** kumpaan joukkoon merkki kuuluu kun kartalla on fokus-pätkä: `'focus'` vai `'dim'`.
**Käyttäjä:** molemmat (primitiivi — talkoolaisella automaatti, järjestäjällä kytkin)
**Moduuli:** `src/logic/marker-focus.ts`
**Testattavuus:** Vitest-pure (`tests/marker-focus.test.ts`)

### Rajapinta
```typescript
type FocusState = 'focus' | 'dim'
focusState(markers: SignMarker[], focusSegment: TaskMarkerSource | undefined): Map<string, FocusState>
isFocused(state: Map<string, FocusState>, markerId: string): boolean
```

### Ominaisuudet
- ✓ `focusSegment === undefined` ⇒ ∀ merkki `'focus'` (ei fokusta = ei himmennystä)
- ✓ Jäsenyys delegoi `resolveTaskMarkers`iin (V140) — reittifiltteri ∪ linkedMarkerIds ∪ markerTypeFilter
- ✓ Tyhjä pätkä ⇒ kaikki `'dim'`, ei heittoa; tuntematon id `isFocused`issa ⇒ true
- ✓ Jokainen merkki saa tilan — V243:n "himmennä, älä piilota" alkaa jo täältä: joukosta ei putoa ketään

### Käyttäjätarkistus
> Talkoolainen: oman pätkän merkit erottuvat, naapurin merkit näkyvät silti (tiedän onko ne asetettu).
> Järjestäjä: sama sääntö kuin merkkilistan suodatuksessa — ei toista jäsenyystotuutta.

---

## TaskMarkers *(tulossa — T214)*
**Vastuu:** Tehtävän merkkijoukon kanoninen resolvointi — yksi funktio Segment + AreaMarker
**Käyttäjä:** molemmat (järjestäjä liittää, talkoolainen näkee resolvoidut)
**Moduuli:** `src/logic/task-markers.ts` *(ei vielä)*
**Testattavuus:** Vitest-pure

### Rajapinta (alustava)
```typescript
interface TaskMarkerSource {
  routeIds?: string[]; startDist?: number; endDist?: number  // reitillinen filtteri
  linkedMarkerIds?: string[]     // eksplisiittinen linkki (skenaario 1 & 3)
  markerTypeFilter?: string      // dynaaminen tyyppisuodatin, templateId (skenaario 2)
}
resolveTaskMarkers(source: TaskMarkerSource, markers: SignMarker[]): SignMarker[]
// = reittifiltteri (jos reitillinen) ∪ linkedMarkerIds ∪ markerTypeFilter-osumat
```

### Tulossa
- [ ] `resolveTaskMarkers` + `TaskMarkerSource` (T214, V140)
- [ ] `getMarkersForSegment` delegoi tähän — poista duplikoitu route+dist-filtteri
- [ ] `markerTypeFilter` nojaa `SignMarker.templateId`:hen (T215, V143)

### Käyttäjätarkistus
> Talkoolainen: tehtävän merkit resolvoituvat oikein niin reitilliselle kuin reitittömälle — navigoi ja kuittaa vain omat.
> Järjestäjä: voi liittää merkkejä joko poimimalla kartalta tai tyyppisuodattimella; sama funktio kattaa molemmat.

---

## RoleController *(tulossa — T12)*
**Vastuu:** Rooli-tila (järjestäjä | talkoolainen) + localStorage
**Käyttäjä:** molemmat
**Moduuli:** `src/logic/role.ts` *(ei vielä)*
**Testattavuus:** Vitest-pure

### Tulossa
- [ ] `Role` type: järjestäjä | talkoolainen (T12)
- [ ] Rooli localStorage:iin + lataus (T12)

---

## SituationLogic *(tulossa — T15)*
**Vastuu:** Tilannekuvan laskenta: % per status per reitti
**Käyttäjä:** molemmat (taustalogiikka)
**Moduuli:** `src/logic/situation.ts` *(ei vielä)*
**Testattavuus:** Vitest-pure

### Tulossa
- [ ] `calcRouteSituation(markers, routeId)` — % per status (T15)

---

## Types (ei komponentti)
**Moduuli:** `src/logic/types.ts`

Nykyiset: `MarkerType`, `MarkerStatus`, `RoutePoint`, `SignMarker`

Tulossa lisätään: `SignTemplate`, `Segment`, `Role`
