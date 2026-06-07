# DESIGN.md — Karttamaster design-sopimukset

Ainoa totuus tyyleistä. CSS elää `src/style.css`:ssä (Vite importtaa `main.ts`:stä).
CSS custom properties: `:root`-lohko tiedoston alussa — muuta tokeneja sieltä, ei hardcoded-hexeistä.
Inline SVG-tyylit (dynaamiset, bearing-riippuvaiset): `src/map/icons.ts`.

---

## §C Värit

| Token          | Arvo                        | Käyttö                              |
|----------------|-----------------------------|-------------------------------------|
| bg-primary     | `#0f172a`                   | Toolbar, route-bar tausta           |
| bg-card        | `#1e293b`                   | Modaalit, dropdownit, kortit        |
| text-primary   | `#e2e8f0`                   | Pääteksti, napit, otsikot           |
| text-muted     | `#94a3b8`                   | Sekundaaritieto, h1, meta-napit     |
| text-meta      | `#64748b`                   | Metatieto (km-lukema)               |
| accent         | `#f59e0b`                   | Päänappi "Lisää merkki"             |
| accent-text    | `#111`                      | Teksti accent-taustan päällä        |
| danger         | `#ef4444`                   | Poistopainike, place-mode aktiivi   |
| border-subtle  | `rgba(255,255,255,0.06)`    | Osastojen erottimet                 |
| border-card    | `rgba(255,255,255,0.08)`    | Listarivien separator               |
| border-default | `rgba(255,255,255,0.10)`    | Korttirajat, dropdownit             |
| border-strong  | `rgba(255,255,255,0.12)`    | Napit (btn-list)                    |
| overlay        | `rgba(0,0,0,0.5)`           | Modaalin backdrop                   |
| hover-light    | `rgba(255,255,255,0.08)`    | Hover-tila napeilla ja riveillä     |
| warn-highlight | `rgba(245,158,11,0.12)`     | Uusi/korostettu listakohta          |

### Merkki-värit (karttaikonit, src/map/icons.ts)

| Token          | Hex       | Merkki                     |
|----------------|-----------|----------------------------|
| marker-right   | `#16a34a` | Oikealle (vihreä)          |
| marker-left    | `#2563eb` | Vasemmalle (sininen)       |
| marker-up-r    | `#b45309` | Tuleva oikealle (oranssi)  |
| marker-up-l    | `#7c3aed` | Tuleva vasemmalle (violetti)|

### Status-värit (merkki-elinkaari, src/ui/marker-list.ts + style.css)

Käytetään tummalla taustalla (bg-card `#1e293b`) — värit valittu WCAG AA -kontrastille pieniä tekstejä varten.

| Token              | Teksti hex | Taustaopasiteetti | Status           |
|--------------------|------------|-------------------|------------------|
| status-suunniteltu | `#94a3b8`  | `rgba(255,255,255,0.06)` | Suunniteltu |
| status-asetettu    | `#4ade80`  | `rgba(74,222,128,0.10)`  | Asetettu ✓  |
| status-tarkistettu | `#93c5fd`  | `rgba(147,197,253,0.10)` | Tarkistettu ✓|
| status-kerätty     | `#6ee7b7`  | `rgba(110,231,183,0.10)` | Kerätty     |
| status-ei_tarpeen  | `#fbbf24`  | `rgba(251,191,36,0.10)`  | Ei tarpeen  |

Kuittaus-napit (talkoolainen): `btn-status-primary` bg `#15803d` (5.0:1 kontrastisuhde #fff kanssa).

**Sääntö:** Käytä vain yllä olevia arvoja. Älä keksi uusia hex-koodeja suoraan CSS:ään.
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
- Kiinteä yläreuna, `z-index: 200`
- Tausta: `bg-primary`, alaraja: `border-bottom: 1px solid border-subtle`
- Napit: `padding: 6px 12px`, `border-radius: 6px`, `font-size: 12px`, `font-weight: 600`
- ⚠️ **Puute:** toolbar-napeilla ei `min-height: 44px` — korjattava

### Role-toggle (`#btn-role`)
- Toolbarissa, toolbar-nappi tyyli
- `min-height: 44px` (§R pakollinen)
- Inactive: `color: text-muted`, `background: transparent`
- Active: `background: accent`, `color: accent-text`
- Teksti: `"Järjestäjä"` tai `"Talkoolainen"` — ei ikoneja (aria)

### Route-bar (`#route-bar`)
- Kiinteä alareuna, `z-index: 100`
- Tausta: `bg-primary`, shadow ylöspäin
- Navigointipainikkeet (`btn-route-prev/next`): `min-height: 36px` — nostettava 44px:ään

### Dropdownit (`#sign-type-dropdown`, `#floating-picker`)
- Tausta: `bg-card`, border: `border-default`, `border-radius: 10px`
- Shadow: `0 8px 24px rgba(0,0,0,0.4)`
- `z-index: 1003–2000` (floating-picker alempana)

### Marker-modaali (`#marker-modal`)
- Tausta: `bg-card`, border: `border-default`, `border-radius: 14px`
- Shadow: `0 16px 48px rgba(0,0,0,0.5)`
- Backdrop: `overlay` + `backdrop-filter: blur(2px)`
- Leveys: `min(340px, 92vw)`, `max-height: 60vh`

### Listarivit (`.marker-item`)
- Padding: `10px 14px`, separator: `border-card`
- Hover: `hover-light`
- Uusi kohta: `warn-highlight` background

### Sign-type-napit (`.sign-type-btn`)
- `min-height: 44px` ✓ (touch-target OK)
- Väriswatch: `22×22px`, `border-radius: 6px`
- Hover: `rgba(255,255,255,0.08)`

### Karkkimerkit (SVG, `src/map/icons.ts`)
- Koko: `32×50px` (W×H)
- Pyöreä ikoni: `r=14`, ankkuri pisteessä `(16, 38)`
- Värit: ks. §C Merkki-värit
- Outline: `stroke: white, stroke-width: 2`

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

| ID  | Ongelma                                              | Kriittisyys |
|-----|------------------------------------------------------|-------------|
| U1  | `button` global: ei `min-height: 44px` → toolbar-napit liian pieniä | Korkea |
| U2  | `#btn-route-prev/next`: `min-height: 36px` → alle touch-targetin | Korkea |
| U3  | `#btn-modal-close`: `padding: 4px 8px` → paljon alle 44px | Korkea |
| U4  | `aria-label` puuttuu: btn-modal-close, btn-route-prev/next, route-tab-vis | Keski |
| U5  | Border-radius epäyhtenäinen: 6px / 7px / 10px / 14px sekaisin | Matala |

**U1–U3 korjataan ennen seuraavaa kenttätestausta.** Talkoolainen metsässä ei pääse
pieniin nappeihin hanskat kädessä.

---

## §P Designperiaatteet (VISION.md:stä)

1. **Metsässä toimiva** — isot napit, korkea kontrasti, ei turhia elementtejä
2. **Max 2 nappia kriittisiin toimintoihin** — merkin lisäys, kuittaus, drive mode
3. **Sama työkalu eri rooleille** — ei kahta sovellusta, vain eri näkymät
4. **Nopea kuittaus** — yksi nappi riittää normaalitapauksessa
5. **Ei häiriöitä** — talkoolaiselle näytetään vain se mitä hän tarvitsee

Epäselvässä UX-päätöksessä: "Toimiiko talkoolainen yhdellä kädellä, metsässä, 10 sekunnissa?"
