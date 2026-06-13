# DESIGN.md — pohja (käytetään `init`-komennossa)

Luo tai päivitä `DESIGN.md` tässä muodossa. Täytä todelliset arvot `index.html`:stä —
älä kopioi placeholdereita suoraan.

```markdown
# DESIGN.md — Karttamaster design-sopimukset

## §C Värit
| Token       | Arvo      | Käyttö                    |
|-------------|-----------|---------------------------|
| --surface-app   | #...  | Sovelluksen tausta        |
| --surface-card  | #...  | Modaalit, dropdownit      |
| --text-body     | #...  | Pääteksti                 |
| --text-muted    | #...  | Sekundaaritieto           |
| --text-meta     | #...  | Metatieto (km, pvm)       |
| --accent        | #...  | Päänapin väri             |
| --danger        | #...  | Poisto, virhe             |
| --border-subtle | ...   | Korttirajat               |

Merkki-värit (karttaikonit):
| right          | #... | Oikealle                  |
| left           | #... | Vasemmalle                |
| upcoming-right | #... | Tuleva oikealle           |
| upcoming-left  | #... | Tuleva vasemmalle         |

## §T Typografia
- Fontti: (lue index.html:stä)
- Koot: 11px (meta) / 12px (nappi/label) / 13px (body) / 14px (otsikko)
- Painot: 600 (napit), 700 (otsikot)
- Letter-spacing: 0.04em (uppercase otsikot), 0.01em (napit)

## §S Spacing
- Grid: 4px perusyksikkö
- Padding pienissä napeissa: 6px 12px
- Padding isommissa: 8px–14px 16px
- Gap: 4px / 6px / 8px / 10px

## §R Responsive
- Mobiili-first, ei frameworkia
- Viewport: `maximum-scale=1.0, user-scalable=no` (karttasovellus)
- Min touch target: **44×44px** kaikille interaktiivisille elementeille
- Modaali: `min(340px, 92vw)` — toimii 320px-näytöllä
- Käytä flexbox/grid ja `min()`-funktioita ennen media querieja

## §K Komponentit

### Toolbar
- Kiinteä yläreuna, `z-index: 200`
- Tumma tausta, bottom-border hieno viiva
- Napit: `6px 12px` padding, `border-radius: var(--radius-sm)`

### Route-bar
- Kiinteä alareuna, `z-index: 100`
- Sama tumma tausta, shadow ylöspäin

### Modaalit / Dropdownit
- `var(--surface-card)` tausta, border `var(--border-card)`, `border-radius: var(--radius-md)`
- Box-shadow: `0 16px 48px rgba(0,0,0,0.5)`
- Backdrop: `var(--overlay)` + `backdrop-filter: blur(2px)`

### Listarivit
- Hover: `var(--hover)`
- Separator: `1px solid var(--border-subtle)`
- Poistopainike: min 44×44px, `var(--danger)`

### Sign-type-napit
- `min-height: 44px` (touch target)
- Väriswatch: 22×22px, `border-radius: var(--radius-sm)`

## §A Accessibility
- WCAG AA tavoite: kontrastisuhde ≥4.5:1 tekstille
- Kaikki interaktiiviset elementit: min 44×44px
- `aria-label` tarvitaan ikoneille joilla ei ole tekstiä
- Focus-indikaattori: ei poistettu (browser default tai custom)
```

## Huomiot init-vaiheessa

- Lue todelliset CSS custom property -arvot `src/style.css`:stä (tai `index.html <style>`-lohkosta)
- Kirjaa rikkomukset: jos löydät hardkoodattuja hex-arvoja tokenien sijaan → mainitse auditointiosiossa
- Komponentit §K:ssa: lisää vain ne jotka oikeasti olemassa, älä kopioi pohjan placeholdereita
