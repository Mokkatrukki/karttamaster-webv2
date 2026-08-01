# UX-mobiilichecklist — mitä jokaisessa näkymässä PITÄÄ näkyä

Lähde: `VISION.md` §Käyttäjät + `DESIGN.md` §R/§K. Vahti: `e2e/ux-mobile-audit.spec.ts`
(kuvat `screenshots/audit_*.png`, mittaukset `screenshots/audit-json/*.json`).

**Mittari on geometrinen, ei DOM-olemassaolo.** "Nappi on olemassa" ei riitä — sen pitää olla
näkyvissä viewportissa ja ≥44×44px. Toiminto jonka löytää vain koodista ei ole olemassa
talkoolaiselle metsässä.

**Kaksi leveyttä:** 390px (iPhone 12–15, mediaani) ja 360px (halpa Android, kapein tuettu).
360 paljastaa vaakaleikkaukset joita 390 ei näytä.

## Kolme kovaa sääntöä (koskee kaikkia näkymiä)

1. **Ei vaakascrollia.** `document.scrollWidth ≤ innerWidth`. Karttakuori ei scrollaa (§R B108/V187).
2. **Ei elementtejä ruudun oikealla puolella.** `rect.right ≤ innerWidth` kaikelle näkyvälle
   paitsi Leaflet-panelle (kartta panoroi tarkoituksella).
3. **Kosketuskohde ≥44×44px** kaikelle `button, [role=button], a, input, select, textarea` (§A/V268).

---

## Talkoolainen — mobiili on ENSISIJAINEN

### `/patkat` — talkoolais-hub
| Pitää näkyä | Miksi |
|---|---|
| `.patkat-hero` | "Tervetuloa talkoilemaan" — vahvistaa että ollaan oikeassa paikassa |
| `.patkat-list` + `.patkat-row` | Kaikki pätkät: nimi + kuka tekee + status |
| `.patkat-row-open` | Linkki omaan pätkään — hubin ainoa syy olla olemassa |
| `.patkat-to-map` | "Kartalle →" |
| `.patkat-faq` | Aikataulut/ruokailut — se mitä kysytään WhatsAppissa |

### `/s/<koodi>` — KOTI-moodi (landing, V174)
Kartta on tässä **tarkoituksella piilossa** — koti on lähtöruutu, kartalle mennään napista.

| Pitää näkyä | Miksi |
|---|---|
| `#toolbar` + `#btn-menu` | Yläpalkki ei rivinylitä ≤360px (T233/V155) |
| `.segment-koti-tabbar` | 🎒 Varustelista / Kaikki merkit |
| `.segment-view-equipment` | Varustelista — mitä otetaan mukaan ennen lähtöä |
| `#btn-to-map` | "Kartalle →" — ainoa tie karttamoodiin |

### `/s/<koodi>` — merkit-välilehti
| Pitää näkyä | Miksi |
|---|---|
| `.segment-koti-panel[data-tab="merkit"]` | Merkkilista bulk-kuittausta varten |
| `.segment-view-markers-row` | Rivi + rasti SAMALLA rivillä (ei kahdella) |

### `/s/<koodi>` — KARTTA-moodi
| Pitää näkyä | Miksi |
|---|---|
| `#map` | Kartta on konteksti |
| `#btn-home-view` | 🏠 takaisin kotiin |
| `.segment-view-next-row` | **Seuraava merkki + ✓ Aseta** — talkoolaisen core-flow, max 2 nappia |

### `/s/<koodi>` — ⋯-valikko
| Pitää näkyä | Miksi |
|---|---|
| `#toolbar-menu` | Valikko avautuu ruudun sisään, ei reunan yli |
| `#btn-tk-gps` | GPS asuu VAIN täällä talkoolaiselle (T257/R8) |
| `#btn-tk-add-marker` | Merkin lisäys maastossa |
| `#btn-layer` | Karttatyyli (T233 siirsi toolbarista) |

### `/kasat` — autoporukka
| Pitää näkyä | Miksi |
|---|---|
| `.kasat-header` | Kuinka monta kasaa hakematta |
| `#kasat-map` | Missä kasat ovat — ainoa tapa tietää miten sinne pääsee |
| `#kasat-content` | Kasalista + varaus + "haettu" |

### Kirjautuminen (`/` ilman sessiota)
Lomake mahtuu ruudulle ilman zoomia; kentät ≥44px.

---

## Järjestäjä — mobiili on VÄLTTÄVÄ, muttei rikki

VISION §Järjestäjä: *"core-toiminnot eivät saa olla rikki tai saavuttamattomissa mobiililla —
kartan pitää latautua kokonaan, napit pitää osua, moodia ei saa vaihtaa vahingossa."*

| Näkymä | Pitää näkyä |
|---|---|
| Kartta | `#toolbar`, `#btn-list`, `#btn-menu`, `#map`, `#left-panel-toggle` — ✎ Muokkaa siirtyy ⋯-valikkoon ≤560px |
| Sivupaneeli auki | `#left-panel` kokonaan ruudun sisällä (drawer, ei 40px kaista) |
| Reittipätkät | `#btn-segment-create` + pätkärivit |
| Karttasuodatin | `.map-filter-sheet-trigger` → `.map-filter-groups` bottom sheet + sticky **Valmis** |
| Kaikki merkit | `.marker-overview` + hakukenttä + tilamonivalinta |
| ⋯-valikko | `#toolbar-menu`, `#btn-layer`, vaihevalitsin |
| Pätkämodaali | Modaali `min(340px, 92vw)`, toimintorivi `flex-wrap` |
| Alueet | Aluerivit + komponenttien avaus |
| `/inventory` | `#inventory-header`, `#inventory-content` |
| `/loki` | `#loki-header`, `#loki-content` — suodattimet eivät leikkaa |
| `/admin` | `#admin-header`, `#admin-content`, `#admin-settings` — käyttäjätaulu latautuu korteiksi ≤700px |

---

## Löydöt 2026-08-01 (ensimmäinen ajo)

| Vika | Näkymä(t) | Korjaus |
|---|---|---|
| `#btn-menu` (⋯) leikkautui ruudun yli (right=409 @ 390px) | järjestäjän kartta, kaikki | ✎ Muokkaa → ⋯-valikkoon ≤560px (`#btn-menu-map-mode`) |
| "↩ Palauta asettamattomaksi" leikkautui (right=422) | talkoolaisen merkkilista | `flex-basis: calc(100% - 44px)` (basis ei huomioinut marginia) |
| Rasti omalla rivillään merkin nimen yläpuolella | talkoolaisen merkkilista | `.segment-view-markers-row` `flex:1 1 0` `width:100%`:n tilalle |
| Varustelistan rastit 22×22px | talkoolaisen varustelista | jaettu 44×44-kaava (V303), näkyvä ruutu 22px |
| `.btn--sm` 36px | ✎ Muokkaa varusteita / pätkän rajoja | `--sm` = typografinen variantti, 44px säilyy |
| "Poista pätkä" 88×32px | pätkämodaali | `min-height: 44px` |
| Alue-rivin ▶ 32×44px | järjestäjän aluepaneeli | 44×44 |
| `#left-panel-toggle` 6px ruudun ulkopuolella | järjestäjän kartta | kutistettu kaista 32→44px, suodatinbarin sisennys 40→48px |
| Admin-käyttäjätaulu 551px → vaakascroll | `/admin` | rivi = kortti ≤700px, otsikot `data-label`ista |
| FAQ-editorin teksti 82px leveä (sanat katkesivat) | `/admin` | Crepen `padding: 0 120px` → 16px ≤700px |
| GPS-pilleri peitti suodatin-sheetin "Valmis" | järjestäjän kartta | `#gps-control` z-index 1100→1050 |

### Toinen aalto — modaalit, purku, tumma teema

| Vika | Näkymä | Korjaus |
|---|---|---|
| **Tumma teema ei pätenyt viidellä sivulla** — `/patkat`, `/kasat`, `/inventory`, `/admin`, `/loki` | kaikki paitsi kartta | `initTheme()` jokaiseen entrypointiin; vahti: "teema pätee sivulla …" |
| Aluemodaalin kentät 24–33px korkeita | `.area-*-input`, `.feat-name-input` | `min-height: 44px` |
| Väriswatch 22×44, poisto ✕ 36×32 | aluemodaali | 44×44 (swatch: näkyvä 22px `background-clip: content-box`) |
| "Kierto (°)" label ja sen kenttä eri riveillä | aluemodaali | label kääriytyy kentän ympärille → pari on yksi flex-lapsi |
| "+ Lisää osa" 88×36, suosikkirasti 18×18 | merkkikirjastomodaali | 44px; rasti jaettuun V303-kaavaan |

### Kolmas aalto — admin-rooli (käyttäjähavainto 2026-08-01)

| Vika | Näkymä | Korjaus |
|---|---|---|
| **"Suodata" asettui ▶-togglen päälle ja nappasi klikin** — suunnittelupaneelia ei saanut auki | järjestäjän kartta **admin-tilillä**, ≤480px | `layoutRole()`: admin → järjestäjä-layout |
| ✎ Muokkaa katosi kokonaan ≤560px | admin | sama korjaus |
| Talkoolaisen ⋯-valikkolohko näkyi | admin | sama korjaus |

**Roolisidonnainen CSS on ansa.** `[data-role="järjestäjä"]`-sääntöjä oli viisi ja **kaikki**
ohittivat adminin hiljaa. Korjaus on yksi kartta (`layoutRole`), ei viisi selektorilaajennusta.

**Auditoi jokainen rooli erikseen.** Fixtuurin `role` oli aina `järjestäjä` ∴ 53 vihreää
näkymää eivät nähneet tätä lainkaan. Nyt mukana `admin-kartta_390` + `admin-valikko_390`.

**Geometria ei riitä.** Päällekkäisyys mitataan `elementFromPoint`illa: nappi voi olla
oikean kokoinen ja oikeassa paikassa, ja silti toinen elementti syö sen klikin.

**Kaamos-tumma auditoidaan omana kierroksenaan.** Teema ei saa muuttaa geometriaa — jos muuttaa,
jokin luki värin kokoa määräävästä paikasta. Lisäksi jokaiselle sivulle on erillinen vahti joka
vaatii `<html data-theme="dark">`: teemavalinta on käyttäjän eikä se saa kadota sivunvaihdossa.
Headless-kuvassa natiivi `<select>` voi renderöityä vaaleana vaikka laskennallinen tyyli on tumma
— luota mittariin, älä pikseliin, tässä yhdessä asiassa.

---

## Miten audit ajetaan

```bash
bunx playwright test e2e/ux-mobile-audit.spec.ts --workers=2
```

Kuvat: `screenshots/audit_<näkymä>_<leveys>.png`. Mittaukset: `screenshots/audit-json/`.
Uusi näkymä → lisää rivi tähän tauluun JA `must`-lista speciin. Lista jota vahti ei lue mätänee.
