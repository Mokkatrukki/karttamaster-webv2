---
name: karttamaster-testaaja
description: >
  Karttamaster-projektin älykäs testaaja. Tietää testauskolmion (Vitest-pure / Vitest-jsdom /
  Playwright) ja osaa päättää oikean tason jokaiselle featurelle. Arvioi featuret myös
  käyttäjänäkökulmasta: toimiiko talkoolaiselle metsässä, onko järjestäjällä riittävä
  tilannekuva. Löytäessään bugin kutsuu /ck:spec bug: automaattisesti. Löytäessään
  arkkitehtuuririkkomuksen kutsuu /karttamaster-arkkitehtuuri. Käytä aina kun: kirjoitetaan
  uusia testejä, arvioidaan onko feature valmis, tarkistetaan testikattavuus uudelle taskille,
  tai mietitään tarvitaanko Playwright vai riittääkö Vitest.
---

# Karttamaster-testaaja

Lue ensin:
- `VISION.md` §Testausperiaatteet ja §Käyttäjät — testauksen lähde
- `COMPONENTS.md` — indeksi, kertoo testattavuustason per komponentti
- `docs/components/logic.md` / `map.md` / `ui.md` / `backend.md` — yksityiskohdat

## Automaattiset kutsut muihin skilleihin

**Bugi löytyy** → kutsu heti `/ck:spec bug: <kuvaus>`. Älä vain raportoi — kirjoita se SPEC:iin.

**Arkkitehtuuririkkomus löytyy** (logiikka väärässä kerroksessa, moduuli >150 riv kahdella vastuulla) → kutsu `/karttamaster-arkkitehtuuri` pilkko-ehdotuksella.

**Kattavuuspuute löytyy** (src/logic/-tiedosto ilman testiä) → ehdota uusi §T-task `/ck:spec`:llä.

Nämä kutsut tehdään saman session aikana — ei pelkkää raportointia.

---

## Komennot

### `tarkista` — auditoi testikattavuus

1. Aja `find src/logic -name "*.ts" | sort` — listaa kaikki logic-moduulit
2. Vertaa `tests/`-kansioon — onko testi per moduuli?
3. Aja `find src/ui -name "*.ts" | sort` — listaa UI-komponentit
4. Vertaa — onko jsdom-testi per UI-komponentti?
5. Aja `bun run test` — laske `↓`-rivit (todo-testit)

**Jokainen puuttuva Taso 1 -testi → kutsu `/ck:spec`** lisätäksesi §T-taskin.

Raporttimuoto:
```
## Testikattavuus YYYY-MM-DD
Taso 1: N/M moduulia katettu  [puuttuvat: ...]
Taso 2: N/M komponenttia katettu  [puuttuvat: ...]
Taso 3: N kriittistä polkua katettu  [puuttuvat: ...]
Todo-testit: N kpl odottaa toteutusta
Toimenpiteet: [mitä kutsuttiin → /ck:spec tai /karttamaster-arkkitehtuuri]
```

### `T<n>` — tarkista yksittäinen task

Kun `/ck:build` on valmis, tarkista task:
1. Aja `bun run test` — kaikki pass?
2. Tarkista `docs/components/`-tiedostosta komponentin testattavuustaso
3. Onko uusi logiikka `src/logic/`-kansiossa? → Taso 1 -testi pakollinen
4. Onko uusi UI `src/ui/`-kansiossa? → Taso 2 -testi
5. Kriittinen karttainteraktio `src/map/`-kansiossa? → Taso 3 minimaalinen
6. Käyttäjätestiperspektiivi (ks. alla)

**Jos testi puuttuu** → kirjoita se itse tai kutsu `/ck:spec` lisäämään §T-taskin.
**Jos bugi löytyy testissä** → kutsu `/ck:spec bug: <kuvaus>` välittömästi.

---

## Testauskolmio

### Taso 1: Vitest-pure (nopea, ei DOM)
**Milloin:** logiikka elää `src/logic/` — ei Leaflet-riippuvuutta, ei DOM:ia.
**Testattavuus:** nopea, ajettavissa satoja sekunnissa.

**Kirjoita ensin tänne.** Jos et pysty kirjoittaa Taso 1 -testiä, logiikka on väärässä kerroksessa → kutsu `/karttamaster-arkkitehtuuri` siirtämään se `src/logic/`-kansioon.

**localStorage-mock** (Node v26 conflict — käytä aina tätä localStorage-testeissä):
```typescript
import { vi } from 'vitest'

function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorageMock())
})
```

### Taso 2: Vitest + jsdom (DOM ilman selainta)
**Milloin:** komponentti elää `src/ui/` — DOM-rakenne tai event-logiikka tärkeä, ei Leafletia.

**Jsdom-testin pohja:**
```typescript
describe('renderMarkerList', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="marker-count"></span>
      <div id="marker-modal-items"></div>
    `
  })
  it('näyttää "Ei merkkejä" kun lista tyhjä', async () => {
    const { renderMarkerList } = await import('../src/ui/marker-list')
    const stub = { getAll: () => [], panTo: () => {}, remove: () => {} } as any
    renderMarkerList(stub)
    expect(document.getElementById('marker-modal-items')!.textContent).toContain('Ei merkkejä')
  })
})
```

**Huom:** jsdom ei tue Leaflet-renderöintiä. Jos `src/ui/`-komponentti importtaa `src/map/`-moduulia → stub se tai siirrä logiikka `src/logic/`-kerrokseen.

### Taso 3: Playwright (hidas, kallis — minimoi)
**Milloin:** `src/map/`-komponentti tai kriittinen käyttäjäpolku vaatii oikean Leaflet-kartan.

**Hyväksyttäviä Playwright-testejä:**
- Merkki asetetaan kartalle → näkyy merkkilistassa
- Drive mode käynnistyy, eteneminen toimii
- GPS-navigointi näyttää seuraavan merkin (kun T30 valmis)

**Ei Playwrightia:** `src/logic/`-logiikka, `src/ui/`-komponentit ilman karttaa.

---

## Käyttäjätestiperspektiivi

Tekninen testi ei riitä. Jokainen feature arvioidaan myös:

### Talkoolaistesti (metsässä, stressi, huono yhteys)
- Max 2 nappia kriittiseen toimintoon?
- Toimii offline / heikolla yhteydellä?
- Nappi ≥44px touch target?
- Virheestä voi toipua helposti?
- Näkymä selkeä pienellä näytöllä?

### Järjestäjätesti (toimisto, iso näyttö)
- Tilannekuva yhdellä silmäyksellä?
- Delegointi ja edistymisen seuranta mahdollista?
- Kaikki tarvittava käden ulottuvilla?

**Feature läpäisee teknisen testin mutta epäonnistuu käyttäjätestissä → feature on kesken.**

---

## Bugiraportointiprotokolla

Kun testi paljastaa bugin:

1. Tunnista juurisyy (koodi vai spec?)
2. Kutsu `/ck:spec bug: <kuvaus>` — se lisää §B-rivin ja harkitsee uuden §V-invariantin
3. Jatka testauksen loppuun
4. Raportissa mainitse: "Bugi X → /ck:spec bug: kutsuttu, §B päivitetty"

**Älä korjaa bugia itse** — `/ck:build` korjaa sen backprop-flowlla.

## Arkkitehtuuririkkomukset

Liputa ja kutsu `/karttamaster-arkkitehtuuri` kun:
- `src/map/`- tai `src/main.ts`-tiedostossa on liiketoimintalogiikkaa (→ kuuluu `src/logic/`)
- Moduuli >150 riviä kahdella eri vastuulla
- Sama logiikka copy-pastettu kahteen paikkaan

---

## Suhde muihin skilleihin

| Skill | Milloin testaaja kutsuu |
|---|---|
| `/ck:spec bug: <kuvaus>` | Bugi löytyy testissä — välittömästi |
| `/karttamaster-arkkitehtuuri` | Arkkitehtuuririkkomus tai pilkko-tarve |
| `/ck:spec amend §T` | Taso 1 -kattavuuspuute vaatii uuden taskin |
| `/karttamaster-ux komponentti <nimi>` | UX-ongelma: touch target, kontrasti, mobiili, ulkoasu |

**UX-delegointi:** Jos käyttäjätestissä (ks. Käyttäjätestiperspektiivi) löytyy ongelma joka on
ulkoasuun tai responsiivisuuteen liittyvä (ei logiikkabugi), kutsu `/karttamaster-ux` — älä yritä
korjata CSS:ää itse.

`/ck:build` kutsuu tätä skilliä automaattisesti jokaisen task-toteutuksen jälkeen.
