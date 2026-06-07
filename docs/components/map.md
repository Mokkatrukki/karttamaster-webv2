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
- [ ] GPS-navigointi: oikea sijainti laitteen GPS:ltä (T21, T30)
- [ ] "Seuraava merkki Xm päässä" -ilmoitus (T31)

### Käyttäjätarkistus
> Talkoolainen: ← → -napit isot, toimii hanskat kädessä ✓
> Järjestäjä: progressbar + km ✓

---

## MarkerManager
**Vastuu:** Merkkien hallinta: lisäys, poisto, kääntö, Leaflet-layer, kontekstivalikko
**Käyttäjä:** molemmat
**Moduuli:** `src/map/markers.ts` (309 riviä — ⚠️ pilkkohälytys)
**Testattavuus:** Playwright

### Ominaisuudet
- ✓ `add` — lisää merkki, bearing + reittiassignment automaattisesti
- ✓ `remove` — poistaa merkin ja Leaflet-markerin
- ✓ `updateBearing` — päivittää suuntakulman ja kuvakkeen
- ✓ `getAll` — näkyvien reittien merkit etäisyysjärjestyksessä
- ✓ `getForRoute` — tietyn reitin merkit
- ✓ `setVisibleRoutes` — piilottaa/näyttää merkit
- ✓ `panTo` — siirtää karttanäkymän merkin kohdalle
- ✓ Rotation arm/drag: touch + mouse
- ✓ Kontekstivalikko: "Käännä" + "✕ Poista"

### Tulossa
- [ ] Persistointi: load on init, save on every change (T29)
- [ ] Merkin status-elinkaari (T10, T23)
- [ ] Kuittausnappi talkoolaiselle (T24)

### Pilkkomahdollisuus
Kaksi vastuuta nyt:
1. Merkkidata + Leaflet-layer (add/remove/setVisible)
2. Rotation-UI + context menu + CSS inject

Pilko kun T10 lisätään (status tuo kolmannen vastuun).

### Käyttäjätarkistus
> Talkoolainen: tuplaklikkaa → picker → merkki — 2 toimintoa ✓
> Järjestäjä: kontekstivalikosta kääntö ja poisto ✓

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
