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
- "Luo varmuuskopio" -nappi `min-height:44px` (§R pakollinen)
- Lista: scrollable, `border-card`-separaattorit, `11px text-muted`
- Palauta-nappi: `danger-soft` tausta, `danger-text` — vaarallinen toiminto = punainen

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
- Kärki-path: `M8,0 L16,10 L24,0 Z` — osoittaa tarkan sijainnin kartalla
- Värit: ks. §C Merkki-värit (tyyppiväri — ei muutu statuksen mukaan)
- Outline: `stroke: white, stroke-width: 2`
- Upcoming-tyyppi: `stroke-dasharray="4 2"` (jo käytössä — ei muuteta statukselle)

**Status-visualisointi (T23, `createSignIcon(type, bearing, status)`):**
- `suunniteltu` → `opacity: 0.45` koko ikonille — "haalistunut = ei tehty"
- muut statukset → `opacity: 1.0`
- Status-piste: `8px` absoluuttinen `<span>` oikealle, `bottom:12px` (ympyrän alapuoli, ei tip-alueen päällä)
  - `suunniteltu`: piilotettu (ei pistettä)
  - `asetettu`: `#4ade80`
  - `tarkistettu`: `#93c5fd`
  - `kerätty`: `#6ee7b7`
  - `ei_tarpeen`: `#fbbf24`
- Ei tekstiä merkillä, ei status-perusteista muotomuutosta — muoto on aina teardrop, tyyppiväri pysyy tunnistimena

### LeftPanel (`#left-panel`)
- Vain järjestäjälle — `body[data-role="talkoolainen"] #left-panel { display: none }`
- Sijainti: `#app-main`:n flex-row vasempi lapsi, ennen `#map-area`
- Leveys auki: 240px sisältö + 44px toggle = 284px total; kiinni: 44px toggle strip
- Tausta: `bg-app` (surface-app), oikea reuna: `border-subtle`
- Toggle-nappi (`#left-panel-toggle`): `44×44px`, `position: sticky; top: 0`, `bg-raised`, `color: text-muted`
  - Auki: `◀`, `aria-label: "Sulje paneeli"`; kiinni: `▶`, `aria-label: "Avaa paneeli"`
  - Hover: `hover-strong` bg, `text-body` väri
- Sisältö (`#left-panel-content`): `flex column`, `overflow-y: auto`, piilotetaan `hidden`-attribuutilla kun kiinni
- Osiot (`.left-panel-section`): border-bottom `border-subtle`; otsikko `11px uppercase text-muted`
- `#sign-type-dropdown` paneelissa: `position: static; display: flex` — aina näkyvissä, ei floating
- `#segment-panel-container` paneelissa: `position: static; display: block; max-height: none`
- `+ Merkki` toolbarissa: klikkaus avaa panelin (`LeftPanel.open()`) järjestäjä-moodissa

### SegmentPanel (`#segment-panel`)
- Vain järjestäjälle (`hidden` muille)
- Sijainti: `#app`:n sisällä `#snapshot-panel-container`:n jälkeen, ennen karttaa
- Tausta: `bg-primary`, bottom-border: `border-subtle`
- Header: `11px uppercase text-muted`, "Luo uusi pätkä" -nappi `min-height: 44px` (§R pakollinen)
- Luomistila: `12px text-muted`, "Klikkaa reittiä: 1. / 2. piste" — kaksi klikkausta reitillä → luo pätkän
- Lista: `max-height: 220px`, scrollable, `border-card`-separaattorit
- Segmenttirivi: `padding: 6px 10px`, nimi `text-primary 12px`, km-väli `text-muted 11px`
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
- `locationNote`: `<textarea>` (ei `<input>`) auto-save blur, `min-height:80px`, `field-tint`, placeholder `"Lisää kommentti... (esim: kiinnitä puuhun)"` — kirjoiteltavissa myös talkoolaiselle omalla pätkällä
- Kuvaus-osio: placeholder `text-muted 12px "Kuvaus tulossa (T103)"` kunnes T103 valmis
- Järjestäjä-lisät: type-select `min-height:44px` + "↻ Käännä" -nappi `field-tint` (`arm(id)` + sulje modal) + delete-nappi `danger-soft`
- Talkoolainen-lisät: status-napit (aseta / ei tarpeen) `min-height:44px`, `confirm`-tausta

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

### SignLibraryPanel (`src/ui/sign-library-panel.ts`)
- Vain järjestäjälle — sijaitsee `#left-panel-content`:ssä
- Rivit (`.sign-lib-row`): `display:flex;align-items:center;gap:4px`, border-bottom `border-card`
- Swatch: `22×22px`, `border-radius:radius-sm`, `font-size:10px;font-weight:900;color:#fff`
- Suosikki-nappi (`.sign-lib-fav-btn`): `min-width:44px;min-height:44px` (§R pakollinen)
- Muokkaa-nappi (`.sign-lib-edit-btn`): `min-width:44px;min-height:44px`
- Poista-nappi (`.sign-lib-delete-btn`): `min-width:44px;min-height:44px`, `danger-soft` tausta, `danger-text` väri
- "Uusi malli" -nappi (`.sign-lib-add-btn`): `min-height:44px;width:100%`, `field-tint` tausta, `border-default`
- **Lomake (`.sign-lib-form`):**
  - Tausta: `surface-raised`, `border-radius:radius-md`, padding `10px 8px`
  - Kaikki kentät: `min-height:44px`, `field-tint` tausta, `border-default`, `radius-sm`
  - Lyhenne+väri rivi: `display:flex;gap:6px` — lyhenne-input `flex:1;min-width:0`, color-input `width:44px;height:44px` ilman tekstilabelia (§R: color-picker on itsessään selvä)
  - Tallenna-nappi: `confirm` tausta, `confirm-text`, `min-height:44px`, `flex:1`
  - Peruuta-nappi: `field-tint` tausta, `border-default`, `min-height:44px`

### SegmentOverlay (Leaflet-layer, `src/map/segment-overlay.ts`)
- Pätkäkaista: `weight: 8, opacity: 0.7`, väri rotaatiosta SEGMENT_COLORS (alla)
- DisplayName: pysyvä tooltip `permanent: true`, CSS-class `segment-label`
- Aukko (gap): `color: text-muted hex (#94a3b8), weight: 8, opacity: 0.3`
- SEGMENT_COLORS (6 väriä, rotaatio indeksin mukaan):
  `['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444']`

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

---

## §P Designperiaatteet (VISION.md:stä)

1. **Metsässä toimiva** — isot napit, korkea kontrasti, ei turhia elementtejä
2. **Max 2 nappia kriittisiin toimintoihin** — merkin lisäys, kuittaus, drive mode
3. **Sama työkalu eri rooleille** — ei kahta sovellusta, vain eri näkymät
4. **Nopea kuittaus** — yksi nappi riittää normaalitapauksessa
5. **Ei häiriöitä** — talkoolaiselle näytetään vain se mitä hän tarvitsee

Epäselvässä UX-päätöksessä: "Toimiiko talkoolainen yhdellä kädellä, metsässä, 10 sekunnissa?"
