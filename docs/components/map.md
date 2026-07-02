# Komponentit — src/map/ kerros

Leaflet-glue. Ohut kerros kartan päällä. **Testattavuus: Playwright.**

---

## SignIcon
**Vastuu:** Leaflet DivIcon -luonti merkkityypille ja bearingille
**Käyttäjä:** molemmat (visuaali kartalla)
**Moduuli:** `src/map/icons.ts`
**Testattavuus:** Vitest-jsdom (L.divIcon tarvitsee DOM)

### Ominaisuudet
- ✓ `createSignIcon` — L.DivIcon SVG-ympyrällä, nuolella ja labelilla
- ✓ Rotate-handle (`.sign-handle`) — näkyy vain `.marker-armed`-tilassa
- ✓ Upcoming-tyypit viivakuviolla (dashed circle)

### Tulossa
- [ ] Ikonilähde: SVG-kirjasto tai kuvaupload (T9)
- [ ] Status-värikoodaus kartalla (T23)

---

## DriveMode
**Vastuu:** Reitin selauskohdistin — pan kartalle 50m askeleilla
**Käyttäjä:** talkoolainen metsässä, järjestäjä tarkistuksessa
**Konteksti:** mobiili/desktop, ei oikea GPS
**Moduuli:** `src/map/drive.ts`
**Testattavuus:** Playwright

### Ominaisuudet
- ✓ `start/stop/next/prev` — liiku 50m askeleilla
- ✓ `jumpTo(index)` — hyppää tiettyyn reittipisteeseen
- ✓ `setRoute` — vaihda reitti
- ✓ `currentKm / totalKm` — matka km:nä

### Tulossa
- [ ] Hyppää seuraavaan merkkiin -nappi (T39) — ei GPS-riippuvainen, toimii jo nyt
- [ ] GPS-navigointi: oikea sijainti laitteen GPS:ltä (T21, T30)
- [ ] "Seuraava merkki Xm päässä" -ilmoitus (T31)

### Käyttäjätarkistus — tiedossa oleva kitka
> Talkoolainen-kitka: 50m askeleet = hidas siirtyä merkkien välillä (T39 korjaa)

### Käyttäjätarkistus
> Talkoolainen: ← → -napit isot, toimii hanskat kädessä ✓
> Järjestäjä: progressbar + km ✓

---

## MarkerManager
**Vastuu:** Merkkien data-hallinta + Leaflet-layer
**Käyttäjä:** molemmat
**Moduuli:** `src/map/markers.ts` (159 riv)
**Testattavuus:** Playwright

### Ominaisuudet
- ✓ `add` — lisää merkki, bearing + reittiassignment automaattisesti, status='suunniteltu'
- ✓ `remove` — poistaa merkin ja Leaflet-markerin
- ✓ `updateBearing` — päivittää suuntakulman ja kuvakkeen
- ✓ `getAll` — näkyvien reittien merkit etäisyysjärjestyksessä
- ✓ `getForRoute` — tietyn reitin merkit
- ✓ `setVisibleRoutes` — piilottaa/näyttää merkit
- ✓ `panTo` — siirtää karttanäkymän merkin kohdalle
- ✓ Delegoi interaktio `MarkerInteraction`-oliolle
- ✓ `reload(markers)` — korvaa koko merkkilistan + piirtää näkyvät uudelleen (T124-T128: GPKG-tuonnin jälkeen)
- ✓ `fixOrphanRouteIds()` — B45: korjaa merkit joilla `routeIds:[]` (esim. GPKG-tuonnin uudet merkit, palvelin ei tunne GPX-geometriaa) lähin-reitti-fallbackilla, sama periaate kuin `add()`/V21. Vitest-jsdom-testattu (`tests/gpkg-orphan-markers.test.ts`) real Leaflet-mapilla jsdomissa — ei vaadi Playwrightia tälle logiikalle.

### Tulossa
- [ ] Drag-to-move merkki: siirto päivittää bearing + routeIds (T37, V15)
- [ ] Vaihda merkin tyyppi jälkikäteen (T38, V17)
- [ ] Merkin status-värikoodaus kartalla (T23)
- [ ] Kuittausnappi talkoolaiselle (T24)

### Käyttäjätarkistus
> Talkoolainen: tuplaklikkaa → picker → merkki — 2 toimintoa ✓
> Järjestäjä: kontekstivalikosta kääntö ja poisto ✓
> Järjestäjä-kitka: väärässä paikassa → delete+redo pakko (T37 korjaa)

---

## MarkerInteraction
**Vastuu:** Rotation arm/drag + kontekstivalikko + CSS inject
**Käyttäjä:** molemmat
**Moduuli:** `src/map/marker-interaction.ts` (189 riv)
**Testattavuus:** Playwright

### Ominaisuudet
- ✓ `arm/disarm` — rotaatio-arming + outside-click handler
- ✓ `startRotation/applyRotation` — mouse + touch rotaatio
- ✓ `showContextMenu/hideContextMenu` — "Käännä" + "✕ Poista"
- ✓ `injectStyles` — staattinen CSS inject (kerran per sivu)

### Tulossa
- [ ] Rotation arm sticky: arm ei häviä karttaklikistä (T40, V16)
- [ ] Pitkä paina = kontekstivalikko mobiililla (UX parannus)

### Käyttäjätarkistus — tiedossa oleva kitka
> Järjestäjä-kitka: arm häviää ulkoklikillä → turha Käännä-reset (T40 korjaa)

---

## RouteBar
**Vastuu:** Reittitabsit + polyline-näkyvyystoggle + drive-reitti valinta
**Käyttäjä:** molemmat
**Moduuli:** `src/map/route-bar.ts` (108 riv)
**Testattavuus:** Playwright

### Ominaisuudet
- ✓ Buildaa route-tab DOM elementit
- ✓ `setDriveRoute(id)` — vaihto + driveMode.setRoute() + callback
- ✓ `toggleVisible(id)` — polyline add/remove + V6 invariantti
- ✓ `getActiveRoute / getActiveTotalM` — getterit ProgressBarille
- ✓ Polyline-klik → setDriveRoute + jumpTo lähimpään pisteeseen
- ✓ updateDOM — tab highlight + progress bar color + eye-icon

### Tulossa
- [ ] Rooli-näkymä: talkoolaisella piilotettu järjestäjätoiminnot (T32)

### Käyttäjätarkistus
> Talkoolainen: reittitabi vaihtaa drive-reitin ✓
> Järjestäjä: eye-icon piilottaa/näyttää reitin ✓

---

## GpsNavigator *(tulossa — T21, T30, T31)*
**Vastuu:** Laitteen GPS-sijainti kartalla + navigointi seuraavaan merkkiin
**Käyttäjä:** talkoolainen metsässä
**Konteksti:** mobiili, ulkona, GPS päällä, mahdollinen offline
**Moduuli:** `src/map/gps-navigator.ts` *(ei vielä)*
**Testattavuus:** Playwright (Geolocation API mock)

### Tulossa
- [ ] Geolocation API: sijainti pisteenä kartalla (T30)
- [ ] `nearestUnsetMarker` — lähin asettamaton merkki (T16)
- [ ] "Seuraava merkki Xm päässä" -näyttö (T31)
- [ ] GPS-drive UI: navigointi + kuittaus yhdessä (T31)

### Käyttäjätarkistus
> Talkoolainen: GPS-piste kartalla, nuoli seuraavaan, iso kuittausnappi ✓
