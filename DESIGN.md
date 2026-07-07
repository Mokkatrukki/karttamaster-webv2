# DESIGN.md — Karttamaster design-sopimukset

Ainoa totuus tyyleistä. CSS elää `src/style.css`:ssä (Vite importtaa `main.ts`:stä).
CSS custom properties: `:root`/`[data-theme]`-lohkot tiedoston alussa — muuta tokeneja sieltä, ei hardcoded-hexeistä.
Teemavaihto: `<html data-theme="dark|daylight">`. Default = dark.
Inline SVG-tyylit (dynaamiset, bearing-riippuvaiset): `src/map/icons.ts`.

---

## §C Värit

Kaksi teemaa: **dark** (järjestäjä, toimisto) ja **daylight** (talkoolainen, metsä/aurinko).

### Pääteema: dark

| Token           | Arvo (dark)                  | Arvo (daylight)              | Käyttö                              |
|-----------------|------------------------------|------------------------------|-------------------------------------|
| surface-app     | `#0f172a`                    | `#ffffff`                    | Toolbar, route-bar, paneelit        |
| surface-card    | `#1e293b`                    | `#f1f5f9`                    | Modaalit, dropdownit, kortit        |
| surface-raised  | `#243044`                    | `#f8fafc`                    | Hover-kortit, sisäkkäiset           |
| text-body       | `#e2e8f0`                    | `#020617`                    | Pääteksti, napit, otsikot           |
| text-muted      | `#94a3b8`                    | `#334155`                    | Sekundaaritieto, meta-napit         |
| text-meta       | `#64748b`                    | `#64748b`                    | Metatieto (km-lukema)               |
| accent          | `#f59e0b`                    | `#f59e0b`                    | Päänappi "Lisää merkki"             |
| accent-text     | `#111111`                    | `#1a1205`                    | Teksti accent-taustan päällä        |
| accent-hover    | `#d97706`                    | `#b45309`                    | Accent hover-tila                   |
| confirm         | `#15803d`                    | `#15803d`                    | Talkoolaisen kuittausnappula        |
| confirm-hover   | `#166534`                    | `#166534`                    | Confirm hover-tila                  |
| confirm-text    | `#ffffff`                    | `#ffffff`                    | Teksti confirm-taustan päällä       |
| danger          | `#ef4444`                    | `#dc2626`                    | Poisto, place-mode aktiivi          |
| danger-text     | `#f87171`                    | `#b91c1c`                    | Danger-teksti (kirkas bg:llä)       |
| danger-soft     | `rgba(239,68,68,0.10)`       | `rgba(220,38,38,0.08)`       | Poisto-napin tausta                 |
| danger-soft-hover | `rgba(239,68,68,0.20)`     | `rgba(220,38,38,0.16)`       | Poisto hover                        |
| gps-active      | `#1d4ed8`                    | `#1d4ed8`                    | GPS aktiivi -tila                   |
| border-subtle   | `rgba(255,255,255,0.06)`     | `rgba(15,23,42,0.06)`        | Osastojen erottimet                 |
| border-card     | `rgba(255,255,255,0.08)`     | `rgba(15,23,42,0.10)`        | Listarivien separator               |
| border-default  | `rgba(255,255,255,0.10)`     | `rgba(15,23,42,0.14)`        | Korttirajat, dropdownit             |
| border-strong   | `rgba(255,255,255,0.12)`     | `rgba(15,23,42,0.20)`        | Napit                               |
| hover           | `rgba(255,255,255,0.08)`     | `rgba(15,23,42,0.05)`        | Hover-tila napeilla ja riveillä     |
| hover-strong    | `rgba(255,255,255,0.14)`     | `rgba(15,23,42,0.10)`        | Vahvempi hover (aktiivi painallus)  |
| field-tint      | `rgba(255,255,255,0.06)`     | `rgba(15,23,42,0.05)`        | Input/chip taustasävy               |
| overlay         | `rgba(0,0,0,0.5)`            | `rgba(15,23,42,0.40)`        | Modaalin backdrop                   |
| warn-highlight  | `rgba(245,158,11,0.12)`      | `rgba(245,158,11,0.16)`      | Uusi/korostettu listakohta          |

### Merkki-värit (karttaikonit, src/map/icons.ts)

| Token          | Hex       | Merkki                     |
|----------------|-----------|----------------------------|
| marker-right   | `#16a34a` | Oikealle (vihreä)          |
| marker-left    | `#2563eb` | Vasemmalle (sininen)       |
| marker-up-r    | `#b45309` | Tuleva oikealle (oranssi)  |
| marker-up-l    | `#7c3aed` | Tuleva vasemmalle (violetti)|

### Status-värit (merkki-elinkaari, src/ui/marker-list.ts + style.css)

Kovakoodatut molemmissa teemoissa — domain-värit, ei vaihdeta teeman mukaan.

| Token              | Teksti hex | Taustaopasiteetti | Status           |
|--------------------|------------|-------------------|------------------|
| status-suunniteltu | `#94a3b8`  | `var(--field-tint)` | Suunniteltu    |
| status-asetettu    | `#4ade80`  | `rgba(74,222,128,0.10)`  | Asetettu ✓  |
| status-tarkistettu | `#93c5fd`  | `rgba(147,197,253,0.10)` | Tarkistettu ✓|
| status-kerätty     | `#6ee7b7`  | `rgba(110,231,183,0.10)` | Kerätty     |
| status-ei_tarpeen  | `#fbbf24`  | `rgba(251,191,36,0.10)`  | Ei tarpeen  |

**Sääntö:** Käytä vain yllä olevia tokeneja. Älä keksi uusia hex-koodeja suoraan CSS:ään.
Jos tarvitaan uusi väri, lisää se ensin tähän taulukkoon.

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

### Toolbar (`#toolbar`)
- Kiinteä yläreuna, `z-index: 200`, korkeus ~56px
- Tausta: `bg-primary`, alaraja: `border-bottom: 1px solid border-subtle`
- Padding: `6px 8px` (4px-grid)
- Näkyvät napit: `+ Merkki` (admin), `📍 GPS`, role-toggle, `⋯`-valikko
- `⋯ #btn-menu`: 44×44px, `border: 1px solid border-strong`, `margin-left: auto`
- Ei h1-otsikkoa toolbarissa — poistettu tilan säästämiseksi

### Toolbar-menu (`#toolbar-menu`)
- `position: fixed; top: 56px; right: 8px` — avautuu toolbarin alta oikeasta reunasta
- `bg-card`, `border-default`, `border-radius-md`, `box-shadow: 0 8px 24px rgba(0,0,0,0.4)`
- `z-index: 2001` (yli route-barin 2000)
- Toggle: `.open`-class — avaa `display: flex`, sulkee document-click
- Sisältö: `☰ Lista` (avaa marker-modal) + karttakerros-toggle (label päivittyy)

### Role-toggle (`#btn-role`)
- Toolbarissa, toolbar-nappi tyyli
- `min-height: 44px` (§R pakollinen)
- Inactive: `color: text-muted`, `background: transparent`
- Active: `background: accent`, `color: accent-text`
- Teksti: `"Järjestäjä"` tai `"Talkoolainen"` — ei ikoneja (aria)

### Route-bar (`#route-bar`)
- Kiinteä alareuna, `z-index: 2000` (yli Leaflet-kontrollit 1000)
- Tausta: `bg-primary`, shadow ylöspäin
- Navigointipainikkeet (`btn-route-prev/next`): `min-height: 44px` ✓
- Route-tab-drive: `min-height: 44px` ✓ (T45)
- Route-tab-vis (eye-icon): `width: 44px; min-height: 44px` ✓ (T45)

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

### SignIcon — karttamerkit (SVG, `src/map/icons.ts`)
- Koko: `32×52px` (W×H)
- Teardrop: pyörivä ympyrä `r=14` `cy=28` + kiinteä kärki-SVG `position:absolute;bottom:0;height:10px` (ei rotoi bearingin mukaan). Ankkuri kärjen kärjessä `(16, 52)`.
- Kärki-path: `M8,0 L16,10 L24,0 Z` — osoittaa tarkan sijainnin kartalla. Kärjen väri on **aina tyyppiväri**, riippumatta statuksesta.
- Ympyrän **täyttö on aina tyyppiväri/-kuva** (V87) — tyyppi-identiteetti (nuoli/ikoni/väri) ei koskaan muutu statuksen mukaan, myös kerätty/ei_tarpeen näyttävät saman kuvan.
- Upcoming-tyyppi (`upcoming-left`/`upcoming-right`): pääympyrä pysyy aina tyyppivärillä + `stroke-dasharray="4 2"`, ei osallistu statusväritykseen (esikatselu-tyyppi, ei operatiivinen kuittausflow).

**Status-visualisointi (T23/V51/T140, `createSignIcon(type, status, color?, shortLabel?, iconId?, imageSrc?)`):**
- `suunniteltu` → pääympyrä `fill=tyyppiväri fill-opacity:0.55` + `stroke:white stroke-dasharray:"4 2"` — "haalistunut/katkoviiva = ei tehty" (V51), ennallaan
- `asetettu`/`tarkistettu`/`kerätty`/`ei_tarpeen` → täyttö pysyy tyyppivärinä, **statusväri näkyy ulkoreunassa** (`stroke`, leveys `4px`, T140/V87/B59 — kokeiltiin ensin täyttöväriä T139:ssä, mutta käyttäjä halusi tyyppikuvan pysyvän tunnistettavana joka statuksessa):
  - `asetettu`: reunus `#22c55e` (vihreä)
  - `tarkistettu`: reunus `#0ea5e9` (taivassininen)
  - `kerätty`: reunus `#8b5cf6` (violetti)
  - `ei_tarpeen`: reunus `#78716c` (harmaa)
  - Neljä väriä valittu eri sävyperheistä tarkoituksella — ei saman perheen pastelleja (alkuperäinen 8px badge-versio #4ade80/#93c5fd/#6ee7b7 oli liian samankaltainen, B58)
- Sisältö: **kuva > ikoni > shortLabel** -precedence (V99/T158, `signVisual`). Ikoni/label-tyypit = teardrop-ympyrä yllä. **Kuvatyyppi (T-C): suorakaide-kortti ei ympyrätäyttö** — koko kyltti näkyy croppaamatta (kuvasuhteet vaihtelevat 2.2:1…0.7:1). Kortti `40×40px` valkotausta, `border-radius:8px`, `box-shadow`, `object-fit:contain`; kärki-kolmio `16×8px` kortin alla, ankkuri `(20,48)`. Status = **kortin reuna** (V87): `suunniteltu` katkoviiva neutraali `#64748b`, muuten solid statusväri (vihreä/sininen/violetti/harmaa). Fallback-chip (tyyppiväri + compactLabel) img:n alla, `onerror="this.remove()"` paljastaa sen.
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
- Item: `[swatch 22×22px] [label flex:1] [···]` — klikkaus asettaa merkin, ··· avaa edit-modaalin
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
  - merkit readonly-lista: `text-muted 12px`, status-badge §C-väreillä, `max-height: 160px` scrollable
  - varusteet: add/remove/edit-rivi, `min-height: 44px` kaikille inputeille ja napeille
  - `.btn-segment-clone-phase` (T146): "Kloonaa &lt;seuraava&gt;-vaiheeseen", sama tyyli kuin `.btn-segment-edit-pts-modal` (`field-tint` bg, `border-strong`, `min-height:44px`, `width:100%`, `text-align:left`) — ei destructive, ei primary, matala visuaalinen painoarvo koska harvoin käytetty toiminto

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

### SegmentView (`#segment-view`, `src/ui/segment-view.ts`)
- Vain talkoolaiselle jolla on assignedCode matchaava pätkä
- Sijainti: `#app`:n sisällä ennen karttaa (erillinen `#segment-view-container`)
- Tausta: `bg-primary`, bottom-border: `border-subtle`
- Header: pätkän nimi `text-primary 12px bold`, km-väli `text-muted 11px`
- Description: `text-muted 11px`, max 2 riviä, hidden jos tyhjä
- Merkkilista: max-height 200px scrollable, `border-card`-separaattorit
  - Merkkirivi: type-label + bearing + status-badge, `11px`
  - Status-väri: sama kuin global status-värit (§C)
- `[data-role="talkoolainen"] #segment-view { display: block }` — muille hidden
- Ei purku-bulk-nappia vielä (T52 lisää)
- **Tarkastus-osio (T147, `.segment-view-inspect`):** näkyy vain `phase==='tarkastus'`-pätkällä. `.segment-view-inspect-status` (`text-primary 12px bold`): "Tarkastettu ✓" / "Ei vielä tarkastettu". `.segment-view-inspect-note` (`<textarea>`, 3 riviä, `min-height:44px`, `field-tint` bg) — vapaateksti-huomio, ei per-merkki-kuittausta (VISION §4). `.btn-mark-inspected` (`min-height:44px;width:100%`, `confirm`-tyyli kuten `.btn-bulk-collect`) — tekstinä "Merkitse tarkastetuksi"/"Merkitse tarkastamattomaksi" (toggle).

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
- Swatch: `22×22px`, `border-radius:radius-sm`, `font-size:10px;font-weight:900;color:#fff`. Sisältö **kuva > ikoni > compactLabel** -precedence (V99/T158): template-kuva `object-fit:contain;background:#fff;position:absolute;inset:0` `<img onerror>`-fallbackilla (`overflow:hidden` swatchissa; contain = koko kyltti näkyy, ei crop), muuten Lucide-ikoni (`renderIconSvg`), muuten compactLabel-teksti. Sama precedence sign-picker-napeissa (`.sign-type-btn` `#floating-picker`).
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

### ImageGalleryPicker (`.sign-image-gallery`, edit-modaalin sisällä T93-ikoni-gridin vieressä)
- **Sijainti:** SignLibraryPanel edit-modaalin visual-valinnassa kaksi tabia: `[Ikoni] [Kuva]` (`.sign-visual-tab`, `min-height:44px`, aktiivi = `accent`-alaviiva, ei-aktiivi = `text-muted`). Kuva-tabi näyttää `ImageGalleryPicker`-gridin, Ikoni-tabi nykyisen T93-ikoni-gridin. Precedence (V99) ei riipu tabista — kumpi tahansa asetettu viimeksi voittaa tallennuksessa, toinen kenttä nollataan (kuva ja ikoni eivät ole molemmat samaan aikaan aktiivisia samalle templatelle).
- **Grid:** `display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px`, kontaineri `max-height:min(50vh,420px);overflow-y:auto` (sama scroll-periaate kuin sign-lib-lista rivi 444).
- **Thumbnail (`.sign-image-thumb`):** `64×64px`, `border-radius:radius-sm`, `background:#fff` (kyltit suunniteltu valkoiselle pohjalle), `<img object-fit:contain;width:100%;height:100%>`. Koko napin pinta-ala klikattava (≥44px täyttyy jo 64px:llä — §R ei erillistä paddingia tarvita).
- **Valinta:** klikkaus valitsee kuvan templatelle heti (ei erillistä "vahvista"-nappia gridissä) — `2px solid accent` reunus + pieni ✓-badge oikeassa yläkulmassa (`14px`, `accent` tausta, `accent-text` glyfi) valitulle thumbnailille. Sama korostuslogiikka kuin T93 ikoni-gridin valinta (yhtenäinen pattern kahden tabin välillä).
- **Zoom/lightbox (uusi tarve — pienet thumbnailit eivät riitä erottamaan samankaltaisia kylttejä, esim. useita ylämäki-variaatioita):** jokaisessa thumbnailissa zoom-kulma (`.sign-image-zoom-btn`) — klikattava alue **44×44px** (§A pakollinen kaikille interaktiivisille, myös hiirikäytössä), visuaalinen glyfi pienempi (`18px` tumma pyöreä badge + valkoinen suurennuslasi-SVG) ankkuroitu oikeaan alakulmaan hit-arean sisällä `padding`illa. Click **ei** valitse kuvaa, vaan avaa lightboxin (stopPropagation). Koko thumbnail on silti myös suoraan klikattava valintaan (zoom on lisä, ei pakollinen välivaihe) — zoom-hit-area peittää thumbnailin oikean alakulman, loppuosa jää suoraan valintaan.
  - **Lightbox-rakenne (`.sign-image-lightbox`):** sama pattern kuin SnapshotModal (rivi 161-169) — backdrop `.sign-image-lightbox-backdrop` (`overlay`-token, `backdrop-filter:blur(2px)`, `z-index:5000` — yli edit-modaalin, joka on `z-index:4000`-luokkaa), sisältö keskitetty `max-width:min(90vw,640px);max-height:85vh`, kuva `object-fit:contain;width:100%;height:100%`.
  - Sulkeutuu: Esc, backdrop-klikkaus, tai `✕`-nappi (`.sign-image-lightbox-close`, oikea yläkulma, `min-width:44px;min-height:44px`, `aria-label="Sulje"` — §A vaatii, ei tekstiä).
  - Footer-nappi lightboxissa: `[Valitse tämä kuva]` (`.modal-btn-primary`-tyyli, `confirm` tausta) — valitsee kuvan templatelle ja sulkee lightboxin samalla. Mahdollistaa valinnan suoraan suurennetusta näkymästä ilman paluuta gridiin.
- **Käyttäjä:** järjestäjä (desktop/hiiri, ei touch-kriittinen — mutta 44px-sääntö koskee silti kaikkia nappeja §R:n mukaan, myös hiirikäytössä yhtenäisyyden vuoksi).
- **Datalähde:** `src/assets/signs/*.webp` (Vite glob-import, T161-konversio), kuva-avain = `template.id` (V97 filename-safe).

### AdminPage (`admin.html` + `src/admin.ts` + `src/ui/admin-page.ts`, T122)
- Erillinen entrypoint, ei jaa `#app`-runkoa index.html:n kanssa — vain admin-rooli, oma sivu
- `#admin-app`: `max-width:960px;margin:0 auto;padding:16px` — kapea keskitetty layout, toimii myös mobiililla
- Header (`#admin-header`): otsikko + "Kirjaudu ulos" (`min-height:44px`)
- Invite-banneri (`.admin-invite-banner`): näyttää tuoreimman invite/reset-URL:n + kopiointinappi (`min-height:44px`), `warn-highlight` tausta + `accent`-reunus
- "Kutsu uusi järjestäjä" (`.admin-invite-btn`): `min-height:44px;width:100%`, `field-tint` tausta, katkoviivareunus
- Käyttäjätaulukko (`.admin-users-table`): rivi per käyttäjä, sarakkeet Nimi/Käyttäjätunnus/Rooli/Luotu/Tila/Toiminnot
- Tila-pilli (`.admin-user-status`): käyttää olemassa olevia status-värejä (§C) — `active` = `#4ade80`/`rgba(74,222,128,0.10)` (sama kuin status-asetettu), `inactive` = `danger-text`/`danger-soft`. **Ei uutta `--confirm`-tekstiväriä tummalla taustalla** — kontrasti alle AA:n (3.1:1), käytä aina kirkkaampaa status-tokenia.
- Toimintonapit (`.admin-toggle-active-btn`, `.admin-copy-invite-btn`): `min-height:44px`, `field-tint` tausta

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
