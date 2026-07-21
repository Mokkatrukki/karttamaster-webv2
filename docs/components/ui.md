# Komponentit — src/ui/ kerros

DOM-komponentit ilman Leafletia. **Testattavuus: Vitest-jsdom.**

---

## MarkerListUI
**Vastuu:** Merkkilistamodaali + merkkidotit edistymispalkin päällä + bulk-toiminnot
**Käyttäjä:** molemmat
**Konteksti:** lista avautuu "Merkit"-napista, dotit aina näkyvissä
**Moduuli:** `src/ui/marker-list.ts` (261 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ `renderMarkerList` — modal-lista, klikkaus avaa `MarkerDetailModal` (`onOpenDetail`), muuten pan-to
- ✓ `renderSignDots` — värilliset merkkipisteet edistymispalkkiin, vain aktiivisen reitin merkeille
- ✓ Highlight uusi merkki listassa (`.marker-item--new`)
- ✓ V33: talkoolainen näkee vain oman pätkänsä merkit (`segmentMarkerIds`-filtteri)
- ✓ Järjestäjä: leveämpi modaali (`modal--järjestäjä`) + bulk-toolbar — valitse kaikki, statusvalinta, "Aseta (N)"-nappi joukolle merkeille
- ✓ Talkoolainen: sticky bottom bulk-action-bar — "✓ Aseta (N)" / "Ei tarpeen (N)", vain ei-terminaalitilaisille merkeille
- ✓ Poistonappi (`.btn-delete`) vain järjestäjälle
- ✓ Kommenttikuvake (`marker-note-dot`) jos `locationNote` asetettu

### Käyttäjätarkistus
> Talkoolainen: lista näyttää oman pätkän merkit, bulk-kuittaus nopeuttaa raportointia metsässä ✓
> Järjestäjä: dotit palkin päällä antaa pikakuvan, bulk-status-toolbar nopeuttaa massamuutoksia ✓

---

## ProgressBar
**Vastuu:** Edistymispalkki + drag-to-seek + merkkidotit
**Käyttäjä:** molemmat
**Moduuli:** `src/ui/progress-bar.ts` (72 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ `update(km)` — fill + handle + km-teksti
- ✓ `refreshDots()` — renderSignDots aktiiviselle reitille
- ✓ Drag-to-seek: mouse + touch, jumpTo lähimpään pisteeseen

### Käyttäjätarkistus
> Talkoolainen: drag progress bar → siirtyy suoraan ✓
> Järjestäjä: km-laskuri näkyvissä ✓

---

## PlaceMode
**Vastuu:** Merkin lisäystila — dblclick kartalle avaa floating picker suosikkimerkeistä
**Käyttäjä:** järjestäjä toimistossa
**Moduuli:** `src/ui/place-mode.ts` (61 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Floating picker: dblclick kartalla avaa suosikkimerkkien valikon kursorin viereen (`positionPicker` asemoi ruudun reunoja väistäen)
- ✓ Valinta lisää merkin suoraan (`markerManager.add`)
- ✓ Outside mousedown / Escape → sulkee pickerin
- HUOM: erillinen toolbar-dropdown (`#btn-add-sign`) on poistettu — dblclick+floating-picker on ainoa flow (ks. SPEC.md §B:t)
- HUOM: roolisuojaus ei ole tässä komponentissa — dblclick-käsittelijä on kytketty `main.ts`:ssä kaikille rooleille, mutta talkoolaisen näkymässä toolbar/paneelit on muuten piilotettu roolin mukaan

### Käyttäjätarkistus
> Järjestäjä: tuplaklikkaa → picker ilmestyy kursorin viereen ✓

---

## AppController
**Vastuu:** Sovelluksen entry point — orkestroi wiring-moduulit, ei itse liiketoimintalogiikkaa
**Käyttäjä:** molemmat (entry point)
**Moduuli:** `src/main.ts` (T155: pilkottu 472 riv → ~110 riv)
**Testattavuus:** Playwright (critical-paths kattaa kaikki)

### Ominaisuudet
- ✓ T155: init + wiring pilkottu viiteen `src/app/`-moduuliin, main.ts jää orkestroijaksi:
  - `map-init.ts` — Leaflet-kartta, tile layer -sykli + localStorage, toolbar-menu, left-panel, GPS-nappi
  - `role-view.ts` — `applyRoleView`/`applyRoleHide` + `wireAuth` (AuthScreen, RoleSelector, SnapshotPanel, GpkgControls)
  - `areas-wiring.ts` — `AreaOverlay`/`AreaPanel`/`MapRectEditor`, `/a/<hash>`-syväliinkin käsittely
  - `segments-wiring.ts` — pätkävarasto, `SegmentOverlay`/`SegmentPanel`/`PhaseSwitcher`
  - `markers-wiring.ts` — `MarkerManager`/`MarkerDetailModal`/`PlaceMode`/`DriveMode`/`RouteBar`/`ProgressBar`/`StatusPanel`/`SignLibraryPanel`/`GpsDrivePanel`/`SegmentView`
- ✓ main.ts: GPX-lataus + polylinjat + fitBounds, kartan click/dblclick/keydown-glue (koskettaa useaa wiring-moduulia, siksi jää orkestroijaan), etäisyys/tallennusvaroitukset (`showWarning`)
- ✓ Ei uutta logiikkaa T155:ssä — puhdas siirto, kaikki testit pysyivät vihreinä + Playwright critical-paths (16/16) vahvisti käyttäytymisen

### Käyttäjätarkistus
> Molemmat: sama käyttäytyminen kuin ennen pilkkoa, vahvistettu Playwright-kriittispoluilla — pilkko ei näy käyttäjälle

---

## SignLibraryPanel
**Vastuu:** Järjestäjä luo/muokkaa/poistaa merkkikirjaston templatit
**Käyttäjä:** järjestäjä toimistossa
**Konteksti:** suunnitteluvaiheessa, iso näyttö, hyvä yhteys
**Moduuli:** `src/ui/sign-library-panel.ts` (340 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Kollapsoituva lista left-panelissa, oletusmerkit (vasen/oikea/tuleva-vasen/tuleva-oikea) suoraan sijoitettavissa
- ✓ "+ Uusi merkki" -footer avaa muokkausmodaalin (`···`-nappi jokaisella rivillä)
- ✓ Modaali: ikonivalinta kuratoidusta ikonisetistä (`CURATED_ICONS`) tai ei ikonia, nimi, lyhenne (max 3 merkkiä), väri (ei oletusmerkeille), kuvaus, suosikki-toggle
- ✓ Tallenna luo/päivittää templatin (`createTemplate`/`updateTemplate`)
- ✓ Poista-nappi (destructive, confirm) vain ei-oletusmalleille
- ✓ `createSignLibrary()` — lataa tallennetun kirjaston tai seedaa neljä oletusmerkkiä

### Käyttäjätarkistus
> Järjestäjä: luo "Varo hyppy" ikonilla ja kuvauksella — yhdessä paneelissa ✓
> Talkoolainen: ei suoraa käyttöä

---

## RoleSelector
**Vastuu:** Roolin näyttö toolbarissa (nykyään pääosin lukittu backendin roolin mukaan)
**Käyttäjä:** molemmat
**Moduuli:** `src/ui/role-selector.ts` (36 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Näyttää roolin toolbar-napissa (`Järjestäjä`/`Talkoolainen`)
- ✓ `lockedRole`-parametri piilottaa toggle-napin kokonaan (`btn.hidden = true`) kun rooli tulee backendistä
- HUOM §B48/§V80: `#btn-role`-toggle-klikkauslogiikka on nykyään dead code — `main.ts` antaa aina `lockedRole`:n tili-per-rooli-autentikoinnin myötä, joten manuaalinen roolinvaihto napista ei ole enää mahdollinen (eikä tarpeen)

### Käyttäjätarkistus
> Talkoolainen: näkee vain oman pätkän + kuittausnapin ✓
> Järjestäjä: kaikki suunnittelutyökalut näkyvissä ✓

---

## SegmentPanel
**Vastuu:** Pätkien lista + luontiflow (3-vaiheinen: piste1 → piste2 → tiedot) — luonti/muokkaus/poisto on siirretty `SegmentCreationModal`/`SegmentDetailsModal`-komponentteihin
**Käyttäjä:** järjestäjä
**Moduuli:** `src/ui/segment-panel.ts` (279 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Kollapsoituva pätkälista left-panelissa, "+ Luo uusi pätkä" -footer käynnistää luontiflown
- ✓ Luontiflow: klikkaa aloituspiste kartalta → lopetuspiste → `SegmentCreationModal` näyttää tiedot-lomakkeen (nimi, järjestäjän ohjeet)
- ✓ Validointi luonnissa: pisteet eivät saa olla liian lähellä toisiaan eivätkä mennä päällekkäin olemassa olevan pätkän kanssa (`validateNoOverlap`)
- ✓ Snap-pisteet kartalla luonnin aikana (`onShowSnapMarkers`/`onSnapClick`)
- ✓ Rivin `···`-nappi avaa `SegmentDetailsModal`:n kyseiselle pätkälle
- ✓ Escape / peruuta-nappi keskeyttää luontiflown missä vaiheessa tahansa

### Käyttäjätarkistus
> Järjestäjä: kolme klikkausta kartalle + lomake — pätkä luotu ja näkyy kartalla värillisenä kaistana ✓

---

## SegmentCreationModal
**Vastuu:** Pätkän 3-vaiheinen luontimodaali (map-klikkaus-ohjeet + tiedot-lomake)
**Käyttäjä:** järjestäjä
**Moduuli:** `src/ui/segment-creation-modal.ts` (195 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Progress-indikaattori (1-2-3) ja vaihekohtainen ohjeteksti ("Klikkaa kartalta aloituspiste" / "lopetuspiste")
- ✓ Vaiheissa 1-2 modaali läpinäkyvä klikkauksille (`pointer-events: none` backdropille) jotta kartta on klikattavissa
- ✓ Virheviesti-slotti (`setError`) päällekkäisyys-/etäisyysvirheille
- ✓ Vaihe 3 (`tiedot`): nimi (esitäytetty "Pätkä N"), järjestäjän ohjeet -tekstialue, Tallenna/Peruuta
- ✓ Tallennus luo segmentin (`createSegment`) ja pushaa backendiin (`pushSegment`)

### Käyttäjätarkistus
> Järjestäjä: näkee koko ajan missä vaiheessa ollaan, voi peruuttaa kesken kaiken ✓

---

## SegmentDetailsModal
**Vastuu:** Pätkän täydet asetukset — nimi, kuvaus, merkit, varustelista, talkoolaisen linkki, pisteiden muokkaus, poisto
**Käyttäjä:** järjestäjä
**Moduuli:** `src/ui/segment-details-modal.ts` (490 riv, seurattava — lähellä pilkkorajaa)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Nimen muokkaus (blur/Enter tallentaa, päivittää modaalin otsikon reaaliaikaisesti)
- ✓ Järjestäjän ohjeet -tekstialue (change tallentaa)
- ✓ Pätkän merkit -lista (km + tyyppi + statusbadge), näkyy vain jos merkkejä on
- ✓ Varustelista: automaattinen laskuri merkkityypeittäin + manuaaliset rivit (määrä + nimi, lisää/poista)
- ✓ Talkoolaisen linkki: näyttää/generoi `assignedCode`-koodin, kopiointinappi, "Muuta"-nappi poistaa koodin (`DELETE /api/admin/codes/:code`)
- ✓ "Muokkaa pisteitä kartalla" -nappi sulkee modaalin ja siirtää `segmentOverlay.enterEditMode`-tilaan
- ✓ Danger zone: "Poista pätkä" (confirm, poistaa myös backendistä)
- ✓ Kaikki muutokset synkronoidaan backendiin (`updateSegmentRemote`/`deleteSegmentRemote`)

### Käyttäjätarkistus
> Järjestäjä: yhdessä modaalissa kaikki pätkän hallinta — muokkaus, varusteet, assign-linkki, poisto ✓

---

## EquipmentList
**Vastuu:** Talkoolaisen pätkänäkymä — merkit, automaattinen + manuaalinen varustelista, bulk-kerää-nappi
**Käyttäjä:** talkoolainen (valmistelu kotona/autossa + kentällä)
**Moduuli:** `src/ui/segment-view.ts` (viittaus COMPONENTS.md:ssä käyttää nimeä `EquipmentList`, mutta toteutus on osa laajempaa `SegmentView`-luokkaa, ei erillinen `equipment-list.ts`)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Pätkän nimi + km-väli + kuvaus header-osiossa
- ✓ Automaattinen varustelaskuri: merkit ryhmiteltynä tyypin mukaan ("N× tyyppi")
- ✓ Manuaaliset varusterivit järjestäjän `segment.equipment`-listasta
- ✓ Merkkilista km-järjestyksessä, tyyppi + statusbadge per merkki
- ✓ "✓ Merkitse kaikki kerätyksi" -bulk-nappi, näkyy vain purku-vaiheessa (`phase === 'purku'`) kun ei-terminaalitilaisia merkkejä on jäljellä

### Käyttäjätarkistus
> Talkoolainen: avaa oman pätkän näkymän autossa, tarkistaa varustelistan ja merkit ennen lähtöä ✓

---

## AuthScreen
**Vastuu:** Kirjautumisnäyttö ennen karttaa — järjestäjä (tunnus+salasana) ja talkoolainen (koodi) välilehdet
**Käyttäjä:** molemmat
**Moduuli:** `src/ui/auth-screen.ts` (160 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Overlay näytetään ennen mitään fetchiä (V40) — kartta ei vilahda ennen auth-tarkistusta
- ✓ `GET /api/auth/me` tarkistaa olemassa olevan session ensin, ohittaa kirjautumisen jos voimassa
- ✓ Kaksi välilehteä: Järjestäjä (käyttäjätunnus + salasana, `POST /api/auth/login`) ja Talkoolainen (koodi, `POST /api/auth/code-login`)
- ✓ `/s/<koodi>`-syväliinkki esitäyttää ja lähettää talkoolaiskoodin automaattisesti
- ✓ Virheviestit: väärä tunnus/salasana, väärä koodi, yhteysvirhe — lomake pysyy näkyvissä (V29, ei hiljaista ohitusta)
- HUOM: ei enää pelkkä "kutsukoodi"-syöttö — täysi login-flow admin/järjestäjä/talkoolainen-rooleille, admin käyttää samaa komponenttia (ks. AdminPage)

### Käyttäjätarkistus
> Talkoolainen: syöttää koodin (tai avaa hash-linkin) → suoraan omaan pätkänäkymään ✓
> Järjestäjä: tunnus+salasana → suoraan karttaan ✓

---

## SnapshotPanel
**Vastuu:** Varmuuskopiomodaali — luo/listaa/palauta snapshotteja
**Käyttäjä:** järjestäjä + admin
**Moduuli:** `src/ui/snapshot-panel.ts` (172 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Roolitarkistus (`isAllowed`) — vain järjestäjä/admin voi avata tai käyttää
- ✓ "Luo varmuuskopio" -nappi (`POST /api/admin/snapshots`)
- ✓ Lista snapshoteista: label, päivämäärä, luoja
- ✓ "Palauta tämä versio" -nappi per rivi, confirm-varoitus (kaikki nykyiset merkit korvataan)
- ✓ Escape / backdrop-klikkaus sulkee modaalin

### Käyttäjätarkistus
> Järjestäjä: voi ottaa varmuuskopion ennen isoa muutosta ja palauttaa jos jokin menee pieleen ✓

---

## LeftPanel
**Vastuu:** Vasemman sivupaneelin kollapsoinnin hallinta (sisältää SegmentPanel, AreaPanel, SignLibraryPanel)
**Käyttäjä:** järjestäjä (desktop-layout)
**Moduuli:** `src/ui/left-panel.ts` (35 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Toggle-nappi (`#left-panel-toggle`) piilottaa/näyttää paneelin sisällön, nuoli-ikoni vaihtuu suunnan mukaan
- ✓ `open()` avaa paneelin jos kollapsoitu (ei toggle jos jo auki)
- ✓ Touch-target-korjaus: `#left-panel-toggle` oli 28×28px, kasvatettu 44×44px (SPEC.md §B47)

### Käyttäjätarkistus
> Järjestäjä: voi piilottaa paneelin lisätäkseen karttatilaa, toggle-nappi nyt riittävän iso myös kosketusnäytölle ✓

---

## StatusPanel
**Vastuu:** Tilannekuvanäkymä — edistymispalkki + prosentit per reitti
**Käyttäjä:** järjestäjä + kaikki (avoimuus)
**Moduuli:** `src/ui/status-panel.ts` (49 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Rivi per reitti: reitin nimi, edistymispalkki (`role="progressbar"`), prosenttiluku, "N/total"-teksti
- ✓ `update(summaries)` renderöi `calcAllRouteStatus`-datan uudelleen kutsuttaessa (merkkimuutosten jälkeen)

### Käyttäjätarkistus
> Järjestäjä: yhdellä silmäyksellä montako % asetettu per reitti ✓

---

## ModalHelpers
**Vastuu:** Jaetut modaaliapurit — Esc-sulkeminen ja backdrop-klikkaussulkeminen
**Käyttäjä:** ei suoraa käyttäjää — sisäinen apumoduuli kaikille modaalikomponenteille
**Moduuli:** `src/ui/modal-helpers.ts` (33 riv)
**Testattavuus:** Vitest-jsdom (epäsuorasti modaalien testien kautta)

### Ominaisuudet
- ✓ `registerEscClose(onClose)` — rekisteröi Escape-näppäimen sulkemaan modaalin, palauttaa cleanup-funktion
- ✓ `createBackdrop(className, onClose)` — luo backdrop-elementin joka sulkeutuu klikattaessa taustan (ei sisällön) ulkopuolelta
- Käytössä mm. SignLibraryPanel, SegmentCreationModal, SegmentDetailsModal, AreaDetailsModal, MarkerDetailModal

### Käyttäjätarkistus
> Ei sovellu — sisäinen apuri, ei suoraa käyttäjäkontaktia

---

## AreaDetailsModal
**Vastuu:** Alueen (huoltoalue, noutopiste tms.) täydet asetukset — nimi, koko, kierto, ohjeteksti, komponentit, poisto
**Käyttäjä:** järjestäjä
**Moduuli:** `src/ui/area-details-modal.ts` (370 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Nimen muokkaus (blur/Enter)
- ✓ Koko ja kierto -syötteet (leveys/korkeus metreinä, kiertokulma asteina)
- ✓ Markdown-ohjeteksti talkoolaisille (`textarea`, renderöidään `AreaView`:ssä)
- ✓ Komponenttilista (`AreaFeature[]`): värivalitsin, nimi, poisto per komponentti
- ✓ "✓ Merkitse valmiiksi" / "↩ Peru valmis" -toggle statukselle (confirm valmiiksi-merkinnässä)
- ✓ Danger zone: "Poista alue" (confirm)

### Käyttäjätarkistus
> Järjestäjä: yhdessä modaalissa alueen koko elinkaari — koko, ohjeet, komponentit, valmius, poisto ✓

---

## AreaPanel
**Vastuu:** Alueiden lista + luontiflow left-panelissa (huoltoalueet, noutopisteet ym.)
**Käyttäjä:** järjestäjä
**Moduuli:** `src/ui/area-panel.ts` (367 riv, seurattava — lähellä pilkkorajaa)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Kollapsoituva alue-lista, rivi per alue: laajennusnappi (näyttää komponentit), nimi, statusbadge (✓ valmis / komponenttimäärä), `···`-nappi avaa `AreaDetailsModal`:n
- ✓ Laajennettu rivi näyttää komponentit inline: väriswatch (dblclick vaihtaa väriä), nimi (dblclick muokkaa inline), muokkausnappi
- ✓ "+ Lisää alue" -flow: piirto-tila kartalla (`onEnterDrawMode`) tai klikkaus-tila (`onEnterMapMode`) riippuen mitä callback on annettu
- ✓ "+ Lisää komponentti" per alue -flow samalla piirtologiikalla
- ✓ `updateAreas()` synkronoi listan ulkopuolisen datan kanssa (esim. kartalta siirron jälkeen)

### Käyttäjätarkistus
> Järjestäjä: näkee kaikki alueet listana, voi laajentaa nähdäkseen komponentit ilman kartalle klikkaamista ✓

---

## AreaView
**Vastuu:** Julkinen alueen tarkastelu- ja tulostusnäkymä `/a/<hash>`-syväliinkistä
**Käyttäjä:** talkoolainen (avaa linkin metsässä/ennen lähtöä) — ei vaadi kirjautumista
**Moduuli:** `src/ui/area-view.ts` (124 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ `initAreaView(map)` tunnistaa `/a/<hash>`-polun, hakee alueen (`GET /api/areas/by-hash/:hash`), lentää kartta alueelle
- ✓ Modaali: nimi, markdown-ohjeteksti renderöitynä HTML:ksi (`marked`), komponenttitaulukko (nimi, väri, koko)
- ✓ "Tulosta"-nappi (`window.print()`) — tulostusystävällinen yhteenveto komponenteista

### Käyttäjätarkistus
> Talkoolainen: avaa hash-linkin → näkee heti alueen ohjeet ja komponentit ilman kirjautumista tai kartan selaamista ✓

---

## GpkgControls — T127 ✓
**Vastuu:** Toolbar-menun "Vie GPKG" / "Tuo GPKG" -napit — vienti plain `<a href download>`, tuonti file-input + POST-upload + tulosstatus.
**Käyttäjä:** järjestäjä (kaverin QGIS-vaihto). Piilotettu talkoolaiselta (`data-role-hide="talkoolainen"`, sama mekanismi kuin GPS-napissa käänteisesti).
**Konteksti:** toimisto/koti, ei kenttäkäyttöä — ei erityistä mobiili/hanskat-vaatimusta.
**Moduuli:** `src/ui/gpkg-controls.ts` (import-logiikka) + `index.html` (export-linkki, ei JS:ää tarvita — selain lähettää session-cookien mukana GET-navigoinnissa)
**Testattavuus:** Vitest-jsdom (`tests/gpkg-controls.test.ts`) — fetch mockattu, kattaa onnistuneen tuonnin, 403:n ja verkkovirheen.

### Ominaisuudet
- ✓ "Vie GPKG" — `<a href="/api/gpkg/export" download>`, ei erillistä JS-wireäystä
- ✓ "Tuo GPKG" -nappi avaa piilotetun file-inputin
- ✓ Tiedoston valinta → `POST /api/gpkg/import` multipart, statusteksti "Tuotu: N uutta, M päivitetty" tai virhe (HTTP-status / "yhteys epäonnistui")

### Käyttäjätarkistus
> Järjestäjä: kaksi nappia toolbar-menussa, ei modaalia — export on yksi klikki, import kaksi (valitse tiedosto → tulos näkyy heti).

---

## GpsDrivePanel
**Vastuu:** Talkoolaisen GPS-ajotila — näyttää lähimmän asettamattoman merkin ja pikatoiminnot
**Käyttäjä:** talkoolainen metsässä/autossa
**Moduuli:** `src/ui/gps-drive-panel.ts` (67 riv)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ `update(currentKm)` etsii lähimmän ei-asetetun merkin aktiivisella reitillä (`nearestUnsetMarker`), piiloutuu jos ei löydy
- ✓ Näyttää tyyppi + km + etäisyys (m tai km), korostustyyli (`gdp-near`) kun alle 200 m päässä
- ✓ "Hyppää"-nappi siirtää drive moden suoraan merkin kohdalle (`driveMode.jumpToDistance`)
- ✓ "Aseta" / "Ei tarpeen" -pikanapit päivittävät lähimmän merkin statuksen suoraan ilman modaalia

### Käyttäjätarkistus
> Talkoolainen: ajaa reittiä, näkee heti seuraavan hoidettavan merkin ja voi kuitata sen kahdella klikkauksella ilman listan avaamista ✓

---

## MarkerDetailModal — T103
**Vastuu:** Yksittäisen merkin täydet tiedot — kommentti, kuvaus, kuvat, tyypinvaihto, statussiirtymät, poisto
**Käyttäjä:** molemmat, eri footer roolin mukaan
**Moduuli:** `src/ui/marker-detail-modal.ts` (343 riv, seurattava — kasvoi T103:ssa)
**Testattavuus:** Vitest-jsdom

### Ominaisuudet
- ✓ Header: tyyppi + km + statusbadge + sulje
- ✓ Kommentti-tekstialue (`locationNote`) molemmille rooleille, auto-tallennus blurilla
- ✓ Kuvaus: järjestäjälle muokattava tekstialue, talkoolaiselle vain luku
- ✓ Kuvagalleria (T103): thumbnailit + virhefallback ("[kuva ei saatavilla]"), järjestäjälle "📷 Lisää kuva" -nappi (kamera/tiedosto, `capture=environment`)
- ✓ Järjestäjän footer: tyyppi-select (`.marker-detail-type-select` — sisältää sekä `SIGN_TYPES` että kirjaston templatit), Tallenna, destructive "Poista merkki"
- ✓ Talkoolaisen footer: tila-siirtymänapit `validActions`/`canTransition`-logiikan mukaan (Aseta, Ei tarpeen, Tarkista, Kerätty, Peru)
- HUOM §B50: merkin tyyppi-select siirrettiin tänne (aiemmin `marker-list.ts`:ssä `.marker-type-select`-nimellä) — näkyy vain järjestäjän footerissa, ei talkoolaisen

### Käyttäjätarkistus
> Järjestäjä: voi vaihtaa tyypin, lisätä kuvan ja kuvauksen samassa modaalissa ✓
> Talkoolainen: näkee vain omaan tilansiirtoon tarvittavat napit, ei tyypinvaihtoa ✓

---

## AdminPage — T122+T123 ✓
**Vastuu:** Käyttäjähallinta admin-roolille — käyttäjälista, deaktivointi/aktivointi, kutsut, kutsulinkkien kopiointi
**Käyttäjä:** admin (ei talkoolainen eikä pelkkä järjestäjä)
**Konteksti:** erillinen entrypoint `/admin`, ei jaa runkoa karttanäkymän kanssa — ei karttaa, ei left-panel. Toimii mobiililla (kapea keskitetty layout).
**Moduuli:** `admin.html` (entrypoint) + `src/admin.ts` (wiring, fetch-orkestrointi — poissa coveragesta kuten main.ts) + `src/ui/admin-page.ts` (puhdas render, testattu)
**Testattavuus:** Vitest-jsdom (`tests/admin-page.test.ts`) — renderöinti + callback-wiring. Manuaalisesti Playwright-cli:llä varmistettu login→taulukko→invite-flow (ei pysyvä E2E-spec).

### Ominaisuudet
- ✓ `AuthScreen`-uudelleenkäyttö kirjautumisportissa (roolitarkistus laajennettu myös admin-rooliin, ks. src/admin.ts)
- ✓ Käyttäjätaulukko: nimi, käyttäjätunnus, rooli, luotu, tila, toiminnot
- ✓ Deaktivoi/Aktivoi-nappi → `PATCH /api/admin/users/:id`
- ✓ "Kutsu uusi järjestäjä" → `POST /api/admin/invites` → banner + kopiointi
- ✓ Per-rivi "Kopioi kutsulinkki" kun `invite_token` ei-null (odottava kutsu)
- ✓ 403/ei-admin → `renderForbidden()`, ei pääsyä taulukkoon
- ✓ Per-rivi "Resetoi salasana" (vain aktiivisille) → `POST /api/admin/users/:id/reset-password` → banner + "Lähetä WhatsAppilla" (`wa.me`-linkki)

### Käyttäjätarkistus
> Admin: käyttäjälista + toiminnot yhdellä sivulla, ei ylimääräistä navigointia — täyttää VISION.md:n "alle minuutissa, kolmella klikkauksella" -kriteerin invite-flow'lle.

## Toast — T253 ✓

`src/ui/toast.ts` — jaettu kelluva ilmoitus (`showToast(message, {actionLabel, onAction, duration})` + `dismissToast()`).

### Ominaisuudet
- Yksi toast kerrallaan: uusi `showToast` korvaa edellisen + resetoi auto-dismiss-timerin (V172).
- Auto-dismiss oletus 5000 ms; action-nappi (esim. "Kumoa") → `onAction` + sulje.
- `role=status` / `aria-live=polite`; user-teksti `textContent` (V164); action-nappi 44px (§R).
- Ensimmäinen käyttäjä: inventaarion client-only undo (`src/inventory.ts` — poisto/qty/siirto/paikan poisto → toast, revert olemassa oleviin `/api/inventory`-reitteihin, V173). CLIENT-ONLY: ei persistointia, reload → undo katoaa. Pysyvä `inventory_audit` PARKISSA.

### Käyttäjätarkistus
> Järjestäjä/admin: "oho vahingossa painoin" -turvaverkko edit-moodissa — yksi klikkaus peruu viimeisimmän. Toast näkyy vain `viewMode='edit'`.
