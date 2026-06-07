---
name: karttamaster-testaaja
description: >
  Karttamaster-projektin älykäs testaaja. Tietää testauskolmion (Vitest-pure / Vitest-jsdom /
  Playwright) ja osaa päättää oikean tason jokaiselle featurelle. Arvioi featuret myös
  käyttäjänäkökulmasta: toimiiko talkoolaiselle metsässä, onko järjestäjällä riittävä
  tilannekuva. Käytä aina kun: kirjoitetaan uusia testejä, arvioidaan onko feature valmis,
  tarkistetaan testikattavuus uudelle taskille, tai mietitään tarvitaanko Playwright vai
  riittääkö Vitest. Käytä myös `tarkista`-komennolla auditoimaan koko projektin testikattavuus.
---

# Karttamaster-testaaja

Lue ensin:
- VISION.md § Testausperiaatteet ja § Käyttäjät — nämä ovat testauksen lähde
- COMPONENTS.md — kertoo komponentin testattavuustason

## Komennot

### `tarkista` — auditoi testikattavuus

Aja seuraava tarkistus ja raportoi tulokset:

1. **Taso 1 -aukot** — listaa jokainen `src/logic/`-tiedosto ja tarkista onko sille testi `tests/`-kansiossa:
   ```
   src/logic/bearing.ts      → tests/bearing.test.ts       ✓/✗
   src/logic/gpx.ts          → tests/gpx.test.ts           ✓/✗
   src/logic/multi-route.ts  → tests/multi-route.spec.ts   ✓/✗
   src/logic/sign-picker.ts  → tests/sign-picker.spec.ts   ✓/✗
   src/logic/tile-layers.ts  → tests/tile-layers.spec.ts   ✓/✗
   src/logic/types.ts        → (tyyppitiedosto, ei testiä tarvita)
   ```
   Uudet `src/logic/`-tiedostot jotka puuttuvat listasta → liputa.

2. **Taso 2 -aukot** — listaa jokainen `src/ui/`-tiedosto ja tarkista onko jsdom-testi:
   ```
   src/ui/marker-list.ts → tests/marker-list.test.ts  ✓/✗
   ```
   Uudet `src/ui/`-tiedostot jotka puuttuvat → liputa.

3. **Taso 3 -aukot** — tarkista onko nämä kriittiset polut Playwright-testattuna:
   - Merkki asetetaan kartalle → näkyy merkkilistassa
   - Drive mode käynnistyy ja etenee
   - GPS-navigointi (kun toteutettu)

4. **Todo-testit** — aja `bun run test` ja laske `↓`-rivit. Nämä ovat kirjoitettuja mutta toteutumattomia — muistuta mitkä ovat prioriteetti.

Raporttimuoto:
```
## Testikattavuus YYYY-MM-DD
Taso 1: N/M moduulia katettu  [puuttuvat: ...]
Taso 2: N/M komponenttia katettu  [puuttuvat: ...]
Taso 3: N kriittistä polkua katettu  [puuttuvat: ...]
Todo-testit: N kpl odottaa toteutusta
```

---

## Testauskolmio

### Taso 1: Vitest-pure (nopea, ei DOM)
**Milloin:** logiikka elää `src/logic/` — ei Leaflet-riippuvuutta, ei DOM:ia.
**Moduulit:** `src/logic/bearing.ts`, `src/logic/gpx.ts`, `src/logic/multi-route.ts`, `src/logic/sign-picker.ts`, `src/logic/tile-layers.ts` — ja kaikki tulevat `src/logic/`-tiedostot.
**Esimerkkejä:** bearing-laskenta, GPX-parsinta, pätkälogiikka, merkkikirjasto-haku, statussiirtymät, varustelistan laskenta, navigointilogiikka.

**Kirjoita ensin tänne.** Jos et pysty kirjoittaa Taso 1 -testiä, logiikka on väärässä kerroksessa — siirrä se ensin `src/logic/`-kansioon ennen testin kirjoittamista.

### Taso 2: Vitest + jsdom (keskinopea, DOM ilman selainta)
**Milloin:** komponentti elää `src/ui/` — DOM-rakenne tai event-logiikka on tärkeä, mutta `src/map/`-riippuvuutta (Leaflet) ei ole.
**Moduulit:** `src/ui/marker-list.ts` — ja kaikki tulevat `src/ui/`-tiedostot.
**Esimerkkejä:** merkkilistat, varustelista-komponentti, statuspaneeli, lomakkeet.

**Jsdom-testin pohja tälle projektille:**
```typescript
// tests/marker-list.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

// Jsdom-ympäristö — lisää vitest.config.ts:hen jos puuttuu:
// test: { environment: 'jsdom' }

describe('renderMarkerList', () => {
  beforeEach(() => {
    // Rakenna minimaalinen DOM jota ui/marker-list.ts odottaa
    document.body.innerHTML = `
      <span id="marker-count"></span>
      <div id="marker-modal-items"></div>
    `
  })

  it('näyttää "Ei merkkejä" kun lista tyhjä', async () => {
    const { renderMarkerList } = await import('../src/ui/marker-list')
    // Stub MarkerManager jolla ei merkkejä
    const stubManager = { getAll: () => [], panTo: () => {}, remove: () => {} } as any
    renderMarkerList(stubManager)
    expect(document.getElementById('marker-modal-items')!.textContent).toContain('Ei merkkejä')
    expect(document.getElementById('marker-count')!.textContent).toBe('0')
  })

  it('renderöi merkkirivin per merkki', async () => {
    const { renderMarkerList } = await import('../src/ui/marker-list')
    const stubMarker = { id: 'abc', type: 'right' as const, distanceFromStart: 1500, bearing: 90, lat: 0, lon: 0, routeIds: ['35km'] }
    const stubManager = { getAll: () => [stubMarker], panTo: () => {}, remove: () => {} } as any
    renderMarkerList(stubManager)
    const items = document.querySelectorAll('.marker-item')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toContain('1.50 km')
  })
})
```

**Huom:** jsdom ei tue Leaflet-renderöintiä. Jos `src/ui/`-komponentti importtaa `src/map/`-moduulin, käytä stubbeja tai siirrä logiikka `src/logic/`-kerrokseen.

### Taso 3: Playwright (hidas, kallis — minimoi)
**Milloin:** komponentti elää `src/map/` tai kriittinen käyttäjäpolku vaatii oikean selaimen ja Leaflet-kartan.
**Moduulit:** `src/map/markers.ts`, `src/map/drive.ts`, `src/map/icons.ts` — näitä ei voi testata jsdom:lla.

**Hyväksyttäviä Playwright-testejä:**
- Merkki asetetaan kartalle → näkyy merkkilistassa
- Drive mode käynnistyy, eteneminen toimii
- GPS-navigointi näyttää seuraavan merkin

**Ei Playwrightia:** logiikka joka voidaan eristää `src/logic/`-kerrokseen, `src/ui/`-komponentit ilman karttaa, laskentafunktiot.

---

## Käyttäjätestiperspektiivi

Tekninen testi ei riitä. Jokainen uusi feature arvioidaan myös näillä kysymyksillä:

### Talkoolaistesti (metsässä, stressi, huono yhteys)
- Saako kriittisen toiminnon tehtyä max 2 napilla?
- Toimiiko offline tai heikolla yhteydellä?
- Onko nappi riittävän iso (min 44px touch target)?
- Jos tekee virheen, voiko korjata helposti?
- Onko näkymä selkeä pienellä näytöllä?

### Järjestäjätesti (toimisto, iso näyttö, hallinta)
- Saako tilannekuvan yhdellä silmäyksellä?
- Voiko delegoida ja seurata edistymistä?
- Onko kaikki tarvittava käden ulottuvilla suunnittelunäkymässä?

Jos feature läpäisee teknisen testin mutta epäonnistuu käyttäjätestissä → feature on kesken.

---

## Testitapausten kirjoittaminen

### Rakenne Vitest-pure testille (src/logic/)
```typescript
describe('<ModuulinNimi>', () => {
  it('<mitä testataan>', () => {
    // Arrange: minimaalinen syöte
    // Act: kutsu funktiota
    // Assert: tarkista tulos
  })
})
```

### Vitest-konfiguraatio jsdom-testejä varten
Jos `vitest.config.ts` ei ole vielä asetettu jsdom:lle, tarkista onko `environment: 'jsdom'` päällä tests-kansiossa. Voi myös asettaa per-tiedosto kommentilla:
```typescript
// @vitest-environment jsdom
```

### Mitä ei testata
- Leaflet-sisäistä toimintaa (Leaflet testaa itsensä)
- DOM-rakenteen visuaalista ulkonäköä
- Tietoja joita ei voi deterministisesti ennustaa (GPS-koordinaatit oikeassa metsässä)

---

## Testikattavuuden tarkistus — task valmis?

Kun uusi §T-task on valmis, tarkista:
1. Onko uusi logiikka `src/logic/`-kansiossa? Jos on → Taso 1 -testi pakollinen.
2. Onko uusi UI-komponentti `src/ui/`-kansiossa ilman Leaflet-riippuvuutta? → Taso 2 -testi.
3. Onko kyseessä kriittinen karttainteraktio (`src/map/`)? → Taso 3 -testi minimaalinen.
4. Läpäisee sekä teknisen testin että käyttäjätestiperspektiivin?

Puuttuva testi Taso 1:lla on aina bugiriski — logiikka ilman testiä tarkoittaa että refaktorointi rikkoo sen hiljaa.

---

## Suhde muihin skilleihin

- `/karttamaster-arkkitehtuuri` kertoo komponentin testattavuustason ja COMPONENTS.md-sijainnin
- `/ck:build` kutsuu tätä tarkistamaan testikattavuuden ennen kuin task merkataan valmiiksi
- `/ck:spec` käyttää tätä arvioimaan §V-invariantteja uusille featureille
