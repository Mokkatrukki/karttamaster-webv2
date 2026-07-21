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

### Merkki-tyyppivärit (SIGN_TYPES `src/logic/sign-picker.ts` + icons.ts, luettavia valkoisella kortilla)

| Tyyppi        | Hex       | Merkki                      |
|---------------|-----------|-----------------------------|
| left          | `#2563EB` | Vasemmalle (sininen)        |
| right         | `#16A34A` | Oikealle (vihreä)           |
| upcoming-left | `#9333EA` | Tuleva vasemmalle (violetti)|
| upcoming-right| `#C2410C` | Tuleva oikealle (poltettu oranssi)|

### Reitti-/pätkävärit (SEGMENT_COLORS `src/logic/segments.ts` + ROUTE_DEFS `src/main.ts`)

Valkoiselle kartalle: `#2F6FB0` (sininen) · `#7A4E9C` (violetti) · `#0E9594` (turkoosi) · `#B5476B` (magenta).
Reitit 35km = `#2F6FB0`, 55km = `#B5476B`.

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
- **Viewport:** `maximum-scale=1.0, user-scalable=no` (karttasovellusvaatimus)
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

**Sääntö:** `min-height: 44px` kaikille napeille. Tämä on erityisen kriittistä talkoolaiselle
metsässä, hanskat kädessä.

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
- Sisältö ylhäältä: **tilivalikko** (`#account-menu-section`, AccountMenu) → `Karttatyyli #btn-layer` (talkoolainen T233/V155 — siirretty toolbarista valikkoon) → phase-switcher (järjestäjä) → Varmuuskopiot → Vie/Tuo kartta-aineisto (gpkg)

### AccountMenu (`src/ui/account-menu.ts`, T203/V133)
- Renderöi `#account-menu-section`iin: `display_name` (`/api/auth/me`, `.account-menu-name` bold) + teemavalitsin + Kirjaudu ulos
- **Teemavalitsin** (`.account-menu-theme`): kaksi vaihtoehtoa "Reittimerkki-vaalea" / "Kaamos-tumma" (`.account-menu-theme-opt`, `min-height:40px`). Aktiivinen = `--accent`-reuna + `color-mix`-tausta, heijastaa `getTheme()`. Klikki → `setTheme()` (theme.ts, persistoi + `data-theme`). Koskee kaikkia rooleja (V132).
- **Kirjaudu ulos** (`#btn-logout`, `.account-menu-logout`, danger-tyyli): `POST /api/auth/logout` → `onLoggedOut` → `AuthScreen.start()` (login-lomake). Verkkovirhekin → kirjautumisruutu (ei jää haamutilaan).
- **Poistettu:** `#btn-role` + `RoleSelector` (B48/V80 dead code — rooli tulee tili-per-rooli-authista, ei toggle).

### Route-bar (`#route-bar`) — roolijako (T204/V134)
- Kiinteä alareuna, `z-index: 2000` (yli Leaflet-kontrollit 1000)
- **Talkoolainen (T224/A/V148):** koko alapalkki `#route-bar` PIILOTETTU (`hidden`). Ei reittivalitsinta, ei km-scrubberia, ei ◀▶-nuolia — ne ohjasivat koko reittiä (ei pätkää) ja hämäsivät. Talkoolaisen navigointi = SegmentView-hero + kartta (seuraava-merkki korostettu, T224/b1) + yläpalkin "Kaikki merkit"/"Varustelista"-napit. `RouteBar` luodaan silti (driveMode-reitin + activeRouteProviderin vuoksi) mutta itse palkki on piilossa. `#gps-drive-panel` POISTETTU (T224/F/V148, komponentti `gps-drive-panel.ts` poistettu) — duplikoi hero-ohjauksen. Oikea GPS-paikannin elää `gps-navigator.ts`:ssä (ei osa route-baria).
- **Järjestäjä** = kevyt reittivalitsin (`RouteVisibilityControl`, `src/map/route-visibility-control.ts`): pelkkä näytä/piilota per reitti pyöreinä pilleinä (`.route-vis-pill`, `border-radius:999px`, `min-height:44px`) kartan alakulmassa (`#route-bar[data-mode="visibility"]` → läpinäkyvä, `right:12px;bottom:12px`). EI drive-nuolia, EI km-scrubberia (V134). V6 säilyy: viimeistä näkyvää reittiä ei voi piilottaa (`disabled`).

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

### Marker-modaali (`#marker-modal`)
- Tausta: `bg-card`, border: `border-default`, `border-radius: 14px`
- Shadow: `0 16px 48px rgba(0,0,0,0.5)`
- Backdrop: `overlay` + `backdrop-filter: blur(2px)`
- Leveys järjestäjä: `min(560px, 92vw)`, `max-height: 82vh`
- Leveys talkoolainen: `min(340px, 92vw)`, `max-height: 60vh` (tai T74 bottom sheet)

### BulkStatusToolbar (`.bulk-status-toolbar`, järjestäjä-modal sisällä)
- Sijainti: `#marker-modal-header`:n jälkeen, ennen listaa — `position: sticky; top: 0`
- Tausta: `surface-raised`, `border-bottom: border-subtle`, padding `8px 14px`
- Kolme elementtiä flex-row: `[☐ Valitse kaikki]` + `[status-dropdown]` + `[Aseta-nappi]`
- "Valitse kaikki" checkbox: `22×22px`, `accent-color: var(--accent)`, label `12px text-muted`
- Status-dropdown: `<select>`, `min-height: 44px`, `flex: 1`, kaikki 5 statusta
- "Aseta valituille (N)" -nappi: `min-height: 44px`, `min-width: 120px`
  - N > 0: `background: confirm`, `color: confirm-text`
  - N = 0: `background: field-tint`, `color: text-muted`, `cursor: not-allowed`
- Vain järjestäjälle: piilossa `[data-role="talkoolainen"]`

### BulkActionBar talkoolainen (`.bulk-action-bar`, T17)
- Sijainti: `#marker-modal`:n alaosa — `position: sticky; bottom: 0`
- Tausta: `surface-card`, `border-top: border-subtle`, padding `10px 14px`
- Layout: `flex-wrap: wrap` — kaksirivinen 340px modaalissa:
  - Rivi 1: `[☐ Valitse kaikki]` (`label { width: 100% }` pakottaa omalle riville)
  - Rivi 2: `[✓ Aseta valituille]` + `[Ei tarpeen]` (molemmat `flex:1`)
- Napit `min-height: 44px`, disabled-tila `field-tint` kun 0 valittuna
- Vain talkoolaiselle: piilossa järjestäjällä

### Listarivit (`.marker-item`)
- Layout: kompakti yksirivinen flex-row — `[checkbox?][icon][type-label][💬?][km][status-badge][delete?]`
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

**Section pattern (V61) — kaikki osiot noudattavat:**

| Osa | Elementti | Tyyli |
|-----|-----------|-------|
| Header | `.left-panel-section-header` | `cursor:pointer; display:flex; align-items:center; padding:8px 10px; border-bottom:1px solid border-subtle` |
| Toggle-ikoni | `▼/▶` | `11px text-muted flex-shrink:0 mr:6px` — ▼ auki, ▶ kiinni |
| Nimi | `span` | `11px uppercase text-muted letter-spacing:0.06em flex:1` |
| Count | `span` | `11px text-meta` — sulkuihin esim. `(3)` |
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
  - **vaihe1:** progress (●○○), "Klikkaa kartalta aloituspiste" — kartta crosshair-cursor, snap-markerit näkyvissä
  - **vaihe2:** progress (●●○), "Klikkaa kartalta lopetuspiste" + aloituspiste km-info
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
- Otsikko-rivi: pätkän nimi `text-primary 14px bold`, ✕-nappi `aria-label:"Sulje"` `min-height:44px min-width:44px`
- Sulkeminen: ✕-nappi / Escape / backdrop-klikki — auto-save on change, ei hylkäysdialogi
- Kentät:
  - `displayName`: `<input>`, auto-save blur/Enter, `min-height: 44px`
  - kuvaus: `<textarea>`, 3 riviä, auto-save change, `min-height: 44px`
  - **Merkit & varusteet (T199, yhtenäinen lista — korvaa entiset kolme erillistä osiota):**
    - Per-merkki-rivit (`.segment-details-marker-list`, `max-height:200px` scrollable): `[MarkerVisualRow 34px, zoomable=true][nimi flex:1 truncated][km tabular-nums text-meta][status-pilli]`. Nimi = `m.label ?? tyyppilabel`. Status-pilli väritetty §C-taulukon mukaan (`.status-suunniteltu/asetettu/tarkistettu/kerätty/ei_tarpeen`, pill-muotoinen `border-radius:999px`).
    - Yhteenveto-chip-rivit (`.segment-equipment-chip-list`, samassa sektiossa heti perässä): merkit groupoitu `m.type`:n mukaan, `[iso tabular-nums luku "N×"][MarkerVisualRow 28px, zoomable=false][nimi]`. Korvaa entisen `"6× left"`-tekstirivin. Ei zoom-nappia (yhteenveto ei ole tarkka esikatselu, per-merkki-rivi hoitaa sen).
    - Manuaaliset lisävarusteet: add/remove/edit-rivi ennallaan (ei muutettu T199:ssä), `min-height: 44px` kaikille inputeille ja napeille.
    - Molemmat merkkipohjaiset osiot piilossa jos pätkällä ei merkkejä (`segMarkers.length === 0`) — manuaalinen lista näkyy silti aina.
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
- **GPS-toggle (T232/B, `.segment-view-gps-btn`, V156):** `📍 GPS`/`📍 GPS päällä` -toggle (siirretty yläpalkista, VISION phase 3 core). Persistentti panel-kontrolli — näkyy KAIKISSA phaseissa (asettaminen+purku), EI asettaminen-only heron sisällä (muuten tavoittamaton purussa). Aktiivi → `.gps-active` (accent-täyttö). Ohjaa `GpsNavigator` (T30, oma sijainti) — erillään driveModesta. Näkyy vain jos `onToggleGps` annettu.
- **Edistymispalkki (`.segment-view-progress`):** phase-tietoinen (`getPhaseProgress`/`formatPhaseProgress`, sama logiikka kuin järjestäjän sivupalkissa). `.segment-view-progress-bar/-fill` (`--confirm`-täyttö) + `.segment-view-progress-text` (esim "3/10 asetettu"). Aina näkyvissä otsikon alla (myös kutistettuna).
- **T224: EI välilehtiä** — yksi pystysarake. "Kaikki merkit" -massalista löytyy yläpalkin napista (marker-modal, V144-suodatus omaan pätkään); Varustelista omana modaalinaan (alla). Tuplaotsikot ("Kaikki merkit" välilehti + yläpalkki) poistettu käyttäjäpalautteen mukaan.
- **Description (`.segment-view-desc`):** ohjeteksti `field-tint`-kortissa, hidden jos tyhjä.
- **"Seuraava merkki" -hero (`.segment-view-next`, vain `phase==='asettaminen'`):** accent-vasenreunainen kortti. **Valittu merkki (T232/C, V159):** oletus = pätkän ENSIMMÄINEN asettamaton (`firstUnsetMarker`, pienin distanceFromStart); **◀▶-selailunuolet (`.segment-view-next-prev/-fwd`, `.segment-view-next-nav`, näkyvät kun >1 asettamaton) selaavat asettamattomia (`stepUnset` T231, clamp päihin = disabled reunoilla).** Otsikossa laskuri "Seuraava merkki · n/N". Sisältö: `buildMarkerVisual(44px)` + nimi + km + `locationNote`. `✓ Aseta`/`Näytä kartalla`/overflow/kartan `NextMarkerHighlight` kohdistuvat KAIKKI valittuun merkkiin; `update()`-reconcile: valittu asetettu/poistettu → palaa `firstUnsetMarker`iin (V159). **Primary 2 nappia (VISION max 2):** `✓ Aseta` (`.btn--confirm`, `flex:2`) + `Näytä kartalla` (`.btn--secondary`, panoroi + kutistaa, EI modaalia) + `⋯` (`.segment-view-next-more`, avaa overflow). **Overflow-valikko (`.segment-view-next-menu`, hidden→toggle):** `Ei tarpeen` (`.segment-view-next-skip`, `onSkipMarker`) + **`Siirretty` (`.segment-view-next-move`, T222)** + **`Laita kommentti` (`.segment-view-next-comment`, T228)** + **`+ Merkki` (`.segment-view-next-add`, T232/E/T229: `onAddMarker`→sign-picker kartan keskelle, POST omalle pätkälle V149; siirretty yläpalkista; disabled jos ei annettu)** + `Ota kuva` (`.segment-view-next-photo`, disabled "tulossa"). Kaikki asetettu → `.segment-view-next-done` **slim-rivi "✓ Kaikki asetettu 🎉" + `.segment-view-next--done` (T228, matala paino → kartta esiin)**.
- **Dynaaminen keräyslista (T218/V143, `.segment-view-collect`, vain `markerTypeFilter`-tehtävä):** reititön keräyskasa-/autoporukka-tehtävä korvaa asettaminen-heron (`renderNext` early-return kun `markerTypeFilter`). Accent-vasenreunainen kortti kuten hero. `.segment-view-collect-header` (`text-muted 11px uppercase`) = "Keräyslista · N/M haettu" (tyhjä → "Ei vielä keräyskohteita"). Rivit `.segment-view-collect-row` (distanceFromStart-järjestys, top-border-erottimet): `buildMarkerVisual(36px)` + `.segment-view-collect-info` (klikattava `<button>` → `onShowOnMap`, nimi + `locationNote`) + `.segment-view-collect-btn` (`44px`; ei-kerätty `.btn--confirm` "✓ Haettu" → `onCollectMarker(id,true)`; kerätty `.btn--secondary` "Haettu ✓" → `onCollectMarker(id,false)`, kerätyn nimi himmenee `--done`). **Elävä:** `update()` re-render tuo uudet keräyskasat (getMarkersForSegment→resolveTaskMarkers V140). Kuka tahansa autentikoitu kuittaa (V143, ei ownership-gatea); status kerätty↔suunniteltu suoraan (`bulkSetStatus`, EI 'kerää'-action joka heittää suunniteltu-tilaisille).
- **EI inline-merkkilistaa (T228):** entinen `.segment-view-list` poistettu — se duplikoi "Kaikki merkit" -modaalin (bulk + rivi→MarkerDetailModal) ja söi kartan tilan (dominoiva ei-ydinkomponentti). Per-merkki-lista + detalji elää kahdessa paikassa: yläpalkin **"Kaikki merkit"** -modaali (klikattava rivi→`onOpenMarkerDetail`, V144-suodatus omaan pätkään) + **kartan merkin tap** (`markers-wiring` `setOnMarkerClick`→`onOpenMarkerDetail`). Kartta = päänavigointi.
- **Varustelista-nappi (T224/C, `.segment-view-varuste-btn`):** `🎒 Varustelista (N)` (N = auto-merkit + manuaalimäärä) → avaa `EquipmentModal` (tilava modaali, kuten "Kaikki merkit"). EI ahdasta inline-editoria — käyttäjäpalaute.
- **Purku-bulk (`.btn-bulk-collect`, `.btn--confirm`):** vain `phase==='purku'` + ei-terminal-merkkejä → "✓ Merkitse kaikki kerätyksi" (V28).
- **"Lisää ⋯" sekundäärivalikko (T232/A, `.segment-view-more`, V158):** panel-tason toggle (`.segment-view-more-toggle` → `.segment-view-more-body` hidden↔näkyvä) joka pitää valmis- + rajat-toiminnot POIS hero-primarysta (tiivis hero) mutta tavoitettavina KAIKISSA phaseissa (EI marker-hero-overflow, joka on vain asettaminen+next → complete olisi tavoittamaton purussa/done-tilassa). Näkyy jos `onComplete` (asettaminen/purku) TAI `onEditBounds` annettu. Sisältää alla olevat complete + bounds -osiot.
- **Rajojen muokkaus (T78/V43, `.segment-view-bounds`, "Lisää ⋯" sisällä T232):** kokoontaitettava "✎ Muokkaa pätkän rajoja (X–Y km)" (`.btn--secondary .btn--sm`) → numeeriset km-inputit (`.segment-view-bounds-start/-end`, `44px`, `type=number`) + validointi (`loppu>alku`, `.segment-view-bounds-error` `danger-text`) + Tallenna/Peruuta. Näkyy vain jos `onEditBounds` annettu (talkoolainen). Tallennus → `PUT /api/segments/:id` (server sallii omalle pätkälle V93).
- **Valmis-osio (T230, `.segment-view-complete`, "Lisää ⋯" sisällä T232, vain `phase==='asettaminen'|'purku'`):** talkoolaisen eksplisiittinen "✓ Merkitse pätkä valmiiksi" / "Merkitse keskeneräiseksi" -toggle (`.segment-view-complete-btn` `.btn--confirm`/`.btn--secondary`) + `.segment-view-complete-status` "Pätkä merkitty valmiiksi ✓" (näkyy vain kun completed). Erillään per-merkki-kuittauksesta (VISION r49/r259). Näkyy vain jos `onComplete` annettu (talkoolainen). Tallennus `Segment.completed` → `PUT /api/segments/:id` (server sallii omalle pätkälle V93, kuten `inspected`).
- **Tarkastus-osio (T147, `.segment-view-inspect`, vain `phase==='tarkastus'`):** `.segment-view-inspect-status` "Tarkastettu ✓"/"Ei vielä tarkastettu" + `.segment-view-inspect-note` (`<textarea>`, `field-tint`, vapaateksti-huomio) + `.btn-mark-inspected` (`.btn--confirm`, toggle-teksti).
- **Kokoontaitto (T223, `.segment-view--collapsed`):** chevron kutistaa näkymän otsikkoon+edistymispalkkiin → kartta saa lähes koko ruudun. "Näytä kartalla" kutsuu myös automaattisesti. Kutistettuna desc/next/gps-btn/varuste-btn/more/bounds/inspect/bulk `display:none`.
- **Latauksessa zoom pätkään (T224/D):** `/s/<koodi>` auki → kartta fittaa OMAAN pätkään (`fitMapToSegment` markers-wiring, `planSegmentZoom` `src/logic/segment-zoom.ts`) — lyhyt pätkä `fit`, pitkä `anchor` alkupäähän. "Tässä on sun pätkä" -fiilis, ei koko kartta.
- **Seuraava merkki kartalla (T224/b1, `NextMarkerHighlight` `src/map/next-marker-highlight.ts`):** hero:n VALITTU asettamaton merkki (◀▶-selailu huomioiden, T232/F/V159 — ei suoraan `firstUnsetMarker`) korostuu kartalla accent-renkaalla (`.next-marker-ring`, ei-interaktiivinen) — talkoolainen näkee heti minne mennä. Korostus seuraa `onNavigate`-callbackia (markers-wiring). Kartta = päänavigointipinta. Vain `asettaminen`-phase.

### EquipmentModal (`.equipment-modal`, `src/ui/equipment-modal.ts`) — talkoolaisen varustelista (T224/C)
- Avautuu SegmentViewn `🎒 Varustelista` -napista. Tilava keskitetty modaali (`width:min(480px,94vw)`, `max-height:85vh`), backdrop + Esc/✕/backdrop-sulku (`registerEscClose`/`createBackdrop`).
- **Auto-laskuri (readonly):** merkit pätkällä tyypeittäin (`.equipment-modal-auto-list`, ihmisluettava tyyppilabel).
- **Omat varusteet (muokattava):** rivit `count`-input + nimi-input + `✕`-poisto (`.equipment-modal-count/-name/-remove`, `44px`), `+ Lisää varuste`. Muokkaa `draft`-kopiota.
- **Footer:** `Tallenna` (`.btn--confirm`, commit → `onEquipmentChange` + sulje, tyhjänimiset karsitaan) + `Peruuta` (hylkää). Tallennus → `updateSegment` + `PUT /api/segments/:id` (V38/V93, server sallii talkoolaisen equipment omalle pätkälle).

### PhaseSwitcher (T148, `#phase-switcher-container`, `src/ui/phase-switcher.ts`)
- Vain järjestäjälle — `data-role-hide="talkoolainen"` piilottaa containerin talkoolaiselta
- Sijainti: `#toolbar-menu` (⋯-valikko), oma rivi `.menu-sep`-erottimien välissä
- `<select>` kolmella vaihtoehdolla: Asetus / Tarkastus / Purku (`Segment['phase']`-arvot), `min-height:44px`
- Vapaa valinta mihin arvoon tahansa — ei rajoitettu ketju
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
  - **Keppi-checkbox (T249/V168, `.sign-lib-keppi-checkbox`):** favorite-toggle-mallin alla, `min-height:44px`. Checked = keppi (oletus, yleisin) → näyttönimi sellaisenaan; unchecked = irto → näyttönimeen ' - irto' KAIKKIALLA (`signDisplayLabel(tpl)`, src/logic/sign-library.ts — kirjasto, picker, inventaario). Uusi malli: checked. Inventaarion "Muuta merkiksi" (T250) avaa `prefill.keppi=false` + `favorite=false` (irto-default inventaariossa). HUOM: kartan compactLabel-lyhenne johdetaan raakalabelista, EI saa suffixia.

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

### InventoryPage — v2 (`inventory.html` + `src/inventory.ts` + `src/ui/inventory-page.ts`, T245/T246)
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
- **Viivatyyli = status** (`segmentLineState(getPhaseProgress(seg, markers))`, kolme ämpäriä):
  - `valmis` → ehjä, `opacity: 0.9, weight: 11` (ei dashArray)
  - `kesken` → täysi katko, `opacity: 0.85, weight: 11, dashArray: '1 9'`
  - `ei_alkanut` → haalea katko, `opacity: 0.4, weight: 9, dashArray: '1 9'`
- `update(store, markers)` — tarvitsee merkit progressiin. Kutsutaan sekä segmentin mutaatiosta ETTÄ merkin status-muutoksesta (`main.ts` MarkerManager onUpdate) — muuten kartan status jää jälkeen.
- tarkastus-vaiheen valmis-pätkä: tooltip-nimeen `✓`
- DisplayName: pysyvä tooltip `permanent: true`, CSS-class `segment-label`
- Aukko (gap): `color: text-muted hex (#94a3b8), weight: 8, opacity: 0.3`
- SEGMENT_COLORS (6 väriä, **paletti ei saa sisältää route-värejä** `#f59e0b`/`#8b5cf6`):
  `['#10b981', '#ec4899', '#3b82f6', '#ef4444', '#06b6d4', '#64748b']` (nyt `src/logic/segments.ts`)


**Regressiosuoja (V88):** `getSegmentStatusCounts()` (src/logic/segments.ts) yksikkötestaus ei riitä — T95 hävisi juuri koska pelkkä logiikkatesti jäi vihreäksi vaikka kutsupaikka katosi UI:sta. Pakollinen lisäksi: Vitest-jsdom-testi joka rakentaa oikean `main.ts`-wiring-polun (ei eristettyä komponenttia) ja tarkistaa että `#segment-status-bar` DOM-teksti sisältää oikean lukumäärän segmentStoren mutaation jälkeen. Tulevat refaktorit jotka koskevat `#map-area`-lasten järjestystä tai `SegmentPanel`/`segment-view`-riviä eivät saa läpäistä testejä jos tämä kutsu putoaa pois.

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
- **`user-scalable=no`:** tiedostettu rajoitus, karttasovellusvaatimus

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
