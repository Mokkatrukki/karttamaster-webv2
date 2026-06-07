# COMPONENTS.md — Karttamaster komponenttirekisteri

Lähde totuus arkkitehtuurista. Päivitetään ennen kuin feature lisätään.
Ohjaavat periaatteet: VISION.md.

---

## BearingMath
**Vastuu:** Geo-laskenta — bearing, etäisyys, reittipisteistö, sijaintiprosentti
**Käyttäjä:** molemmat (taustalogiikka)
**Konteksti:** puhdas logiikka, ei DOM:ia, ei Leafletia
**Moduuli:** `src/bearing.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `calcBearing` — suuntakulma kahden pisteen välille
- ✓ `haversineDistance` — etäisyys metreinä
- ✓ `buildRoutePoints` — lat/lon-taulukosta RoutePoint[] kumulatiivisella etäisyydellä
- ✓ `nearestPointIndex` — lähin reittipisteindeksi koordinaatille
- ✓ `routePositionPct` — matka prosentteina (0–100) reitillä
- ✓ `bearingAtIndex` — suuntakulma reittipisteessä (ympyräkeskiarvo)

### Tulossa
- [ ] Snap-to-route: palauta koordinaatti lähimmälle reittipisteelle (navigointia varten)

### Käyttäjätarkistus
> Talkoolainen: ei suoraa käyttöä — taustalogiikka
> Järjestäjä: ei suoraa käyttöä — taustalogiikka

---

## GpxLoader
**Vastuu:** GPX-tiedostojen parsinta ja lataus
**Käyttäjä:** järjestäjä toimistossa
**Konteksti:** init-vaiheessa, hyvä yhteys, ei aikakriittinen
**Moduuli:** `src/gpx.ts`
**Testattavuus:** Vitest-pure (parseGpx), Vitest-jsdom (loadGpx tarvitsee fetch)

### Ominaisuudet
- ✓ `parseGpx` — XML-merkkijono → lat/lon-taulukko
- ✓ `loadGpx` — fetch URL → lat/lon-taulukko

### Tulossa
- [ ] GPX-korvaus olemassa olevilla merkeillä — mitä tapahtuu merkeille? (VISION.md §Avoimet)

### Käyttäjätarkistus
> Järjestäjä: lataa GPX-reitit kerran — ei interaktiivista käyttöä

---

## MultiRouteAssigner
**Vastuu:** Päättää mihin reitteihin merkki kuuluu etäisyyden perusteella
**Käyttäjä:** molemmat (taustalogiikka merkin lisäyksessä)
**Konteksti:** kutsutaan aina kun merkki lisätään kartalle
**Moduuli:** `src/multi-route.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `assignRoutesToMarker` — palauttaa route-id:t joiden lähettyvillä (<100m) merkki on
- ✓ `RouteConfig` — reittimääritys (id, label, color, file, routePoints)
- ✓ `SHARED_THRESHOLD_M` — 100m jako-etäisyys (vakio)

### Tulossa
- [ ] Yhteinen osuus -visualisointi: näytä missä reitit jakavat saman merkin

### Käyttäjätarkistus
> Järjestäjä: merkki automaattisesti molemmille reiteille lähellä yhteistä osuutta — tarkistaa listasta

---

## SignTypes
**Vastuu:** Merkkityyppien rekisteri + picker-elementin sijoittelulogiikka
**Käyttäjä:** molemmat
**Konteksti:** picker aukeaa tuplaklikkauksen tai "Lisää merkki" -napin kautta
**Moduuli:** `src/sign-picker.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `SIGN_TYPES` — 4 tyyppiä: left, right, upcoming-left, upcoming-right
- ✓ `positionPicker` — laskee picker-ikkunan sijainnin viewport-rajojen sisään
- ✓ `SignTypeInfo` — type, label, shortLabel, color

### Tulossa
- [ ] Merkkikirjasto (SignLibrary): dynaamiset tyypit, ei hardkoodattu lista — ikonilähde selvitetään (VISION.md §Avoimet)
- [ ] Talkoolaisen lisätyt merkit: "lisäsin toisen" -toiminto kentällä

### Käyttäjätarkistus
> Talkoolainen: max 2 napin päässä — picker avautuu tuplaklikkilla ✓
> Järjestäjä: kaikki 4 tyyppiä käden ulottuvilla ✓

---

## TileLayers
**Vastuu:** Karttatiilikonfiguraatiot ja URL-rakentaja
**Käyttäjä:** molemmat
**Konteksti:** init-vaiheessa + layer-vaihto napista
**Moduuli:** `src/tile-layers.ts`
**Testattavuus:** Vitest-pure

### Ominaisuudet
- ✓ `TILE_LAYERS` — MML Taustakartta, MML Maastokartta, OpenStreetMap
- ✓ `buildMmlTileUrl` — MML WMTS URL-rakentaja z/y/x-koordinaateilla
- ✓ `TileLayerConfig` — id, label, urlTemplate, attribution, maxZoom

### Tulossa
- [ ] Offline-tiililataamo: lataa tiilet etukäteen omalle pätkälle (VISION.md §2. Valmistelu)

### Käyttäjätarkistus
> Talkoolainen: layer-vaihto yksi nappi ✓ (metsässä helppo)
> Järjestäjä: maastokartta käytettävissä suunnitteluun ✓

---

## SignIcon
**Vastuu:** Leaflet DivIcon -luonti merkkityypille ja suunnalle (bearing)
**Käyttäjä:** molemmat (visuaali kartalla)
**Konteksti:** kutsutaan aina kun merkki lisätään tai käännetään
**Moduuli:** `src/icons.ts`
**Testattavuus:** Vitest-jsdom (L.divIcon tarvitsee DOM)

### Ominaisuudet
- ✓ `createSignIcon` — palauttaa L.DivIcon SVG-ympyrällä, nuolella ja lyhyellä labelilla
- ✓ Rotate-handle (`.sign-handle`) — näkyy vain `.marker-armed`-tilassa
- ✓ Upcoming-tyypit viivakuviolla (dashed circle) erotuksena

### Tulossa
- [ ] Ikonilähde: SVG-kirjasto tai kuvaupload järjestäjältä (VISION.md §Avoimet)
- [ ] Status-värikoodaus: suunniteltu/asetettu/tarkistettu/kerätty (VISION.md §Merkin elinkaari)

### Käyttäjätarkistus
> Talkoolainen: isot selkeät ikonit metsässä ✓
> Järjestäjä: väri + kirjain erottaa tyypit nopeasti ✓

---

## DriveMode
**Vastuu:** Reitin selauskohdistin — pan kartalle 50m askeleilla
**Käyttäjä:** talkoolainen metsässä, järjestäjä tarkistuksessa
**Konteksti:** mobiili/desktop, navigointi reittiä pitkin, ei oikea GPS
**Moduuli:** `src/drive.ts`
**Testattavuus:** Playwright (riippuu L.Map.setView)

### Ominaisuudet
- ✓ `start/stop/next/prev` — liiku 50m askeleilla reittiä pitkin
- ✓ `jumpTo(index)` — hyppää tiettyyn reittipisteeseen
- ✓ `setRoute` — vaihda reitti (multi-route tuki)
- ✓ `currentKm / totalKm` — matka km:nä

### Tulossa
- [ ] GPS-navigointi: oikea sijainti laitteen GPS:ltä (VISION.md §3. Kenttätyö)
- [ ] "Seuraava merkki 300m päässä" -ilmoitus
- [ ] Offline-reitti: toimii ilman yhteyttä

### Käyttäjätarkistus
> Talkoolainen: ← → -napit isot ja helppo painaa hanskat kädessä ✓
> Järjestäjä: progreesibar ja km-luvut kertovat sijainnin ✓

---

## MarkerManager
**Vastuu:** Merkkien hallinta: lisäys, poisto, kääntö, Leaflet-layerin ylläpito, kontekstivalikko
**Käyttäjä:** molemmat
**Konteksti:** kaikki merkkiinteraktiot kartalla
**Moduuli:** `src/markers.ts` (309 riviä — ⚠️ pilkkohälytys)
**Testattavuus:** Playwright

### Ominaisuudet
- ✓ `add` — lisää merkki, laskee bearing + reittiassignment automaattisesti
- ✓ `remove` — poistaa merkin ja Leaflet-markerin
- ✓ `updateBearing` — päivittää suuntakulmaa ja kuvaketta
- ✓ `getAll` — palauttaa näkyvien reittien merkit etäisyysjärjestyksessä
- ✓ `getForRoute` — palauttaa tietyn reitin merkit
- ✓ `setVisibleRoutes` — piilottaa/näyttää merkit reittinäkyvyyden mukaan
- ✓ `panTo` — siirtää karttanäkymän merkin kohdalle
- ✓ Rotation arm/drag: touch + mouse, suuntakulman säätö hiirellä/sormella
- ✓ Kontekstivalikko: "Käännä" ja "✕ Poista"

### Tulossa
- [ ] Merkitys asetetuksi / ei tarpeen / lisätty toinen (VISION.md §3. Kenttätyö)
- [ ] Merkin status-elinkaari: suunniteltu → asetettu → tarkistettu → kerätty
- [ ] Persistointi: tallennus lokaaliin tai palvelimelle

### Pilkkomahdollisuus
MarkerManager vastaa kahdesta vastuusta:
1. **Merkkidata + Leaflet-layer** (add/remove/setVisible)
2. **Vuorovaikutus-UI** (rotation, context menu, CSS inject)

Pilko kun nämä eriytyvät tai moduuli ylittää 350 riviä.

### Käyttäjätarkistus
> Talkoolainen: tuplaklikkaa → picker → merkki ilmestyy — 2 toimintoa ✓
> Järjestäjä: kontekstivalikosta kääntö ja poisto ✓

---

## MarkerListUI
**Vastuu:** Merkkilistamodaali + merkkidotit edistymispalkin päällä
**Käyttäjä:** molemmat (lista), järjestäjä (kokonaistilannekuva)
**Konteksti:** lista avautuu "Merkit"-napista, dotit aina näkyvissä
**Moduuli:** `src/ui.ts`
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ `renderMarkerList` — renderöi merkit modal-listaan, pan-to click, delete button
- ✓ `renderSignDots` — piirtää värilliset merkkipisteet edistymispalkkiin
- ✓ Highlight uusi merkki listassa (`.marker-item--new`)

### Tulossa
- [ ] Tilannekuva-näkymä: värikoodaus statuksen mukaan (suunniteltu/asetettu/kerätty)
- [ ] Varustelista: automaattinen merkkimäärälaskuri + manuaaliset lisäykset (VISION.md §2. Valmistelu)
- [ ] Prosenttiluvut per reitti ja kokonaisuus

### Käyttäjätarkistus
> Talkoolainen: listasta näkee kaikki merkit ja voi navigoida ✓ — poisto onnistuu ✓
> Järjestäjä: dotit palkin päällä antaa tilannekuvan ✓ — kokonaistilannekuva puuttuu vielä

---

## AppController
**Vastuu:** Sovelluksen init ja komponenttien wiring
**Käyttäjä:** molemmat (entry point)
**Konteksti:** latautuu kerran, koordinoi kaikki komponentit
**Moduuli:** `src/main.ts` (385 riviä — ⚠️ PILKKOHÄLYTYS: useita vastuita)
**Testattavuus:** Playwright

### Ominaisuudet
- ✓ GPX-lataus kaikille reiteille rinnakkain
- ✓ Leaflet-polylinjojen luonti
- ✓ Tile layer -sykli (localStorage-muisti)
- ✓ Route selector -tabsit (drive + visibility toggle)
- ✓ Progress bar + drag-to-seek
- ✓ Place mode (toolbar dropdown flow)
- ✓ Floating picker (dblclick flow)
- ✓ Marker modal avaus/sulkeminen
- ✓ Keyboard shortcuts (Escape, ←→ drive)
- ✓ Polyline click → jump to nearest point

### Tulossa
- [ ] Auth-flow: kutsukoodi → oma tunnus (VISION.md §Avoimet)
- [ ] Talkoolainen/järjestäjä -näkymävalinta

### Pilkkomahdollisuus
`main.ts` ylittää 150 riviä reilusti ja sisältää vähintään 4 erillistä vastuuta:
1. **RouteBar** — route selector tabs + visibility toggle (→ `src/ui/route-bar.ts`)
2. **ProgressBar** — edistymispalkki + drag-to-seek + sign dots wiring (→ `src/ui/progress-bar.ts`)
3. **PlaceMode** — place mode state + dropdown + floating picker (→ `src/ui/place-mode.ts`)
4. **AppController** — vain init + wiring, jäljelle jää ~80 riviä

### Käyttäjätarkistus
> Talkoolainen: kaikki kriittiset toiminnot max 2 napin päässä — tarkistettava kun pilkotaan
> Järjestäjä: route tabs + visibility toggle toimii ✓

---

## Types (ei komponentti)
**Moduuli:** `src/types.ts`
Jaetut tyypit: `MarkerType`, `RoutePoint`, `SignMarker`. Ei logiikkaa.

---

## Arkkitehtuurianalyysi

### Nykyinen hakemistorakenne vs VISION.md

VISION.md vaatii:
```
src/logic/    ← puhtaat funktiot
src/map/      ← Leaflet-glue
src/ui/       ← DOM-komponentit
src/main.ts   ← vain init + wiring
```

Nykyinen rakenne on **kaikki suoraan `src/`**. Refaktorointi on tekemättä.

Oikea sijoittelu kun refaktoroidaan:
| Tiedosto | Oikea paikka |
|---|---|
| `bearing.ts` | `src/logic/bearing.ts` |
| `gpx.ts` | `src/logic/gpx.ts` |
| `multi-route.ts` | `src/logic/multi-route.ts` |
| `sign-picker.ts` | `src/logic/sign-picker.ts` |
| `tile-layers.ts` | `src/logic/tile-layers.ts` |
| `types.ts` | `src/logic/types.ts` |
| `drive.ts` | `src/map/drive.ts` |
| `icons.ts` | `src/map/icons.ts` |
| `markers.ts` | `src/map/markers.ts` |
| `ui.ts` | `src/ui/marker-list.ts` |
| `main.ts` (pilkottu) | `src/ui/route-bar.ts`, `src/ui/progress-bar.ts`, `src/ui/place-mode.ts` |

### Isot moduulit (pilkkohälytys)

| Moduuli | Rivit | Ongelma |
|---|---|---|
| `main.ts` | 385 | 4+ vastuuta: RouteBar, ProgressBar, PlaceMode, init |
| `markers.ts` | 309 | 2 vastuuta: data+layer vs rotation+UI |

### Dokumentoimattomat vs suunnitellut

**Koodissa, ei COMPONENTS.md:ssä aiemmin:** kaikki — tämä on ensimmäinen COMPONENTS.md.

**VISION.md:ssä, ei vielä koodissa:**
- Merkin status-elinkaari (suunniteltu → asetettu → tarkistettu → kerätty)
- Merkkikirjasto (dynaamiset tyypit, ei 4 hardkoodattua)
- Pätkäjako talkoolaisille
- Varustelista
- GPS-navigointi (oikea laitteen GPS)
- Offline-tuki
- Kokonaistilannekuvanäkymä
- Auth-flow (kutsukoodi → tunnus)
