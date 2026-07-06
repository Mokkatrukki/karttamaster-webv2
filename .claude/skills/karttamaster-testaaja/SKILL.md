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
6. **Testit ajautuvat -tarkistus** — testi joka ei aja on valhetta:
   - Aja `find src server -name "*.test.ts" -o -name "*.spec.ts" | grep -v node_modules` ja
     vertaa vitest includeen (`vite.config.ts` → `tests/**`) sekä `bun test server/`-piiriin.
     Testitiedosto jota mikään runner ei poimi = kuollut → poista tai siirrä oikeaan paikkaan.
     (Syy: `src/logic/tile-layers.test.ts` makasi kuukausia ajamattomana ja duplikoi tests/-testin.)
   - Todo-testit: jos `it.todo` kuvaa featurea joka on jo katettu muualla (esim. e2e:ssä) tai
     UI:ta joka on poistettu, poista todo — stale-todot hämärtävät "↓ = roadmap" -signaalin.

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
7. **COMPONENTS.md-tarkistus:** Löytyykö kaikki task T<n>:n luomat/muuttamat tiedostot COMPONENTS.md-taulukosta?
   - Aja `git diff --name-only HEAD~1` — mitkä tiedostot muuttuivat?
   - Vertaa COMPONENTS.md-taulukkoon — onko jokainen `src/*.ts` / `server/*.ts` kirjattu?
   - Jos puuttuu tai status on vanhentunut → kutsu `/karttamaster-arkkitehtuuri sync-spec`

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

**PAKOLLINEN WORKFLOW — aina ennen Taso 3 -testin kirjoittamista:**

```bash
# 1. Käynnistä dev-serveri (jos ei pyöri)
bun run dev &

# 2. Aja olemassa olevat E2E-testit — kaikki vihreänä ennen muutoksia
bunx playwright test e2e/ --browser=chromium --reporter=line

# 3. Kirjoita uusi testi e2e/-hakemistoon
# 4. Aja uusi testi — varmista pass
bunx playwright test e2e/uusi.spec.ts --browser=chromium

# 5. Kuvakaappaus epäselvissä tilanteissa
bunx playwright screenshot http://localhost:5173 /tmp/debug.png --browser=chromium
```

**E2E-testit sijaitsevat `e2e/`-hakemistossa** (ei `tests/`). Config: `playwright.config.ts`.

**Kriittiset polut joille E2E-testi PAKOLLINEN:**
- Merkki asetetaan kartalle → näkyy merkkilistassa (T46)
- Drive mode käynnistyy + navigoi eteenpäin (T46)
- Rooli-toggle muuttaa toolbaria (T46)
- Ghost marker -varoitus näkyy kun klikki >500m reitistä (T44)
- Touch targets ≥44px mobiililla 375px viewportilla (T45)

**Touch target -validointi (aina mobiili-taskien jälkeen):**
```typescript
await page.setViewportSize({ width: 375, height: 812 })
const buttons = await page.locator('button').all()
for (const btn of buttons) {
  const box = await btn.boundingBox()
  const text = (await btn.innerText()).trim()
  if (box) expect(Math.min(box.width, box.height), `TOUCH SMALL: "${text}"`).toBeGreaterThanOrEqual(44)
}
```

**Ei Playwrightia:** `src/logic/`-logiikka, `src/ui/`-komponentit ilman karttaa.

### Taso 4: Bun integraatiotesti (server/)
**Milloin:** `server/`-koodi — Hono-reitit, SQLite-logiikka, auth-middleware.
**Ajotapa:** `bun test server/` (ei vitest, ei playwright)
**Testattavuus:** in-memory SQLite, ei verkkoyhteyttä, nopea.

**Testifixturit — käytä aina `server/test-fixtures.ts`:**
```typescript
import { createDb } from './db'
import { seedTestUsers, authHeaders, makeTestSession } from './test-fixtures'
import type { Database } from 'bun:sqlite'

let db: Database
beforeEach(() => {
  db = createDb(':memory:')
  seedTestUsers(db)   // luo admin + järjestäjä + talkoolainen-koodi
})
afterEach(() => db.close())

// Yksi rivi auth per testi:
const res = await app.request('/api/jotain', { headers: authHeaders(db, 'admin') })
const res = await app.request('/api/jotain', { headers: authHeaders(db, 'talkoolainen') })

// Vanhentunut sessio:
const id = makeTestSession(db, 'admin', -1)   // expiresOffset negatiivinen
```

**TEST_USERS** — vakiotunnukset joita kaikki server-testit käyttävät:
```typescript
import { TEST_USERS } from './test-fixtures'
// TEST_USERS.admin.username, .role, .displayName
// TEST_USERS.järjestäjä.username, .role, .displayName
// TEST_USERS.talkoolainen.code, .displayName, .role
```

**Ei Bun-testiä:** `src/`-kansion koodi — käytä Vitest (Taso 1/2) tai Playwright (Taso 3).

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

## Haiku-subagentit (token-säästö)

Testien ajo ja tiedostonavigaatio delegoidaan `Agent(model="haiku")`:

**test-runner** (käytä aina `bun run test`-kutsuissa):
```
Agent(model="haiku", prompt="""
Aja: bun run test 2>&1 | tail -40
Aja myös: bun run test [yksittäinen tiedosto] jos täsmätesti.
Raportoi: pass-count, fail-count, failing test names + ensimmäinen virherivi.
Älä korjaa mitään — vain raportti.
""")
```

**grep-navigator** (ennen COMPONENTS.md-tarkistusta):
```
Agent(model="haiku", prompt="""
Lue COMPONENTS.md. Laske git diff --name-only HEAD~1.
Onko jokainen muuttunut src/*.ts / server/*.ts kirjattu COMPONENTS.md-taulukkoon?
Raportoi: [tiedosto] → löytyy / PUUTTUU COMPONENTS.md:stä
""")
```

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
