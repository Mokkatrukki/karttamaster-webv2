# Komponentit — src/map/ kerros

Leaflet-glue. Ohut kerros kartan päällä. **Testattavuus: Playwright.**

---

## SignIcon
**Vastuu:** Leaflet DivIcon -luonti merkkityypille (bearing-rotaatio poistettu T130)
**Käyttäjä:** molemmat (visuaali kartalla)
**Moduuli:** `src/map/icons.ts`
**Testattavuus:** Vitest-jsdom (L.divIcon tarvitsee DOM)

### Ominaisuudet
- ✓ `createSignIcon` — L.DivIcon SVG-ympyrällä, nuolella ja labelilla
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
**Vastuu:** Merkkien data-hallinta + Leaflet-layer (bearing/rotaatio poistettu T130 — `MarkerInteraction` poistettu kokonaan, se oli olemassa vain kääntöä varten)
**Käyttäjä:** molemmat
**Moduuli:** `src/map/markers.ts`
**Testattavuus:** Playwright

### Ominaisuudet
- ✓ `add` — lisää merkki, reittiassignment automaattisesti, status='suunniteltu'
- ✓ `remove` — poistaa merkin ja Leaflet-markerin
- ✓ `getAll` — näkyvien reittien merkit etäisyysjärjestyksessä
- ✓ `getForRoute` — tietyn reitin merkit
- ✓ `setVisibleRoutes` — piilottaa/näyttää merkit
- ✓ `panTo` — siirtää karttanäkymän merkin kohdalle
- ✓ `reload(markers)` — korvaa koko merkkilistan + piirtää näkyvät uudelleen (T124-T128: GPKG-tuonnin jälkeen)
- ✓ `fixOrphanRouteIds()` — B45: korjaa merkit joilla `routeIds:[]` (esim. GPKG-tuonnin uudet merkit, palvelin ei tunne GPX-geometriaa) lähin-reitti-fallbackilla, sama periaate kuin `add()`/V21. Vitest-jsdom-testattu (`tests/gpkg-orphan-markers.test.ts`) real Leaflet-mapilla jsdomissa — ei vaadi Playwrightia tälle logiikalle.
- ✓ T175/V109: `map.on('zoomend', ...)` skaalaa kaikki markerit `markerScaleForZoom()`-kaavalla (`src/logic/marker-scale.ts`) — CSS `transform: scale()` marker-ikonin sisäwrapperiin (`transform-origin: center bottom`), EI Leafletin omaan position-elementtiin (välttää translate3d-ylikirjoituksen). Uusi marker saa oikean scalen heti luonnissa.

- ✓ T335/V243: `setFocusSegment(seg | undefined, { locked })` — himmentää muut kuin pätkän merkit (`.marker-dimmed`, talkoolaisella lisäksi `.marker-dimmed--locked` = read-only V142). Jäsenyys `src/logic/marker-focus.ts`:stä, ei omaa sääntöä. Fokus lasketaan uusiksi jokaisesta merkkijoukon mutaatiosta (add/remove/reload/updateType) ∴ korostus ei vanhene.
- ✓ T335: `reapplyElementState(id)` — Leafletin `setIcon` korvaa DOM-elementin ja pudottaa KAIKKI luokat. Yksi paikka palauttaa pending/next-highlight/dimmed/zoom-skaalan; aiemmin `.marker-next-highlight` katosi status-päivityksessä (V178).

### Tulossa
- [ ] Vaihda merkin tyyppi jälkikäteen (T38, V17)
- [ ] Merkin status-värikoodaus kartalla (T23)
- [ ] Kuittausnappi talkoolaiselle (T24)

### Käyttäjätarkistus
> Talkoolainen: tuplaklikkaa → picker → merkki — 2 toimintoa ✓
> Järjestäjä: drag&drop siirtää merkin, poisto modaalin kautta ✓

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

## SegmentOverlay — T466 ✓
**Vastuu:** pätkien piirto kartalle — tunniste, status, nimilappu, raja. VAIN katselukerros: muokkaustyökalut irtosivat T466:ssa → `segment-edit-handles.ts`.
**Käyttäjä:** järjestäjä (tilannekuva), talkoolainen (oma pätkä + himmennetty konteksti)
**Konteksti:** desktop-kartta ja puhelin metsässä; taustakarttana MML ∴ kontrastin on kestettävä aurinko
**Moduuli:** `src/map/segment-overlay.ts`
**Testattavuus:** Playwright (`e2e/t464-segment-boundaries.spec.ts`, `t419-label-scale`, `t349-map-surface-theme`, `critical-paths`) — tyylilaskenta on puhtaissa moduuleissa (`segment-style.ts`, `segments.ts`) ja testataan Vitest-purena

### Neljä kanavaa samasta viivasta
| Kanava | Miten | Kantaa | Sopimus |
|---|---|---|---|
| casing | pätkäväri `weight 15` | kenen pätkä | DESIGN.md §K SegmentCasing, V244 |
| sisus | reitin väri `weight 9` valkoisen erottimen takaa | mikä reitti | V244/B137 |
| viivatyyli | `dashArray` + `opacity` casingissa | phase-status | V252, `LINE_STATE_STYLE` |
| **raja** | rako 12 m + päätepistemerkki `r=5` kummassakin päässä | mistä mihin | V353 |

- **Väri ei riitä rajaksi.** Se pettää värisokealle, himmennetyssä kontekstissa (V142/V270) ja aina kun paletti törmää. Raja saa siksi geometrisen kanavan — sama periaate jolla pätkä ja reitti erotettiin.
- **Rako on presentaatio, ei dataa.** `insetRoutePoints` lyhentää piirrettyä viivaa; `sliceRoutePoints` ja `deriveTrackFromBounds` (V258/V260) pitävät km-rajansa pikselilleen.
- **Päätepiste istuu piirretyn viivan päässä**, ei km-rajalla: jaetulla rajalla molemmat pätkät piirtävät omansa ja rako pitää ne erillään. `interactive: false` ∴ se ei varasta klikkiä casingilta eikä viritetyltä sijoitukselta (V345/T460).
- **Väri tulee `assignSegmentColors`ilta kerran per render** — silmukan sisällä se olisi O(n²).
- **Kaikki kerrokset samaan `this.layers`-listaan** ⇒ `clear()` vie kolmikon JA päätepisteet; orpo merkki väittäisi rajaa jota ei enää ole.

### Käyttäjätarkistus
> Talkoolainen: näkeekö mistä mihin oma pätkä ulottuu ilman listan avaamista? ✓ (rako + päätepiste)
> Järjestäjä: erottaako vierekkäiset pätkät yhdellä silmäyksellä? ✓ (naapuriväritys, V352)

---

## SegmentEditHandles — T466 ✓
**Vastuu:** pätkän kartta-ELEET — raahattavat rajakahvat (A/B) + luonnin snap-pisteet.
**Käyttäjä:** järjestäjä (pätkän luonti ja rajojen muokkaus)
**Moduuli:** `src/map/segment-edit-handles.ts`
**Testattavuus:** Playwright (`e2e/segments.spec.ts` — luonnin snap-flow)

### Rajapinta
| Metodi | Mitä |
|---|---|
| `enterEditMode(seg, onSave)` / `exitEditMode()` / `isEditMode()` | A/B-rajakahvat, `dragend` snappaa lähimpään reittipisteeseen (T78/V43) |
| `showCreationSnapMarkers(store, onSnap)` / `hideCreationSnapMarkers()` | olemassa olevien pätkien päätepisteet luonnin tarttumapintana (T150/V94) |

- **Miksi erillään overlaystä (T466):** nämä ovat TYÖKALUJA joilla on oma elinkaari — ne syntyvät käyttäjän eleestä ja kuolevat siihen, eivät jokaisesta renderistä. Jakolinja seurasi **tilaa**: kumpikaan ei koske overlayn `layers`-listaan ∴ V353(e):n `clear()`-sopimus (orpo päätepiste ei jää kartalle) ei ristikkäistynyt. Molemmilla on oma listansa ja oma siivousmetodinsa.
- **Portti on `mapMode` (T307/V218):** rajakahvat ovat muokkaustilan toiminto — katselussa `enterEditMode` on no-op eikä kartalle ilmesty raahattavia päätepisteitä. Numeerinen rajojen muokkaus (hero/modaali) ei ole kartan ele ∴ ei tämän portin takana.
- **Escape-ketju (`main.ts`):** `isEditMode()` → `exitEditMode()` on ketjun kolmas askel (placeMode → creation → **editMode** → picker → overview → drive). Järjestys on käyttäytymistä eikä muuttunut pilkkomisessa.
- **Snap-pisteet luovuttavat klikin** `deliverMapClick`ille ennen omaa käsittelyään (V345/T460).

---

## GpsNavigator *(T30 ✓, T341 ✓ — T21/T31 tulossa)*
**Vastuu:** Laitteen GPS-sijainti kartalla + navigointi seuraavaan merkkiin
**Käyttäjä:** talkoolainen metsässä
**Konteksti:** mobiili, ulkona, GPS päällä, mahdollinen offline
**Moduuli:** `src/map/gps-navigator.ts`
**Testattavuus:** Playwright (Geolocation API mock)

### Tulossa
- [x] Geolocation API: sijainti pisteenä kartalla (T30)
- [x] Tilakone `haetaan → päällä → pois` + näkyvä virhesyy, TIMEOUT-retry matalalla tarkkuudella (T341/V247, fix B133)
- [x] Oma Leaflet-pane `gps` (zIndex 675) — piste yli reitti-/pätkä-/aluoverlayden, merkki-ikonien ja pätkälappujen; pane luodaan idempotentisti GpsNavigatorin sisällä (T397/V287, fix B166)
- [ ] `nearestUnsetMarker` — lähin asettamaton merkki (T16)
- [ ] "Seuraava merkki Xm päässä" -näyttö (T31)
- [ ] GPS-drive UI: navigointi + kuittaus yhdessä (T31)

### Käyttäjätarkistus
> Talkoolainen: GPS-piste kartalla, nuoli seuraavaan, iso kuittausnappi ✓
