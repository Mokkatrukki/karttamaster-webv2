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

## SegmentManager *(tulossa — T13)*
**Vastuu:** Pätkädata: alku/loppu reitillä + talkoolaisen assign
**Käyttäjä:** järjestäjä luo, talkoolainen näkee oman
**Moduuli:** `src/logic/segments.ts` *(ei vielä)*
**Testattavuus:** Vitest-pure

### Segment-tyyppi (alustava)
```typescript
interface Segment {
  id: string
  routeId: string
  startDist: number   // meters from start
  endDist: number     // meters from start
  assignedTo: string  // roolitunnus
}
```

### Tulossa
- [ ] `Segment` type + jatkuvuus-validointi (T13, V11)
- [ ] Assign talkoolaiselle (T26)

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
