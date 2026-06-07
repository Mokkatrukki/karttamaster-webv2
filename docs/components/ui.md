# Komponentit — src/ui/ kerros

DOM-komponentit ilman Leafletia. **Testattavuus: Vitest-jsdom.**

---

## MarkerListUI
**Vastuu:** Merkkilistamodaali + merkkidotit edistymispalkin päällä
**Käyttäjä:** molemmat
**Konteksti:** lista avautuu "Merkit"-napista, dotit aina näkyvissä
**Moduuli:** `src/ui/marker-list.ts`
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ `renderMarkerList` — modal-lista, pan-to click, delete button
- ✓ `renderSignDots` — värilliset merkkipisteet edistymispalkkiin
- ✓ Highlight uusi merkki listassa (`.marker-item--new`)

### Tulossa
- [ ] Värikoodaus statuksen mukaan (T23, T28)
- [ ] Varustelista (T27)
- [ ] Prosenttiluvut per reitti (T15)

### Käyttäjätarkistus
> Talkoolainen: lista näyttää merkit, voi navigoida + poistaa ✓
> Järjestäjä: dotit palkin päällä antaa pikakuvan ✓

---

## ProgressBar
**Vastuu:** Edistymispalkki + drag-to-seek + merkkidotit
**Käyttäjä:** molemmat
**Moduuli:** `src/ui/progress-bar.ts` (74 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ `update(km)` — fill + handle + km-teksti
- ✓ `refreshDots()` — renderSignDots aktiiviselle reitille
- ✓ Drag-to-seek: mouse + touch, jumpTo lähimpään pisteeseen

### Tulossa
- [ ] Merkkipisteet värikoodattu statuksen mukaan (T23)

### Käyttäjätarkistus
> Talkoolainen: drag progress bar → siirtyy suoraan ✓
> Järjestäjä: km-laskuri näkyvissä ✓

---

## PlaceMode
**Vastuu:** Merkin lisäystila — toolbar dropdown + floating picker (dblclick)
**Käyttäjä:** järjestäjä toimistossa
**Moduuli:** `src/ui/place-mode.ts` (103 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ `enter/exit` — place-mode CSS + btn teksti
- ✓ Toolbar dropdown: avaa/sulje, sign-type valinta
- ✓ Floating picker: asemointi positionPicker, dblclick flow
- ✓ `onMapClick` — lisää merkki jos place mode aktiivinen
- ✓ Outside mousedown → sulkee molemmat

### Tulossa
- [ ] Roolisuojaus: vain järjestäjä voi lisätä (T32)

### Käyttäjätarkistus
> Järjestäjä: tuplaklikkaa → picker ilmestyy kursorin viereen ✓
> Talkoolainen: ei pääsyä place-modeen roolin mukaan (T32 jälkeen)

---

## AppController
**Vastuu:** Sovelluksen init ja komponenttien wiring
**Käyttäjä:** molemmat (entry point)
**Moduuli:** `src/main.ts` (143 riv)
**Testattavuus:** Playwright

### Ominaisuudet
- ✓ GPX-lataus kaikille reiteille rinnakkain
- ✓ Leaflet-polylinjojen luonti
- ✓ Tile layer -sykli + localStorage
- ✓ Marker modal avaus/sulkeminen
- ✓ Keyboard shortcuts (Escape, ←→ drive)
- ✓ RouteBar + ProgressBar + PlaceMode wiring

### Tulossa
- [ ] Auth-flow (T36)
- [ ] Roolinäkymävalinta (T32)

---

## SignLibraryPanel *(tulossa — T22)*
**Vastuu:** Järjestäjä luo/muokkaa/poistaa merkkikirjaston templatit
**Käyttäjä:** järjestäjä toimistossa
**Konteksti:** suunnitteluvaiheessa, iso näyttö, hyvä yhteys
**Moduuli:** `src/ui/sign-library-panel.ts` *(ei vielä)*
**Testattavuus:** Vitest-jsdom

### Tulossa
- [ ] Lista olemassa olevista SignTemplate:ista (T22)
- [ ] Luo uusi: label, shortLabel, color, icon, kuvaus (T22)
- [ ] Muokkaa / poista (T22)

### Käyttäjätarkistus
> Järjestäjä: luo "Varo hyppy" ikonilla ja kuvauksella — yhdessä paneelissa ✓
> Talkoolainen: ei suoraa käyttöä

---

## RoleSelector *(tulossa — T12)*
**Vastuu:** Roolin valinta-UI + toggle järjestäjä/talkoolainen
**Käyttäjä:** molemmat
**Moduuli:** `src/ui/role-selector.ts` *(ei vielä)*
**Testattavuus:** Vitest-jsdom

### Tulossa
- [ ] Toggle UI: järjestäjä ↔ talkoolainen (T12)
- [ ] Toolbar + paneelit eriytyvät roolin mukaan (T32, V13)

### Käyttäjätarkistus
> Talkoolainen: näkee vain oman pätkän + kuittausnapin ✓
> Järjestäjä: kaikki suunnittelutyökalut näkyvissä ✓

---

## SegmentPanel *(tulossa — T25)*
**Vastuu:** Pätkien luonti kartalla + assign talkoolaiselle
**Käyttäjä:** järjestäjä
**Moduuli:** `src/ui/segment-panel.ts` *(ei vielä)*
**Testattavuus:** Vitest-jsdom

### Tulossa
- [ ] Pätkän piirto kartalla: korostettu viiva (T25)
- [ ] Assign talkoolaiselle roolitunnuksella (T26)
- [ ] Talkoolaisen pätkänäkymä: filtteröity kartta (T14)

---

## SituationDashboard *(tulossa — T28)*
**Vastuu:** Tilannekuvanäkymä: merkit värikoodattu + prosentit per reitti
**Käyttäjä:** järjestäjä + kaikki (avoimuus)
**Moduuli:** `src/ui/situation-dashboard.ts` *(ei vielä)*
**Testattavuus:** Vitest-jsdom

### Tulossa
- [ ] Merkit värikoodattu statuksen mukaan kartalla (T28)
- [ ] Prosenttiluvut per reitti + kokonaisuus (T15)

### Käyttäjätarkistus
> Järjestäjä: yhdellä silmäyksellä montako % asetettu per reitti ✓

---

## EquipmentList *(tulossa — T27)*
**Vastuu:** Automaattinen varustelista + manuaaliset lisäykset
**Käyttäjä:** talkoolainen (valmistelu kotona/autossa)
**Moduuli:** `src/ui/equipment-list.ts` *(ei vielä)*
**Testattavuus:** Vitest-jsdom

### Tulossa
- [ ] Auto-laskuri per SignTemplate per pätkä (T27)
- [ ] Manuaaliset rivit: "5 rullaa nauhaa" (T27)
- [ ] Järjestäjän ohjeteksti (T27)

### Käyttäjätarkistus
> Talkoolainen: avaa listan autossa, tarkistaa onko kaikki ✓

---

## AuthScreen *(tulossa — T36)*
**Vastuu:** Kutsukoodi-syöttö ennen karttaa
**Käyttäjä:** molemmat
**Moduuli:** `src/ui/auth-screen.ts` *(ei vielä)*
**Testattavuus:** Vitest-jsdom

### Tulossa
- [ ] Koodi-input + submit (T36)
- [ ] Virheviesti väärästä koodista (T36)

### Käyttäjätarkistus
> Talkoolainen: syöttää koodin → suoraan omaan pätkänäkymään ✓
