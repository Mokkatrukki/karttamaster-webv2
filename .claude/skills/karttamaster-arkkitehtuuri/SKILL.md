---
name: karttamaster-arkkitehtuuri
description: >
  Karttamaster-projektin arkkitehtuurihallinta. Ylläpitää COMPONENTS.md-indeksiä ja
  docs/components/-tiedostoja, analysoi komponentteja, ehdottaa pilkkomisia ja varmistaa
  että uudet featuret menevät oikeaan paikkaan. Ottaa kantaa käyttäjäkontekstiin
  (talkoolainen/järjestäjä) jokaisen komponentin kohdalla. Pitää synkronoinnin
  SPEC.md §T-taskien ja COMPONENTS.md:n välillä. Käytä aina kun: lisätään uusi feature
  ja mietitään mihin se kuuluu, komponentti tuntuu kasvavan liian isoksi, halutaan
  tietää mitä komponentissa on tulossa, tai ck:spec tarvitsee arkkitehtuurikontekstin
  uudelle taskille.
---

# Karttamaster-arkkitehtuuri

Lue ensin VISION.md (arkkitehtuuriperiaatteet + käyttäjäroolit). Se on päätösten lähde.

## Tilakuri — tärkein sääntö

Tämä skilli **ei sisällä tilannetietoa**: ei rivimääriä, ei hälytyslistoja, ei task-statuksia.
Syy: kovakoodattu tila mätänee. Aiempi versio väitti "main.ts 385 riv, pilko ennen T10/T12"
kun todellisuus oli 472 riviä ja T10/T12 valmistuneet kauan sitten — neljä eri lukua neljässä
tiedostossa, kaikki väärin.

Jokaisella tiedolla yksi koti:

| Tieto | Ainoa paikka |
|---|---|
| Rivimäärät | ei missään — laske `wc -l` ajon hetkellä |
| Pilkkoliput | COMPONENTS.md §Pilkkohälytykset |
| Task-statukset | SPEC.md §T |
| Komponentin vastuu/kerros | `docs/components/*.md` |
| Bugihistoria | SPEC.md §B + git log |

Jos huomaat kirjoittavasi rivimäärää tai task-listaa tähän tiedostoon, CLAUDE.md:hen
tai COMPONENTS.md-taulukon soluun — pysähdy. Se on väärä paikka ja luku on valhetta
viikon päästä.

## Tiedostorakenne

COMPONENTS.md on **indeksi** — komponenttitaulukko, pilkkoliput, MVP-vaihelinkit.

Yksityiskohdat hakemistossa `docs/components/`:
- `logic.md` — src/logic/ kerros (Vitest-pure)
- `map.md` — src/map/ kerros (Playwright)
- `ui.md` — src/ui/ kerros (Vitest-jsdom)
- `backend.md` — server/ + SQLite

**Lue oikea tiedosto** kun tarvitset yksityiskohtia. Älä lue kaikkia kerralla.

## Tehtävät

### `analysoi` — tarkastele nykytilaa

1. Lue COMPONENTS.md (indeksi + taulukko)
2. Aja `find src server -name "*.ts" ! -name "*.test.ts" | xargs wc -l | sort -rn | head -15`
   — tämä on ainoa totuus rivimääristä, älä luota mihinkään dokumenttiin
3. Vertaa taulukkoon:
   - Dokumentoimattomat moduulit (koodissa mutta ei taulukossa)
   - ○-rivit joiden koodi on jo olemassa (status jäänyt päivittämättä)
4. Vertaa live-rivimäärät pilkkokynnyksiin (ks. Pilkkohälytys alla) ja **päivitä
   COMPONENTS.md §Pilkkohälytykset-liput** — lisää uudet, poista korjatut. Lippuihin
   ei kirjata lukuja, vain moduuli + peruste.
5. Tarkista taulukon tila-solut: jos solussa on enemmän kuin viimeisin T-viite + yksi
   huomio, tiivistä (historia on gitissä ja SPEC §T:ssä, ei taulukkosolussa)
6. Ilmoita SPEC-puutteet (task valmis mutta status ei päivitetty)

### `lisää <komponentti>` — uusi komponentti rekisteriin

1. Kysy: vastuu, käyttäjä, moduulipolku, testattavuus
2. Lisää rivi COMPONENTS.md komponenttitaulukkoon (tila = ○)
3. Lisää yksityiskohdat oikeaan `docs/components/`-tiedostoon alla olevalla rakenteella
4. Jos backend-komponentti → `docs/components/backend.md`

### `muokkaa <komponentti>` — päivitä komponentti

1. Tunnista oikea `docs/components/`-tiedosto komponenttitaulukosta
2. Lue nykyinen tiedosto
3. Tee muutos
4. Päivitä tarvittaessa COMPONENTS.md-taulukon tila-solu (ei rivimääriä)

### `feature <kuvaus>` — mihin feature kuuluu?

1. Lue VISION.md — kumpaa roolia feature palvelee?
2. Tarkista COMPONENTS.md-taulukko — onko jo komponentti joka ottaa tämän vastuun?
3. Jos ei, päätä kerros: logiikka (logic) / kartta (map) / UI (ui) / backend
4. Tulosta: "Feature X → komponentti Y (`src/polku/tiedosto.ts`), koska [rooli + vastuu].
   Lisätään tulossa-listaan: [kyllä/ei]."

### `ck:spec-konteksti <T-id>` — anna konteksti ck:specille

1. Lue SPEC.md — mitä T-id tekee?
2. Lue COMPONENTS.md — mitkä komponentit koskevat tätä taskia?
3. Lue ko. `docs/components/`-tiedosto
4. Tulosta: "Task TXX koskee komponentteja: [lista]. Moduulit: [polut].
   Testattavuus: [tasot]. Pilkkomahdollisuus: [kyllä/ei]."

### `sync-spec` — päivitä statukset SPEC:n mukaan

1. Lue SPEC.md §T — mitkä taskit ✓?
2. Vertaa COMPONENTS.md-taulukkoon — päivitä puuttuvat
3. **Ennen kuin merkitset src/logic/-komponentin ✓:** varmista että Taso 1 -testi on
   olemassa (`grep -rl "logic/<moduuli>" tests/`). Puuttuu → tila jää ○ ja ilmoita
   puute — testitön logic-moduuli ei ole valmis vaikka SPEC sanoisi ✓.
   (Syy: area-sync.ts oli taulukossa "✓ valmis" kuukausia ilman ainuttakaan testiä.)
4. Tila-solun muoto: `✓ T<viimeisin>` + korkeintaan yksi elävä huomio (esim. dead-code-
   varoitus tai pilkkolippu). Ei task-litanioita, ei changelog-selitteitä.

## Komponenttirakenteen malli (docs/components/-tiedostot)

```markdown
## KomponentinNimi *(tulossa — T-id jos suunniteltu)*
**Vastuu:** mitä yksi asia tämä tekee
**Käyttäjä:** talkoolainen metsässä | järjestäjä toimistossa | molemmat
**Konteksti:** millä laitteella, missä tilanteessa, mitä rajoituksia
**Moduuli:** `src/polku/tiedosto.ts` *(ei vielä jos tulossa)*
**Testattavuus:** Vitest-pure | Vitest-jsdom | Playwright

### Ominaisuudet
- ✓ toteutettu asia

### Tulossa
- [ ] suunniteltu asia (T-id)

### Käyttäjätarkistus
> Talkoolainen: [max 2 nappia? toimii offline? iso nappi?]
> Järjestäjä: [riittävä hallinta? näkee tilannekuvan?]
```

## COMPONENTS.md-taulukon malli

```markdown
| KomponentinNimi | `src/polku/tiedosto.ts` | ✓ T142 | critical-paths: "Drive mode" | [ui.md](docs/components/ui.md) |
| TulevaNimi | `src/logic/tuleva.ts` *(ei vielä)* | ○ T15 | — | [logic.md](docs/components/logic.md) |
| IsoNimi | `src/ui/iso.ts` | ✓ T99 ⚠️ pilkko | — | [ui.md](docs/components/ui.md) |
```

Tila-koodit: `✓` valmis (+ viimeisin T-id) | `○ T-id` tulossa | `⚠️ pilkko` -lippu tarvittaessa.
E2E-sarake: `e2e/`-testitiedosto joka kattaa komponentin, `—` jos ei ole.
**Muuta komponenttia → tarkista E2E-sarake → päivitä testi ennen ✓.**
Ei rivimääriä taulukkoon — ne vanhenevat; `analysoi` laskee ne livenä.

## Arkkitehtuurirajat (VISION.md:stä)

```
src/logic/    ← puhtaat funktiot, EI Leafletia — Vitest-pure
src/map/      ← Leaflet-glue, ohut kerros — Playwright
src/ui/       ← DOM-komponentit ilman Leafletia — Vitest-jsdom
src/main.ts   ← vain init + wiring (tavoite ~80 riv)
server/       ← Hono + Bun + SQLite
```

Jos uusi logiikka yritetään laittaa `src/map/` tai `main.ts`:hen, liputa se.
Oikea paikka on `src/logic/`.

`main.ts` ylittää tavoitteensa moninkertaisesti — älä kasvata sitä. Uusi wiring-tarve
→ ehdota pilkko-§T-taskia /ck:spec:lle sen sijaan että lisäät main.ts:ään.

## Pilkkohälytys

Ehdota pilkkomista kun (live `wc -l` -datasta, ei dokumentin luvuista):
- Moduuli > ~150 riviä **ja** vastaa kahdesta erillisestä asiasta
- Moduuli > ~400 riviä (koko yksinään riittää lippuun)
- Sama logiikka copy-pastettu kahteen paikkaan

Älä pilko vain koon takia — pilko kun vastuut eriytyvät.

**`/ck:deepen` (cavekit v4.1) täydentää pilkkomista:** pilkkominen jakaa liian ison
moduulin; deepen syventää liian matalan (leveä rajapinta, ohut vastuu). Kun build on
vihreä ja token-budjettia jää → ehdota `/ck:deepen <moduuli>`: pienempi §I, sama
käyttäytyminen, testit vihreät ennen JA jälkeen. Ei riko invariantteja.

Ajantasaiset liput: **COMPONENTS.md §Pilkkohälytykset** — se on ainoa lista.
Lippu ilman toimenpidettä on hukkaa: jos lippu on ⚠️-tasoa, varmista että SPEC:ssä
on vastaava pilkko-§T-task tai ehdota sitä /ck:spec:lle.

## Suhde muihin skilleihin

- `/karttamaster-testaaja` lukee `docs/components/`-tiedostoja testattavuustason selvittämiseksi
- `/ck:spec` saa arkkitehtuurikontekstin `ck:spec-konteksti`-komennolla
- `/ck:build` käyttää COMPONENTS.md-taulukkoa tietääkseen mihin tiedostoon uusi koodi menee
- Sync-flow: ck:spec lisää task → arkkitehtuuri lisää komponentti (○) → ck:build toteuttaa
- `/ck:research` (v4.1): tekninen valinta (kirjasto, Leaflet-plugin, algoritmi) → kirjaa perusteltu löytö **§R**:ään lähteineen, jotta build ei arvaa. Arkkitehtuuripäätös nojaa faktaan, ei muistiin.
- `/ck:review` (v4.1): kun feature koskee jaettua moduulia tai rikkoo kerrosrajoja, toimi adversariaalisena katselmoijana ennen buildia — refutoi §I/§V, kovettaa invariantit.
  → arkkitehtuuri merkitsee ✓ (testitarkistuksen kera, ks. sync-spec kohta 3)
