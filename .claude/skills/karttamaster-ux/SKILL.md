---
name: karttamaster-ux
description: >
  Karttamaster-projektin UX/design-vahtimestari. Ylläpitää DESIGN.md:tä (ainoa totuus
  tyyleistä), auditoi komponentteja, korjaa UX-rikkomukset ja generoi prompteja ulkoisiin
  design-palveluihin (v0, Lovable, Claude Artifacts, Figma). Tuntee käyttäjät: talkoolainen
  metsässä (mobiili, hanskat, aurinko) ja järjestäjä (desktop). Integroituu rakentajaan ja
  testaajaan. Käytä aina kun: puhutaan ulkoasusta, tyyleistä, mobiilista, responsiivisuudesta,
  kontrasteista, touch-kohteista, design-yhtenäisyydestä, tai halutaan prompt ulkoiseen
  design-työkaluun. Kutsutaan automaattisesti kun testaaja löytää UX-ongelman tai rakentaja
  rakentaa uuden UI-komponentin.
---

# karttamaster-ux — UX/design-vahtimestari

Lue ensin `DESIGN.md` (design-sopimukset). Jos ei ole, luo se ensin `init`-komennolla.
Lue `VISION.md` §Käyttäjät ymmärtääksesi kenelle rakennetaan.

## Nykyinen design-tila (lähde: index.html `<style>`)

CSS elää `index.html`:n `<style>`-lohkossa. TypeScript-tiedostoissa on myös inline SVG-tyylejä
(`src/map/icons.ts`). Ei erillistä CSS-tiedostoa — muutokset menevät `index.html`:ään tai
komponenttikohtaiseen TypeScript-tiedostoon.

---

## Komennot

### `init` — luo DESIGN.md

Jos `DESIGN.md` ei ole, distillaa se `index.html`:stä:
1. Lue `index.html` kokonaan
2. Kirjoita `DESIGN.md` alla olevan rakenteen mukaan (ks. §DESIGN.md rakenne)
3. Ilmoita mitä puuttuu tai on epäyhtenäistä
4. Lisää `DESIGN.md` `.gitignore`:en jos ei siellä jo — ei, oikeasti: lisää git-seurantaan `git add DESIGN.md`

### `auditoi` — tarkista yhtenäisyys

1. Lue `DESIGN.md` — mitkä ovat sopimukset?
2. Lue `index.html` `<style>`-lohko — noudatetaanko värejä, spacingia, border-radiuksia?
3. Lue `src/map/icons.ts` ja muut TS-tiedostot joissa inline-tyylejä
4. Tarkista touch-targetit: onko kaikki interaktiiviset elementit ≥44px?
5. Tarkista kontrasti: teksti taustan päälle — onko WCAG AA (4.5:1)?
6. Tarkista mobiili: onko `min-width`-raja-arvoja jotka rikkoutuvat pienellä näytöllä?

Raporttimuoto:
```
## UX-audit YYYY-MM-DD
§C Värit: [OK / rikkomukset]
§T Typografia: [OK / rikkomukset]
§S Spacing: [OK / rikkomukset]
§R Responsive: [OK / rikkomukset]
§K Komponentit: [OK / rikkomukset]
§A Accessibility: [OK / rikkomukset]
Kriittiset: [lista]
Korjattu tässä sessiossa: [lista]
Delegoitu: [bugi → /ck:spec bug: tai arkkitehtuuri → /karttamaster-arkkitehtuuri]
```

### `T<n>` tai `komponentti <nimi>` — tarkista yksittäinen komponentti

Kun rakentaja on valmis tai testaaja delegoi:
1. Tunnista mihin HTML/CSS-elementteihin uusi koodi vaikuttaa
2. Tarkista DESIGN.md:n §K-sopimusta kyseiselle komponentille
3. Tarkista touch target, kontrasti, mobiili-käyttäytyminen
4. Jos rikkomus: korjaa `index.html`:ssä tai ao. TS-tiedostossa
5. Raportoi: "Komponentti X: [OK / korjattu / delegoitu]"

### `prompt <palvelu> [kuvaus]` — generoi design-prompti

Generoi valmis tekstiprompt ulkoiseen palveluun. Palvelut:
- `v0` — Vercel v0 (React-komponentti tai layout)
- `lovable` — Lovable.dev (full app tai sivu)
- `artifacts` — Claude Artifacts (interaktiivinen demo)
- `figma` — Figma AI tai FigJam

Promptin rakenne:
1. Konteksti: "SyöteMTB 2026 merkintätyökalu, käytetään mobiilissa metsässä"
2. Käyttäjä: talkoolainen (mobiili, stressi) tai järjestäjä (desktop, hallinta)
3. DESIGN.md §C väripaletti (hex-arvot)
4. Komponenttikohtaiset vaatimukset (DESIGN.md §K)
5. Responsiivisuus ja touch-target vaatimukset
6. Mikä pitää säilyttää / mikä saa muuttua

Tulosta pelkkä prompti, valmiina copy-pastettavaksi.

### `korjaa <rikkomus>` — ota käyttöön UX-korjaus

1. Tunnista mihin tiedostoon korjaus menee (`index.html` vai `src/`)
2. Lue tiedosto
3. Tee korjaus
4. Varmista että ei riko muuta

**Älä muuta** `src/logic/`-kerrosta — UX koskee vain `src/ui/`, `src/map/` visual-osia ja `index.html`.
Jos korjaus vaatii logiikkamuutoksen → kutsu `/karttamaster-arkkitehtuuri`.

---

## DESIGN.md rakenne

Luo tai päivitä tässä muodossa:

```markdown
# DESIGN.md — Karttamaster design-sopimukset

## §C Värit
| Token       | Hex       | Käyttö                    |
|-------------|-----------|---------------------------|
| bg-primary  | #0f172a   | Toolbar, route-bar tausta |
| bg-card     | #1e293b   | Modaalit, dropdownit      |
| text-primary| #e2e8f0   | Pääteksti                 |
| text-muted  | #94a3b8   | Sekundaaritieto           |
| text-meta   | #64748b   | Metatieto (km, pvm)       |
| accent      | #f59e0b   | Päänapin väri (lisää merkki) |
| danger      | #ef4444   | Poisto, virhe             |
| border      | rgba(255,255,255,0.08-0.12) | Korttirajat   |

Merkki-värit (karttaikonit):
| right          | #16a34a | Oikealle (vihreä)         |
| left           | #2563eb | Vasemmalle (sininen)      |
| upcoming-right | #b45309 | Tuleva oikealle (oranssi) |
| upcoming-left  | #7c3aed | Tuleva vasemmalle (violetti)|

## §T Typografia
- Fontti: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif
- Koot: 11px (meta) / 12px (nappi/label) / 13px (body/komponentti) / 14px (otsikko)
- Painot: 600 (napit), 700 (otsikot)
- Letter-spacing: 0.04em (h1 uppercase), 0.01em (napit)

## §S Spacing
- Grid: 4px perusyksikkö
- Padding pienissä napeissa: 6px 12px
- Padding isommissa: 8px-14px 16px
- Gap: 4px / 6px / 8px / 10px

## §R Responsive
- Mobiili-first, ei frameworkia
- Viewport: `maximum-scale=1.0, user-scalable=no` (karttasovellus, ei tekstizoomausta)
- Min touch target: **44×44px** kaikille interaktiivisille elementeille
- Modaali: `min(340px, 92vw)` — toimii 320px-näytöllä
- Kirjoita media queries vain jos välttämätöntä — käytä flexbox/grid ja `min()`-funktioita

## §K Komponentit

### Toolbar
- Kiinteä yläreuna, `z-index: 200`
- Tumma tausta `bg-primary`, bottom-border `rgba(255,255,255,0.06)`
- Napit: `6px 12px` padding, `border-radius: 6px`

### Route-bar
- Kiinteä alareuna, `z-index: 100`
- Sama tumma tausta, shadow ylöspäin

### Modaalit / Dropdownit
- `bg-card` tausta, border `rgba(255,255,255,0.1)`, `border-radius: 10-14px`
- Box-shadow: `0 8px-16px 24-48px rgba(0,0,0,0.4-0.5)`
- Backdrop: `rgba(0,0,0,0.5)` + `backdrop-filter: blur(2px)`

### Listarivit
- Hover: `rgba(255,255,255,0.05-0.08)`
- Separator: `border-bottom: 1px solid rgba(255,255,255,0.06)`
- Poistopainike: min 44×44px, `#ef4444`

### Sign-type-napit
- `min-height: 44px` (touch target)
- Väriswatch: 22×22px, `border-radius: 6px`

## §A Accessibility
- WCAG AA tavoite: kontrastisuhde ≥4.5:1 tekstille
- Kaikki interaktiiviset elementit: min 44×44px
- `aria-label` tarvitaan ikoneille joilla ei ole tekstiä
- Focus-indikaattori: ei poistettu (browser default tai custom)
```

---

## Käyttäjäkonteksti (VISION.md:stä)

### Talkoolainen metsässä
- Laite: älypuhelin, mobiili
- Olosuhteet: aurinko (kontrasti tärkeä!), käsineet (touch-target ≥44px!), liikkeellä
- Kriittinen toiminto: merkin asettaminen ja drive mode — max 2 napin takana
- Ei häiriöitä: ei turhia elementtejä näytöllä

### Järjestäjä toimistossa
- Laite: laptop/desktop
- Tarpeet: tilannekuva kaikista merkeistä, reiteistä, edistymisestä
- Hallinta: lisäys, poisto, järjestys

**UX-päätöksessä epäselvää?** Kysy: "Toimiiko talkoolainen yhdellä kädellä, metsässä, 10 sekunnissa?"

---

## Automaattiset kutsut muihin skilleihin

| Tilanne | Kutsu |
|---------|-------|
| UX-ongelma vaatii logiikkamuutosta | `/karttamaster-arkkitehtuuri feature <kuvaus>` |
| Löytyy bugi (ei UX vaan toiminnallinen) | `/ck:spec bug: <kuvaus>` |
| Uusi komponentti tarvitsee design-sopimusta | Lisää §K-lohkoon `DESIGN.md`:hen |
| Testaaja delegoi UX-ongelman | Suorita `komponentti <nimi>` ja korjaa |

---

## Suhde muihin skilleihin

- `/karttamaster-rakentaja` kutsuu UX:ää kun rakentaa `src/ui/`-tason komponentin
- `/karttamaster-testaaja` delegoi UX-bugit (touch target, kontrasti, mobiili) UX-skillille
- `/karttamaster-arkkitehtuuri` koordinoi kun UX-muutos vaatii kerrossiirtoa
- `/ck:spec` lisää UX-taskit §T:hen jos korjaus on iso työ

UX ei muuta `src/logic/`-kerrosta. Vain ulkoasu ja `src/ui/` + `index.html`.
