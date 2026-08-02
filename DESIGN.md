# DESIGN.md — Karttamaster design-sopimukset

Ainoa totuus tyyleistä. CSS elää `src/style.css`:ssä (Vite importtaa `main.ts`:stä).
CSS custom properties: `:root`/`[data-theme]`-lohkot tiedoston alussa — muuta tokeneja sieltä, ei hardcoded-hexeistä.
Teemavaihto: `<html data-theme="dark|daylight">`. Default = dark.
Inline SVG-tyylit (dynaamiset, bearing-riippuvaiset): `src/map/icons.ts`.

---

## §C Värit

Kaksi **käyttäjän vapaasti valittavaa** teemaa (V132/T202, EI roolisidottu):
**Reittimerkki-vaalea** (`:root`, oletus — birkkupaperi) ja **Kaamos-tumma**
(`[data-theme="dark"]` — lämmin hiilenmusta). Valinta persistoituu localStorageen
(`karttamaster-theme`, `src/logic/theme.ts`) ja palautuu latauksessa. Molemmat teemat
molempien roolien käytettävissä; toggle tilivalikossa (T203).

### Chrome-tokenit

| Token           | Reittimerkki-vaalea (`:root`)| Kaamos-tumma (`[data-theme=dark]`)| Käyttö                              |
|-----------------|------------------------------|------------------------------|-------------------------------------|
| surface-app     | `#EDF1EC`                    | `#1A1614`                    | Toolbar, route-bar, paneelit        |
| surface-card    | `#F6F9F5`                    | `#241E1B`                    | Modaalit, dropdownit, kortit        |
| surface-raised  | `#ffffff`                    | `#2E2723`                    | Hover-kortit, sisäkkäiset           |
| text-body       | `#17221D`                    | `#F0EAE4`                    | Pääteksti, napit, otsikot           |
| text-muted      | `#5B6A61`                    | `#A99E95`                    | Sekundaaritieto, meta-napit         |
| text-meta       | `#7C8A80`                    | `#857B72`                    | Metatieto (km-lukema)               |
| accent          | `#F2542D`                    | `#F2542D`                    | Päänappi (huomionauha)              |
| accent-text     | `#ffffff`                    | `#ffffff`                    | Teksti accent-taustan päällä        |
| accent-hover    | `#D8441F`                    | `#FF6A44`                    | Accent hover-tila                   |
| confirm         | `#1F8A50`                    | `#2FA35B`                    | Talkoolaisen kuittausnappula        |
| confirm-hover   | `#196E40`                    | `#3BBE6C`                    | Confirm hover-tila                  |
| confirm-text    | `#ffffff`                    | `#ffffff`                    | Teksti confirm-taustan päällä       |
| danger          | `#C4384A`                    | `#E45C6B`                    | Poisto, place-mode aktiivi          |
| danger-text     | `#C4384A`                    | `#F08292`                    | Danger-teksti                       |
| gps-active      | `#2F6FB0`                    | `#4C8BD0`                    | GPS aktiivi -tila                   |
| border-default  | `rgba(23,34,29,0.14)`        | `rgba(255,245,235,0.10)`     | Korttirajat, dropdownit             |
| hover           | `rgba(23,34,29,0.05)`        | `rgba(255,245,235,0.08)`     | Hover-tila napeilla ja riveillä     |
| field-tint      | `rgba(23,34,29,0.04)`        | `rgba(255,245,235,0.06)`     | Input/chip taustasävy               |
| overlay         | `rgba(23,34,29,0.40)`        | `rgba(0,0,0,0.55)`           | Modaalin backdrop                   |

Border-portaikko (subtle/card/default/strong) ja hover-strong noudattavat samaa opasiteettiskaalaa
(0.06/0.10/0.14/0.20 vaaleassa, 0.06/0.08/0.10/0.14 tummassa). Katso `src/style.css` `:root` / `[data-theme="dark"]`.

### Status-värit (§C, merkki-elinkaari — CSS-tokenit `--status-*` + icons.ts STATUS_RING)

Väri = tunniste (V96), eri sävyperheistä (B58). Näkyvät myös kuvamerkin kortin reunuksena (V87).
CSS-tokeneina teemakohtaisesti; Leaflet-DivIcon-SVG (icons.ts) ei peri `:root`-tokeneja → arvot
myös `STATUS_RING`-taulussa synkassa vaalean teeman kanssa. Taustaväri: `color-mix(... 12%, transparent)`.

| Token / status     | Vaalea (`:root`) | Kaamos    | Status           |
|--------------------|------------------|-----------|------------------|
| status-suunniteltu | `#8A968D`        | `#9AA69D` | Suunniteltu (harmaa) |
| status-asetettu    | `#2FA35B`        | `#3EBB6E` | Asetettu (vihreä) |
| status-tarkistettu | `#3B82C4`        | `#4C97D6` | Tarkistettu (sininen)|
| status-keratty     | `#8A5CD1`        | `#A277E0` | Kerätty (violetti)|
| status-ei-tarpeen  | `#C9922E`        | `#DBA83F` | Ei tarpeen (kulta)|

### Vaihe-aksentti (`--phase-accent` + `--phase-accent-contrast`) — T443/V329

Tapahtuman vaihe on järjestelmän tila (V317) mutta oli näkymätön: sama sovellus, samat pätkät, samat merkit ∴ purun alkamisen saattoi luulla joksikin muuksi. Aksentti värjää **yläpalkin** (`#toolbar` tausta) ja **heron** (`#segment-view` yläreunan 4px nauha); rinnalla kulkee aina **nimi** (`.phase-name`, "Purkumaster") — väri ei ole koskaan ainoa kantaja (V329, sama sääntö kuin V328).

Asetetaan `<body data-phase="…">`-attribuutille (`src/ui/phase-indicator.ts`) ∴ token valuu CSS:n kautta jokaiseen pintaan. Ei inline-tyyliä: kaksi väripaikkaa ajautuu erilleen.

| data-phase | `--phase-accent` | `--phase-accent-contrast` | vs valkoinen | Nimi |
|---|---|---|---|---|
| `asettaminen` | `#0F6FA8` sininen | `#ffffff` | 5.44 | Asetusmaster |
| `tarkastus` | `#B26100` amber | `#ffffff` | 4.60 | Tarkastusmaster |
| `purku` | `#9B4C8C` magenta | `#ffffff` | 5.52 | Purkumaster |

Sininen / amber / magenta on CVD-turvakolmikko (Okabe-Ito-suku): **ei punainen↔vihreä -paria**, ja sävyjen lisäksi kylläisyys- ja vaaleusero pitävät ne erillään kirkkaassa auringossa halvalla puhelimella. Vihreä on varattu status-kanavalle (`--segment-done`, `--status-asetettu`) ∴ se ei saa esiintyä vaihekanavassa — kaksi merkitystä samalle sävylle on kaksi asiaa opeteltavaksi.

**Teemariippumaton tarkoituksella.** Vaihe on TUNNUS, ja tunnus joka vaihtuu teeman mukana ei ole tunnus. `[data-theme="dark"]` ei ylikirjoita näitä (sama sääntö kuin karttapinta-tokeneilla, V253 — eri syystä).

**Lähde on rooli-kohtainen (V318/V321), kaksi eikä kolme:** talkoolainen näkee `getActivePhase()` (globaali — hänellä ei ole katselusuodinta), järjestäjä `getViewPhase()` (katselu). T434:n "katselet muuta kuin globaalia" -pilleri säilyy ja on edelleen ainoa paikka joka kertoo eron.

Ilman `data-phase`-attribuuttia (auth-ruutu, `/patkat`) tokenit putoavat neutraaliin chromeen (`--surface-app` / `--text-body`) ∴ mikään ei väläytä väärää vaihetta.

### Merkki-tyyppivärit (SIGN_TYPES `src/logic/sign-picker.ts` + icons.ts, luettavia valkoisella kortilla)

| Tyyppi        | Hex       | Merkki                      |
|---------------|-----------|-----------------------------|
| left          | `#2563EB` | Vasemmalle (sininen)        |
| right         | `#16A34A` | Oikealle (vihreä)           |
| upcoming-left | `#9333EA` | Tuleva vasemmalle (violetti)|
| upcoming-right| `#C2410C` | Tuleva oikealle (poltettu oranssi)|

### Reitti-/pätkävärit (SEGMENT_COLORS `src/logic/segments.ts` + ROUTE_DEFS `src/main.ts`)

Segmenttipaletti (pätkät): **TUMMA perhe** `#163A5F` (petroli) · `#552070` (violetti) · `#681A41` (viini) · `#582F0F` (ruoste). Reittipaletti on keskikirkas ∴ pätkä ja reitti erottuvat päällekkäin myös akromaattisesti (vaaleusero on kanava jota värisokeus ja aurinko eivät vie) ja V244:n ehto `SEGMENT_COLORS ∩ ROUTE-värit = ∅` toteutuu myös silmällä, ei vain pikselinä (ennen: `#2F6FB0` = `smtb-55` pikselilleen). Vihreä puuttuu tarkoituksella — se on varattu status-kanavalle (`--segment-done`, V96-amend).

**Karttapinta-tokenit — oma väriavaruus (V253/B136).** Karttapinnan grafiikan (Leaflet-vektorit, karttalappu, merkkien hehku) kontrasti on kalibroitu POHJAKARTTAA vasten, ja pohjakartta ei vaihdu teeman mukana ∴ nämä värit **eivät saa tulla teemariippuvaisista chrome-tokeneista** (`--confirm`, `--accent`, `--surface-*`, `--text-*`). Lisäksi Leaflet-vektori saa värinsä JS:stä joka ei näe CSS-muuttujaa ⇒ jokainen chrome-token karttapinnalla luo parin joka hajoaa teemanvaihdossa (B136: viiva `#1F8A50` vs lapun reunus `#2FA35B` Kaamoksessa).

| Token | Arvo | JS-peili | Käyttö |
|---|---|---|---|
| `--segment-done` | `#1F8A50` | `SEGMENT_DONE_COLOR` (`src/logic/segments.ts`) | valmis-pätkän viiva + nimilapun reunus |
| `--marker-glow` | `#F2542D` | — | seuraava-merkin hehku (`.marker-next-highlight`) + pending-pulssi (`.leaflet-marker-pending`) |

Rekisteri on testattu: `e2e/t349-map-surface-theme.spec.ts` iteroi tämän taulukon tokenit molemmilla teemoilla ja vaatii identtiset arvot. Uusi karttapinta-token → lisää se sekä tähän taulukkoon että testin `MAP_SURFACE_TOKENS`-listaan.

Sääntö: karttapinta-token määritellään **vain `:root`issa** — `[data-theme="dark"]` ei ylikirjoita sitä. Poikkeus säännöstä "väri tulee tokenista": elementti joka kantaa oman läpinäkymättömän pintansa kartan päällä (`.map-mode-pill`, `#marker-focus-pill`, kontrollit) on chromea ja saa seurata teemaa — se ei lue kontrastiaan pohjakarttaa vasten. Testattava vain teemakierroksella (`e2e/t349-map-surface-theme.spec.ts`): vaaleassa vika on näkymätön.

**Reittivärit — KAKSI KANAVAA (T304/V216).** Sävy erottaa tapahtuman (MTB viileä, Gravel lämmin) JA reitin perheen sisällä; viivakuvio on riippumaton 2. kanava joka paljastaa jaetulla osuudella alla kulkevan reitin ja luetaan myös akromaattisesti (värisokeus, aurinko, mobiilin autokirkkaus). Ennen T304:ää perheen sisäinen ero oli pelkkä vaaleusporrastus (3 sinistä) — yksi kanava kantoi kaiken ∴ päällekkäisyys hävitti alemman kokonaan.

Luminanssibudjetti on kaksipuolinen ja mitattu: reittipilleri (`route-bar.ts`) renderöi värin **taustaksi** tummalla tekstillä ⇒ väri ei saa olla liian tumma (≥3:1 vs `--text-body`), ja viiva piirtyy vaalealle kartalle ⇒ ei liian vaalea (≥2.5:1 vs `#F2F0EA`). Testattu: `tests/t304-route-palette.test.ts`.

| Reitti | id | väri | sävy | kuvio | vs kartta | vs pilleriteksti |
|---|---|---|---|---|---|---|
| SyöteMTB 30 km | `smtb-30` | `#1D8CB4` syaani-sininen | 196° | ehjä | 3.37 | 4.26 |
| SyöteMTB 55 km | `smtb-55` | `#4D6FCB` indigo | 224° | `18 8` | 4.14 | 3.47 |
| SyöteMTB 110 km siirtymä | `smtb-110-siirtyma` | `#8C71D6` violetti-sininen | 256° | `6 10` | 3.38 | 4.25 |
| Gravel 62 km | `sgf-62` | `#A58312` oliivi-amber | 46° | ehjä | 3.15 | 4.56 |
| Gravel 125 km | `sgf-125` | `#E2662A` oranssi | 20° | `18 8` | 2.99 | 4.81 |
| Gravel 175 km | `sgf-175` | `#C4384A` puna | 352° | `6 10` | 4.59 | 3.13 |

Sävyero perheen sisällä ≥20° (mitattu; amber siirrettiin 38°→46° koska 38° oli vain 18° päässä oranssista). Kuviot: ehjä / pitkä katko / lyhyt katko, sama kolmikko molemmissa perheissä — perhe erottuu sävystä, reitti perheen sisällä kuviosta.

**Legenda vastaa karttaa (V216 c).** `MapFilterBar` (T377, `.map-filter-swatch` 18×6px) ja `RouteBar` renderöivät väripallon sijaan **viivaswatchin** (`.tab-color-dot` 16×4px) jonka tausta tulee `routeSwatchBackground(color, dashArray)`-funktiosta (`src/logic/route-swatch.ts`, puhdas). Swatchiin mahtuu 3 jaksoa ∴ harva kuvio lukee kuviona eikä yhtenä pisteenä. Väripallo valehteli sen jälkeen kun kuviosta tuli erottava kanava.

Uusi reittiväri: pidä ≥3:1 tummalla tekstillä. `smtb-55 #1E5A94` hylättiin (2.29:1 < 3:1).

**Sääntö:** Käytä vain yllä olevia tokeneja. Älä keksi uusia hex-koodeja suoraan CSS:ään.
Jos tarvitaan uusi väri, lisää se ensin tähän taulukkoon. Icons.ts/sign-picker.ts JS-arvot
pidettävä synkassa tämän taulukon kanssa (Leaflet-SVG ei peri CSS-tokeneja).

---

## §T Typografia

- **Fontti:** `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif`
- **Koot:**
  - `11px` — meta, tooltip, pieni label
  - `12px` — nappi, sekundaarinen teksti, route-km
  - `13px` — body, listakohta, sign-type-nappi
  - `14px` — modaaliotsikko, navigointipainike
- **Painot:** `600` napit, `700` otsikot
- **Letter-spacing:** `0.04em` h1 (uppercase), `0.01em` napit

**Sääntö:** Ei alle `11px`. Ei yli `14px` ilman UX-hyväksyntää (isompi otsikko = uusi hierarkiataso).

---

## §S Spacing (4px grid)

| Käyttö              | Arvo            |
|---------------------|-----------------|
| Pieni gap           | `4px`           |
| Normaali gap        | `6px`           |
| Komponenttien gap   | `8px`           |
| Iso gap             | `10px`          |
| Pienen napin padding| `6px 12px`      |
| Isojen elementtien padding | `8–14px 16px` |
| Toolbar padding     | `8px 10px`      |

**Sääntö:** Käytä 4px:n monikertoja. `5px`, `7px`, `9px` = bugi.

---

## §R Responsive ja touch

- **Strategia:** mobiili-first, flexbox/grid, ei media queries ellei pakko
- **Viewport:** `maximum-scale=1.0, user-scalable=no` (karttasovellusvaatimus) — **PYYNTÖ, ⊥ toteutus**
  (iOS Safari on ohittanut sen iOS 10:stä lähtien). Toteutus: §R Zoom-sopimus alla.
- **Breakpoints:** ei kiinteitä — `min()`, `clamp()`, `vw`-yksiköt
- **Modaali-leveys:** `min(340px, 92vw)` — toimii 320px Android-puhelimella

### Touch-target minimumit

| Elementti              | Vaatimus       | Tila          |
|------------------------|----------------|---------------|
| Kaikki interaktiiviset | **44×44px**    | §A pakollinen |
| sign-type-btn          | `min-height: 44px` ✓ | OK    |
| btn-delete (poisto)    | `min 44×44px` ✓ | OK           |
| btn-route-prev/next    | `min-height: 36px` ⚠️ | LIIAN PIENI |
| button (global)        | `padding: 6px 12px` → ~24px ⚠️ | LIIAN PIENI |
| btn-modal-close        | `padding: 4px 8px` ⚠️ | LIIAN PIENI |
| `.left-panel-section-header` | `min-height: 44px` ✓ | OK (T373) |
| `.leaflet-control-zoom a` | `44×44px` ✓ | OK (B156 — oli 30×30) |
| `.btn--sm`             | `min-height: 44px` ✓ | OK (UX-audit 2026-08-01 — oli 36px) |
| `.modal-btn-destructive` | `min-height: 44px` ✓ | OK (UX-audit 2026-08-01 — oli 32px) |
| `.equipment-check-box` | `44×44px` ✓ | OK (UX-audit 2026-08-01 — oli 22×22) |
| alue-rivin `▶`         | `44×44px` ✓ | OK (UX-audit 2026-08-01 — oli 32×44) |
| `.leaflet-control-attribution a` | — | POIKKEUS: lisenssimaininta, ⊥ toiminto |

**`--sm` on TYPOGRAFINEN variantti, ⊥ kokovariantti (UX-audit 2026-08-01).** Se pienentää
fonttia (12px) ja vaakapaddingia — **⊥ korkeutta**. Molemmat käyttöpaikat ("✎ Muokkaa
varusteita", "✎ Muokkaa pätkän rajoja") ovat talkoolaisen omia ∴ juuri se käyttäjä jolle
§A on kirjoitettu sai ennen pienimmän kohteen. Vahti: `tests/t206-button-system.test.ts`.

### Mobiiliaudit — geometrinen vahti (2026-08-01)

`e2e/ux-mobile-audit.spec.ts` ajaa **53 näkymää** (SPEC §T463) kahdella leveydellä (390px
mediaanipuhelin, 360px kapein tuettu Android) ja mittaa kolme asiaa jokaisesta:

1. `document.scrollWidth ≤ innerWidth` — ei vaakascrollia
2. jokaisen näkyvän elementin `rect.right ≤ innerWidth` — mikään ⊥ jää ruudun oikealle puolelle
3. jokainen `button/[role=button]/a/input/select/textarea` ≥44×44px

Lisäksi jokaisella näkymällä on **`must`-lista**: mitkä elementit KÄYTTÄJÄN pitää nähdä siinä
näkymässä. Mittari on geometrinen — `querySelector`-osuma ei riitä, elementin ! olla näkyvissä
ja kokonaan viewportissa. Lista elää `docs/UX-MOBIILI-CHECKLIST.md`:ssä.

Uusi näkymä → rivi checklistiin JA `must`-lista speciin. Uusi kelluva kontrolli → tarkista
pinojärjestys sheettejä vasten (ks. `#gps-control` z-index 1050 alla).

**Teema pätee JOKAISELLA sivulla (UX-audit 2026-08-01).** `initTheme()` ! kutsua jokaisessa
entrypointissa (`main` · `patkat` · `kasat` · `inventory` · `admin` · `loki`) ennen ensimmäistä
renderiä. Ennen tätä vain `main.ts` teki sen ∴ Kaamoksen valinnut talkoolainen sai muille
sivuille täyden valkoisen — juuri niille pinnoille jotka avataan pimeässä. Vahti: audit-specin
"teema pätee sivulla …" -testit vaativat `<html data-theme="dark">` per sivu.

**`body[data-role]` on LAYOUT-rooli, ⊥ tilirooli (B193/V346).** Layout-rooleja on kaksi
(`järjestäjä` · `talkoolainen`), tilirooleja kolme. `layoutRole()` (`src/app/role-view.ts`)
typistää `admin`in järjestäjäksi — VISION §Roolihierarkia: admin ⊇ järjestäjä, eikä
karttanäkymässä ole yhtään admin-erityistä pintaa.

Ennen tätä `data-role` sai tilin roolin sellaisenaan ∴ `body[data-role="admin"]` EI osunut
yhteenkään `[data-role="järjestäjä"]`-sääntöön ja admin putosi jokaisesta niistä **hiljaa**:
`#map-filter-bar`in 48px sisennys jäi pois ⇒ "Suodata" asettui `#left-panel-toggle`in päälle
ja nappasi klikin ⇒ suunnittelupaneelia ⊥ saanut auki lainkaan (sama umpikuja kuin B170);
`#btn-menu-map-mode` jäi piiloon ⇒ ≤560px muokkaustila katosi kokonaan; talkoolaisen
⋯-valikkolohko jäi näkyviin.

**Sääntö:** roolisidonnainen CSS kirjoitetaan VAIN layout-roolilla. Uusi tilirooli → rivi
`layoutRole`en, ⊥ uusi haara jokaiseen selektoriin. Vahdit: `tests/b193-layout-role.test.ts`
(kartta) + audit-specin `admin-kartta_390` (mittaa `elementFromPoint`illa KUKA SAA KLIKIN —
pelkkä geometria ⊥ paljasta varastettua klikkiä).

**Inline-tyyli voittaa CSS:n.** Useat modaalikontrollit (`area-details-modal.ts`,
`sign-template-modal.ts`) asettavat mittansa `style.cssText`illä ∴ §A:n korjausta EI voi tehdä
`style.css`:ään — se ei pure. Poikkeus: natiivi checkbox, jonka koko ! tulla jaetusta
`appearance:none`-kaavasta (B171) ⇒ inline-leveys on siltä poistettava, ei kasvatettava.

**Sääntö:** `min-height: 44px` kaikille napeille. Tämä on erityisen kriittistä talkoolaiselle
metsässä, hanskat kädessä.

**Mittari seuraa roolia, ei tagia (T373/V268).** E2E-vahti (`critical-paths.spec.ts` "Touch targets")
valitsee `button, [role="button"]`. Pelkkä `button` jätti mittaamatta `div[role=button]`-headerit
(~28px) ja Leafletin zoom-linkit (30×30px, B156) — vahti oli vihreä ja lupasi §A:n pitävän.
Jos lisäät interaktiivisen elementin joka ei ole `<button>`, sillä ! olla syy: natiivi nappi tuo
fokuksen, Enter/Space-aktivoinnin ja vahdin kattavuuden ilmaiseksi.

**V135-poikkeus:** `.left-panel-section-header` on rakenne-elementti (osion otsikko), ei `.btn`-variantti
— se on `<button>` semantiikan ja kosketuskoon vuoksi, mutta ei kuulu nappipaletin variantteihin.
Älä yritä pakottaa sitä `.btn--ghost`iksi: taustaton, koko leveys, 11px uppercase, `border-bottom`.

### Zoom kuuluu kartalle (T408/V293)

Kehys ⊥ zoomaa — vain kartta. Kolme sääntöä:

1. **`#map` ⊥ saa omaa `touch-action`ia.** ID-selektori (1,0,0) kumoaisi Leafletin
   `.leaflet-container{touch-action:none}`n (0,1,0) → selain nappaa pinchin & iOS zoomaa SIVUN
   kartan sijaan. `#map{touch-action:manipulation}` oli juuri tämä vika. Leaflet asettaa arvon
   itse handlerien mukaan.
2. **Jokainen kehyspinta julistaa eleensä.** Scrollaavat (`#toolbar-menu`, `#left-panel`,
   `#segment-view`, modaalikuoret, `.map-filter-groups`) → `touch-action: pan-y`; ei-scrollaavat
   (`#toolbar`, `#route-bar`, `#status-panel`, `#map-filter-bar`, `.map-mode-pill`) → `none`.
   Mikään ⊥ jää selaimen oletukselle.
3. **`button, [role=button], a, input, select, textarea, label` → `manipulation`** (tappaa
   kaksoisnapautus-zoomin: hanskat → epätarkka osuma toistuu) + **`gesturestart/change/end`
   `preventDefault` dokumentissa** kaikelle `#map`in ulkopuolella (Safari-only ele jota
   `touch-action` ⊥ kata, `src/main.ts`). `html{-webkit-text-size-adjust:100%}` estää iOS:n
   maisema-asennon fonttikasvun venyttämästä 44px-nappeja.

**Sääntö:** uusi kelluva/kiinteä kehyspinta → lisää se sääntöön 2. Uusi `touch-action` `#map`iin →
regressio (E2E `t408-pinch-zoom.spec.ts` vahtii).

### Scroll ja overscroll (B108/V187 — mobiili "kaikki liikkuu" -korjaus)

Pieni puhelinruutu + fixed karttakuori → oletusselain valuttaa scrollin. Kolme sääntöä:

1. **Sisäiset scroll-alueet = `overscroll-behavior: contain`.** Jokainen `overflow-y:auto`-alue
   (modaalilistat, `#toolbar-menu`, `#segment-view`, `#segment-panel`, `#left-panel-content`,
   `.equipment-modal-body`, snapshot/segment-details/creation-modaalit, `.marker-detail-body`)
   pysäyttää scroll-chainingin — reunaan asti scrollattu liike EI valu taustan karttaan.
   Tuettu kaikissa selaimissa 2022 lähtien; CSS-only, ei JS-scroll-lockia.
2. **Karttakuori ei scrollaa itse.** `html:has(#app), body:has(#app) { overflow: hidden }` +
   globaali `overscroll-behavior: none` → ei pull-to-refresh, ei 100dvh-address-bar-hyppyä.
   ⚠️ **VAIN `:has(#app)`-karttasivulle** — `#inventory-app`/`#admin-app` ovat normaali-flow
   scrollaavia sivuja, joilta `overflow:hidden` leikkaisi sisällön.
3. **Backdropit nappaavat eleet.** Modaalin backdrop `touch-action: none; overscroll-behavior: none`
   → drag backdropin päällä ei panoroi alla olevaa Leaflet-karttaa.

**Sääntö:** uusi `overflow-y:auto`-alue → lisää se §R-scroll-selektorilistaan (`overscroll-behavior:
contain`). Fixed dropdown/valikko → `max-height` + `overflow-y:auto` (ei koskaan yli ruudun).
Flex-toolbar joka voi ylittää kapean modaalin → `flex-wrap: wrap` (ei vaakaleikkausta).

---

## §K Komponentit

### Toolbar (`#toolbar`) — yhdistetty yläpalkki (T203/V133, roolijako T233/V155)
- Kiinteä yläreuna, `z-index: 200`, korkeus ~56px, `surface-app`, alaraja `border-subtle`
- **Vasemmalla:** `#app-brand` tuotenimi ("Karttamaster", `font-weight:700`, `15px`)
- **Oikealla:** `#toolbar-actions` (`margin-left:auto`, `gap:6px`) — **koostumus roolikohtainen:**
  - **Talkoolainen (T233/V155):** TASAN `Kaikki merkit #btn-list` + `🎒 Varustelista #btn-varuste` (`data-role-hide="järjestäjä"`, avaa `EquipmentModal`) + `⋯ #btn-menu`. Vain 3 nappia → mahtuu mobiiliin, ⊥ rivinylitä ≤360px. GPS (`#btn-gps`) + `➕ Merkki #btn-add-marker` EIVÄT toolbarissa — asuvat `SegmentView`-herossa (T232, GPS-toggle + hero-overflow).
  - **Järjestäjä:** `Kaikki merkit #btn-list` + `⋯ #btn-menu` (`🎒 Varustelista` piilossa `data-role-hide`illa; `➕ Merkki` lisätään sivupalkista).
  - `Karttatyyli #btn-layer` siirretty ⋯-valikkoon (`#toolbar-menu`) **molemmilla rooleilla** — ei enää näkyvä toolbar-nappi (T233).
- `⋯ #btn-menu`: 44×44px, `border: 1px solid border-strong`
- Ei h1-otsikkoa erikseen — tuotenimi toimii otsikkona

### Toolbar-menu = tilivalikko (`#toolbar-menu`)
- `position: fixed; top: 56px; right: 8px` — avautuu toolbarin alta oikeasta reunasta
- `surface-card`, `border-default`, `border-radius-md`, `box-shadow`, `z-index: 2001`
- Toggle: `.open`-class (`#btn-menu`-klikki), sulkee document-click
- Sisältö ylhäältä: **tilivalikko** (`#account-menu-section`, AccountMenu) → **talkoolaisen pätkä-toiminnot** (`#tk-menu-actions`, T257/R8, `data-role-hide=järjestäjä`: `📍 GPS #btn-tk-gps` label-sync + `➕ Lisää merkki #btn-tk-add-marker` + `✓ Merkitse pätkä valmiiksi #btn-tk-complete` label-sync) → `Karttatyyli #btn-layer` (talkoolainen T233/V155 — siirretty toolbarista valikkoon) → phase-switcher (järjestäjä) → Varmuuskopiot → Vie/Tuo kartta-aineisto (gpkg)
- **T257/R8:** GPS asuu VAIN tässä valikossa talkoolaiselle (hero-GPS-nappi CSS-piilotettu) — VISION "GPS ym ylävalikkoon". Karttamoodin (T255) minimaali hero → core-toiminnot ⋯:ssä.

### AccountMenu (`src/ui/account-menu.ts`, T203/V133)
- Renderöi `#account-menu-section`iin: `display_name` (`/api/auth/me`, `.account-menu-name` bold) + teemavalitsin + Kirjaudu ulos
- **Teemavalitsin** (`.account-menu-theme`, T259/R9): kaksi vaihtoehtoa **"☀️ Vaalea" / "🌙 Tumma"** (`.account-menu-theme-opt`, `min-height:40px`, RINNAKKAIN `flex:1`). Aktiivinen = `--accent` 2px-reuna + `color-mix`-tausta + `✓` (`::after`), heijastaa `getTheme()`. Inaktiivi `surface-raised` + `border-strong` (luettava — ei "rikkinäinen"). Klikki → `setTheme()` (theme.ts, persistoi + `data-theme`). Koskee kaikkia rooleja (V132).
- **Kirjaudu ulos** (`#btn-logout`, `.account-menu-logout`, danger-tyyli): `POST /api/auth/logout` → `onLoggedOut` → `AuthScreen.start()` (login-lomake). Verkkovirhekin → kirjautumisruutu (ei jää haamutilaan).
- **Poistettu:** `#btn-role` + `RoleSelector` (B48/V80 dead code — rooli tulee tili-per-rooli-authista, ei toggle).

### Route-bar (`#route-bar`) — roolijako (T204/V134)
- Kiinteä alareuna, `z-index: 2000` (yli Leaflet-kontrollit 1000)
- **Talkoolainen (T224/A/V148):** koko alapalkki `#route-bar` PIILOTETTU (`hidden`). Ei reittivalitsinta, ei km-scrubberia, ei ◀▶-nuolia — ne ohjasivat koko reittiä (ei pätkää) ja hämäsivät. Talkoolaisen navigointi = SegmentView-hero + kartta (seuraava-merkki korostettu, T224/b1) + yläpalkin "Kaikki merkit"/"Varustelista"-napit. `RouteBar` luodaan silti (driveMode-reitin + activeRouteProviderin vuoksi) mutta itse palkki on piilossa. `#gps-drive-panel` POISTETTU (T224/F/V148, komponentti `gps-drive-panel.ts` poistettu) — duplikoi hero-ohjauksen. Oikea GPS-paikannin elää `gps-navigator.ts`:ssä (ei osa route-baria).
- **Järjestäjä (T377):** koko alapalkki PIILOTETTU myös järjestäjältä. Reittivalinta muutti **MapFilterBariin** (alla) — kaksi "mitä näkyy" -kontrollia = käyttäjä arvaa kummasta etsii. `RouteVisibilityControl` säilyy DOM-vapaana sovelluskerroksena (polylinet + merkit + pätkäviivat + `getActiveRoute`-sopimus ProgressBarille/StatusPanelille). Vanha kuvaus pyöreistä pilleistä (`.route-vis-pill`) ja T286:n trigger-paneelista on POISTUNUT — kumpaakaan ei enää renderöidä.

### MapFilterBar (`#map-filter-bar`, `src/ui/map-filter-bar.ts`) — T377/V272 ✓
Kartan "mitä näkyy" -kontrollit YHDESSÄ paikassa: ohut bar `#map-arean` ensimmäisenä flow-lapsena (headerin & kartan välissä). **Aina näkyvissä, ⊥ napin takana** — suodatettu kartta jonka syytä ⊥ näy luetaan kadonneena datana (B131-luokka). Pystytilan hinta ~56px on tietoinen valinta: löydettävyys > pikselit.
- **Järjestäjä = 4 dropdownia** (`.map-filter-dropdown[data-filter]`): **Reitit** (näytä/piilota + "vain tämä" -oikotie per rivi; V6: viimeistä ⊥ voi piilottaa → `disabled`) · **Pätkät** (isolointi-TILA + ✕ sekä tila-monivalinta ei aloitettu/kesken/valmis) · **Merkit** (status-monivalinta, 5 statusta) · **Himmennys** (kevyt/vahva/piilota, oletus **vahva**, V243-amend).
- **Talkoolainen = 1 dropdown** (T379, `.map-filter-bar--narrow`): `Näytä: kaikki merkit | vain asettamattomat`. Yläpalkkiin ⊥ kosketa (V155).
- **Trigger** (`.map-filter-trigger`, `min-height:44px` §A/V268): label + nykyarvo (`kaikki` / `2/5` / `vahva himmennys`) + ▾. Yksi paneeli auki kerrallaan; document-klikki sulkee.
- **Rivit** (`.map-filter-row`, `<button>`, `min-height:44px`): ✓-ruutu + valinnainen swatch + label. `aria-pressed` kantaa valinnan. Monivalinta ⊥ saa tyhjentyä nollaan (V272).
- **Suodatettu-affordanssi (V272):** `data-active-filters="N"` barissa + `.map-filter-banner` ("Suodatin päällä (N) — kartalla ei näy kaikkea", `--warn`) + `.map-filter-reset` ✕ Nollaa. Molemmat piilossa oletustilassa. Tila persistoituu (`localStorage`, V5) ∴ banneri on pakollinen, ⊥ koriste.
- **Isolointi ⊥ ole toinen laukaisin:** valinta tehdään kartalta/pätkämodaalista (T335-korostuskytkin), bar näyttää `Vain: <nimi>` + ✕ joka sammuttaa myös korostuksen.
- **Kapea ruutu (≤700px) = OMA VALIKKO (B160/B161/V274):** bar kutistuu yhdeksi `.map-filter-sheet-trigger`iksi ("Suodata (N)", `--warn`-reunus kun suodatin päällä) joka avaa `.map-filter-groups`-**bottom sheetin**: kaikki neljä osiota haitareina (`position:static` paneelit — kelluva paneeli sheetin sisällä jäisi klikkaamattomaksi), sticky **Valmis**-nappi pohjassa (taustaklikki osuisi karttaan ∴ se ⊥ saa olla ainoa ulospääsy). Syy: 4 triggeriä ⊥ mahdu 375px-riviin — mitattu `Himmennys` alkoi `x=379` = ruudun ulkopuolelta. Vanha muotoilu: leveän barin paneelit = **bottom sheet** (`position:fixed;bottom:0`, safe-area-padding) — kelluva paneeli veisi kartan leveyden & suodatinta säädetään juuri siksi että vaikutus nähdään kartalla (V114). Kapea (talkoolaisen) bar pitää tavallisen dropdownin: ruudun alalaidan omistaa hero (`#segment-view-container` z-index 1000). Bar `margin-left:40px` järjestäjälle — `#left-panel`in kutistettu kaista overlayaa kartan (T181/V114) & bar ⊥ saa peittää ▶-togglea.
- **⊥ overflow-leikkausta (B161):** barilla `overflow:visible` — `overflow:auto` leikkasi absoluuttisen dropdown-paneelin barin alareunaan & kartta jäi päälle vaikka `z-index` oli oikein. Ahtaus ratkaistaan valikolla (yllä), ⊥ skrollilla.
- **Kerrostuminen:** bar `z-index:1100` (yli hero-kortin 1000 & Leaflet-panejen). Kartan päällä leijuvat kortit siirtyvät barin alle: `#status-panel` `top:65px`, `.map-mode-pill` `top:65px`, `.marker-focus-pill` `top:65px` (105px muokkaustilassa).
- **Himmennysportaat (V243-amend):** `body[data-dim-level]` asetetaan VAIN järjestäjälle → `.marker-dimmed` opacity kevyt `0.4` / vahva `0.15`; viivoilla `0.22` / `0.08` (§K MarkerFocus: viiva satoja px, merkki 40×48). Talkoolaisen automaattifokus (V142) pysyy vakiona kevyt-portaassa.

### Pohjakartan näkyvyys-slider (`BasemapDimControl`, T287/V201)
- **Sijainti:** ⋯-toolbar-valikon rivi `#basemap-dim-container` heti `#btn-layer` (Karttatyyli) vieressä — muut karttakontrollit samassa valikossa. Menu jaettu ∴ näkyy **molemmille rooleille**.
- **Rakenne:** `.basemap-dim` flex-rivi — `.basemap-dim-label` (himmennysikoni + "Pohjan näkyvyys", `text-muted 13px`) + `.basemap-dim-slider` (`<input type=range>` 0–100, `step 5`, `accent-color:var(--accent)`).
- **Touch (§R):** slider `min-height:44px` — hit-area riittää hanskoin.
- **Toiminta:** `tilePane.style.opacity = slider%/100`. Default 100 % (koko kartta). 0 % = pohja häviää (valkoinen jää), 50 % kuultaa läpi. Merkit/reitit koskemattomia (V51). Persistoituu localStorageen (`'karttamaster-basemap-opacity'`).
- **Menu-vuorovaikutus:** container `stopPropagation` klikille → slider-raahaus ei sulje ⋯-valikkoa (document-klikki-sulkija).

### StatusPanel (`#status-panel`, järjestäjä) — T205/V132
- Per-reitti-rollup (35/55km valmis-%) SÄILYY (PM-päätös 2026-07-04). Logiikka `src/ui/status-panel.ts` ennallaan.
- Visuaali: hillitty **leijuva tilannekortti** kartan vasemmassa yläkulmassa (`position:absolute;top:8px;left:8px;z-index:500`, `surface-card` + `border-default` + `radius-md` + kevyt varjo). EI enää "päälle liimattua" täysleveää tummaa palkkia joka työntää karttaa. Näkyy vain `[data-role="järjestäjä"]`. Täyttö/% = `--confirm`-token.

### Dropdownit (`#sign-type-dropdown`, `#floating-picker`)
- Tausta: `bg-card`, border: `border-default`, `border-radius: 10px`
- Shadow: `0 8px 24px rgba(0,0,0,0.4)`
- `z-index: 1003–2000` (floating-picker alempana)

### SnapshotModal (`#snapshot-modal`, `.snapshot-modal-backdrop`) — T82
- Vain järjestäjälle — `SnapshotPanel.open()` tarkistaa roolin ennen avaamista
- Sijainti: `document.body`-lapsi, `position:fixed`, ei vie karttatilaa
- Avautuu: `⋯`-valikko → Varmuuskopiot → `btn-snapshot-panel` → `panel.open()`
- Backdrop: `.snapshot-modal-backdrop`, `var(--overlay)`, `backdrop-filter:blur(2px)`, `z-index:4000`
- Sulkeutuu: ✕-nappi, backdrop-klikki, Esc
- Modal: `background:surface-card`, `border-radius:radius-lg (14px)`, `width:min(480px,92vw)`, `max-height:80vh` scrollable
- Header: `14px 700` otsikko + ✕-nappi `min-height:44px`
- Toimintorivi `.snapshot-modal-actions`: flex, wrap, `gap:6px` — kaikki napit `min-height:44px` (§R pakollinen)
- "Luo varmuuskopio" -nappi (neutraali `hover`-tausta)
- "⬇ Lataa varmuuskopio" (`btn-snapshot-download`, T164): neutraali tausta — turvallinen (vain luku), lataa koko datasetin JSON-tiedostona `<a download>`-triggerillä (session-cookie mukana)
- "⬆ Palauta tiedostosta" (`btn-snapshot-restore-file`, T164): `danger-soft`/`danger-text` — tuhoava (korvaa koko datan), `confirm()` ennen; piilotettu `.snapshot-file-input` avataan napista
- Lista: scrollable, `border-card`-separaattorit, `11px text-muted`
- Palauta-nappi: `danger-soft` tausta, `danger-text` — vaarallinen toiminto = punainen

### GpkgControls (`#btn-gpkg-export`, `#btn-gpkg-import`) — T127
- Vain järjestäjälle/adminille — piilotus `body[data-role="talkoolainen"]`-CSS-selektorilla (**ei** `data-role-hide`-attribuutti, se on kertaluontoinen eikä reagoi live rooli-togglelle, ks. U7)
- `#toolbar-menu a` saa saman tyylin kuin `#toolbar-menu button` (yhtenäinen selektori `#toolbar-menu button, #toolbar-menu a`) — muuten ankkuri renderöityisi oletustyylillä (sininen, alleviivattu)
- "Vie GPKG": plain `<a href download>`, ei JS:ää — selain lähettää session-cookien mukana
- "Tuo GPKG": avaa piilotetun file-inputin, `min-height: 44px` (§R pakollinen)
- `.gpkg-import-status`: `12px`, `text-muted`, `display:block` oman rivinsä — ei riko menun leveyttä (`min-width:200px` riittää)

### MarkerOverviewPanel (`.marker-overview`, `src/ui/marker-overview-panel.ts`) — T402/V290 ✓
Järjestäjän merkkijono: "mitkä merkit jäivät asettamatta ja miltä pätkiltä". Korvaa `#marker-modal`in (poistuu T404).
- **Vain järjestäjä:** `body[data-role="talkoolainen"] .marker-overview{display:none}` — CSS-selektori ⊥ `data-role-hide` (jälkimmäinen on kertaluontoinen eikä reagoi T274:n live-view-flippiin, U7/GpkgControls-oppi).
- **Sijainti = TELAKKA ⊥ modaali ⊥ left-panel-sektio.** `#app-main`in kolmas lapsi `#map-arean` jälkeen, `width:min(380px,100vw)`, `border-left:border-subtle`, `surface-app`, täysi korkeus. **⊥ backdropia ⊥ overlaytä** — rivin klikkaus panoroi karttaa ∴ kartta ! pysyä näkyvänä & klikattavana (V114). Modaali peittäisi juuri sen minkä toiminto liikuttaa = vanhan näkymän käyttämättömyyden syy. Left-panel torjuttu MITATULLA perusteella: sisältöleveys 240px ∴ `.marker-item`in 5 elementtiä (checkbox·ikoni·label·km·status) ⊥ mahdu & status-badge putoaisi; lisäksi 194 merkin lista veisi SignLibrary/SegmentPanel/AreaPanel-kolumnin foldin taakse.
- **Avaus:** `#btn-list` togglaa (`aria-expanded`), Esc sulkee, otsikon `▼` sulkee (⊥ kaksi eri "kiinni"-tilaa samalle pinnalle). Tila `localStorage('karttamaster-marker-overview-open')` (V5-kuvio) — työjono johon palataan ⊥ nollaudu sivulatauksessa. Toggle muuttaa `#map-arean` leveyttä ∴ **`map.invalidateSize()` pakollinen** (T179).
- **Otsikot:** `createSectionHeader` (T371/V267) kolmella tasolla — paneelin otsikko `[▼ Merkit (N)]`, ryhmäotsikko `[▼ Asettamatta (N)]`, alaotsikko `.marker-overview-subhead` (11px uppercase text-muted, sama typografia kuin left-panelin osioilla ∴ ⊥ uutta otsikkotasoa).
- **Ryhmittely status → pätkä** (`marker-overview.ts`): `Asettamatta` · `Asetetut` · `Ei tarpeen` — SAMA kolmijako & sanat kuin talkoolaisen koti-tabissa (V184) ∴ sana tarkoittaa samaa molemmille rooleille. Alaryhmä per pätkä, omistajaton VIIMEISENÄ nimellä `Ei pätkää (N)`.
- **Rivi = `.marker-item`** + `buildMarkerVisual` (T198, `size:28`): `[checkbox?][ikoni][nimi flex:1][km][status-badge][···]`, `min-height:44px` (§R/§A). Klikkauspinta on oikea `<button>` (`.marker-overview-row`) — natiivi nappi tuo fokuksen, Enter/Space & näkyvyyden kosketusvahdille (V268). `···` avaa MarkerDetailModalin; V62: ⊥ inline-poistoa rivillä.
- **`Suodattimen ulkopuolella (N)`** = VIIMEINEN ryhmä, oletuksena **kiinni** (▶), `opacity:.55` mutta luettava. Kartan suodatin (V271) rajaa listaa mutta merkit ⊥ katoa hiljaa — lista jonka luku ⊥ täsmää karttaan luetaan rikkinäisenä datana (B131-luokka). Erillistä banneria ⊥ tarvita: MapFilterBarin oma banneri (V272) on jo näkyvissä.
- **Sticky-toimintopalkki** (T311/V223): `.marker-overview-actionbar` = scroll-sisällön VIIMEINEN lapsi + `position:sticky;bottom:0` (⊥ `fixed`, B101), `surface-app` + `border-top`, `padding-bottom: calc(10px + env(safe-area-inset-bottom))`. Sisältö: `.marker-overview-note` (11px text-muted, V291-informaatio) + `[Luo tehtävä valituista (N)]` `.btn--confirm` `width:100%` `min-height:52px`. **Disabloitu tila ! näkyä** (`field-tint`+`text-muted`+`cursor:not-allowed`) — jaetut `.btn--*` ⊥ määrittele `:disabled`ia ∴ ilman omaa sääntöä nappi näyttäisi painettavalta & klikkaus ⊥ tekisi mitään (V250 kuollut pinta).
- **Lisäys olemassa olevaan tehtävään (T415/V305):** toimintopalkissa on KAKSI polkua valituille, ⊥ yksi: `[Lisää valitut tehtävään (N)]` (`.marker-overview-add-existing`, kohdevalitsimen kanssa samalla rivillä `.marker-overview-target-row`) & `[Luo tehtävä valituista (N)]`. Kohdevalitsin on **natiivi `<select>`** (`.marker-overview-target-select`), ⊥ oma leijuva valikko: (a) natiivi valitsin on yksi napautus myös hanskoilla & mobiili antaa oman ison listansa, (b) ≤700px paneeli on bottom sheet (`z-index:1200`) ∴ oma popup joutuisi kilpailemaan sheetin reunan kanssa & voisi jäädä sen alle, (c) bulk-statusin rivi käyttää jo samaa `select + nappi` -kuviota ∴ ⊥ kahta valitsinkieltä samassa palkissa. Rivin teksti `[nimi] · [N merkkiä] · [km-väli \| "reititön"]` — reitillinen & reititön ovat SAMASSA listassa (V305: sama operaatio), km-väli erottaa ne. Valittu kohde SÄILYY valinnan muutoksen yli (nollautuminen kesken työn = kuollut pinta, V250). Kohde puuttuu (aktiivisessa vaiheessa ⊥ pätkiä) → nappi JA valitsin disabloitu näkyvästi; "Luo tehtävä valituista" on silloin oikea polku.
- **Valinta (T403):** checkbox `22×22px` `accent-color:var(--accent)`. `Suodattimen ulkopuolella` -rivit ovat valinnan ULKOPUOLELLA (V298) — bulk ⊥ saa koskea riviin jota käyttäjä ⊥ näe kartalla; suodattimen muutos pudottaa kadonneet id:t valinnasta & laskuri päivittyy.
- **Tyhjätilat:** ⊥ merkkejä → `"Ei merkkejä"`; kaikki asetettu → `"Kaikki merkit asetettu ✓"` (`--confirm`, `.marker-overview-done`) & lista jää selattavaksi — onnistuminen ⊥ ole tyhjä lista.
- **≤700px = bottom sheet** (sama kuvio kuin `.map-filter-groups`, B160/V274): `position:fixed;bottom:0;width:100%;max-height:70dvh;z-index:1200` (yli MapFilterBarin 1100 & hero-kortin 1000), varjo ylös. Kartta jää YLÄPUOLELLE näkyviin — ⊥ full-screen, panorointi on toiminnon toinen puoli. Scroll-alue `overscroll-behavior:contain` (§R-sääntö).
- **⊥ uusia värejä** ∴ §C ennallaan: `--surface-app`, `--border-subtle/default/card`, `--text-body/muted/meta`, `--confirm`, `--field-tint`, `--hover`.

### ~~Marker-modaali (`#marker-modal`)~~ — KORVATTU T404:ssä
**Poistettu 2026-07-30.** Korvaaja: §K MarkerOverviewPanel (telakka). Historia jää tänne V86-kuviolla, ⊥ poisteta — alla oleva kuvaus EI ole enää voimassa.
- Tausta: `bg-card`, border: `border-default`, `border-radius: 14px`
- Shadow: `0 16px 48px rgba(0,0,0,0.5)`
- Backdrop: `overlay` + `backdrop-filter: blur(2px)`
- Leveys järjestäjä: `min(560px, 92vw)`, `max-height: 82vh`
- Leveys talkoolainen: `min(340px, 92vw)`, `max-height: 60vh` (tai T74 bottom sheet)

### ~~BulkStatusToolbar (`.bulk-status-toolbar`)~~ — KORVATTU T404:ssä
**Poistettu 2026-07-30.** Järjestäjän bulk-status elää nyt merkkijonon sticky-toimintopalkissa (`.marker-overview-status-row`, §K MarkerOverviewPanel) — kyky säilyi, kuori vaihtui.
- Sijainti: `#marker-modal-header`:n jälkeen, ennen listaa — `position: sticky; top: 0`
- Tausta: `surface-raised`, `border-bottom: border-subtle`, padding `8px 14px`
- Kolme elementtiä flex-row: `[☐ Valitse kaikki]` + `[status-dropdown]` + `[Aseta-nappi]`
- "Valitse kaikki" checkbox: `22×22px`, `accent-color: var(--accent)`, label `12px text-muted`
- Status-dropdown: `<select>`, `min-height: 44px`, `flex: 1`, kaikki 5 statusta
- "Aseta valituille (N)" -nappi: `min-height: 44px`, `min-width: 120px`
  - N > 0: `background: confirm`, `color: confirm-text`
  - N = 0: `background: field-tint`, `color: text-muted`, `cursor: not-allowed`
- Vain järjestäjälle: piilossa `[data-role="talkoolainen"]`

### BulkActionBar talkoolainen (`.bulk-action-bar`, T17) — ✓ TOTEUTUKSESSA (T409)
**Huom 2026-07-30:** sopimus oli `marker-list.ts`:ssä joka poistui T404:ssä. Talkoolainen ⊥ ollut päässyt siihen T264:n jälkeen (`#btn-list` piilotettu) ∴ kyky oli poissa jo ennen poistoa (V292). **T409 palautti sen koti-tabin listaan** (`segment-marker-list.ts`) tällä sopimuksella.
- Sijainti: koti-tabin "Kaikki merkit" -listan alaosa (⊥ enää `#marker-modal` — modaali poistui T404:ssä). Ei `sticky`: lista on jaetun koti-scrollerin sisällä (T315/V226) & tarttuva bar veisi 44px pystytilaa jokaisesta scrollasennosta
- Checkbox `.marker-item-checkbox` per **ei-terminaali** rivi (`isTerminal` → `kerätty` ⊥ saa ruutua). Ruudun kaava: ks. §Listarivit (T412: sääntö on jaettu järjestäjän paneelin kanssa, ⊥ duplikaattia). Checkboxiton rivi tasataan `--nocheck`-paddingilla
- Tausta: `surface-card`, `border-top: border-subtle`, padding `10px 14px`
- Layout: `flex-wrap: wrap` — kaksirivinen 340px modaalissa:
  - Rivi 1: `[☐ Valitse kaikki]` (`label { width: 100% }` pakottaa omalle riville)
  - Rivi 2: `[✓ Aseta valituille]` + `[Ei tarpeen]` (molemmat `flex:1`)
- Napit `min-height: 44px`, disabled-tila `field-tint` kun 0 valittuna. Nappiteksti kantaa laskurin: `✓ Aseta valituille (N)` / `Ei tarpeen (N)`
- Bar renderöityy vain jos valittavia rivejä on ≥1 — pysyvästi disabloitu pinta ⊥ vie 44px puhelimessa
- Vain talkoolaiselle: piilossa järjestäjällä (järjestäjän vastine on `.marker-overview-actionbar` + BulkStatusToolbar)

### Listarivit (`.marker-item`)
- Layout: kompakti yksirivinen flex-row — `[checkbox?][icon][type-label][💬?][km][status-badge][delete?]`
- **Checkbox `.marker-item-checkbox` (T412/V303, jaettu järjestäjän paneelin & talkoolaisen pätkälistan kesken):** `appearance:none` + 44×44 klikkialue + `::before` 22px ruutu (`2px border-default`, `radius-sm`, `field-tint`), valittuna `confirm`-täyttö + ✓. **⊥ padding-box-kaavaa** — selain ohittaa natiivin checkboxin `padding`in & `width`in (B171: mitattu 13×13). Luvattu mitta on testattu: `e2e/t412-checkbox-touch-target.spec.ts`
- Padding: `10px 14px`, **min-height: 44px** (§R touch-target pakollinen)
- Separator: `border-card`, hover: `hover`, uusi kohta: `warn-highlight`
- `marker-type-label`: `flex:1`, `12px text-muted`, truncated (ellipsis)
- `marker-km`: `11px text-meta`, `flex-shrink:0`
- `marker-icon`: `18px`, `flex-shrink:0`
- `marker-note-dot`: `16px`, `color:text-muted`, `flex-shrink:0` — näkyy vain jos `locationNote` on asetettu ja ei-tyhjä. Sisältö: Lucide `MessageSquare` SVG (16×16, `currentColor`). Ei tooltip-tekstiä — modaali näyttää sisällön.
- Rivin klikkaus → avaa `MarkerDetailModal` (T105) — ei toimintopainikkeita listarivillä (poisto-nappi järjestäjälle ok, siirtyy T105:een kun rakennettu)

### Sign-type-napit (`.sign-type-btn`)
- `min-height: 44px` ✓ (touch-target OK)
- Väriswatch: `22×22px`, `border-radius: 6px`
- Hover: `rgba(255,255,255,0.08)`

### SignIcon — karttamerkit (`src/map/icons.ts`)
**V136/T208: kaikki merkit yhtenäisiä neliökortteja ("kyltti kepissä") — EI teardrop/pyöreä pisara.**
- Koko: `40×48px` (kortti `40×40px` + kärki `8px`). Ankkuri kärjen kärjessä `(20, 48)`.
- Kortti: pyöristetty neliö (`border-radius:8px`, `box-shadow`), täyttö = **tyyppiväri**, valkoinen glyfi/ikoni keskitettynä (`cardSvg`). Sama koko + rounding kuva- ja combomerkin kanssa.
- Kärki-kolmio `16×8px` kortin alla, path `M0,0 L8,8 L16,0 Z`, `left:12px` — osoittaa tarkan sijainnin. Kärjen väri **aina tyyppiväri**, riippumatta statuksesta.
- Kortin **täyttö on aina tyyppiväri/-kuva** (V87) — tyyppi-identiteetti (nuoli/ikoni/väri) ei muutu statuksen mukaan, myös kerätty/ei_tarpeen näyttävät saman sisällön.
- Suuntamerkki: selkeä nuoli-glyfi (`→ ← ↱ ↰`) valkoisena kortissa — ei bearing-rotaatiota (T129 poisti bearingin).
- Upcoming-tyyppi (`upcoming-left`/`upcoming-right`): kortti pysyy tyyppivärillä + valkoinen katkoviivareuna, ei osallistu statusväritykseen (esikatselu-tyyppi).

**Status-visualisointi (T23/V51/T140/T208, `createSignIcon(type, status, color?, compact?, iconId?, imageSrc?, visualParts?)`):**
- `suunniteltu` → kortti tyyppivärillä + **valkoinen katkoviivareuna** (`border:3px dashed white`) — "katkoviiva = ei tehty" (V51).
- `asetettu`/`tarkistettu`/`kerätty`/`ei_tarpeen` → täyttö pysyy tyyppivärinä, **statusväri näkyy kortin reunassa** (`border:4px solid`, V87/B59 — käyttäjä halusi tyyppikuvan pysyvän tunnistettavana joka statuksessa). Värit §C `--status-*` -taulukosta, synkassa `STATUS_RING` (icons.ts): asetettu `#2FA35B`, tarkistettu `#3B82C4`, kerätty `#8A5CD1`, ei_tarpeen `#C9922E` — eri sävyperheistä (B58).
- Sisältö: **kuva > ikoni > compactLabel** -precedence (V99/T158, `signVisual`). Kaikki kolme tieriä renderöityvät samana korttina: ikoni/label = tyyppiväri-kortti + valkoinen glyfi; **kuvatyyppi = valkoinen kortti** (`object-fit:contain`, koko kyltti croppaamatta, kuvasuhteet 2.2:1…0.7:1). Kaikilla sama `40×40px` + `border-radius:8px` + kärki. Status = kortin reuna. Kuvatyypin fallback-chip (tyyppiväri + compactLabel) img:n alla, `onerror="this.remove()"` paljastaa sen.
- Kuva-fallback: `<img onerror="this.remove()">` (T103-pattern) — puuttuva/rikki kuvatiedosto poistaa kuvakerroksen → alla oleva ikoni/label paljastuu, ei rikkoudu. Assetit: `src/assets/signs/<id>.webp` (T161 konversio-pipeline, ~79 kpl).
- **Ei erillistä nurkkabadgea** (poistettu T138:ssa, oli B57: "kaksi kertaa sama teksti").

### ComboSignIcon — yhdistelmämerkki (T172/V107, `src/map/icons.ts` `comboMarkerSvg`)
- **Konsepti:** oikea liikennemerkkikeppi — useampi kyltti päällekkäin samassa kepissä. `SignTemplate.parts[0]` on ylin, seuraavat alle järjestyksessä. Max 4 osaa.
- **Koko:** jokainen osa `40×40px` slotti (sama leveys kuin kuva-kortti), pinottu pystysuunnassa. `1px border-default`-jakoviiva slottien välissä. Koko pinon leveys pysyy `40px` (ei levene), korkeus = `osien määrä × 40px`.
- **Sisältö per osa (V107):** kuva>ikoni-precedence (`signVisualParts`), EI label-fallbackia — combo-osa on aina tarkoituksella valittu kuva/ikoni. Ikoni-osa: tyyppiväri-tausta + valkoinen Lucide-SVG keskitettynä. Kuva-osa: valkotausta + `object-fit:contain`.
- **Osan lisäys-UI (T178, `sign-library-panel.ts`):** "+ Lisää osa" avaa picker-paneelin jossa `[Ikoni]/[Kuva]`-tabit (`.sign-part-visual-tab` — eri luokka kuin päävisualin `.sign-visual-tab`, ettei kahta erillistä tab-paria voi sekoittaa DOM-kyselyissä). Kuva-tabissa `44×44px`-thumbnail-grid kaikista `signImageIds()`-kuvista. Yksi osa on aina joko-tai (ei molempia kerralla), samoin kuin päävisualilla. Kaikki kolme yhdistelmää mahdollisia: kuva+kuva, kuva+ikoni, ikoni+kuva.
- **Yksi ankkuripiste koko pinolle:** kärki-kolmio (`16×8px`) vain pinon alimman osan alla — koko pino on yksi kartta-objekti, ei per-osa tippiä. `iconAnchor = [20, osien_määrä×40+8]`.
- **Status:** yhteinen koko pinon ulkoreunana (V87-pattern, ei per-osa) — `suunniteltu` katkoviiva neutraali, muuten solid statusväri koko pinon ympärillä.
- Käyttäjä: järjestäjä (rakentaa kirjastossa), talkoolainen (näkee kartalla).

### SignPreview — iso merkki-esikatselu modaaleissa (`.sign-preview`, `src/ui/modal-helpers.ts` `signPreviewHtml`)
- **Missä:** MarkerDetailModal bodyn yläosassa (molemmat roolit näkevät mikä kyltti) + SignLibraryPanel edit-modaalissa headerin alla (järjestäjä katsoo/muokkaa templatea).
- **Koko:** `width:100%; height:150px`, `border:1px solid border-default`, `border-radius:radius-sm`, `overflow:hidden`.
- **Sisältö (V99-precedence):** kuva → `object-fit:contain` valkotaustalla `padding:10px` (koko kyltti näkyy, ei crop); ikoni → Lucide `72×72` valkoisella tyyppiväri-taustalla; label → `compactLabel` `900 40px` valkoisella tyyppiväri-taustalla.
- **Fallback (V99/T103):** kuvakerros img:n alla on aina ikoni/label tyyppiväri-taustalla; `onerror="this.remove()"` paljastaa sen jos kuva puuttuu/rikki.
- Käyttäjä: molemmat.

### LeftPanel (`#left-panel`)
- Vain järjestäjälle — `body[data-role="talkoolainen"] #left-panel { display: none }`
- Sijainti: `#app-main`:n flex-row vasempi lapsi, ennen `#map-area`
- Leveys auki: 240px sisältö + 44px toggle = 284px total; kiinni: 44px toggle strip
- Tausta: `bg-app` (surface-app), oikea reuna: `border-subtle`

**Panel header (`#left-panel-header`):**
- Aina näkyvissä (ei piilotu kun kiinni)
- Title: `"Työkalut"` — `11px uppercase text-muted letter-spacing:0.06em`
- Toggle-nappi (`#left-panel-toggle`): `44×44px`, `bg-raised`, `color: text-muted`
  - Auki: `◀`, `aria-label: "Sulje paneeli"`; kiinni: `▶`, `aria-label: "Avaa paneeli"`
  - Hover: `hover-strong` bg, `text-body` väri

**Sisältö (`#left-panel-content`):** `flex column`, `overflow-y: auto`, piilotetaan `hidden`-attribuutilla kun kiinni

**Section pattern (V61) — kaikki osiot noudattavat.** Header EI kirjoiteta käsin: `createSectionHeader`
(`src/ui/section-header.ts`, T371/V267) on ainoa toteutus. Käsin kirjoitettu kopio ajautuu inline-tyyleihin
(niin kävi AreaPanelille) ja jää ilman näppäimistökuuntelijaa vaikka `role="button"` lupaa sen.

| Osa | Elementti | Tyyli |
|-----|-----------|-------|
| Header | `button.left-panel-section-header` | `min-height:44px` (§A, T373); `cursor:pointer; display:flex; align-items:center; width:100%; padding:8px 10px; background:none; border:0; border-bottom:1px solid border-subtle; text-align:left; font:inherit` — oikea `<button>`, ei `div[role=button]` |
| Toggle-ikoni | `▼/▶` | `11px text-muted flex-shrink:0 mr:6px` — ▼ auki, ▶ kiinni |
| Nimi | `span` | `11px uppercase text-muted letter-spacing:0.06em flex:1` |
| Count | `span.section-header-count` | `11px text-meta, font-weight:400, letter-spacing:normal` — sulkuihin esim. `(3)`. Luku ei peri otsikon uppercase/boldia: se on mittari ⊥ otsikko |
| Item-rivit | `.left-panel-item` | `display:flex; align-items:center; min-height:44px; border-bottom:1px solid border-card` |
| Item — label | `button tai span` | `flex:1; min-height:44px; text-align:left` — klikkaus = toiminto |
| Item — actions | `[···]` | `min-width:44px; min-height:44px; color:text-muted` — avaa modal |
| Section footer | `button` | `width:100%; min-height:44px; background:field-tint; border:1px solid border-default; color:text-muted; 12px` |

**Sääntö (V62):** Item-rivillä ei koskaan inline delete. Poisto aina modaalin `modal-btn-destructive`-rivillä.

**SignLibraryPanel section:**
- Section-header: `[▼/▶ Merkkikirjasto]`
- Ryhmittely (V126): väliotsikko `Suosikit` (favorite:true) ensin, sitten väliotsikko `Muut` — molemmat ryhmät label-aakkosjärjestyksessä (`localeCompare 'fi'`). Ei accordionia; tyhjää ryhmää ei renderöidä. Väliotsikko: 11px uppercase, `--text-muted`, `.sign-lib-subhead`.
- Item: `[swatch 22×22px] [label + kuvaus flex:1] [···]` — klikkaus asettaa merkin, ··· avaa edit-modaalin. Koko `description` näkyy labelin alla (11px `--text-muted`, wrap); tyhjä kuvaus → ei riviä.
- Haku suodattaa rivit; väliotsikko piiloutuu kun ryhmässä ei näkyviä rivejä.
- Edit-modaali: sisältää suosikki-toggle (`<input type=checkbox>`) + footer-destructive "Poista malli" (vain custom-malleille)
- Section-footer: `[+ Uusi merkki]`

**SegmentPanel section:**
- Section-header: `[▼/▶ Pätkäjako (N)]` — ei create-nappia headerissa
- Item: `[nimi flex:1 truncated] [km text-muted] [···]` — ··· avaa SegmentDetailsModal
- Section-footer: `[+ Luo uusi pätkä]`

**SegmentRowMenu (`.segment-row-menu`, T345/V250):**
- Avaaja: rivin `···` (`aria-haspopup="menu"`, `aria-expanded`)
- Rivit järjestyksessä: `🔍 Näytä kartalla` · `◎ Korosta vain tämä pätkä` ↔ `◉ Korostus päällä` (`aria-pressed`, sama tila kuin SegmentDetailsModalin kytkin — T335) · `🔗 Kopioi talkoolaislinkki` (VAIN jos pätkä on jaettu) · `⚙ Lisätiedot & varusteet…`
- **Ei disabloituja rivejä:** rivi joko toimii tai puuttuu. Harmaa "Kopioi linkki" jakamattomalla pätkällä olisi arvoitus, ei ohje
- Ulkoasu: `surface-card`, `border-default`, `radius-md`, `box-shadow 0 12px 32px rgba(0,0,0,.28)`; rivit `min-height:44px` (§A), hover `--hover`, päällä oleva rivi `--accent` + bold — tila ei ole pelkkä teksti (V197)
- Backdrop `.segment-row-menu-backdrop`: **läpinäkyvä** (`background:transparent`, `z-index:3200`) — nappaa ulkoklikin muttei tummenna karttaa; valikko on välitila, ei modaali
- Sulkeminen: valinta / Esc / ulkoklikki — `createBackdrop` + `registerEscClose` (`modal-helpers.ts`), ei omaa document-kuuntelijaa
- Ankkurointi: napin alle (`top: rect.bottom+4`), oikea reuna clampattu `max(8px, rect.right - menuWidth)`

**AreaPanel section (T109):**
- Section-header: `[▼/▶ Alueet (N)]` — ei create-nappia headerissa
- Item-rivi: `[▶/▼ expand] [nimi button flex:1] [(N) tai ✓] [···]`
  - `▶/▼ expand` (32×44px): laajentaa/sulkee feature sub-listin klikkaamalla
  - `nimi button`: klikkaus = sama expand/collapse (ei modaalia)
  - status/count badge: "✓" (#4ade80) jos valmis, "(N)" (text-meta) muuten — N = komponenttien määrä
  - `···` (44×44px): avaa AreaDetailsModal
- **Feature sub-list** (`.area-feature-sublist`): piilotettu `hidden` kun suljettu, `surface-raised` tausta, sisennetty `28px` vasemmalta
  - Feature-rivi: `[14×14px väri-swatch] [nimi text-muted 12px flex:1] [✎ 44×44px text-muted]`, `min-height:40px`
    - `✎`-nappi (`.btn-feat-inline-edit`) avaa inline-edittilan
    - dblclick feature-nimelle = sama kuin `✎`-nappi
    - **Inline-edit tila:** rivi saa `background: var(--hover); border-left: 2px solid var(--accent)`. Elementit: `[swatch] [name-input autofocus field-tint flex:1] [color-select]`. Enter/blur tallentaa. Escape palauttaa.
  - Tyhjätila: `"Ei komponentteja"` `11px text-meta`
  - Footer-nappi: `[+ Lisää komponentti]` `min-height:44px`, `border-top:dashed border-card`, `text-muted 12px`, käynnistää draw-by-drag suoraan — ei avaa modaalia
- Section-footer: `[+ Lisää alue]`
- **AreaDetailsModal** (···): nimi-input + koko+kierto + kuvaus-textarea (Markdown) + feature-lista VAIN editointia varten (nimi, väri, poisto) — ei "Lisää komponentti" -nappia modalissa
  - AreaFeature-item: `[väri-swatch 16×16] [nimi-input flex:1] [väri-select] [✕ poista]`
  - Poisto (feature): btn-feat-delete suoraan feature-rivillä (pienikokoinen, danger-soft)
  - "Merkitse valmiiksi": window.confirm() ennen tilansiirtoa suunniteltu→valmis
- **Alue kartta-polygon**: `fillOpacity: 0` (outline-only, sininen reuna) — featuret näkyvät paremmin omilla väreillään
- **AreaFeature karttanimet (zoom-riippuvainen):**
  - `L.Tooltip` `permanent:true, direction:'center', className:'area-feature-label'` — centroidi, polygonin sisällä
  - Zoom `≥16` → näkyy (`opacity:1`). Zoom `<16` → piilotettu (`opacity:0`)
  - `map.on('zoomend', updateFeatureLabels)` — iteroi feature-layerit, aseta opacity
  - CSS `.area-feature-label`: `font-size:11px; font-weight:600; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.9); background:transparent; border:none; padding:0; white-space:nowrap; pointer-events:none`
  - Ei CSS custom propertya — Leaflet-DOM ei peri `:root`-tokeneja reliably
- Sijainti: `#area-panel-container` left-panel-content:ssä, segment-panelin jälkeen

### SegmentPanel (`#segment-panel`)
- Vain järjestäjälle (`hidden` muille)
- Sijainti: `#app`:n sisällä `#snapshot-panel-container`:n jälkeen, ennen karttaa
- Tausta: `bg-primary`, bottom-border: `border-subtle`
- Header: `11px uppercase text-muted`, "Luo uusi pätkä" -nappi `min-height: 44px` (§R pakollinen)
- Luomistila: `12px text-muted`, "Klikkaa reittiä: 1. / 2. piste" — kaksi klikkausta reitillä → luo pätkän
- Lista: `max-height: 220px`, scrollable, `border-card`-separaattorit
- Segmenttirivi: `padding: 6px 10px`, nimi `text-primary 12px`, `.segment-km` `text-muted 11px` — **T143/V90 (korvaa T142:n täyden breakdownin, liian pitkä ahtaaseen riviin):** näyttää **yhden phase-tietoisen luvun**, ei kaikkia neljää statusta. `phase: 'asettaminen'` → `"<asetettu+tarkistettu+kerätty>/<yhteensä> asetettu"` (esim. `"3/10 asetettu"`). `phase: 'purku'` → `"<kerätty>/<yhteensä> kerätty"` (esim. `"0/10 kerätty"`). Tyhjä pätkä (0 merkkiä): `"ei merkkejä"`. Täysi breakdown (`formatStatusCounts`, kaikki 4 statusta) siirtyy `title`-attribuuttiin km-alueen kanssa samaan hover-tooltippiin, esim. `title="0.0–2.2 km · 2 suunniteltu · 1 asetettu"`. Uusi pure-funktio `getPhaseProgress(segment, markers): {done: number, total: number, label: string}` `src/logic/segments.ts`:ään — ei branch-logiikkaa UI-tasolle.
- **`phase: 'tarkastus'`** (spekattu T144-T147/V91/V92, ei vielä rakennettu): rivi näyttää "Tarkastettu ✓" / "Ei vielä tarkastettu" — segmentin oma boolean (`inspected`), ei `X/N`-lukumäärä, koska tarkastuksella ei ole per-merkki-statusta.
- Poista-nappi: `rgba(239,68,68,0.10)` tausta, `#f87171` teksti — vaarallinen toiminto
- "Lisätiedot & varusteet" -nappi: `min-height: 44px`, avaa `SegmentDetailsModal` (alla)

### SegmentCreationModal (`.segment-creation-modal`, T94)
- Avautuu "Luo uusi pätkä" -napista — vain järjestäjälle
- DOM: `document.body`-lapsi, `position:fixed; inset:0; z-index:3000`
- Backdrop: `background: overlay; backdrop-filter: blur(2px)` — klikki sulkee (cancelCreation)
- Modaalikehys: `bg-card`, `border: 1px solid border-default`, `border-radius: 14px`, `box-shadow: 0 16px 48px rgba(0,0,0,0.5)`
- Leveys: `min(480px, 92vw)`, `max-height: 80vh`
- Otsikko-rivi: "Luo uusi pätkä" `text-primary 14px bold`, ✕-nappi `aria-label:"Peruuta"` `min-height:44px min-width:44px`
- Sulkeminen: ✕-nappi / Escape / backdrop-klikki → `cancelCreation()` → palaa idle
- Tilakone:
  - **vaihe1:** progress (●○○), "Klikkaa kartalta pätkän aloituspiste" — kartta crosshair-cursor, snap-markerit näkyvissä
  - **polku (T362, korvaa vaihe2:n):** progress (●●○), "Klikkaa reittiä pitkin eteenpäin — lopeta \"Valmis\"-napilla".
    - `.segment-creation-route` — **valittu reitti NÄKYVISSÄ** (`text-primary`, bold). Ei koristetta: 3 SMTB-reittiä kulkee ≤100 m toisistaan ja luonti valitsi reitin aiemmin hiljaa (B144(a)) — näkyvä reitti on se mikä tekee väärästä valinnasta havaittavan.
    - `.segment-creation-anchors` (`<ol>`, `max-height:132px; overflow-y:auto`, 12px `text-muted`) + `.segment-creation-anchor` -rivit: "Alku: 0.0 km" · "Välipiste 1: 5.0 km" · "Loppu: 10.0 km". Viimeinen rivi `text-primary` bold — se on se jota "Poista viimeinen" koskee, & lista **skrollataan loppuun joka renderissä** (lista rakentuu uudelleen klikeistä ∴ 6. ankkurista eteenpäin juuri klikattu jäisi muuten fold-rajan alle).
    - `.segment-creation-path-actions`: "Poista viimeinen" (`.btn--secondary`) + "Valmis" (`.btn--confirm`), molemmat `flex:1` `min-height:44px`. **Disabloitu tila on PAKKO merkitä näkyviin** (`field-tint` + `text-muted` + `cursor:not-allowed`, sama sopimus kuin `.btn-bulk-apply:disabled`) — jaetut `.btn--confirm`/`.btn--secondary` ⊥ määrittele `:disabled`-tilaa ∴ ilman omaa sääntöä nappi näyttäisi painettavalta & klikkaus ⊥ tekisi mitään (V250: kuollut pinta). **Molemmat disabloituvat <2 ankkurilla** — napit näkyvät heti mutta kertovat mitä puuttuu, ⊥ ilmesty yllättäen kesken klikkailun. Ensimmäistä ankkuria ⊥ voi poistaa: ilman sitä reitti ⊥ ole lukittu ∴ Peruuta (✕) on se ulospääsy — yksi tapa, ⊥ kaksi.
    - Backdrop `[data-phase="polku"]`: läpinäkyvä & `pointer-events:none` (kuten vaihe1) — kartta on klikattava modaalin ali.
  - **tiedot:** progress (●●●), nimi-input + kuvaus-textarea + footer
- Footer-napit: Tallenna (`confirm`-tausta, `min-height:44px`), Peruuta (`field-tint`, `min-height:44px`)
- Tallenna luo segmentin ja sulkee modaalin — ei auto-save (käyttäjä vahvistaa)
- **Reititön-haara (T216, `mode:'reititon'`):** avautuu "+ Luo aluetehtävä (reititön)" -napista (segment-panel footer, `.btn-segment-footer` `min-height:44px`) — maali/keräysalue ilman reittipätkää. EI progress-askelia, EI kartta-klikkiä. Otsikko "Luo aluetehtävä". Lomake: nimi-input + kuvaus-textarea + valinnaiset merkkiliitokset:
  - `.segment-creation-typefilter` (`<select>`, `min-height:44px`, input-tokenointi) — dynaaminen tyyppisuodatin (uniikit templateId:t olemassa olevista merkeistä). Näkyy vain jos merkkejä on.
  - `.segment-creation-marker-checklist` (`max-height:180px; overflow-y:auto`, `border-default`) + `.segment-creation-marker-check` -rivit (`min-height:44px`, checkbox `18×18px` + label) — eksplisiittinen merkkiliitos. Näkyy vain jos merkkejä on.
  - Tallenna → reititön segmentti (ei route-kenttiä) + linkedMarkerIds/markerTypeFilter.

### SegmentDetailsModal (`.segment-details-modal`)
- Avautuu "Lisätiedot & varusteet" -napista pätkärivillä — vain järjestäjälle
- DOM: `document.body`-lapsi, `position:fixed; inset:0; z-index:3000`
- Backdrop: `background: overlay; backdrop-filter: blur(2px)` — klikki sulkee
- Modaalikehys: `bg-card`, `border: 1px solid border-default`, `border-radius: 14px`, `box-shadow: 0 16px 48px rgba(0,0,0,0.5)`
- Leveys: `min(480px, 92vw)`, `max-height: 80vh`, scrollable sisältö
- **Otsikko-rivi (T356): kolme elementtiä** — `[otsikko flex:1; min-width:0; ellipsis][korostuskytkin flex:0 0 auto][✕ 44×44]`.
  Otsikko `text-primary 14px bold` typistyy ENSIN; kytkin ja ✕ eivät kutistu (44px = kosketuskoko, ei neuvoteltava).
  Korostuskytkin `.btn.btn--ghost.btn-segment-focus-toggle`: `min-height:44px`, `padding:0 10px`, `12px`, `white-space:nowrap`,
  teksti `◎ Korosta` ↔ `◉ Korostettu` (**ei pelkkä ikoni** — V197: näkyvä teksti on saavutettava nimi), pitkä muoto `title`-attribuutissa,
  `aria-pressed` + `[aria-pressed="true"]` = accent-kehys. Kytkin on karttaan heti vaikuttava TILAKYTKIN ∴ se ei kuulu välilehden taakse.
- Sulkeminen: ✕-nappi / Escape / backdrop-klikki — auto-save on change, ei hylkäysdialogi
- **Välilehdet (T354/V257):** runko on `SegmentKotiTabs` — SAMA komponentti kuin talkoolaisen kotinäkymässä, ei toista toteutusta.
  Kolme tabia (T357-järjestys): `Asetukset` (oletus) · `🎒 Varustelista` · `Kaikki merkit` — järjestäjä avaa modaalin
  hallitakseen pätkää, ei selatakseen varusteita; oletus tulee tab-arraysta (`tabs[0]`), ei erillisestä `initial`ista.
  Tabipalkki `position:sticky; top:0` bodyn sisällä,
  `surface-card`-tausta (läpinäkymätön — alta liukuva sisältö ei sotke). Panelin sisäinen rytmi `flex-column; gap:14px`.
  Modaali antaa komponentille `scrollerSelector: '.segment-details-modal-body'` → tab-vaihto nollaa scrollTopin (T315/V226).
  Merkitön pätkä: `Kaikki merkit` näyttää tyhjätilan (`.segment-details-markers-empty`) — **tabi ei katoa** datan mukana.
  Järjestäjän valmis-toggle (`.btn-segment-complete-toggle`, T352/V255) asuu `Kaikki merkit` -tabissa merkkilistan alla — sama paikka kuin talkoolaisen kotinäkymässä ∴ roolit löytävät saman toiminnon samasta kohdasta.
- **Footer (T355):** jaettu `.modal-footer`-pattern. `.modal-btn-secondary` `Sulje` + `.modal-footer-destructive` > `.modal-btn-destructive` `Poista pätkä`.
  **Ei primarya:** kentät tallentuvat muutoksesta ∴ `Tallenna` (tai confirm-täytteinen nappi joka vain sulkee) lupaisi työn jonka kenttä on jo tehnyt (V250).
- Kentät:
  - `displayName`: `<input>`, auto-save blur/Enter, `min-height: 44px`
  - kuvaus: `<textarea>`, 3 riviä, auto-save change, `min-height: 44px`
  - **Merkit & varusteet (T199, yhtenäinen lista — korvaa entiset kolme erillistä osiota):**
    - Per-merkki-rivit (`.segment-details-marker-list`, `max-height:200px` scrollable): `[MarkerVisualRow 34px, zoomable=true][nimi flex:1 truncated][km tabular-nums text-meta][status-pilli]`. Nimi = `m.label ?? tyyppilabel`. Status-pilli väritetty §C-taulukon mukaan (`.status-suunniteltu/asetettu/tarkistettu/kerätty/ei_tarpeen`, pill-muotoinen `border-radius:999px`).
    - Yhteenveto-chip-rivit (`.segment-equipment-chip-list`, samassa sektiossa heti perässä): merkit groupoitu `m.type`:n mukaan, `[iso tabular-nums luku "N×"][MarkerVisualRow 28px, zoomable=false][nimi]`. Korvaa entisen `"6× left"`-tekstirivin. Ei zoom-nappia (yhteenveto ei ole tarkka esikatselu, per-merkki-rivi hoitaa sen). **T394/V285:** iso luku on `take` (vielä asettamatta) ⊥ kokonaismäärä, chipin perässä `.equipment-count-meta` (`11px text-muted tabular-nums`) `"N/M asetettu"` vain kun `done>0`; `take===0` → `.segment-equipment-chip--done` (himmennys+yliviivaus, meta jää lukukelpoiseksi). Chip-rivin yläpuolella `.equipment-summary` (`12px text-muted`) = `formatEquipmentSummary`. Luvut tulevat `getEquipmentCounts`ista ∴ järjestäjä & talkoolainen näkevät saman luvun samasta pätkästä.
    - **T354: merkkiosiot ja lisävarusteet ovat ERI välilehdillä** — per-merkki-rivit + yhteenveto-chipit `Kaikki merkit` -tabissa, manuaaliset lisävarusteet `🎒 Varustelista` -tabissa. Rivien sisäinen DOM ja luokat säilyivät T199:stä ennallaan.
    - Manuaaliset lisävarusteet: add/remove/edit-rivi ennallaan (ei muutettu T199:ssä), `min-height: 44px` kaikille inputeille ja napeille.
    - Merkkipohjainen sisältö korvautuu tyhjätilalla jos pätkällä ei merkkejä (`segMarkers.length === 0`); lisävarustelista näkyy silti aina omalla tabillaan.
  - `.btn-segment-clone-phase` (T146): "Kloonaa &lt;seuraava&gt;-vaiheeseen", sama tyyli kuin `.btn-segment-edit-pts-modal` (`field-tint` bg, `border-strong`, `min-height:44px`, `width:100%`, `text-align:left`) — ei destructive, ei primary, matala visuaalinen painoarvo koska harvoin käytetty toiminto

### Nappijärjestelmä `.btn` (T206/V135) — yksi totuus

Kaikki napit noudattavat jaettua `.btn`-perustaa + varianttia. **Uudet napit: `.btn .btn--<variantti>`.**
Vanhat kertakäyttöluokat on aliasoitu variantteihin (`src/style.css`, "Yhtenäinen nappijärjestelmä")
samoilla token-arvoilla — sama visuaali, keskitetty sopimus.

- **`.btn`** base: `min-height:44px` (§R touch), `border-radius:radius-sm`, `font-family:inherit`, `font-weight:600`, `font-size:13px`, `inline-flex` center, `gap:6px`, `padding:0 14px`. `:disabled` → `opacity:0.5;cursor:not-allowed`.
- **`.btn--sm`**: `min-height:36px; font-size:12px; padding:0 10px` (tiiviit rivinapit).

| Variantti | Tyyli | Käyttö | Vanhat aliakset |
|-----------|-------|--------|-----------------|
| `.btn--primary` | `accent` bg / `accent-text` | pääkorostus (huomionauha) | (uusi) |
| `.btn--confirm` | `confirm` bg / `confirm-text` | Tallenna/Vahvista/kuittaus | `btn-bulk-apply`, `btn-bulk-checkin-aseta`, `btn-status-primary`, `btn-approve`, `btn-bulk-collect`, `btn-mark-inspected`, `btn-segment-modal-save`, `btn-segment-creation-save`, `modal-btn-primary` |
| `.btn--secondary` | `field-tint` bg / `text-muted` / `border-default` | Peruuta/Sulje/toissijainen | `btn-status-secondary`, `btn-snapshot-create`, `btn-snapshot-download`, `btn-segment-create`, `btn-segment-edit-pts(-modal)`, `btn-segment-clone-phase`, `btn-segment-details-toggle`, `btn-assign-*`, `btn-copy-url`, `btn-equipment-add`, `btn-segment-creation-cancel`, `modal-btn-secondary` |
| `.btn--danger` | `danger-soft` bg / `danger-text` / `border:danger` | Poista/Palauta (blokki) | `btn-snapshot-restore(-file)`, `btn-segment-delete`, `btn-equipment-remove` |
| `.btn--ghost` | läpinäkyvä / `text-muted` | ikoni/tekstilinkki | `modal-btn-destructive` |

**Sääntö:** älä keksi uutta napin väriä/muotoa — valitse variantti. Uusi variantti → lisää tähän + `.btn--*` CSS:ään.

### Modal footer -pattern (KAIKKI modaalit noudattavat)

Kolme roolia, kolme tasoa:

| Taso | Elementti | Tyyli | Koko |
|------|-----------|-------|------|
| Primary | Tallenna / Vahvista | `confirm` bg, `confirm-text`, `flex:1` | `min-height:44px` |
| Secondary | Peruuta / Sulje | `field-tint` bg, `border-default` | `min-height:44px` |
| Destructive | Poista / Palauta | **ei taustaa**, `danger-text` väri, `font-size:12px` | `min-height:32px` |

Rakenne:
```
[modal-footer]                     ← sticky bottom, border-top border-subtle, surface-card bg
  [footer-actions]                 ← flex row, gap 8px
    [Tallenna]  [Peruuta]          ← primary + secondary rinnakkain
  [footer-destructive]             ← erillinen rivi alle, text-center
    [Poista merkki]                ← pieni tekstinappi, ei blokki
```

CSS-luokat:
- `.modal-footer` — `position:sticky;bottom:0;padding:12px 14px;border-top:1px solid border-subtle;background:surface-card;display:flex;flex-direction:column;gap:8px`
- `.modal-footer-actions` — `display:flex;gap:8px`
- `.modal-btn-primary` — `flex:1;min-height:44px;background:confirm;color:confirm-text;border:none;border-radius:radius-sm;font-size:13px;font-weight:600`
- `.modal-btn-secondary` — `min-height:44px;padding:0 16px;background:field-tint;border:1px solid border-default;border-radius:radius-sm;color:text-muted;font-size:13px`
- `.modal-btn-destructive` — `min-height:32px;padding:4px 8px;background:transparent;border:none;color:danger-text;font-size:12px;cursor:pointer;align-self:center` — **ei isoa punaista blokkia**
- `.modal-footer-destructive` — `display:flex;justify-content:center`

**Sääntö:** Poista-nappi ei koskaan `danger-soft`-taustalla isona blokkina. Se on aina pieni teksti footerin omalla rivillään.

**Sääntö (peruttavuus, KAIKKI luonti/muokkaus/poisto):** uuden asian luonti, olemassa olevan muokkaus ja poisto tapahtuvat AINA peruttavassa modaalissa (backdrop-klikki + Esc + `Peruuta`-nappi sulkevat kirjoittamatta mitään). **Ei inline-lomakkeita jotka autosavettavat blurilla** eikä inline-toggle-editoreita joista ei pääse turvallisesti pois — käyttäjän pitää nähdä selvästi (a) että ollaan muokkaustilassa (modaalin otsikko) ja (b) miten perua. Rename/luonti = eksplisiittinen `Luo`/`Tallenna`. Poisto = `.modal-btn-destructive` + `confirm()` (V58/V102/V166). Kuori: `min(480px,92vw)`, `surface-card`, `overflow-y:auto`.

**Auto-save vs explicit save:** Modaaleissa joissa on useita kenttiä (segment details, marker details) — kentät auto-save blurilla TAI explicit footer-Tallenna. **Molemmat hyväksytään**, mutta MarkerDetailModal käyttää explicit Tallennaa koska metsässä sormella kirjoitettu kommentti ei saa kadota vahingossa sulkemalla.

### Sticky-toimintopalkki (jaettu sopimus, T311/V223)
Sivun (ei modaalin) **primary-toiminto** kun sivun sisältö on datan mukana kasvava lista: nappi EI jää listan alapuolelle taittorajan taakse vaan omaan sticky-palkkiin.

- **Rakenne:** palkki on scrollattavan sisällön **VIIMEINEN lapsi flow'ssa** + `position:sticky; bottom:0`. Flow'ssa oleminen on sopimuksen ydin: scrollin pohjassa palkki päätyy luonnolliseen paikkaansa listan JÄLKEEN ∴ se ei koskaan peitä viimeistä listariviä (V157/B101-oppi: kiinnitetty palkki ⊥ jätä orpoa gappia eikä peitä sisältöä). `position:fixed` on kielletty tässä kuviossa — se vaatisi käsin ylläpidettävän `padding-bottom`-vastineen joka mätänee (B101).
- **Tyylit:** `background: var(--surface-app)` (läpinäkymätön — alta liukuva sisältö ei sotke lukemista) + `border-top: 1px solid var(--border-subtle)` + full-bleed (negatiivinen sivumargin kompensoi sivun paddingin) + `z-index: 5`.
- **Alalaidan välistys:** palkki OMISTAA sen. Sivukuoresta poistetaan oma `padding-bottom` kun palkki on läsnä (esim. `.patkat-page--has-actionbar { padding-bottom: 0 }`); palkki lisää `padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px))` → iPhone-kotipalkki ei peitä nappia eikä synny kuollutta gappia.
- **Touch (§R):** nappi ≥44px (primary käytännössä `min-height: 52px`, `width: 100%`).
- **Toteutukset:** `/patkat` `.patkat-actionbar` + `.patkat-to-map` (T311). Sama kuvio uusille normaali-flow-sivuille (inventaario/admin) kun niille tulee sivutason primary.

### MarkerDetailModal (`.marker-detail-modal`, T105)
- Avautuu kahdelta triggeriltä — molemmat roolit:
  - **Merkkilistarivin klikki** (olemassa T104)
  - **Karttamerkin klikki** (uusi — korvaa context menun, kaikki merkit kaikilla rooleilla)
- Karttaklikki-flow: `marker.on('click')` → avaa MarkerDetailModal. Context menu (`showContextMenu`) poistetaan — kierto siirtyy modaaliin.
- DOM: `document.body`-lapsi, `position:fixed; inset:0; z-index:3000`
- Backdrop: `overlay; backdrop-filter:blur(2px)` — klikki sulkee
- Kehys: `bg-card`, `border:1px solid border-default`, `border-radius:14px`, `box-shadow:0 16px 48px rgba(0,0,0,0.5)`
- Leveys: `min(480px,92vw)`, `max-height:80vh`, scrollable sisältö
- Otsikko-rivi: type-label + km `text-primary 14px bold`, ✕-nappi `min-height:44px min-width:44px`
- **Navigointi (T396/V286):** `.marker-detail-nav` = `<a class="btn marker-detail-nav">` bodyn alussa, SignPreview'n alla & `locationNote`-kentän YLLÄ — vastaa "missä tämä on", ei ole statustoiminto ∴ ei footeriin (footerin sisältö on lukittu per rooli, ks. alla). Sisältö `📍 Navigoi tähän`, `width:100%`, `min-height:44px` (§R/V268), `field-tint`-tausta + `border-default`. **⊥ `.btn--ghost`:** sen sääntö on `style.css`:ssä myöhemmin samalla spesifisyydellä ∴ se voittaisi nämä → taustaton himmeä teksti joka ei näytä napilta (B105:n ansa). `target="_blank" rel="noopener noreferrer"` — ankkuri ⊥ `<button>`+`window.open`: selain hoitaa app-handoffin & pitkä painallus antaa "kopioi linkki". `href` = `navUrl(navTarget(marker))` (`src/logic/nav-link.ts`) — kutsupaikka ⊥ rakenna URLia itse (V286). `null` (kelvottomat koordinaatit) → koko rivi jää renderöimättä, ⊥ disabloitua nappia (V250). Näkyy MOLEMMILLE rooleille.
- `locationNote`: `<textarea>` `min-height:80px`, `field-tint`, placeholder `"Lisää kommentti... (esim: kiinnitä puuhun)"` — auto-save blurilla + eksplisiittinen "Tallenna"-nappi footerissa
- Kuvaus-osio (T103): järjestäjälle `.marker-detail-description` textarea (`min-height:56px`, `field-tint`, auto-save blurilla), talkoolaiselle `.marker-detail-description-readonly` teksti (tai "Ei kuvausta")
- Kuvat-osio (T103): `.marker-detail-image-gallery` — thumbnailit `72×72px, object-fit:cover, radius-sm`. Lazy-load (`loading="lazy"`) + `onerror` → `.marker-detail-image-placeholder` (`"[kuva ei saatavilla]"`, ei spinneriä). Järjestäjälle `.marker-detail-add-image-btn` (`min-height:44px;width:100%`, katkoviivareunus) avaa piilotetun `<input type="file" accept="image/*" capture="environment">` — mobiilissa avaa kameran suoraan.
- Footer (Modal footer -pattern):
  - Talkoolainen: `[Aseta] [Ei tarpeen]` — primary + secondary
  - Järjestäjä: `[Tallenna] [↻ Käännä]` + footer-destructive rivillä `[Poista merkki]` (pieni, `danger-text`)
- `[Poista merkki]` = `.modal-btn-destructive`, confirm vaaditaan (V58)

### SegmentView (`#segment-view`, `src/ui/segment-view.ts`) — talkoolaisen päänäkymä (T220/T223/T224)
- Vain talkoolaiselle jolla on assignedCode matchaava pätkä. `[data-role="talkoolainen"] #segment-view { display: block }`.
- Sijainti: `#segment-view-container`, ennen karttaa. Mobiili-first: **`max-height:38vh` (T228, 48vh→38vh — kompakti yläkortti)**, `overflow-y:auto`, `surface-app`. Ilman inline-listaa paneeli = otsikko + progress + hero/done + varuste-nappi ∴ kartta (`#map flex:1`) saa ~65% ruudusta, seuraava merkki näkyy ⊥ scroll (VISION r131 kartta=päänavigointi).
- **Yhtenäistetty järjestäjän token-järjestelmään (T220):** jaettu `buildMarkerVisual` (MarkerVisualRow T198) merkkiriveillä, `.btn`-varianttinapit, `surface/border/status`-tokenit, status-pillit (`color-mix(... 14%)`). Sama korttimuoto+väri kuin kartalla ja järjestäjän listassa (V87/V136).
- **Header (T232/D):** pätkän nimi `text-body 14px bold` + **pätkän pituus `.segment-view-length` `text-body 13px 600` ("· 1.0 km" = endDist−startDist)** päänäyttönä + km-väli `.segment-view-range` `text-muted 12px` (`margin-left:auto`) pienempänä metana + **kokoontaitto-chevron** (`.segment-view-collapse`, `44px`, T223).
- **GPS-toggle (T232/B, `.segment-view-gps-btn`, V156; T341/V247 tilat `📍 GPS` → `📍 Haetaan…` → `📍 GPS päällä`, virheessä takaisin `📍 GPS` + varoitusbanneri — nappi ⊥ väitä päällä-tilaa ennen ensimmäistä sijaintia):** `📍 GPS`/`📍 GPS päällä` -toggle (siirretty yläpalkista, VISION phase 3 core). Persistentti panel-kontrolli — näkyy KAIKISSA phaseissa (asettaminen+purku), EI asettaminen-only heron sisällä (muuten tavoittamaton purussa). Aktiivi → `.gps-active` (accent-täyttö). Ohjaa `GpsNavigator` (T30, oma sijainti) — erillään driveModesta. Näkyy vain jos `onToggleGps` annettu.
- **Edistymispalkki (`.segment-view-progress`):** phase-tietoinen (`getPhaseProgress`/`formatPhaseProgress`, sama logiikka kuin järjestäjän sivupalkissa). `.segment-view-progress-bar/-fill` (`--confirm`-täyttö) + `.segment-view-progress-text` (esim "3/10 asetettu"). Aina näkyvissä otsikon alla (myös kutistettuna).
- **T224: EI välilehtiä** — yksi pystysarake. "Kaikki merkit" -massalista löytyy yläpalkin napista (marker-modal, V144-suodatus omaan pätkään); Varustelista omana modaalinaan (alla). Tuplaotsikot ("Kaikki merkit" välilehti + yläpalkki) poistettu käyttäjäpalautteen mukaan.
- **Description (`.segment-view-desc`):** ohjeteksti `field-tint`-kortissa, hidden jos tyhjä.
- **"Seuraava merkki" -hero (`.segment-view-next`, `phase==='asettaminen'` TAI `'purku'` — T422/V313; `tarkastus` käyttää inspect-osiota ja `markerTypeFilter`-tehtävä keräyslistaa):** **Vaiheen sanat & kohdestatus tulevat `phaseTarget`-lookupista, EI UI:n if-lauseista:** purussa otsikko on "Seuraava purettava", primary-nappi `✓ Kerätty` (→ `onCollectMarker`, status `kerätty`), valmis-rivi "✓ Kaikki kerätty 🎉"; avoin merkki on purussa `asetettu\|tarkistettu` (merkkiä jota ei ole asetettu ei voi purkaa). accent-vasenreunainen kortti. **Valittu merkki (T232/C, V159):** oletus = pätkän ENSIMMÄINEN asettamaton (`firstUnsetMarker`, pienin distanceFromStart); **◀▶-selailunuolet (`.segment-view-next-prev/-fwd`, `.segment-view-next-nav`, näkyvät kun >1 asettamaton) selaavat asettamattomia (`stepUnset` T231, clamp päihin = disabled reunoilla).** **Selailurivi = 3 saraketta (T312/V224): `◀` kiinni vasempaan (`flex:0 0 44px`, 44×44 touch) | `.segment-view-next-body` (`flex:1; min-width:0`, ikoni+nimi+km, nimi/km `text-overflow:ellipsis`) | `▶` kiinni oikeaan ∴ nuolen x-sijainti on VAKIO merkistä merkkiin — nuoli ei liiku nimen pituuden mukaan (hanskakäsi ei hae kohdetta uudelleen).** Otsikossa laskuri "Seuraava merkki · n/N". Sisältö: `buildMarkerVisual(44px)` + nimi + km + `locationNote`. `✓ Aseta`/`Näytä kartalla`/overflow/kartan ikoni-korostus (`setNextHighlight`) kohdistuvat KAIKKI valittuun merkkiin; `update()`-reconcile: valittu asetettu/poistettu → palaa `firstUnsetMarker`iin (V159). **Primary 2 nappia (VISION max 2):** `✓ Aseta` (`.btn--confirm`, `flex:2`) + `Näytä kartalla` (`.btn--secondary`, panoroi VAIN — **ei kutista, ei modaalia**; T333/V242) + `⋯` (`.segment-view-next-more`, avaa overflow). **Overflow-valikko (`.segment-view-next-menu`, hidden→toggle):** `Ei tarpeen` (`.segment-view-next-skip`, `onSkipMarker`) + **`Siirretty` (`.segment-view-next-move`, T222)** + **`Lisää ohje` (`.segment-view-next-comment`, T228/T380 — avaa merkin `locationNote`-ohjekentän, V275)** + **`+ Merkki` (`.segment-view-next-add`, T232/E/T229: `onAddMarker`→sign-picker kartan keskelle, POST omalle pätkälle V149; siirretty yläpalkista; disabled jos ei annettu)** + `Ota kuva` (`.segment-view-next-photo`, disabled "tulossa"). Kaikki asetettu → `.segment-view-next-done` **slim-rivi "✓ Kaikki asetettu 🎉" + `.segment-view-next--done` (T228, matala paino → kartta esiin)**.
- **Vaihe on JÄRJESTELMÄN tila (T426/V317):** `phase-switcher` kirjoittaa serverille; epäonnistunut vaihto palauttaa valitsimen edelliseen arvoon + banneri. Talkoolaisen hub (`/patkat`) näyttää vain aktiivisen vaiheen tehtävät & otsikko kantaa vaiheen ("Pätkät · Purku"); tyhjä lista kertoo MIKSI (V21). **Purussa varustepinta on piilossa (T428):** `.segment-view-equipment` + koti-välilehti `varuste` `hidden` — purussa ei pakata mitään (jätesäkit → T431). **Purussa merkillä on TASAN kaksi toimintoa (T429/V319):** primary `✓ Kerätty` + overflow'ssa yksi rivi `Ei löytynyt`; `Siirretty`/`Lisää ohje`/`+ Merkki`/`Ota kuva` EIVÄT renderöidy (⊥ disabloida — kuollut pinta V250).
- **"📦 Jätä kasa tähän" (T424/V314/V320, `.segment-view-pile-btn`, vain `phase==='purku'`):** oma rivi heron ALLA, `.btn--confirm`, `width:100%`, `min-height:44px` — **ei kolmas primary-nappi** vaan pätkätason toiminto samaa luokkaa kuin "Merkitse pätkä valmiiksi" (VISION "max 2 nappia" koskee valittuun merkkiin kohdistuvia toimintoja). Teksti kantaa määrän: `📦 Jätä kasa tähän (12 merkkiä)` = ne `kerätty`-merkit joita ei ole vielä missään kasassa (`unclaimedCollected`). **0 ehdokasta → nappia EI renderöidä** (disabloitu nappi olisi kuollut pinta, V250). **Kasa syntyy AINA (T430/V320):** GPS-fix → kasa siihen (nolla napautusta); ilman fixiä nappi virittää kartan yhtä sijoitusta varten (`placeMode.armPlacer`, Esc peruu) — kirjaamaton kasa on lopullinen vahinko, epätarkka ei ole.
- **Sijoitustilan ohjerivi (T452/V335/V336, `.pile-place-hint`):** **YKSI rivi heron sisällä, EI laatikko sen päällä** — ohje mitoitetaan sen mukaan mitä se ohjeistaa, ja ohjeistettava pinta on kartta (B184: 390×844:llä laatikko + hero söivät kartan juuri kun karttaa piti napauttaa). `position:sticky; top:0` `#segment-view`-scrollerissa ∴ Peruuta on tavoitettavissa koko tilan ajan. Sisältö: `.pile-place-hint-text` (`flex:1 1 12ch`, `font-weight:600`, "📦 Napauta kohta josta kasan voi hakea autolla") + `.pile-place-hint-cancel` (`.btn`, `min-height:44px`, `flex:0 0 auto`; kapealla näytöllä `flex-wrap` vie sen omalle rivilleen — B108-oppi: nappi ei purista tekstiä pois). Kehys `2px solid var(--accent)` + `--surface-card` = sama aksentti kuin herokortilla, ei uutta väriä. **Koti = `#segment-view`, EI `#segment-view-container`** (V336: kontti on karttamoodissa `pointer-events:none` ∴ siellä nappi näkyisi ja olisi kuollut — B183). Sijoitustilan ajan `#segment-view.is-placing-pile` piilottaa `.segment-view-pile-btn`n (tila on jo päällä; tilaa vapautuu kartalle). **Tilaan siirtyminen tuo kartan näkyviin itse** (`startPilePlacement`: `data-view-mode` → `kartta`, purku palauttaa edellisen) — kotimoodissa `#map` on `display:none` ja ilman tätä sijoitus oli umpisolmu (B182).
- **Dynaaminen keräyslista (T218/V143, `.segment-view-collect`, vain `markerTypeFilter`-tehtävä):** **T425-lisäykset autoporukalle:** `.segment-view-collect-count` (`12px/700 tabular-nums text-muted`) = kasan merkkimäärä rivillä, vain kasa-merkillä (`pileCount` → null muilla); `.segment-view-collect-nav` = `📍`-ankkuri (`44×44`, `navUrl` V286, `target=_blank`) — kelvottomat koordinaatit → linkkiä ei renderöidä; `.segment-view-collect-nearest` = **lähin kasa omana rivinään listan yläpuolella** (GPS-fix + `defaultUnsetSelection`), **listan JÄRJESTYS ei muutu GPS:stä** (V304: joka fixillä liikkuva rivi on lukukelvoton hanskoilla).
- **(alkuperäinen sopimus)** reititön keräyskasa-/autoporukka-tehtävä korvaa asettaminen-heron (`renderNext` early-return kun `markerTypeFilter`). Accent-vasenreunainen kortti kuten hero. `.segment-view-collect-header` (`text-muted 11px uppercase`) = "Keräyslista · N/M haettu" (tyhjä → "Ei vielä keräyskohteita"). Rivit `.segment-view-collect-row` (distanceFromStart-järjestys, top-border-erottimet): `buildMarkerVisual(36px)` + `.segment-view-collect-info` (klikattava `<button>` → `onShowOnMap`, nimi + `locationNote`) + `.segment-view-collect-btn` (`44px`; ei-kerätty `.btn--confirm` "✓ Haettu" → `onCollectMarker(id,true)`; kerätty `.btn--secondary` "Haettu ✓" → `onCollectMarker(id,false)`, kerätyn nimi himmenee `--done`). **Elävä:** `update()` re-render tuo uudet keräyskasat (getMarkersForSegment→resolveTaskMarkers V140). Kuka tahansa autentikoitu kuittaa (V143, ei ownership-gatea); status kerätty↔suunniteltu suoraan (`bulkSetStatus`, EI 'kerää'-action joka heittää suunniteltu-tilaisille).
- **EI inline-merkkilistaa (T228):** entinen `.segment-view-list` poistettu — se duplikoi "Kaikki merkit" -modaalin (bulk + rivi→MarkerDetailModal) ja söi kartan tilan (dominoiva ei-ydinkomponentti). Per-merkki-lista + detalji elää kahdessa paikassa: yläpalkin **"Kaikki merkit"** -modaali (klikattava rivi→`onOpenMarkerDetail`, V144-suodatus omaan pätkään) + **kartan merkin tap** (`markers-wiring` `setOnMarkerClick`→`onOpenMarkerDetail`). Kartta = päänavigointi.
- **Varustelista-nappi (T224/C, `.segment-view-varuste-btn`):** `🎒 Varustelista (N)` (N = auto-merkit + manuaalimäärä) → avaa `EquipmentModal` (tilava modaali, kuten "Kaikki merkit"). EI ahdasta inline-editoria — käyttäjäpalaute.
- **KOTI-inline-varustelista (T262/V182, `.segment-view-equipment`, `SegmentEquipment`):** KOTI-moodissa (`data-view-mode=koti`) varustelista+varustarkastus näkyy INLINE heron tilalla (hero on kartta-moodin ohjaus; koti = valmistelu, brief "varustarkastus ensin, lähtövalmis"). `field-tint`-kortti: otsikko `🎒 Varustelista` + `✎ Muokkaa varusteita` (`.segment-view-equipment-edit`, `.btn--sm` → avaa `EquipmentModal` manuaalilistan editointiin) + edistymä (`.equipment-modal-progress` jaettu, "Varustarkastus: N/M otettu", täysi→`--confirm`) + auto-merkit (readonly, `checkKeyForType`) + omat varusteet (readonly + checkoff, `checkKeyForItem`). Checkoff-rivit jakavat `.equipment-check`-tyylit (44px, `accent-color:confirm`, `--done`-yliviivaus) ja **saman client-only-tilan + label-avaimet EquipmentModalin kanssa** (`varustarkastus.ts` V180) → rasti täsmää inline↔modaali. Kartta-moodissa CSS piilottaa (`#app[data-view-mode=kartta] .segment-view-equipment{display:none}`); vastaavasti koti piilottaa heron (`#app[data-view-mode=koti] .segment-view-next{display:none}`). **T394/V285 (varustelista vastaa "paljonko PAKKAAN"):** auto-rivin iso luku = `take` (jäljellä olevat) ⊥ kokonaismäärä; `.equipment-check-label` saa `flex:1` & perään `.equipment-count-meta` (`11px text-muted tabular-nums, white-space:nowrap`) `"N/M asetettu"` (purussa `"kerätty"` — sana tulee logiikasta ⊥ UI:n if-lauseesta). `done===0` → metaa EI renderöidä (ennen lähtöä rivi näyttää entiseltään, ⊥ kohinaa). `take===0` → rivi saa OLEMASSA OLEVAN `.equipment-check--done`-kohtelun + `checkbox.disabled` (⊥ enää päätös) & putoaa varustarkastuksen nimittäjästä (V250: rasti tavaralle jota ⊥ oteta on kuollut pinta & estäisi "lähtövalmis"-tilan). Edistymärivin alla `.equipment-summary` (`12px text-muted tabular-nums`) = `"Pätkällä N merkkiä · M jo asetettu · ota mukaan K"` (+ `" · J ei tarpeen"` kun `J>0`). Ei uusia §C-tokeneja, rivikorkeus 44px ennallaan (V268).
- **KOTI-välilehdet (T264/V184, `.segment-koti-tabs`, `SegmentKotiTabs`):** KOTI-moodissa koko pätkäsisältö on 2 tabissa (T380/V275: Kommentit-tab poistettu): **Varustelista** (`.segment-view-equipment`) · **Kaikki merkit** (`.segment-view-markers` ryhmiteltynä + `✓ Merkitse pätkä valmiiksi` `.segment-view-complete` + `✎ Muokkaa rajoja` `.segment-view-bounds`). Tabbar `.segment-koti-tabbar` (role=tablist, 44px `.segment-koti-tab`, aktiivi = accent-alareuna `.is-active`). Korvaa "Lisää ⋯" -accordionin (`.segment-view-more` piilotettu) — valmis/rajat EIVÄT enää haitarin alla (käyttäjäpalaute 2026-07-21). SegmentKotiTabs reparentoi olemassa olevat elementit paneleihin (SegmentView pysyy koordinaattorina). Kartta-moodissa CSS piilottaa `.segment-koti-tabs` (hero näkyy, V177). Talkoolaisen yläpalkista poistuivat Varustelista (`#btn-varuste` poistettu) + Kaikki merkit (`#btn-list` piilotettu talkoolaiselta) — molemmat ovat koti-tabeja.
- **KOTI "Kaikki merkit" -lista (T263/V183 + T264, `.segment-view-markers`, `SegmentMarkerList`):** KOTI-moodissa oman pätkän merkit näkyvät listana koti-landingissa (brief Näkymä 1). Otsikko "Kaikki merkit (N)" + rivit (`buildMarkerVisual(36px)` + nimi + "Status · X.X km", distanceFromStart-järjestys, 44px `<button>`-rivit `field-tint`-hoverilla) → rivi-klikkaus avaa `MarkerDetailModal` (`onFocusMarker`, jaettu yläpalkin "Kaikki merkit" -modaalin kanssa — EI uusi mutaatiopolku). Kartta-moodissa CSS piilottaa (`.segment-view-markers{display:none}`) — T228:n "inline-lista söi kartan tilaa" -peruste pätee vain kartta-moodissa, ei kodissa. V33/V142: vain oman pätkän merkit (currentMarkers jo suodatettu).
- **Listan väliotsikot (T264 → T468/V355, `.segment-view-markers-group`):** typografia on jaettu alaotsikkosopimus (`11px uppercase 700 letter-spacing:0.03em text-muted`) — sama kuin `.marker-overview-subhead` & `.sign-lib-subhead` ∴ EI uutta otsikkotasoa. **Sanat tulevat `PhaseTarget`ista, ei CSS:stä eikä UI:n if-lauseesta:** asetus `Asettamatta/Asetetut/Ei tarpeen`, purku `Purkamatta/Ei kuitattu asetetuksi/Puretut/Ei löytynyt`, keräys `Hakematta/Haetut`. Ryhmiä on 4-5 (ennen 2-3) ∴ ensimmäinen otsikko käyttää `margin-top:4px` (`:first-of-type`) — 390px-ruudulla otsikkomassa on mitattavaa pystytilaa. **Välitilaryhmä (`--pending`) on ainoa varoitus:** `--warn-highlight`-chip + `--text-body` (ei uutta väritokenia, V132) — muut ryhmät ovat tilatietoa, tämä vaatii toimenpiteen. Sama kanava heron välitilarivillä (`.segment-view-next-pending`), joka oli T436:sta asti luokiteltu muttei tyylitelty ∴ varoitus näytti sijaintimuistiinpanolta.
- **Purku-bulk (`.btn-bulk-collect`, `.btn--confirm`):** vain `phase==='purku'` + ei-terminal-merkkejä → "✓ Merkitse kaikki kerätyksi" (V28).
- **"Lisää ⋯" sekundäärivalikko (T232/A, `.segment-view-more`, V158):** panel-tason toggle (`.segment-view-more-toggle` → `.segment-view-more-body` hidden↔näkyvä) joka pitää valmis- + rajat-toiminnot POIS hero-primarysta (tiivis hero) mutta tavoitettavina KAIKISSA phaseissa (EI marker-hero-overflow, joka on vain asettaminen+next → complete olisi tavoittamaton purussa/done-tilassa). Näkyy jos `onComplete` (asettaminen/purku) TAI `onEditBounds` annettu. Sisältää alla olevat complete + bounds -osiot. **Toggle-tyyli (B105):** `field-tint` + `border-default` + `radius-sm` — luettava sekundäärikontrolli, EI paljas `btn--ghost`-teksti (näytti aiemmin ei-interaktiiviselta himmeältä tekstiltä).
- **Rajojen muokkaus (T78/V43, `.segment-view-bounds`, "Lisää ⋯" sisällä T232):** kokoontaitettava "✎ Muokkaa pätkän rajoja (X–Y km)" (`.btn--secondary .btn--sm`) → numeeriset km-inputit (`.segment-view-bounds-start/-end`, `44px`, `type=number`) + validointi (`loppu>alku`, `.segment-view-bounds-error` `danger-text`) + Tallenna/Peruuta. Näkyy vain jos `onEditBounds` annettu (talkoolainen). Tallennus → `PUT /api/segments/:id` (server sallii omalle pätkälle V93).
- **Valmis-osio (T230, `.segment-view-complete`, "Lisää ⋯" sisällä T232, vain `phase==='asettaminen'|'purku'`):** talkoolaisen eksplisiittinen "✓ Merkitse pätkä valmiiksi" / "Merkitse keskeneräiseksi" -toggle (`.segment-view-complete-btn` `.btn--confirm`/`.btn--secondary`) + `.segment-view-complete-status` "Pätkä merkitty valmiiksi ✓" (näkyy vain kun completed). Erillään per-merkki-kuittauksesta (VISION r49/r259). Näkyy vain jos `onComplete` annettu (talkoolainen). Tallennus `Segment.completed` → `PUT /api/segments/:id` (server sallii omalle pätkälle V93, kuten `inspected`).
- **Tarkastus-osio (T147, `.segment-view-inspect`, vain `phase==='tarkastus'`):** `.segment-view-inspect-status` "Tarkastettu ✓"/"Ei vielä tarkastettu" + `.segment-view-inspect-note` (`<textarea>`, `field-tint`, vapaateksti-huomio) + `.btn-mark-inspected` (`.btn--confirm`, toggle-teksti).
- **Kokoontaitto (T223, `.segment-view--collapsed`):** chevron kutistaa näkymän otsikkoon+edistymispalkkiin → kartta saa lähes koko ruudun. **Chevron on AINOA laukaisin (T333/V242, B131):** mikään toiminto ei kutista sivuvaikutuksena — kutistettuna hero katoaa ja ainoa paluu olisi merkitsemätön 18px ikoni ∴ umpikuja kentällä. Kutistettuna desc/next/gps-btn/varuste-btn/more/bounds/inspect/bulk `display:none`.
- **Latauksessa zoom pätkään (T224/D):** `/s/<koodi>` auki → kartta fittaa OMAAN pätkään (`fitMapToSegment` markers-wiring, `planSegmentZoom` `src/logic/segment-zoom.ts`) — lyhyt pätkä `fit`, pitkä `anchor` alkupäähän. "Tässä on sun pätkä" -fiilis, ei koko kartta.
- **Seuraava merkki kartalla (T224/b1 + T256/R6, `MarkerManager.setNextHighlight`):** hero:n VALITTU asettamaton merkki (◀▶-selailu huomioiden, T232/F/V159 — ei suoraan `firstUnsetMarker`) korostuu kartalla — **R6/V178: ITSE ikoni hehkuu huomiovärillä** (`.marker-next-highlight`, `filter:drop-shadow` accent-glow + pulse), EI erillistä accent-rengasta (`NextMarkerHighlight`/`.next-marker-ring` poistettu). Talkoolainen näkee heti minne mennä. Korostus seuraa `onNavigate`-callbackia (markers-wiring). Kartta = päänavigointipinta. Vain `asettaminen`-phase.

### ImageLightbox — jaettu suurennus (`src/ui/image-lightbox.ts`, T337/V246)
- **Yksi kuori kaikille suurennetuille kuville:** merkkien valokuvat, kylttivisuaali (`marker-visual-row`). Kolme toteutusta ⇒ kolme eri sulkemiskäytöstä; Esc, backdrop-klikki ja ✕ toimivat samoin joka paikassa (escape-chain).
- **Rakenne:** `.marker-visual-lightbox-backdrop` (`--overlay` + blur, `z-index:5000`) > `.marker-visual-lightbox` (kortti, `max-width:min(90vw,420px)`) > `.marker-visual-lightbox-close` (✕, `34px`, oikea yläkulma) + `.marker-visual-lightbox-stage` + valinnainen `.marker-visual-lightbox-caption`.
- **Valokuva (`openImageLightbox`):** `.image-lightbox-photo`, **`object-fit: contain`**, `max-height:70vh`. Lava `--surface-app` (tumma) ⇒ valokuva erottuu kortin reunasta. Thumbin `cover`-rajaus EI saa toistua isossa — rajaus hävittää juuri sen mitä kentällä kuvattiin (V246).
- **Kuvan kahva (thumb):** `role="button"` + `tabindex=0` + `aria-label="Avaa kuva N"` + `cursor:zoom-in`, Enter/Space avaa. Thumb ≥44px hit-area (§R) — `.marker-detail-image-thumb` on 72px ∴ täyttyy.
- Sisältö tulee kutsujalta (`stage`-elementti) — kuori ei tiedä mitä näyttää.

### Talkoolaisen moodit (koti/kartta) — T254/V174–176 (R1 keystone)
- **Moodi = `#app[data-view-mode="koti"|"kartta"]`**, asettaa `src/app/talkoolainen-mode.ts`. Koskee VAIN talkoolaista (järjestäjän `#app` ei saa attribuuttia).
- **KOTI (oletus, V174):** pätkänäkymä ILMAN karttaa. `#map { display:none }`. Landing kun `/s/<koodi>` avataan.
  - **Korkeus = VIEWPORT, ei sisältö (T315/B123/V226):** `#segment-view-container { flex:1; min-height:0; display:flex; flex-direction:column }` + `#segment-view { flex:1; min-height:0; max-height:none }` → näkymä on RAJATTU scroll-alue (base `overflow-y:auto` + `overscroll-behavior:contain`, V187a). Pelkkä `max-height:none` oli bugi: elementin korkeus kasvoi datan mukana ∴ oma `overflow-y` ei koskaan aktivoitunut, eikä yksikään esivanhempi tarjonnut scrolleria (`#map-area{overflow:hidden}`, sivukuori `overflow:hidden` V187b) → alimmat merkit tavoittamattomissa. **Sääntö: talkoolaisen sisältöpaneeli ei koskaan määrää korkeuttaan sisällöstä.** `#segment-view` pysyy sisäisesti `display:block` (sisäinen layout ei muutu).
  - **`#btn-to-map` on scrollerin ULKOPUOLELLA** (`#segment-view-container`in sisarus `#map-area`ssa, `flex:0 0 auto`) → kodin primary näkyy aina, myös pohjaan scrollattuna.
  - **Koti-tabit jakavat SAMAN scrollerin** ∴ `SegmentKotiTabs.setActive` nollaa `#segment-view`in `scrollTop`in (lähin `closest('#segment-view')`) — uusi tabi ei avaudu keskeltä.
- **KARTTA (V175/V177, R5):** `#map` täyttää `#map-area`:n (≥~80%, VISION "yksinkertainen kartta"). `#segment-view-container` `position:absolute;bottom` (pointer-events:none), `#segment-view` = kelluva alakortti (`radius-lg` + varjo, `pointer-events:auto`, `max-height:46vh`). Näyttää VAIN seuraava-merkki-heron (+ keräyslista/done); header/progress/gps/varuste/lisää/kommentit/inspect piilossa. GPS → ylävalikko R8:ssa.
- **"Kartalle →" (`#btn-to-map`):** iso confirm-primary (`min-height:52px`, `--confirm`-täyttö, `radius-md`), näkyy vain `[data-view-mode="koti"]`. Sijainti `#map-area`:ssa `#segment-view-container`:n jälkeen.
- **"🏠 koti" (`#btn-home-view`):** toolbar-nappi 44×44 (`#btn-menu`-tyyli: transparent + `border-strong`), näkyy vain `body[data-role="talkoolainen"]` + `[data-view-mode="kartta"]`. Paluu kotiin.
- **Vaihto (V176):** pelkkä näkyvyyskytkin — ei nollaa segment-/marker-tilaa, ei verkkokutsuja. Karttamoodiin siirtyessä Leaflet `invalidateSize()` (kartta oli piilossa). ⚠️ Toolbar ahtautuu karttamoodissa (🏠 + Kaikki merkit + Varustelista + ⋯ ≤390px) → R9 (toolbar-remontti) siirtää osan ⋯-valikkoon.

### Kartan muokkaustila (`.map-mode-toggle` + `.map-mode-pill`, `src/ui/map-mode-toggle.ts`) — T307/T308, V218/V219
Kartta avautuu **katselutilassa** joka latauksella; kaikki kartan MUTATOIVAT eleet (merkin raahaus, tuplaklikki-sijoitus, pätkän rajakahvat) elävät muokkaustilan alla. Tila = `src/logic/map-mode.ts` (`mapMode`-singleton), heijastus DOM:iin **yhdestä paikasta** (`syncMapModeToBody` → `body[data-map-mode="katselu"|"muokkaus"]`). UI-komponentti EI kirjoita attribuuttia eikä pidä omaa tilamuuttujaa.

- **Toggle (`.map-mode-toggle`), sama tila molemmille rooleille (⊥ rooli-eriytettyä logiikkaa):**
  - järjestäjä = yläpalkin karttatyökalurivi `#btn-map-mode` (`data-role-hide="talkoolainen"`)
  - talkoolainen = ⋯-valikon `#btn-tk-map-mode` (V179-linja: pätkän core-toiminnot ⋯:ssä, näkyy myös karttamoodissa)
  - **Label = KOHDETILA** (mitä klikki tekee): katselu → `✎ Muokkaa`, muokkaus → `✓ Valmis`. `aria-pressed` = onko muokkaus päällä. Näkyvä teksti = saavutettava nimi (ei ristiriitaista `aria-label`ia, V197); `title` on lisäselite.
  - Tyylit: `min-height/min-width:44px` (§R, hanskat), `field-tint` + `border-strong` + `--text-body` katselussa; `.active` = `--warn-highlight`-tintti + `--accent`-reuna + `inset 0 0 0 1px accent` (toinen accent-pikseli **ilman reflowta** — 2px-border togglaus siirtäisi naapurinapit). Valikkovariantti: `#toolbar-menu .map-mode-toggle` (ID-selektorin voittava override, täysleveä + vasemmalle tasattu).
- **Pilleri (`.map-mode-pill`, `#map-mode-pill`):** PYSYVÄ (ei ajastettu toast) `✎ Muokkaustila` kartta-alueen yläreunan keskellä (`absolute; top:8px; left:50%` — ei törmää `#status-panel`iin joka on top-left). `surface-card`-tausta + **2px `--accent`-reuna** + `radius:999px` + `--text-body`-teksti, `role="status"`, `pointer-events:none` (ei koskaan syö kartan tappia). **Näkyvyys = `hidden`-attribuutti** (JS-totuus, testattava ilman CSS:ää); `.map-mode-pill[hidden]{display:none}` estää luokan `display:flex`in kumoamasta sitä.
- **Accent-kehys:** `body[data-map-mode="muokkaus"] #map-area::after` = `border:3px solid var(--accent)` + `inset:0` + `z-index:1500` + `pointer-events:none`. **Pseudo-overlay, EI `box-shadow: inset`** — Leafletin läpinäkymättömät laattapaneelit ovat `#map-area`n LAPSIA ja peittäisivät inset-varjon.
- **Kolme signaalikerrosta (V219):** (1) toggle-label+`.active`, (2) pilleri SANOIN, (3) perifeerinen kehys. Talkoolainen metsässä (aurinko, hanskat) ⊥ joudu arvaamaan onko kartta "liukas".
- **Kontrastisääntö (§C-seuraus):** teksti on aina `--text-body` accent-TINTIN päällä — **ei valkoista accent-täytön päällä** (`#F2542D` + `#fff` = 3.5:1 → FAIL vaalealla teemalla). Accent kantaa reunan/kehyksen, ei tekstin luettavuutta. Sama sääntö pätee kaikkiin uusiin accent-korostuksiin (vrt. `.inv-mode-toggle.active`, joka on tämän vastaesimerkki).
- **KOTI-moodi (talkoolainen, V175):** kartta piilossa ∴ `#app[data-view-mode="koti"]` piilottaa sekä pillerin että kehyksen — muokkaustila koskee KARTTAA.
- Ei uusia väritokeneja (reuse `accent`/`warn-highlight`/`field-tint`/`surface-card`).

### EquipmentModal (`.equipment-modal`, `src/ui/equipment-modal.ts`) — talkoolaisen varustelista (T224/C)
- Avautuu SegmentViewn `🎒 Varustelista` -napista. Tilava keskitetty modaali (`width:min(480px,94vw)`, `max-height:85vh`), backdrop + Esc/✕/backdrop-sulku (`registerEscClose`/`createBackdrop`).
- **Varustarkastus-checkoff (T258/R2, "otin nämä"):** jokaisella rivillä (auto + ei-tyhjä manuaali) checkbox (`.equipment-check-box`/`.equipment-manual-check`, `22px`, `accent-color:confirm`). Checkattu → yliviivaus (`--done`). Edistymä `.equipment-modal-progress` "Varustarkastus: N/M otettu" (täysi → `--confirm`-vihreä). Client-only per pätkä (V180, localStorage) — henkilökohtainen valmisteluapu, EI backend.
- **Auto-laskuri (readonly-laskuri):** merkit pätkällä tyypeittäin (`.equipment-modal-auto-list`, ihmisluettava tyyppilabel) — otsikko "Merkit pätkällä (ota mukaan)". **T394/V285:** identtinen rivi- ja metasopimus kuin `SegmentEquipment`illa (sama `getEquipmentCounts`-lähde + `.equipment-count-meta` + `.equipment-summary`) — inline ja modaali ⊥ saa näyttää eri lukua samasta pätkästä.
- **Omat varusteet (muokattava):** rivit `count`-input + nimi-input + `✕`-poisto (`.equipment-modal-count/-name/-remove`, `44px`), `+ Lisää varuste`. Muokkaa `draft`-kopiota.
- **Footer:** `Tallenna` (`.btn--confirm`, commit → `onEquipmentChange` + sulje, tyhjänimiset karsitaan) + `Peruuta` (hylkää). Tallennus → `updateSegment` + `PUT /api/segments/:id` (V38/V93, server sallii talkoolaisen equipment omalle pätkälle).

### PhaseSwitcher (T148 → T434/V321, `#phase-switcher-container`, `src/ui/phase-switcher.ts`)
- **KATSELUSUODIN, ei komento (T434/V321).** Valinta muuttaa vain sitä mitä TÄMÄ järjestäjä näkee — ei koske serveriin, ei näy kenellekään muulle. Käynnissä olevan vaiheen vaihtaminen kaikille asuu **admin-paneelissa** (§K AdminPage, T433) ja on admin-only.
- Vain järjestäjälle — `data-role-hide="talkoolainen"` piilottaa containerin talkoolaiselta. Talkoolaisella ei ole katselusuodinta lainkaan (V318): hänelle vaihe on tapahtuman tosiasia, ei valinta.
- Sijainti: `#toolbar-menu` (⋯-valikko), oma rivi `.menu-sep`-erottimien välissä
- `<select>` kolmella vaihtoehdolla: Asetus / Tarkastus / Purku (`Segment['phase']`-arvot), `min-height:44px`
- Vapaa valinta mihin arvoon tahansa — ei rajoitettu ketju
- **Pilleri `.phase-switcher-pill`** (`flex:1 0 100%` → oma rivi, `min-height:44px`, `warn-highlight`-tausta + `accent`-reunus, 12px): näkyy **vain kun katselu ≠ käynnissä oleva vaihe**, teksti "Katselet: Purku · käynnissä: Asetus — palaa", klikkaus palauttaa katselun. **Tämä ei ole koriste vaan säännön ainoa aisti** — ilman sitä järjestäjä luulee vaihtaneensa vaiheen kaikille, mikä oli V321:n synnyttänyt väärinkäsitys.
- Ei virhebanneria: paikallinen kirjoitus ei voi epäonnistua (vanha `onError`-parametri poistui, virheet siirtyivät admin-paneeliin)
- Ohjaa mitä `SegmentPanel`-lista ja `SegmentOverlay`-kartta näyttävät oletuksena (`getSegmentsForPhase`-suodin) — ei vaikuta talkoolaisen omaan pätkänäkymään

### SignLibraryPanel (`src/ui/sign-library-panel.ts`)
- Vain järjestäjälle — sijaitsee `#left-panel-content`:ssä
- **Yksi lista (T161-kuratointi):** kaikki merkit samassa listassa. Ei osiojakoa.
  - Rakenne: section-header `[▼/▶ Merkkikirjasto]` → hakukenttä `.sign-lib-search` (`type=search`, `min-height:44px`, `field-tint`, placeholder "Hae merkkiä…") → scrollattava lista → `+ Uusi merkki` -footer.
  - **Järjestys:** suosikit (`favorite:true`, "suosituimmat") listan alussa, muut perässä.
  - **Scroll:** lista `max-height:min(60vh,620px);overflow-y:auto` → ~10–15 riviä näkyvissä, loput scrollilla. Hakukenttä ja footer pysyvät listan ulkopuolella (eivät scrollaa pois).
  - **Haku:** suodattaa rivit **DOM:ssa** (`data-label`-attribuutti, `display:none`) — ei re-renderiä → syöttöfokus säilyy. `sign-catalog.ts category` ('sign'/'place') on datassa mutta ei enää jaa UI:ta.
- Rivit (`.sign-lib-row`): `display:flex;align-items:center;gap:4px`, border-bottom `border-card`, `data-label` (lowercase, hakua varten)
- Swatch (`22×22px`, `.sign-lib-swatch-slot`): **T200 — sama `buildMarkerVisual`-helper (MarkerVisualRow, T198) kuin SegmentDetailsModal (T199)**, kutsuttu `{size:22, zoomable:false}`. Ei enää oma swatch-render — yhtenäinen tuplamerkki-visuaali kaikkialla (sivupalkki ↔ modaali ↔ kartta). Yksittäinen merkki: kuva > ikoni > compactLabel -precedence (V99/T158). Tuplamerkki (`parts.length>1`, V107): pystypino, max 4 lohkoa, ei kulmabadgea. Väri = `template.color` (V87 — täyttö on aina tyyppiväri, ei kiinteä accent). `zoomable:false` → ei zoom-nappia riveillä (sama peruste kuin T199 yhteenveto-chipit). Adapteri `templateToMarkerVisual`: `type = t.imageId ?? t.id` (kuva-avain, ei väri-fallback koska `color` aina asetettu). Slotit täytetään DOM:issa `innerHTML`-asetuksen jälkeen (`buildMarkerVisual` palauttaa `HTMLElement`, ei stringiä).
- Suosikki-nappi (`.sign-lib-fav-btn`): `min-width:44px;min-height:44px` (§R pakollinen)
- Muokkaa-nappi (`.sign-lib-edit-btn`): `min-width:44px;min-height:44px`
- Poista-nappi (`.sign-lib-delete-btn`): `min-width:44px;min-height:44px`, `danger-soft` tausta, `danger-text` väri
- "Uusi malli" -nappi (`.sign-lib-add-btn`): `min-height:44px;width:100%`, `field-tint` tausta, `border-default`
- **Lomake (`.sign-lib-form`):**
  - Tausta: `surface-raised`, `border-radius:radius-md`, padding `10px 8px`
  - Kaikki kentät: `min-height:44px`, `field-tint` tausta, `border-default`, `radius-sm`
  - **Tunnus-input (`.sign-lib-id-input`, T156/V97):** VAIN luonnissa (edit-modaalissa ei renderöidä — id on muuttumaton avain). Label "Tunnus (uniikki, esim. N-OIK)". Käsin annettu, uniikki, filename-safe `[A-Za-z0-9_-]+` (toimii GPKG-export-`type`-koodina + kuva-avaimena). Virhe: `.sign-lib-id-error` (`danger-text`, `12px`, `role=alert`, `display:none`→`block`) — duplikaatti/kelvoton estää tallennuksen, modaali pysyy auki, fokus takaisin id-inputiin.
  - Lyhenne+väri rivi: `display:flex;gap:6px` — lyhenne-input `flex:1;min-width:0`, color-input `width:44px;height:44px` ilman tekstilabelia (§R: color-picker on itsessään selvä)
  - Tallenna-nappi: `confirm` tausta, `confirm-text`, `min-height:44px`, `flex:1`
  - Peruuta-nappi: `field-tint` tausta, `border-default`, `min-height:44px`
  - ~~**Keppi-checkbox / kiinnitystapa (T249/V168 → V181)**~~ **POISTETTU KOKONAAN T266/V186** — kiinnitystapa (keppi/irto) EI ole strukturoitu kenttä missään (ei mallissa, ei inventaariorivillä). Oletus = aina keppi; poikkeus "sido puuhun" ilmaistaan merkin kommentissa/paikkaohjeessa kartalla (`marker-detail-modal` note, placeholder "kiinnitä puuhun"). Malli = pelkkä kylttipinta (yksi tunnus). `signDisplayLabel(tpl.label)` = pelkkä label KAIKKIALLA (kirjasto/picker/kartta/inventaario). Ei `.inv-field-keppi`/`.inv-d-keppi`/`.sign-lib-keppi-checkbox`-elementtejä. HUOM: kartan compactLabel johdetaan raakalabelista.

- **Vaiheen mukainen kutistus (T444/V250, `setPhase(phase)`):** purkuvaiheessa paneeli renderöityy **kutistettuna** — purussa merkkejä ei aseteta ∴ kirjasto vie pystytilaa toiminnolta jota ei käytetä (sama kuvio kuin T428, varustelista pois purusta). **Collapse, EI täyspiilotus:** järjestäjä voi tarvita kirjastoa korjaukseen kesken purun, ja piilotettu paneeli olisi kadonnut toiminto — V250-linja on että rivi näkyy kun se voi tehdä jotain, ja kirjasto voi yhä. Section-header + chevron pysyvät aina DOM:issa. Käyttäjän oma avaus/sulku (`userToggled`) voittaa vaiheen oletuksen istunnon ajan, ja `setPhase` samalla vaiheella on no-op ∴ paneeli ei kutistu uudelleen jokaisella renderillä tai synkalla. Lähde: `getViewPhase()` (paneeli on järjestäjän pinta, V321).

### ImageGalleryPicker (`.sign-image-gallery`, edit-modaalin sisällä T93-ikoni-gridin vieressä)
- **Sijainti:** SignLibraryPanel edit-modaalin visual-valinnassa kaksi tabia: `[Ikoni] [Kuva]` (`.sign-visual-tab`, `min-height:44px`, aktiivi = `accent`-alaviiva, ei-aktiivi = `text-muted`). Kuva-tabi näyttää `ImageGalleryPicker`-gridin, Ikoni-tabi nykyisen T93-ikoni-gridin. Precedence (V99) ei riipu tabista — kumpi tahansa asetettu viimeksi voittaa tallennuksessa, toinen kenttä nollataan (kuva ja ikoni eivät ole molemmat samaan aikaan aktiivisia samalle templatelle).
- **Grid:** `display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px`, kontaineri `max-height:min(50vh,420px);overflow-y:auto;flex-shrink:0` (sama scroll-periaate kuin sign-lib-lista rivi 444). **`flex-shrink:0` pakollinen (B91/T201/V130):** galleria on modaalin (flex-column, overflow-y:auto) lapsi jolla oma `overflow-y:auto` → CSS antaa flex-itemille `min-height:auto=0` → matalalla mobiiliviewportilla flexbox kutistaisi gallerian 0-korkeuteen (thumbnailit katoaisivat). `flex-shrink:0` pitää korkeuden, modaalin oma scroll hoitaa ylipursun.
- **Thumbnail (`.sign-image-thumb`):** `64×64px`, `border-radius:radius-sm`, `background:#fff` (kyltit suunniteltu valkoiselle pohjalle), `<img object-fit:contain;width:100%;height:100%>`. Koko napin pinta-ala klikattava (≥44px täyttyy jo 64px:llä — §R ei erillistä paddingia tarvita).
- **Valinta:** klikkaus valitsee kuvan templatelle heti (ei erillistä "vahvista"-nappia gridissä) — `2px solid accent` reunus + pieni ✓-badge oikeassa yläkulmassa (`14px`, `accent` tausta, `accent-text` glyfi) valitulle thumbnailille. Sama korostuslogiikka kuin T93 ikoni-gridin valinta (yhtenäinen pattern kahden tabin välillä).
- **Lataa oma kuva (T196/V131, `.sign-lib-image-upload-btn`):** Kuva-tabin yläosassa dashed-reunuksinen `min-height:44px` -nappi "⬆ Lataa oma kuva" → avaa piilotetun `<input type=file accept=image/*>`. Valinta POSTaa `/api/templates/:id/images` (multipart) → backend palauttaa URL:n joka tallentuu `template.imageId`:hin ja prependataan galleriaan valittuna thumbnailina. Vaatii että tunnus (id) on annettu ensin (URL sisältää id:n) — muuten inline-virhe (`.sign-lib-image-upload-error`). Ratkaisee bundle-riippuvuuden: järjestäjä jakaa oman kuvan kaikille backendin kautta (ei enää `src/assets/signs`-buildaus). Näkyy vain Kuva-tabilla (setVisualTab togglaa).
- **Zoom/lightbox (uusi tarve — pienet thumbnailit eivät riitä erottamaan samankaltaisia kylttejä, esim. useita ylämäki-variaatioita):** jokaisessa thumbnailissa zoom-kulma (`.sign-image-zoom-btn`) — klikattava alue **44×44px** (§A pakollinen kaikille interaktiivisille, myös hiirikäytössä), visuaalinen glyfi pienempi (`18px` tumma pyöreä badge + valkoinen suurennuslasi-SVG) ankkuroitu oikeaan alakulmaan hit-arean sisällä `padding`illa. Click **ei** valitse kuvaa, vaan avaa lightboxin (stopPropagation). Koko thumbnail on silti myös suoraan klikattava valintaan (zoom on lisä, ei pakollinen välivaihe) — zoom-hit-area peittää thumbnailin oikean alakulman, loppuosa jää suoraan valintaan.
  - **Lightbox-rakenne (`.sign-image-lightbox`):** sama pattern kuin SnapshotModal (rivi 161-169) — backdrop `.sign-image-lightbox-backdrop` (`overlay`-token, `backdrop-filter:blur(2px)`, `z-index:5000` — yli edit-modaalin, joka on `z-index:4000`-luokkaa), sisältö keskitetty `max-width:min(90vw,640px);max-height:85vh`, kuva `object-fit:contain;width:100%;height:100%`.
  - Sulkeutuu: Esc, backdrop-klikkaus, tai `✕`-nappi (`.sign-image-lightbox-close`, oikea yläkulma, `min-width:44px;min-height:44px`, `aria-label="Sulje"` — §A vaatii, ei tekstiä).
  - Footer-nappi lightboxissa: `[Valitse tämä kuva]` (`.modal-btn-primary`-tyyli, `confirm` tausta) — valitsee kuvan templatelle ja sulkee lightboxin samalla. Mahdollistaa valinnan suoraan suurennetusta näkymästä ilman paluuta gridiin.
- **Käyttäjä:** järjestäjä (desktop/hiiri, ei touch-kriittinen — mutta 44px-sääntö koskee silti kaikkia nappeja §R:n mukaan, myös hiirikäytössä yhtenäisyyden vuoksi).
- **Datalähde:** `src/assets/signs/*.webp` (Vite glob-import, T161-konversio), kuva-avain = `template.id` (V97 filename-safe).

### MarkerVisualRow — jaettu merkkivisuaali listariveihin (T198, `src/ui/marker-visual-row.ts` `buildMarkerVisual`)
- **Mikä:** pure-DOM-funktio `buildMarkerVisual(marker, {size, zoomable})` — pieni merkkivisuaali (kuva/ikoni/label, V99-precedence) listariveihin. Käyttäjät: SegmentDetailsModalin merkkilista (T199, `size:34/28`) **ja SignLibraryPanelin sivupalkkirivit (T200, `size:22, zoomable:false`)** — sama helper takaa että tuplamerkki näyttää identtiseltä sivupalkissa, modaalissa ja kartalla. Erillinen tiedosto tarkoituksella: `segment-details-modal.ts` on liputettu ⚠️ pilkko (COMPONENTS.md), eikä visuaali-render saa kasvattaa sitä lisää; sama helper uudelleenkäytettävissä myöhemmin talkoolaisen SegmentView:ssä.
- **Koko:** `opts.size`-parametrilla ohjattu neliö (`width/height: size px`), kutsuja päättää (esim. `34px` tarkka lista, `28px` yhteenveto-chip).
- **Väri (V87-pattern — täyttö on aina tyyppiväri, ei koskaan kiinteä accent):** `marker.color` (custom template) voittaa; muuten oletustyypin väri `SIGN_TYPES`-taulukosta (`src/logic/sign-picker.ts`: left `#2563eb`, right `#16a34a`, upcoming-left `#7c3aed`, upcoming-right `#b45309`); muuten neutraali `#94a3b8`. Sama precedence kuin kartan `circleSvg`/`comboMarkerSvg`:ssä (`src/map/icons.ts`) — listan värien on täsmättävä kartan väreihin, muuten tunnistettavuus katoaa.
- **Yksittäinen visuaali (`.marker-visual-row-single`, V136/T208):** kuva → valkotausta `border-radius:8px`, `object-fit:contain`; ikoni/label → resolvoitu tyyppiväri-tausta **neliökortti** (`border-radius:8px`, EI 999px-pyöreä), valkoinen Lucide-SVG tai `compactLabel`-teksti keskitettynä. Neliömuoto täsmää kartan `cardSvg`-korttiin (sivupalkki ↔ modaali ↔ lista ↔ kartta yhtenäisiä).
- **Tuplamerkki (`.marker-visual-row-combo`, `parts.length>1`, V107):** pystypino, max 4 lohkoa (`.marker-visual-row-combo-slot`), `1px`-jakoviiva lohkojen välissä, `border-radius:8px` koko pinolle, sama resolvoitu väri kaikissa ikoni/label-lohkoissa. **Ei kulmabadgea** (esim. "2") — käyttäjäpäätös: kaksi näkyvää lohkoa jo kertoo tuplauksen, badge koettiin turhaksi.
- **Zoom (`opts.zoomable=true`, `.marker-visual-row-zoom`):** `44×44px` klikattava hit-area (V129/B89 — alkuperäinen 20px-toteutus rikkoi §A:n, korjattu ennen ✓-merkintää) oikeassa alakulmassa, sisällä `18×18px` näkyvä pyöreä tumma badge valkoisella suurennuslasi-SVG:llä, `aria-label="Suurenna <label>"`. Klikkaus `stopPropagation` + avaa lightboxin — ei valitse mitään, pelkkä esikatselu (ero ImageGalleryPickeriin: siellä zoom voi myös valita).
- **Lightbox (`.marker-visual-lightbox`, `.marker-visual-lightbox-backdrop`):** sama pattern kuin ImageGalleryPickerin lightbox (rivit 468-471) — `overlay`-token backdrop, `z-index:5000`, keskitetty `max-width:min(90vw,420px)`, `surface-card` tausta (ei valkoinen — tämä ei ole vain kuva-esikatselu vaan koko merkkivisuaali omalla taustallaan), sisällä `buildMarkerVisual(marker, {size:160, zoomable:false})` + caption (label tai compactLabel). Sulkeutuu: Esc, backdrop-klikkaus, `✕`-nappi (`.marker-visual-lightbox-close`, `34×34px`, `aria-label="Sulje"`).
- **Päätetilan koriste (T442/V328, `data-decoration`):** merkin PÄÄTETILA luetaan muodosta, ei himmennyksestä. `markerDecoration(status, phase)` (`src/logic/sign-visual.ts`, puhdas) → `collected` | `missing` | `skipped` | `none`; `buildMarkerVisual` kirjoittaa sen `data-decoration`-attribuutille ja `.marker-visual-row-sv--<arvo>`-luokaksi. `status`/`phase` ovat **vapaaehtoisia** — merkkikirjasto ja esikatselut piirtävät tyyppejä joilla ei ole elinkaarta, ja ilman niitä koriste on `none`.

| Arvo | Milloin | Ilme |
|---|---|---|
| `collected` | `status = kerätty` | **Vinoviiva** ikonin yli (`::after`, `3px`, −45°) |
| `missing` | `status = ei_tarpeen` **ja** `phase = purku` ("ei löytynyt", V319) | **Katkoviiva** + `?`-merkki oikeassa yläkulmassa |
| `skipped` | `status = ei_tarpeen` muussa vaiheessa | Himmennys `opacity:.5`, ei viivaa |

  Viiva **ei peitä ikonin ydintä**: talkoolainen tarvitsee kasaa kootessaan yhä tiedon MIKÄ merkki tämä oli — peittävä rasti hävittäisi juuri sen. Kolme päätetilaa näyttivät ennen samalta himmeältä ∴ sama merkki kerättiin kahdesti tai keräämätön ohitettiin.
  **Kontrastitokenit (`:root`, teemariippumattomat kuten karttapinta-tokenit V253):** `--mark-slash: #10161A` (viiva) + `--mark-slash-halo: rgba(255,255,255,0.95)` (halo, kaksi `drop-shadow`ia). Halo tarvitaan koska merkin oma väri ei ole tiedossa piirtohetkellä: sama viiva osuu sekä vaalealle kuvakyltille että tummalle tyyppivärille. Ei inline-hexiä — kirkkaan auringon kalibrointi eläisi kahdessa paikassa.
  **Sama kieli kartalla:** `MarkerManager.reapplyElementState` asettaa `.marker-collected` Leaflet-merkin elementille → identtinen `::after`-vinoviiva. Kaksi kieltä samalle tilalle olisi kaksi asiaa opeteltavaksi.
- **Käyttäjä:** molemmat (järjestäjä nyt SegmentDetailsModalissa, talkoolainen tuleva SegmentView).

### AdminPage (`admin.html` + `src/admin.ts` + `src/ui/admin-page.ts`, T122)
- Erillinen entrypoint, ei jaa `#app`-runkoa index.html:n kanssa — vain admin-rooli, oma sivu
- `#admin-app`: `max-width:960px;margin:0 auto;padding:16px` — kapea keskitetty layout, toimii myös mobiililla
- Header (`#admin-header`): otsikko + "Kirjaudu ulos" (`min-height:44px`)
- Invite-banneri (`.admin-invite-banner`): näyttää tuoreimman invite/reset-URL:n + kopiointinappi (`min-height:44px`), `warn-highlight` tausta + `accent`-reunus
- "Kutsu uusi järjestäjä" (`.admin-invite-btn`): `min-height:44px;width:100%`, `field-tint` tausta, katkoviivareunus
- Käyttäjätaulukko (`.admin-users-table`): rivi per käyttäjä, sarakkeet Nimi/Käyttäjätunnus/Rooli/Luotu/Tila/Toiminnot
- Tila-pilli (`.admin-user-status`): käyttää olemassa olevia status-värejä (§C) — `active` = `#4ade80`/`rgba(74,222,128,0.10)` (sama kuin status-asetettu), `inactive` = `danger-text`/`danger-soft`. **Ei uutta `--confirm`-tekstiväriä tummalla taustalla** — kontrasti alle AA:n (3.1:1), käytä aina kirkkaampaa status-tokenia.
- Toimintonapit (`.admin-toggle-active-btn`, `.admin-copy-invite-btn`): `min-height:44px`, `field-tint` tausta
- **Tapahtuman vaihe (T433/V321, `#admin-phase` + `.admin-phase-section`)** — sivun ENSIMMÄINEN osio (ennen talkoo-salasanaa): se on ainoa toiminto tällä sivulla joka muuttaa jokaisen talkoolaisen näkymää kentällä. Rakenne kolmessa kerroksessa:
  - **Nykytila ensin** (`.admin-phase-current`, 1rem/600 + `accent`-pisteindikaattori `::before`): "Käynnissä: Asetusvaihe". Admin ei saa vaihtaa vaihetta tietämättä mistä lähtee. Alle `.admin-phase-hint` muted-tekstinä: "Vaihe koskee kaikkia — talkoolainen näkee vain käynnissä olevan vaiheen tehtävät."
  - **Valitsin** (`.admin-phase-select`, `min-height:44px`, `surface-app` + `border-default`) — sama kolme vaihetta kuin PhaseSwitcherissä
  - **Vahvistus** (`.admin-phase-confirm`, `warn-highlight`-tausta + `accent`-reunus, piilossa kunnes valinta ≠ nykytila): `.admin-phase-warning` sanoo **seurauksen** (`phaseChangeWarning`-lookup, ei geneeristä "oletko varma?"), sitten `.admin-phase-apply` (`accent`-täyttö, teksti "Käynnistä: Purku") + `.admin-phase-cancel` (neutraali), molemmat `min-height:44px`. Peruutus ei kutsu serveriä.
  - **Virhe** (`.admin-phase-error`, `danger-soft` + `danger-text`, `role="alert"`): eritelty statuskoodin mukaan (V322) — 403/404/5xx/verkko saavat eri lauseen, kukin kertoo mitä tehdä
  - Ei uusia väritokeneja (`accent`, `warn-highlight`, `danger-soft`, `danger-text` §C:stä)

### InventoryPage — v2 (`inventory.html` + `src/inventory.ts` + `src/ui/inventory-page.ts`, T245/T246)
- **Read/edit-moodi (T251, `viewMode` 'read'|'edit', V169–V171):** sivu avautuu **read-modessa** (oletus, sessiokohtainen — reload→read, V170). **Moodi-toggle `.inv-mode-toggle`** asuu **sivun headerissa** (`#inventory-header .inventory-header-actions`, ← Kartta -napin vasemmalla puolella — yksi komentopalkki, EI orpoa yläpalkkia). `mountModeToggle` deduppaa vanhan togglen ennen uutta (load() re-renderöi joka mutaatiolla). Eristetyssä mountissa (testit, ei headeria) fallback: kevyt `.inv-topbar` containeriin. Toggle = **päänappi, EI pilli**: `radius-sm`, `min-height:44px`, `font-size:14px`, read="✎ Muokkaa" (accent-outline: läpinäkyvä tausta + accent-reuna+teksti → erottuu paikkatabien field-tint-pilleistä) / edit="✓ Valmis" (`.active`=accent-täyttö), `aria-pressed`. **Kontekstirivi `.inv-context`** tabien alle: vasen `.inv-context-label` "`<paikka> · N tavaraa`" (13px/600; paikka = aktiivi tabi / "Kaikki paikat" / "Ei paikkaa", V164 textContent) + edit-modessa oikea `.inv-mode-badge` "Muokkaustila" (`accent`) — antaa ryhdin: aina tiedät missä olet + montako. **Edit-signaali = 3 kerrosta:** (1) toggle accent-täyttö + Muokkaustila-merkki, (2) mutaationappien ilmestyminen, (3) **per-kortti-aksentti `.inv-edit-mode .inv-card { box-shadow: inset 3px 0 0 accent }`** — inset vasen väripalkki jokaisen editoitavan kortin reunassa (`marker-item--pending`-idiomi, EI border/padding → ei reflowta togglatessa). EI container-tasolla: korttien 10px-raot katkoisivat container-palkin irrallisiksi oransseiksi tikuiksi (havaittu visuaalitarkastuksessa). **Read piilottaa KAIKKI mutaatiot** (add-form, `.inv-stepper`, `.inv-card-actions`, `.inv-loc-add`, `.inv-loc-edit-toggle`); **säilyttää katselun**: paikkatabit, "Kaikki", zoom-lightbox, kyltin nimi→SignTemplateModal (tietoinen editori sallittu read-modessa). **Read-lista = tiivis rekisteri** (`.inv-list--read` `gap:0`): rivit `.inv-card--read` EIVÄT korttilaatikoita vaan hiusviivalla eroteltuja (`background:none; border:none; border-bottom:border-subtle`, viimeinen ilman viivaa), `padding:10px 4px`; qty pelkkänä tekstinä omassa oikeassa sarakkeessa (`.inv-card-qty` `margin-left:auto; min-width:3.5em; text-align:right; tabular-nums`) → `[ikoni] nimi ········ määrä unit` skannattavana. Edit-mode pitää korttilaatikot (sisältävät kontrollit) → read=litteä rekisteri vs edit=laatikot on tietoinen hierarkiaero, ei epäyhtenäisyys. **"Kaikki"+edit:** rivi-muokkaus ON, add-form EI (V171, add vaatii paikkakontekstin). Rooli: järjestäjä/admin (mobiili-primääri kärryllä). Ei uusia väritokeneja (reuse accent/field-tint).
- **Paikkatabit = paikan ainoa totuus** (`.inv-location-bar` + `.inv-loc-tab` pillit `border-radius:999px min-height:44px`): järjestys **paikat → "Ei paikkaa" → "Kaikki" → "+ Paikka"**. "Kaikki" EI ensimmäisenä eikä oletus (T247). Oletusvalinta avattaessa = "Kärry"/ensimmäinen paikka (`defaultSelection`), muuten "Ei paikkaa". Aktiivi `.active` = accent. "+ Paikka" (`.inv-loc-add` katkoviiva) → **peruttava luonti-modaali** (kuori `.inv-sign-picker`, otsikko "Uusi paikka", nimi-input, footer `[Luo][Peruuta]`, backdrop+Esc — Modal footer -pattern).
- **"Kaikki" = vain koontinäkymä** (T247): näyttää kaikki paikoittain väliotsikoin, EI lisäystä — `.inv-add-hint` "Valitse paikka yltä lisätäksesi tavaraa." Erillinen add-paikkaselect POISTETTU (yksi paikka-totuus = tabit).
- **Minimilisäys** (`.inv-add-row`, vain paikkatabissa): nimi (`flex:1`) + määrä (`width:80px`) + "+ Lisää". Paikka = valittu tabi (konteksti, ei selectiä). Inputit `font-size:16px` (iOS-zoom-esto), 44px.
- **Siirto** (`.inv-d-location` tiedot-editorissa): paikka-`<select>` (sis. "Ei paikkaa") → onEditItem uudella locationId:llä. Ainoa per-item paikka-picker, erillään navigointitabeista.
- **Paikkojen muokkaus** (T248, `.inv-loc-edit-toggle` "✎ Muokkaa" → **peruttava hallinta-modaali** "Muokkaa paikkoja"): rivi per paikka (`.inv-manage-row`) = nimi-`<input>` (`.inv-manage-input`) + "Poista" (`.modal-btn-destructive`, confirm → DELETE, tavarat → "Ei paikkaa" V166). Footer `[Tallenna][Peruuta]`: `Tallenna` firaa rename-PUT:t vain muuttuneille nimille, `Peruuta`/Esc/backdrop hylkää kaiken (ei autosavea). Näkyy vain jos paikkoja on.
- **Määräsäädin** (`.inv-stepper`): `[−]`(`.inv-step-minus`) `[luku]`(`.inv-step-qty` nappi) `[+]`(`.inv-step-plus`), kaikki 44×44px. − clamppaa 0:aan (adjustQty T244). Tap luku → `.inv-step-qty-input` tarkka-syöttö (Enter/blur tallentaa). Muutos persistoituu heti.
- **Rivi** (`.inv-card` + `.inv-card-head`): nimi (resolveItemName V165 — merkillä `.inv-card-name-sign` accent) + stepper. Meta = kommentti (`.inv-card-meta`). Toiminnot: "✎ Tiedot" (`.inv-details-editor`: yksikkö+kommentti sekundäärinä) + "Poista" (confirm V102).
- **Merkki-integraatio** (T246): "+ Merkki kirjastosta" (`#inv-add-sign-btn`) → `.inv-sign-picker` modaali: haku (`.inv-sign-search`) + malli-lista (`.inv-sign-row`) → valinta luo template_id-rivin; "+ Uusi merkki" (`#inv-sign-new`) → uusiokäyttää `SignTemplateModal` (T239) luontitilassa → näkyy heti kirjastossa+kartalla (V165). Merkin luonti EI duplikoi logiikkaa (template-sync + sign-template-modal).
- **XSS (V164):** kaikki user-teksti (name/unit/note/template-label) `textContent`illä.
- LeftPanel-linkki (`.left-panel-link`, `href="/inventory.html"`) — ks. alla vanha huom.
- **Undo-toast (T253, V172/V173):** jokainen mutaatio edit-modessa (poisto, −/+, siirto, paikan poisto) → `showToast` "Kumoa"-toastilla (ks. §K Toast). Client-only: yksi undo-slotti, reload → katoaa. Näkyy vain `viewMode='edit'`. Revert olemassa oleviin `/api/inventory`-reitteihin (POST uudelleen / PUT vanha arvo).

### InventoryStockBadge — "kartalla N" inventaariorivillä (`.inv-card-stock`, T387/V276)
- **Vain merkki-rivillä** (`templateId`): tarvikkeella ⊥ ole karttavastinetta ∴ badge olisi valhe. Sijainti: nimen jälkeen, ennen määrää — `[visuaali] nimi · kartalla N ···· määrä`.
- **Tieto ⊥ toiminto:** `text-muted`, 12px, `tabular-nums`, ⊥ accent, ⊥ nappi. Määrä (`.inv-card-qty`) pysyy rivin ainoana korostettuna lukuna — kaksi vahvaa lukua vierekkäin lukisi kilpailuna.
- **`kartalla 0` on merkityksellinen tulos** (⊥ piilotettavaa): "⊥ vielä kartalla" on juuri se mitä järjestäjä etsii ennen tapahtumaa.
- **Marker-haun kaatuminen ⊥ estä inventaarion latausta** → badge näyttää `kartalla 0`. Näkyvä nolla > sivu joka ⊥ aukea.
- Rooli: järjestäjä. Näkyy sekä read- että edit-modessa (katselutietoa, V169 koskee mutaatioita).

### InventoryLinkPicker — "mitä varastossa on" merkkipohjaa luotaessa (`src/ui/inventory-link-picker.ts`, T399/V288/V289)
- **Sijainti:** nimikentän ALLA luontimodaalissa, ennen Tunnusta — ehdotus seuraa sitä kenttää jota se koskee. Näkyy **vain luontitilassa**.
- **Toissijainen tieto, ⊥ kilpaile nimikentän kanssa:** `.inv-link-suggestion` = `field-tint` + `border-default`, accent vasta hoverissa. Nimi 600, meta (`N kpl · paikka`) `text-muted` oikeassa reunassa. 44px (§A/V268).
- **Ei osumia → kaista katoaa kokonaan** (`.inv-link-suggestions` ⊥ renderöidä). Tyhjä laatikko "ei ehdotuksia" olisi melua kentässä johon käyttäjä on juuri kirjoittamassa.
- **`.inv-link-browse`** katkoviivakehys (sama affordanssi kuin "+ Paikka") tekstillä "Näytä kaikki varastorivit (N)" → `.inv-sign-picker`-kuoren haettava lista **`z-index:5000`** (luontimodaali on 1000).
- **Valinta → `.inv-link-chip`** (accent-reuna + 12% accent-tausta) "Linkitetään: <nimi> (N kpl)" + "Poista valinta"; **ehdotukset väistyvät** — päätös on tehty, lisäehdotukset kutsuisivat epäilemään sitä.
- **Nimi täyttyy siivottuna** (`cleanDisplayName`, T398): "Nuoli irtokyltti, valkoinen tausta" → "Nuoli, valkoinen tausta". Kiinnitystapa kuuluu varastoriville ⊥ merkkipohjan nimeen (V278/V186). Täyttö **ylikirjoittaa aina** — kirjoitettu teksti on hakusana ("bus") ⊥ nimi — ja fokus siirtyy kenttään teksti valittuna ∴ yksi näppäily kirjoittaa yli.
- **V288: valinta ⊥ ole kirjoitus.** PUT ajetaan vasta tallennuksessa & vasta kun template on backendissä. Peruutus ⊥ jätä jälkeä.
- **V289: osio on valinnainen.** Callback puuttuu tai haku hylkää (403 talkoolaiselle kartalla) → osiota ⊥ renderöidä, ⊥ virheilmoitusta. Merkkipohjan luonti on itsenäinen toiminto.
- **XSS (V164):** rivinimet `textContent`. Rooli: järjestäjä. Ei uusia väritokeneja.

### InventoryMergePanel — järjestäjän "Yhdistä"-työkalu (`src/ui/inventory-merge-panel.ts`, T386/V277/V279)

**Ongelma:** 101 inventaariorivistä osa on merkkejä joita ⊥ ole linkattu merkkipohjaan. Nimivertailu osaa ehdottaa, mutta kone ⊥ saa kirjoittaa liitosta (V277) ∴ tarvitaan näkymä jossa ihminen kuittaa rivin kerrallaan.

- **Oma näkymä, ⊥ inventaariosivun laajennus.** `inventory-page.ts` on jo pilkkorajalla; yhdistämisellä on oma tilansa (kuittausjono) joka ⊥ kuulu listasivulle.
- **Avaus:** `.inv-merge-open` "🔗 Yhdistä (N)" `.inv-mode-toggle`n naapurina `#inventory-header .inventory-header-actions`issa, **vain edit-modessa** (V169). Sekundäärityyli (`field-tint` + `border-strong`) — moodi-toggle säilyy ainoana accent-päänappina. **N = laskuri KOKO inventaariosta** (⊥ vain valitusta paikasta): laskuri itse on työkalun arvo — järjestäjä näkee että työtä on jäljellä & milloin se loppui. `N=0` → nappi disabloitu, `title="Kaikki rivit yhdistetty"`.
- **Paneeli** (`.inv-merge-backdrop` + `.inv-merge-panel`, `role=dialog`): `min(720px, 96vw)`, `max-height:88vh`, oma vieritys listassa. Leveämpi kuin `.inv-sign-picker` (480px) — rivillä on nimi + 3 ehdotusta + 3 toimintoa. Header: otsikko + `.inv-merge-count` "N riviä" + "Sulje".
- **Rivi** (`.inv-merge-row`): `.inv-merge-row-name` (nimi, 600) + `.inv-merge-row-meta` "`N kpl · <paikka>`" → paikka on näkyvissä koska se ratkaisee yhdistämisen (sama kyltti eri paikassa ⊥ ole duplikaatti).
- **Ehdotukset** (`.inv-merge-suggestion`, max 3, `min-height:44px` §A/V268): `buildMarkerVisual` 32px + label. Accent-reuna = "tämä kirjoittaa jotain". **Vain kynnyksen (`SUGGESTION_THRESHOLD`) ylittävät** — heikko arvaus houkuttelisi väärään linkitykseen & väärä liitos on pahempi kuin puuttuva (V276). Ei osumia → `.inv-merge-nosug` "Ei ehdotuksia".
- **V277 — kolme tietoista rajaa:** ⊥ esivalintaa (mikään ehdotus ⊥ ole valmiiksi valittu), ⊥ checkboxeja, **⊥ "linkitä kaikki varmat" -massanappia**. Jokainen rivi kuitataan erikseen. Tämä on regressiovahdittu DOM-testissä.
- **Toiminnot** (`.inv-merge-actions`, `.inv-btn`-pohja): "Luo merkkipohja" (→ `SignTemplateModal` luontitilassa, esitäytetty nimi) · "Ei merkki" (`.inv-merge-notsign`, muted → PUT `not_sign=1`, rivi katoaa **pysyvästi**, V279) · duplikaattitapauksessa `.inv-merge-dup` (accent-reuna) "Yhdistä riviin X (N+M)" — määrät näkyvissä ETUKÄTEEN, koska summaus ⊥ ole peruttavissa yhtä helposti kuin linkitys.
- **Kestää keskeytyksen:** jokainen kuittaus persistoituu HETI omalla pyynnöllään — **⊥ "Tallenna kaikki" -nappia**. 101 rivin urakka ⊥ mahdu yhteen istuntoon ∴ sulkeminen kesken ⊥ saa hukata tehtyä työtä. Kuittaus poistaa rivin listalta paikallisesti (⊥ koko sivun reloadia → vierityskohta säilyy); sulkeminen reloadaa listan & laskurin.
- **Virhe (V21):** epäonnistunut pyyntö → rivi JÄÄ listalle + `.inv-merge-error` (`danger-soft`-tausta, `role=alert`) kertoo **MIKSI** suomeksi (backend-koodi käännettynä, tuntematon → status+koodi). Hiljainen epäonnistuminen olisi pahin mahdollinen: järjestäjä luulisi työn tehdyksi.
- **Undo:** `showToast` "Kumoa" (ks. §K Toast, V172 yksi slotti) linkitykselle & "Ei merkki":lle → palauttaa rivin ENNEN-tilaan ja listalle. Merge ⊥ saa Kumoaa: lähderivi on poistettu serveriltä ∴ kumous vaatisi rivin uudelleenluonnin — siksi määrät näytetään napissa etukäteen.
- **Tyhjätila:** `.inv-merge-empty` "Kaikki rivit yhdistetty ✓".
- **XSS (V164):** kaikki nimet `textContent`.
- **Rooli: järjestäjä, desktop ensisijainen** — 101 rivin läpikäynti ⊥ ole kärry-mobiilityötä. Mobiili välttävä: `≤560px` paneeli täysleveä + toimintonapit venyvät riville.
- **Ei uusia väritokeneja** — accent / field-tint / border / danger §C:stä.

### Toast — jaettu (`src/ui/toast.ts`, T253)
- **Idiomi = snackbar:** kelluva ilmoitus alareunaan keskitettynä (`position:fixed; left:50%; transform:translateX(-50%); bottom:16px + safe-area-inset-bottom`). `z-index:5000` (modaalien 4000 yläpuolella, auth-gate 9999 alapuolella).
- **Kiinteä tumma tausta MOLEMMISSA teemoissa** (EI teemakäänteinen): `--toast-bg #1F2A24` / `--toast-fg #F6F9F5`. Syy: jos bg kääntyisi (`--text-body`), accent-action jäisi dark-teemassa vaalealle pohjalle → 2.87:1 FAIL. Kiinteä tumma → action säilyy AA:na. **Nämä tokenit EIVÄT saa mennä `:root[dark]`-overrideen.**
- **Action-nappi** (`.toast-action`, esim. "Kumoa"): `--toast-action #FF7A54` (kirkastettu accent → **5.77:1** tummalla toast-bg:llä, AA ✓), `font-weight:700`, `min-height:44px min-width:44px` (§R touch-target), focus-visible accent-outline.
- **Viesti** (`.toast-msg`): `--toast-fg` (~14:1), yksirivinen `text-overflow:ellipsis; white-space:nowrap` (`flex:1; min-width:0`) → pitkä nimi katkeaa siististi, ei rivitä toastia korkeaksi. User-teksti `textContent` (V164).
- **Kesto:** auto-dismiss 5000ms; uusi `showToast` korvaa edellisen + resetoi timerin (yksi kerrallaan). `toast-in`-animaatio 160ms + `prefers-reduced-motion:reduce`→ei animaatiota.
- **A11y:** `role=status` + `aria-live=polite` (ei keskeytä ruudunlukijaa, mutta ilmoittaa).
- Rooli: molemmat (nyt järjestäjä/admin inventaariossa; jaettu → talkoolaisen flowt voivat uusiokäyttää).

### AuditLogPage (`loki.html` + `src/loki.ts` + `src/ui/audit-log-page.ts` + `src/audit-log.css`, T321/V231)
- **Oma entrypoint** admin/inventaario-mallin mukaan — rooligate `admin|järjestäjä` (talkoolainen → `renderForbidden`). EI osa `admin.html`:ää: se gettaa koko sivun adminiin, ja järjestäjä on tämän näkymän pääkäyttäjä.
- **Omat tyylit** (`src/audit-log.css`, importattu `src/loki.ts`:stä) — ⊥ riviäkään `style.css`:ään. Tokenit peritään `:root`ista, arvoja ⊥ kopioida (V81-linja).
- `#loki-app`: `max-width:1100px;margin:0 auto;padding:16px` — leveämpi kuin admin (960px), koska rivillä on 6 saraketta ja järjestäjä katsoo desktopilla.
- **Rivi** (`.audit-row`): CSS-grid `tekijä │ teko │ pätkä │ aika │ poikkeama │ toiminnot`, `surface-card` + `border-card`, `radius 10px`. Uusin ensin.
- **Rooli-badge** (`.audit-role-badge`): pilleri `--status-*`-tokeneista — talkoolainen `--status-tarkistettu` (sininen), järjestäjä `--status-asetettu` (vihreä), admin `--status-keratty` (violetti). ⊥ omia värejä.
- **Poikkeama** (`.audit-deviation`): metrit `font-variant-numeric:tabular-nums` + `text-align:right` → suuruusluokat asettuvat allekkain silmäiltäviksi. >100 m → `.audit-deviation-warn` (`--danger-text`, 700). Raja perustuu 2026-07-25 dataan: pienin vahinkosiirto 1272 m, suurin laillinen tarkennus 15 m.
- **Suodattimet** (`.audit-filters`): rooli/tekijä/pätkä `<select>` + alkaen/päättyen `<input type=date>`, kaikki `min-height:44px` (§R). Tekijä- ja pätkävalikot rakentuvat DATASTA, ⊥ kiinteästä listasta.
- **Peruutus** (`.audit-undo`): `.btn.btn-secondary`, `min-height:44px`, `window.confirm` ennen (tuhoava, V102). Virhe → `.audit-status` (`aria-live=polite`) kertoo MIKSI (jo peruttu / merkki kadonnut / ei oikeutta / verkko) — ⊥ hiljaista epäonnistumista (V21).
- **Tyhjätila** (`.audit-empty`): "Ei muutoksia näillä ehdoilla." — suodatin joka ei osu ⊥ saa näyttää rikkinäiseltä sivulta.
- **Mobiili** (<768px): rivi → kortti `grid-template-areas`illa (tekijä+poikkeama, teko, pätkä+aika, toiminnot). Järjestäjän mobiili = välttävä toiminta (VISION), ⊥ täysoptimointi.
- Rooli: järjestäjä/admin.

### InventoryPage (v1-huom, `inventory.html`, T242)
- Erillinen entrypoint /admin-mallin mukaan — vain järjestäjä/admin (V163, talkoolainen → `.inv-forbidden`). Ei jaa `#app`-runkoa.
- `#inventory-app`: `max-width:720px;margin:0 auto;padding:16px` — kapeampi kuin admin (960px), koska mobiili-primääri (järjestäjä puhelimella kärryllä).
- Header (`#inventory-header`): otsikko "Inventaario" + "← Kartta" (`#btn-inventory-back`) + "Kirjaudu ulos" — molemmat `min-height:44px`, `field-tint`/`border-strong`.
- Lisäyslomake (`.inv-add-form`, ylhäällä): `surface-raised` kortti. Kentät pystyssä (`.inv-fields` flex-column): Nimi/Määrä/Yksikkö/Sijainti/Kommentti. Inputit `.inv-field input` **`font-size:16px`** (iOS-zoom-esto fokusoinnissa), `min-height:44px`, `surface-app` tausta, `accent`-focus-outline (auth-malli). "+ Lisää" (`.inv-btn-primary`): `width:100%`, `accent`-tausta.
- Virheteksti (`.inv-error`): `danger-soft`/`danger-text` — client-validointi (T241) ennen POSTia.
- Tavarakortit (`.inv-card`, alla): `surface-raised`, per rivi. Päärivi (`.inv-card-main`): nimi (`.inv-card-name` 15px/600, `word-break`) + määrä+yksikkö (`.inv-card-qty` `accent`, `white-space:nowrap`). Meta (`.inv-card-meta` 12px `text-muted`): 📍 sijainti · kommentti. Napit `.inv-btn-edit`/`.inv-btn-delete` (`danger-text`), `min-height:44px`.
- Muokkaus = inline (`.inv-card.editing`): kortti korvautuu samalla kenttäjoukolla + Tallenna/Peruuta. Ei erillistä modaalia.
- **XSS (V164):** kaikki user-teksti (name/unit/location/note) `textContent`illä — ⊥ `innerHTML`-interpolaatiota. Malli admin-page.ts.
- LeftPanel-linkki (`.left-panel-link`, `#btn-inventory-link` "📦 Inventaario", `href="/inventory.html"` — toimii sekä vite-dev että nginx-prod; `/inventaario` on vain nginx-alias prodissa, vite-dev SPA-fallback serveeraisi sille index.html:n). Asuu `#left-panel-content`issa → automaattisesti piilossa talkoolaiselta (LeftPanel `display:none` talkoolaiselle, T229). `min-height:44px`, `field-tint`.
- Ei uusia väritokeneja — reuse §C (accent/field-tint/border/danger/surface).

### SegmentOverlay (Leaflet-layer, `src/map/segment-overlay.ts`)
- **T152/V96: kaksi visuaalista kanavaa erikseen** — väri = *tunniste* (kuka), viivatyyli = *status* (missä vaiheessa). Järjestäjä lukee molemmat yhdellä silmäyksellä (VISION UX-testi).
- **Väri = tunniste, stabiili per `segment.id`**: `colorForSegment(id)` (`src/logic/segments.ts`) hashaa id → SEGMENT_COLORS-indeksi. EI lista-indeksi — pätkän poisto ei saa vaihtaa muiden värejä. Törmäys (sama hue) ok, tooltip-nimi erottaa.
- **T348/V96-amend: `valmis` OHITTAA tunnistevärin** — kartan viiva ottaa värinsä `segmentLineColor(id, state)`ista (`src/logic/segments.ts`): valmis → `SEGMENT_DONE_COLOR` = `--confirm`-peili `#1F8A50`, muut → `colorForSegment(id)`. Perustelu: valmiin pätkän identiteetti ei enää kanna tietoa, status kantaa. **Vihreä sävyperhe on varattu tälle kanavalle** — SEGMENT_COLORS ei saa sisältää vihreää (T304-paletti). Sivupalkki/lista käyttää yhä `colorForSegment`ia (tunniste ilman status-kontekstia) ∴ rivin väri ei vaihdu valmistumisesta.
- **Viivatyyli = status** (`segmentLineState(getPhaseProgress(seg, markers))`, kolme ämpäriä, `LINE_STATE_STYLE` `src/map/segment-overlay.ts`):
  - `valmis` → ehjä, `opacity: 0.9, weight: 11` (ei dashArray)
  - `kesken` → karkea katko, `opacity: 0.85, weight: 11, dashArray: '10 8'`
  - `ei_alkanut` → harva katko, kevyin, `opacity: 0.7, weight: 9, dashArray: '6 12'`
  - **Alfa-alaraja (UX-audit 2026-07-27):** kartan viivan efektiivinen kontrasti vaaleaa MML-taustaa (`#F2F0EA`) vasten ≥ 3:1 (WCAG non-text). `opacity 0.4` antoi `#7A4E9C`:lle 1.79:1 ∴ "ei aloitettu" katosi kirkkaassa — ja se on juuri se tila jonka järjestäjän pitää bongata. 0.7 = 3.0:1. Mitatut: valmis 3.83, kesken 3.57, ei_alkanut 3.0.
  - **V252/B135:** viivanpätkä ! olla aukon kokoluokkaa. Vanha `'1 9'` (1px viiva, 9px aukko) MOLEMMISSA katkotiloissa hajosi pistesarjaksi joka katosi maastokartan tekstuuriin ∴ tilat erottuivat käytännössä vain valmiin ehjyydestä. Kolmen tilan ! erottua myös **akromaattisesti** (ehjä / karkea katko / haalea harva katko), ei vain leveydellä tai värillä.
- `update(store, markers)` — tarvitsee merkit progressiin. Kutsutaan sekä segmentin mutaatiosta ETTÄ merkin status-muutoksesta (`main.ts` MarkerManager onUpdate) — muuten kartan status jää jälkeen.
- **valmis-pätkä: tooltip-nimeen `✓`-PREFIX kaikissa phaseissa** (T348 — ennen: vain `phase==='tarkastus'`). Nimi voi katketa lapun leveyteen, merkki ei saa ∴ prefix, ei suffix. Positiivinen tila tarvitsee positiivisen merkin: "valmis" ei saa olla pääteltävissä vain katkon PUUTTUMISESTA (V252).
- DisplayName: pysyvä tooltip `permanent: true`, CSS-class `segment-label` → oma sopimus **SegmentLabel** alla
- **Aukko (gap) = PALJAS REITTIVIIVA** (T378/V273/B159 — oma render POISTETTU). Pätkä on värillinen casing; sen puuttuminen ON aukko. Vanha harmaa aukkoviiva (`#94a3b8`, `weight 8`, `opacity 0.3`) oli kolmas visuaalinen kanava reitin & pätkän päällä ja mitattavasti näkymätön maastokartalla — järjestäjä pyysi 2026-07-28 ominaisuutta joka oli koodissa jo vuoden. Aukon havaittavuus ratkeaa PÄTKÄN kontrastilla (alfa-alaraja yllä ≥3:1), ⊥ aukon omalla tyylillä: yksi säädin ⊥ kaksi. Jos aukko ⊥ erotu, korjataan pätkän kontrasti — aukkoviivaa ⊥ palauteta.
- SEGMENT_COLORS (6 väriä, **paletti ei saa sisältää route-värejä** `#f59e0b`/`#8b5cf6`):
  ~~`['#10b981', '#ec4899', '#3b82f6', '#ef4444', '#06b6d4', '#64748b']`~~ **VANHENTUNUT** — todellinen paletti on §C:n 4 väriä `['#2F6FB0', '#7A4E9C', '#0E9594', '#B5476B']` (`src/logic/segments.ts:274`). ⚠ Sääntö "paletti ei saa sisältää route-värejä" on RIKKI: `#2F6FB0` = pätkäväri 1 = `smtb-55`-reittiväri (`route-defs.ts:12`) ∴ pätkä ja reitti näyttävät samalta juuri siinä kohtaa missä ne ovat päällekkäin. Korjataan T304:n paletti-päätöksen yhteydessä (V216), ei erikseen.

### SegmentLabel — pätkän nimilappu kartalla (`.segment-label`, `segmentLabelOptions()` `src/map/segment-overlay.ts`) ✓ T347

**Konsepti:** lappu on pätkän ainoa luettava kohde kartalla ∴ se on myös sen sisääntulo. Sama sopimus kuin §K LeftPanel "Item — label: klikkaus = toiminto" (V250) — nimi joka näyttää siltä että sitä luetaan, mutta ei reagoi, on kuollutta pintaa keskellä karttaa.

| Ominaisuus | Arvo |
|---|---|
| Tausta | `rgba(15,23,42,0.85)` — **kiinteä navy, ⊥ teemamuuttuja** |
| Teksti | `#fff` AINA (B106: tausta ei vaihdu teeman mukana ∴ `var(--text-body)` teki lapun lukukelvottomaksi vaaleassa teemassa) |
| Typo | `11px / 700`, `var(--font-ui)` |
| Padding | `6px 8px` (~26px korkea lappu) |
| Reuna | `1px solid rgba(255,255,255,0.15)`, `radius-sm`, `box-shadow 0 2px 8px rgba(0,0,0,0.4)` |
| Osoitin | `cursor: pointer` **vain** `.segment-label.leaflet-interactive` |
| Himmeä (`--dim`) | `opacity: .4`, `font-weight: 600`, `pointer-events: none` |
| Zoom-skaala ✓ T419/V309 | `font-size`/`padding` = `calc(… * var(--label-scale, 1))`, `--label-scale` 0,25 @ zoom ≤12 → 1,0 @ ≥16 (`segmentLabelScaleForZoom`). **⊥ `transform`** — Leaflet omistaa tooltipin `transform`in. Pilleri kutistuu tekstin MUKANA. Skaala on AJON tilaa (`segment-overlay.ts` asettaa) ⊥ `segmentLabelOptions()`in luokkajonossa |
| Valmis (`--done`) ✓ T348/T349 | `border: 2px solid var(--segment-done)` (**ei `--confirm`** — B136/V253, karttapinta-token) + `padding: 5px 7px` (reunan kasvu kompensoitu ∴ osumapinta säilyy) + teksti saa `✓ `-prefixin (`segment-overlay.ts`). **Tausta pysyy kiinteänä navynä & teksti valkoisena** — vihreä tulee VAIN reunuksesta (B106: lapun tausta ei seuraa teemaa ∴ vihreä tausta rikkoisi kontrastisopimuksen) |

- **`--dim` & `--done` eivät ole toisensa poissulkevia** (T348): talkoolaisen konteksti-lappu voi olla valmis ∴ luokkajono kootaan yhdessä paikassa (`segmentLabelOptions(interactive, done)`), ei kutsupaikalla.
- **Klikattavuus tulee yhdestä lähteestä:** `segmentLabelOptions(style.interactive)` saa saman `interactive`-lipun kuin polyline (`contextSegmentStyle`, V142) ∴ talkoolaisen näkymässä vain oma pätkä on klikattava — muiden lappu on läpäisevä (kaksi lukkoa: Leaflet-optio + `pointer-events:none`).
- **Klikkiä EI kytketä tooltipiin.** Leaflet tekee `addEventParent(this._source)` tooltipin avautuessa ∴ lapun klikki propagoi polylinelle ja olemassa oleva `line.on('click')` avaa `SegmentDetailsModal`in. Oma kuuntelija lapulle = modaali avautuu kahdesti.
- **44px-poikkeus (§A/§R) — tietoinen ja kirjattu.** Kartan nimilappu ei täytä 44px-minimiä. Perustelu: 44px-lappu peittäisi naapuripätkän reitin tiheässä ruudukossa (lappu on kartan sisältöä, ei chromea); tämän sisääntulon käyttäjä on **järjestäjä** (desktop + hiiri); talkoolaisen mobiilipolku ei riipu tästä — hänen kontekstilappunsa ovat ei-klikattavia ja oma pätkä avautuu herosta/sivupalkista, jotka täyttävät 44px:n. Poikkeus koskee VAIN karttalappua — ⊥ yleistä sitä muihin komponentteihin.
- **Lappu SKAALAUTUU zoomin mukana & ⊥ KATOA MILLOINKAAN** (T419/V309, kumoaa T418:n piilotusportin): sama kohtelu kuin merkki-ikonilla (`marker-scale.ts` — kaaret asuvat samassa tiedostossa vierekkäin). 0,25× kaukana (~2,8px teksti = tumma tahra: pätkän paikka & määrä näkyvät, nimi ⊥ ole luettava — 15 luettavaa nimeä yhtä aikaa ON ratkaistava ongelma) → 1,0× zoomilla ≥16. Talkoolaisen OMA pätkä on aina 1,0× (luettavuus metsässä). Perustelu piilotusta vastaan: piiloutuva nimi tekee kartasta arvoituksen & merkit eivät katoa sekään ∴ lappu ⊥ saa olla ainoa kerros joka katoaa — ongelma oli lapun KOKO kaukana, ⊥ sen olemassaolo. Skaala ! olla MITATTU pikseleinä (V303-linja): `e2e/t419-label-scale.spec.ts`.
- Käyttäjä: järjestäjä.

### MarkerFocus — fokus-/himmennystila kartalla (`src/map/markers.ts` + `.marker-dimmed`) ✓ T334/T335

**Konsepti:** yksi primitiivi, kaksi laukaisinta. Fokus = "nämä merkit ovat sinun tehtäväsi nyt"; kaikki muut jäävät näkyviin taustaksi (kartta ei valehtele — merkki on olemassa) mutta lakkaavat kilpailemasta huomiosta. Sama visuaalinen kieli kuin `contextSegmentStyle` (V142) tekee jo pätkäVIIVOILLE.

- **Laukaisin A — talkoolainen (`/s/<slug>`):** automaattinen, EI kytkintä. Oman pätkän merkit täysillä, muut himmeinä. VISION "max 2 nappia" ∴ talkoolaiselle tämä ei ole valinta vaan oletus. Sama lähde kuin viivoille: `contextOwnId`.
- **Laukaisin B — järjestäjä:** eksplisiittinen kytkin, **oletus POIS** (järjestäjä tarvitsee kokonaiskuvan; §P "tilanne yhdellä silmäyksellä").
  - Koti: `SegmentDetailsModal` toimintorivi — `.btn.btn--ghost` `aria-pressed`, teksti `◎ Korosta vain tämä pätkä` ↔ aktiivina `◉ Korostus päällä`. Yksi koti, EI rinnakkaista kytkintä `SegmentPanel`-riviin (kaksi sisääntuloa samaan tilaan = kaksi eri mieltä olevaa indikaattoria).
  - **Poistuminen on pakollinen ja näkyvä:** modaali suljetaan mutta korostus jää → kartalle `.map-mode-pill`-kuvion mukainen pilleri `Korostus: <pätkän nimi> ✕` (T308/V219, sama komponenttisopimus). Ilman pilleriä tila jää päälle eikä käyttäjä tiedä miksi kartta on haalea — sama umpikuja-luokka kuin B131.
- **Himmennysarvo:** `opacity: 0.4` **+ `filter: grayscale(1)`**. ⊥ käytä viivojen `CONTEXT_DIM_OPACITY 0.22`:ta merkeille: viiva on satoja pikseleitä pitkä, merkki 40×48px ∴ sama alfa katoaa kokonaan ilmakuvan päältä auringossa. Kaksi kanavaa (alfa + värikylläisyys) antaa saman "taustalla"-viestin matalammalla alfa-hinnalla. Harmaasävy on tässä oikea sivutuote: väri = identiteetti (tyyppiväri V87, pätkäväri), ja fokuksen ulkopuolella identiteettiä ei tarvitse lukea.
- **Fokusoituja merkkejä EI korosteta ylöspäin** (ei hehkua, ei skaalausta) — `.marker-next-highlight` (T256/V178) on jo varattu "seuraava merkki" -tasolle. Kolme kilpailevaa korostustasoa samalla kartalla ⇒ ei yhtään.
- **Status- ja tyyppikieli säilyy:** himmennetty kortti pitää muotonsa, kärkensä ja reunatyylinsä (katkoviiva = suunniteltu, solid = status, V51/V87). Grayscale vie sävyn, ⊥ rakennetta ∴ "tehty vs tekemättä" luettavissa myös himmennettynä.
- **Klikattavuus (T416/V306 amendaa tämän):** lukko on **kolmiarvoinen** (`FocusLock = 'vapaa' | 'claimable' | 'locked'`, `src/map/markers.ts`) ⊥ boolean. Järjestäjä → `'vapaa'`: himmennetty merkki **pysyy täysin klikattavana** (hän omistaa kaiken; korostus on lukemisen apu, ei lukko). Talkoolainen → `'claimable'`: himmennetty merkki ottaa **TASAN YHDEN** klikin joka avaa `MarkerClaimSheet`in ("➕ Lisää tehtävääni") — `pointer-events:auto` + `cursor:pointer`, luokka `.marker-dimmed--claimable`. Muu on yhä kiellettyä: ⊥ raahausta (`draggableFn`, V150), ⊥ statuskuittausta, ⊥ kenttämuokkausta, ⊥ poistoa & klikki EI mene `MarkerDetailModal`iin (siinä on muokkauskentät joita hän ⊥ omista, V93/V150). `'locked'` (`pointer-events:none`) on jäljellä täydelle read-onlylle & on myös se mihin `'claimable'` putoaa jos käsittelijää ⊥ ole kytketty (kyky on opt-in). Luokat ovat toisensa poissulkevia — `--claimable` ⊥ ole `--locked`in puute.

### MarkerClaimSheet (`.marker-claim-sheet`, `src/ui/marker-claim-sheet.ts`) ✓ T416/V306
Himmennetyn merkin ainoa toiminto talkoolaiselle. **⊥ ole karsittu MarkerDetailModal** vaan eri pinta eri oikeuksilla.
- **Bottom sheet, ⊥ keskitetty modaali:** napautus tuli KARTALTA ∴ vastaus tulee alalaidasta & jättää kartan näkyviin (sama kuvio kuin `.marker-overview` ≤700px, B160/V274). `z-index:3001` backdropin (`3000`) päällä; `padding-bottom: calc(14px + env(safe-area-inset-bottom))`. ≥701px → kortti keskellä alalaitaa (`width:min(420px,94vw)`, `bottom:16px`) — järjestäjä voi olla talkoo-layoutissa desktopilla (T274).
- **Sisältö on suljettu lista:** `buildMarkerVisual` (T198, `size:40`) + merkin nimi + rivi joka NIMEÄ kohteen ("Ei kuulu tehtävääsi — lisätään tehtävään *X*") + `[➕ Lisää tehtävääni]` (`.btn--confirm`, `min-height:52px`) + `[Sulje]` (`.btn--secondary`, `min-height:44px`). **Kolmas toiminto tai mikä tahansa `input`/`textarea`/`select` rikkoo V306:n** — Taso 2 -testi mittaa sen (`tests/t416-claim-sheet.test.ts`).
- Esc & backdrop-klikki sulkevat mutatoimatta. Kuuntelija irtoaa sulkemisessa (⊥ vuotavaa `keydown`ia, B92-luokka). Esc on tässä oma kuuntelija ⊥ `main.ts`:n ketjussa: lehtinen on hetkellinen & päällimmäinen pinta ∴ ⊥ kilpailijaa samasta näppäimestä.
- Käyttäjä: talkoolainen metsässä.
- **Suhde pohjakartan slideriin (T287/V201):** kaksi riippumatonta kontrollia. Merkkien himmennys ⊥ skaalaa slider-arvon mukaan (⊥ kertolaskua) — 30 % pohja + 0.4 merkki on luettava (valkoinen paperi taustalla), 100 % pohja + 0.4 merkki on se raja johon arvo on kalibroitu. Slideri koskee `tilePane`a, fokus `markerPane`a — ⊥ jaettua tilaa.
- **Toteutus:** CSS-luokka Leafletin `divIcon`-elementtiin (`getElement().classList.toggle('marker-dimmed')`), ⊥ ikonin uudelleenluontia (`createSignIcon`) — uudelleenluonti nollaa `.marker-next-highlight`in ja vilkuttaa koko kartan. `transition: opacity .12s, filter .12s` — riittää pehmentämään, ⊥ hidasta kenttäkäytössä.
- **Toteutunut (T335):** luokkapari `.marker-dimmed` (himmennys) + `.marker-dimmed--locked` (talkoolaisen read-only) — rooli päätetään wiringissä, ei CSS:ssä arvattuna. Kytkin `.btn.btn--ghost.btn-segment-focus-toggle` (täysleveä, `aria-pressed` näkyy myös accent-kehyksenä, V197). Pilleri `#marker-focus-pill` (`.map-mode-pill`-kuvio) teksti `Korostus: <nimi>` + ✕ 44×44 (§A); pilleri itse `pointer-events:none`, vain ✕ ottaa klikin. Muokkaustilan pilleri on yhtä aikaa näkyvissä → korostuspilleri `top:48px` kun `body[data-map-mode="muokkaus"]`.
- Käyttäjä: talkoolainen (automaattinen), järjestäjä (kytkin).

### SegmentCasing — pätkä reitin päällä, kaksi kanavaa (`src/map/segment-overlay.ts` + `src/logic/segment-style.ts`) ✓ T336

**Ongelma:** pätkä piirtyi yhtenä `weight: 11` -viivana reitin PÄÄLLE ∴ reitti-identiteetti katosi juuri pätkän kohdalta — ja jos pätkäväri sattui olemaan sama kuin reittiväri, pätkää ei erottanut lainkaan.

**Sopimus — kolme viivaa samalle geometrialle, piirtojärjestyksessä:**

| Kerros | Väri | `weight` | Näkyvä osuus | Kantaa |
|---|---|---|---|---|
| casing | pätkäväri (`segmentLineColor`, T348) | 15 | 2px/puoli | tunniste + **status** (`dashArray`, `opacity`) |
| erotin | `#FFFFFF` | 11 | 1px/puoli | kontrastin kummallekin |
| sisus | reitin väri (`ROUTE_DEFS` ← `segmentPrimaryRouteId`) | 9 | 9px | mikä reitti tämä on |

- **Erotin ei ole koriste (B137).** Ilman sitä reunus ja sisus ovat vierekkäin, jolloin V244 vaati niiden väliltä ≥3:1 — ehto joka osoittautui **ylimääritellyksi**: reittiväri on lukittu kaistaan jonka toisessa päässä on taustakartan kontrasti ja toisessa reittipillerin tekstin kontrasti, eikä mikään pätkäpaletti täytä 3:1:tä kaikille pareille (mitattu huonoin **2.19**). Valkoista vasten kumpikin saa ≥3.4:1 (reitit 3.40–5.23, pätkät 11.49–11.64). Halo on ohut tarkoituksella — paksuna se lukisi valkoisena viivana kartalla.
- **Statuskieli elää casingissa**, sisus pysyy ehjänä: katkoviivainen sisus paljastaisi pohjakartan keskeltä viivaa ja hajottaisi kuvion.
- **Vain casing ottaa klikin.** Erotin ja sisus ovat `interactive: false` ∴ klikki läpäisee niistä alle — kolme kerrosta ei saa olla kolme kuuntelijaa (T347:n opetus). Nimilappu sidotaan samaan casing-viivaan.
- **Reititön tehtävä (V139)** ja **talkoolaisen himmennetty konteksti-pätkä (V142)** → yksi viiva kuten ennen: edellisellä ei ole sisusta jota kehystää, jälkimmäiselle ei anneta korostuksen kieltä.
- Tyylit tulevat puhtaalta `segmentLayerStyles()`-funktiolta (`src/logic/segment-style.ts`) valmiiksi järjestettynä — Leaflet vain soveltaa. Kaikki kerrokset samaan `this.layers`-listaan ⇒ `clear()` poistaa kolmikon, ei jätä orpoa viivaa.

**Pätkän raja — kolmas kanava (T464/V352/V353, B200).** Casing kertoo KENEN pätkä, ei sitä MISTÄ MIHIN se ulottuu. Tuotannossa 13 purkupätkää jaettiin 4 värin paletista hashilla ∴ kolme peräkkäistä sai saman värin ja 16 km luki yhtenä viivana.

| Osa | Arvo | Kantaa |
|---|---|---|
| tunnisteväri | `assignSegmentColors()` — ahne intervallivärjäys, ryhmä (`phase` + primary-reitti) | naapurista erottuminen |
| rako | `SEGMENT_END_GAP_M = 12` m molemmista päistä | raja geometriana |
| päätepiste | `r = 5`, `stroke #FFFFFF` `2px`, `fill` = pätkän oma väri, `interactive: false` | "mistä mihin" |

- **Väri on suhde naapuriin, ei funktio id:stä (V352).** Paletti (`SEGMENT_COLORS`, T304-kalibrointi) pysyy ennallaan — 4 väriä riittää kunnes viisi pätkää on päällekkäin yhtä aikaa, koska ahne värjäys aloitusjärjestyksessä on intervalligraafilla optimaalinen. Hinta: pätkän lisäys/poisto **saa** vaihtaa naapureiden värejä (V96-amend). Vakaus palvelee muistia, erottuvuus lukemista — samanvärinen naapuri tekee kartasta väärän, ei vain epämukavan.
- **Rako on metreissä, ei pikseleissä.** ~1.5 px zoomilla 13, ~12 px zoomilla 16 ∴ se katoaa kaukaa jossa sitä ei tarvita (kaukaa luetaan väriä) ja on selvä läheltä jossa raja kiinnostaa. Rako on **presentaatio**: `sliceRoutePoints` ja sen kanssa identtinen `deriveTrackFromBounds` (V258/V260) pitävät km-rajansa pikselilleen — jälki on dataa.
- **Päätepiste istuu piirretyn viivan päässä, ei km-rajalla.** Jaetulla rajalla molemmat pätkät piirtävät omansa; täsmälleen samaan pisteeseen asetettuina ne peittäisivät toisensa ja raja katoaisi taas. Rako pitää ne erillään.
- **Ei klikattava.** `interactive: false` ∴ merkki ei varasta klikkiä casingilta eikä viritetyltä sijoitukselta (V345/T460) vaikka Leaflet piirtää sen viimeisenä.
- **Kaksi peruuttamista lähtötilaan:** lyhyt pätkä (`≤ 4 × gap`) ja harva GPX (kavennettu siivu < 2 pistettä) piirtyvät ilman rakoa. Näkyvä väärä raja on parempi kuin näkymätön pätkä.



**Regressiosuoja (V88):** `getSegmentStatusCounts()` (src/logic/segments.ts) yksikkötestaus ei riitä — T95 hävisi juuri koska pelkkä logiikkatesti jäi vihreäksi vaikka kutsupaikka katosi UI:sta. Pakollinen lisäksi: Vitest-jsdom-testi joka rakentaa oikean `main.ts`-wiring-polun (ei eristettyä komponenttia) ja tarkistaa että `#segment-status-bar` DOM-teksti sisältää oikean lukumäärän segmentStoren mutaation jälkeen. Tulevat refaktorit jotka koskevat `#map-area`-lasten järjestystä tai `SegmentPanel`/`segment-view`-riviä eivät saa läpäistä testejä jos tämä kutsu putoaa pois.

---

### GpsControl (`#gps-control`, `src/ui/gps-control.ts`) — paikannus kartalla ✓ T407/V294

Talkoolaisen kriittisin kenttätoiminto oli ⋯-valikossa = 3 napautusta (⋯ → GPS → sulje valikko)
∴ se rikkoi VISION §Talkoolainen "max 2 napin päässä". Kartalla on **TASAN yksi** pysyvä kontrolli
joka on **sekä laukaisin että tilanäyttö** — erillinen indikaattori olisi toinen totuus samasta
tilasta (B133-luokka).

- **Sijainti:** `position:absolute; right:8px; bottom:var(--gps-control-bottom, 24px)`, `z-index:1100`
  (Leaflet-panet 200–700 & talkoolaisen hero 1000 yllä, modaalit 3000 alla). 24px oletus jättää
  Leafletin attribuutiorivin luettavaksi (lisenssiehto).
- **Hero väistetään MITATTUNA:** `gps-control.ts` tarkkailee `#segment-view-container`ia
  `ResizeObserver`illa ja kirjoittaa `--gps-control-bottom = heroH + 16px`. ⊥ kiinteää `46vh`-arvausta:
  hero kutistuu sisällön mukaan → nappi jäisi leijumaan keskelle ruutua.
- **Koko:** `min-height/min-width:48px` — §R:n 44px + hanskamarginaali. `radius:999px`,
  `surface-card`, `padding:0 14px`, `box-shadow: 0 2px 10px rgba(0,0,0,.22)`.
- **Neljä tilaa, kaksi kanavaa kummassakin (reuna + tintti)** — aurinko pesee värit, hanskat
  estävät tarkan katseen ∴ tila erottuu SANOIN, ⊥ pelkällä värillä:

  | tila | teksti | reuna | tausta |
  |------|--------|-------|--------|
  | `pois` | `📍 GPS` | 1px `border-strong` | `surface-card` |
  | `haetaan` | `📍 Haetaan…` | 1px `--warn` | `--warn-highlight` + 1,4 s pulssi |
  | `vapaa` | `📍 Keskitä` | 2px `--gps-active` | `surface-card` (reuna = "GPS on", tintin puute = "⊥ seuraa") |
  | `seuraa` | `🧭 Seuraa` | 2px `--gps-active` | `color-mix(--gps-active 16%, surface-card)` |

- **Kontrastisääntö (§K-linja):** teksti aina `--text-body` TINTIN päällä — ⊥ valkoista täytön päällä.
- **Napautuskierto:** `pois→seuraa →(käyttäjän panorointi)→ vapaa →seuraa`; `seuraa`-napautus sammuttaa,
  `haetaan`-napautus peruu. Merkitys tulee `gpsTapAction()`ista (`src/logic/gps-follow.ts`) ∴ nappi ja
  ⋯-valikko ⊥ voi tulkita eri tavoin.
- **Saavutettavuus:** näkyvä teksti = saavutettava nimi (V197) ∴ **⊥ `aria-label`ia**; `title` on lisäselite.
  `aria-pressed` = seuraako kartta (`vapaa` = false — paikannus on päällä muttei seuraa).
- `prefers-reduced-motion: reduce` → pulssi pois.
- **Koti-moodi:** `#app[data-view-mode="koti"] #gps-control{display:none}` — kartta on piilossa ∴
  karttakontrolli ei tarkoita mitään (V175-kuvio).

---

## §A Accessibility

- **Kontrasti:** WCAG AA, ≥4.5:1 normaali teksti, ≥3:1 iso teksti (≥18px tai ≥14px bold)
- **Touch-target:** min 44×44px kaikille interaktiivisille (§R)
- **aria-label:** pakollinen ikoni-napeille joilla ei ole tekstiä:
  - `#btn-modal-close` (✕) — puuttuu ⚠️
  - `#btn-route-prev` (◀) — puuttuu ⚠️
  - `#btn-route-next` (▶) — puuttuu ⚠️
  - `.route-tab-vis` (silmä-ikoni) — puuttuu ⚠️
- **Focus:** älä poista `outline` ilman custom-focus-indikaattoria
- **`user-scalable=no`:** tiedostettu rajoitus, karttasovellusvaatimus. Sen VOIMAANSAATTO on
  `touch-action`-sopimus (§R Zoom kuuluu kartalle, T408/V293) — meta-tagi yksin ei riitä iOS:llä.

---

## §B Tunnetut UX-velat (kirjattu init-auditoinnissa 2026-06-07)

| ID  | Ongelma                                              | Kriittisyys | Status |
|-----|------------------------------------------------------|-------------|--------|
| U1  | `button` global: ei `min-height: 44px` → toolbar-napit liian pieniä | Korkea | ✓ korjattu |
| U2  | `#btn-route-prev/next`: `min-height: 36px` → alle touch-targetin | Korkea | ✓ korjattu |
| U3  | `#btn-modal-close`: `padding: 4px 8px` → paljon alle 44px | Korkea | ✓ korjattu |
| U4  | `aria-label` puuttuu: btn-modal-close, btn-route-prev/next, route-tab-vis | Keski | auki |
| U5  | Border-radius epäyhtenäinen: 6px / 7px / 10px / 14px sekaisin | Matala | auki |
| U6  | `#gps-drive-panel { display: flex }` ovenrride HTML `hidden` → paneeli aina näkyvissä | Korkea | ✓ korjattu |
| U7  | `SnapshotPanel` ei reagoi rooli-togglelle — pysyi näkyvissä talkoolaisena | Korkea | ✓ korjattu |
| U8  | Paneelien toimintopainikkeet 28px: `.btn-segment-delete`, `.btn-copy-url`, `.btn-assign-edit`, `.btn-assign-save`, `.btn-snapshot-restore`, `.btn-approve` | Korkea | ✓ korjattu 2026-06-10 |
| U9  | Segment assign -inputit 28px korkeus, 90px leveys — liian pieni | Korkea | ✓ korjattu 2026-06-10 |
| U10 | Toolbar: 5 nappia ilman visuaalista hierarkiaa — sekundäärit (GPS, kartta) erottuvat huonosti | Suuri | ✓ korjattu 2026-06-11: Lista + Layer → overflow-valikko, h1 poistettu |
| U11 | Snapshot-paneeli aina auki — vie karttatilaa (T57 korjaa) | Suuri | ✓ korjattu 2026-06-11: backupBtn aina näkyvissä, toggle piilossa kun count=0 |
| U12 | Segment-paneeli: ei visuaalista palautetta 1. klikin jälkeen luonnissa (T56 korjaa) | Suuri | auki |
| U13 | `.marker-type-select` 28px — alle touch-targetin | Keski | ✓ korjattu 2026-06-10 |
| U14 | Talkoolaisen Lista-modaali näyttää kaikki merkit eikä vain pätkän (B8 → T58) | Suuri | auki |
| U15 | Segment-view merkkirivit liian pienet mobiilissa (4px padding, 11px font) | Keski | ✓ korjattu 2026-06-10 |
| U16 | Progress track handle 20px — alle 44px (kasvatettu 28px) | Keski | ✓ korjattu 2026-06-10 |
| U17 | GPS-drive: 3 nappia ahtaana 320px näytöllä | Pieni | auki |
| U18 | `.btn-segment-details-toggle` touch target ~20px (padding:4px 0) → alle 44px | Korkea | ✓ korjattu 2026-06-11 (36px) |
| U19 | Equipment inputs/napit min-height:32px → alle 44px; `.segment-desc-label`, `.segment-equipment-title` 10px font | Korkea | ✓ korjattu 2026-06-11 (36px + 11px) |
| U20 | `.segment-info` väri text-muted 11px — DESIGN.md §K sanoo text-primary 12px | Suuri | ✓ korjattu 2026-06-11 |
| U21 | `.segment-list` max-height:160px liian lyhyt useilla pätkillä | Pieni | ✓ korjattu 2026-06-11 (220px) |
| U22 | Segment-panel korkeus ei ole rajoitettu kun "Lisätiedot & varusteet" on auki — koko paneeli näkyy, kartta painuu pitkälle alas. | Suuri | osittain ✓ 2026-06-11: paneeli alkaa nyt suljettuna (collapsed=true), lista piilossa |
| U23 | SegmentPanel ei ollut collapsible — "Pätkäjako"-lista aina auki, vie karttatilaa | Suuri | ✓ korjattu 2026-06-11: collapse toggle lisätty, alkaa suljettuna |
| U24 | SEGMENT_COLORS törmäsi route-väreihin (`#f59e0b`,`#8b5cf6` molemmissa) + sama solid-tyyli — järjestäjä ei erottanut pätkää reitistä kartalla | Suuri | ✓ korjattu 2026-07-02: dashArray '1 9' + weight 11 + väripaletti ilman route-värejä |

---

## §P Designperiaatteet (VISION.md:stä)

1. **Metsässä toimiva** — isot napit, korkea kontrasti, ei turhia elementtejä
2. **Max 2 nappia kriittisiin toimintoihin** — merkin lisäys, kuittaus, drive mode
3. **Sama työkalu eri rooleille** — ei kahta sovellusta, vain eri näkymät
4. **Nopea kuittaus** — yksi nappi riittää normaalitapauksessa
5. **Ei häiriöitä** — talkoolaiselle näytetään vain se mitä hän tarvitsee

Epäselvässä UX-päätöksessä: "Toimiiko talkoolainen yhdellä kädellä, metsässä, 10 sekunnissa?"
