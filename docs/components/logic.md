# Komponentit — src/logic/ kerros

Puhtaat funktiot. Ei Leafletia, ei DOM:ia. **Testattavuus: Vitest-pure.**

---

## BearingMath
**Vastuu:** Geo-laskenta — bearing, etäisyys, reittipisteistö, sijaintiprosentti
**Käyttäjä:** molemmat (taustalogiikka)
**Moduuli:** `src/logic/bearing.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `calcBearing` — suuntakulma kahden pisteen välille
- ✓ `haversineDistance` — etäisyys metreinä
- ✓ `buildRoutePoints` — lat/lon-taulukosta RoutePoint[] kumulatiivisella etäisyydellä
- ✓ `nearestPointIndex` — lähin reittipisteindeksi koordinaatille
- ✓ `routePositionPct` — matka prosentteina (0–100) reitillä
- ✓ `bearingAtIndex` — suuntakulma reittipisteessä (ympyräkeskiarvo)

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

## PersistenceLayer *(tulossa — T29)*
**Vastuu:** Merkkien tallennus/lataus — localStorage nyt, backend sync myöhemmin
**Käyttäjä:** molemmat (taustalogiikka)
**Moduuli:** `src/logic/persistence.ts` *(ei vielä)*
**Testattavuus:** Vitest-jsdom (localStorage mock)

### Tallennusformaatti
```json
{ "version": 1, "markers": [ ...SignMarker[] ] }
```

### Tulossa
- [ ] `saveMarkers(markers)` — JSON + versiointi → localStorage (T29)
- [ ] `loadMarkers()` — parsii, validoi versio → SignMarker[] tai [] (T29)
- [ ] Silent reset korruptoituneella datalla (T29)
- [ ] Myöhemmin: POST/PUT palvelimelle (backend T)

---

## SignLibrary *(tulossa — T8)*
**Vastuu:** Merkkikirjaston data model + CRUD-logiikka
**Käyttäjä:** järjestäjä
**Moduuli:** `src/logic/sign-library.ts` *(ei vielä)*
**Testattavuus:** Vitest-pure

### SignTemplate-tyyppi
```typescript
interface SignTemplate {
  id: string
  label: string
  shortLabel: string
  color: string
  description: string
  icon: string  // Lucide-nimi tai custom SVG (T9 selvittää)
}
```

### Tulossa
- [ ] CRUD: create/update/delete SignTemplate (T8)
- [ ] Ikonilähde selvitetään: Lucide / Heroicons / custom SVG (T9)

---

## MarkerStatus *(tulossa — T10)*
**Vastuu:** Merkin elinkaari-tila ja tila-siirtymälogiikka
**Käyttäjä:** molemmat
**Moduuli:** `src/logic/marker-status.ts` *(ei vielä)*
**Testattavuus:** Vitest-pure

### Elinkaari
```
suunniteltu → asetettu → tarkistettu → kerätty
                     ↘ ei_tarpeen
```

### Tulossa
- [ ] `MarkerStatus` type (T10)
- [ ] `canTransition(from, to)` — validoi legalit siirtymät (T10)
- [ ] `nextStatus(current)` — seuraava normaali tila (T10)
- [ ] Status lisätään `SignMarker`-tyyppiin (T10)

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

Nykyiset: `MarkerType`, `RoutePoint`, `SignMarker`

Tulossa lisätään: `MarkerStatus`, `SignTemplate`, `Segment`, `Role`
