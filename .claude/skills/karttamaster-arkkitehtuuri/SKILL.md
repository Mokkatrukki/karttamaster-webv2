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

## Tiedostorakenne

COMPONENTS.md on **indeksi** — kaikki komponentit taulukossa, pilkkohälytykset, MVP-rajaus.

Yksityiskohdat hakemistossa `docs/components/`:
- `logic.md` — src/logic/ kerros (Vitest-pure)
- `map.md` — src/map/ kerros (Playwright)
- `ui.md` — src/ui/ kerros (Vitest-jsdom)
- `backend.md` — server/ + SQLite + OfflineManager + AuthController

**Lue oikea tiedosto** kun tarvitset yksityiskohtia. Älä lue kaikkia kerralla.

## Tehtävät

### `analysoi` — tarkastele nykytilaa
1. Lue COMPONENTS.md (indeksi + taulukko)
2. Aja `find src/ -name "*.ts" | xargs wc -l | sort -rn | head -10` — tunnista isot moduulit
3. Vertaa: mitä taulukossa on ○ (tulossa) vs mitä koodissa jo on
4. Ilmoita:
   - Dokumentoimattomat moduulit (koodissa mutta ei taulukossa)
   - Pilkkohälytykset (>150 riv tai useita vastuita)
   - SPEC-puutteet (task valmis mutta status ei päivitetty)

### `lisää <komponentti>` — uusi komponentti rekisteriin
1. Kysy: vastuu, käyttäjä, moduulipolku, testattavuus
2. Lisää rivi COMPONENTS.md komponenttitaulukkoon (tila = ○)
3. Lisää yksityiskohdat oikeaan `docs/components/`-tiedostoon käyttäen alla olevaa rakennetta
4. Jos backend-komponentti → lisää `docs/components/backend.md`:hen

### `muokkaa <komponentti>` — päivitä komponentti
1. Tunnista oikea `docs/components/`-tiedosto komponenttitaulukosta
2. Lue nykyinen tiedosto
3. Tee muutos
4. Päivitä tarvittaessa myös COMPONENTS.md-taulukko (tila, rivimäärä)

### `feature <kuvaus>` — mihin feature kuuluu?
1. Lue VISION.md — kumpaa roolia feature palvelee?
2. Tarkista COMPONENTS.md-taulukko — onko jo olemassa komponentti joka ottaa tämän vastuun?
3. Jos ei, päätä kerros: logiikka (logic) / kartta (map) / UI (ui) / backend
4. Tulosta: "Feature X → komponentti Y (`src/polku/tiedosto.ts`), koska [rooli + vastuu]. Lisätään tulossa-listaan: [kyllä/ei]."

### `ck:spec-konteksti <T-id>` — anna konteksti ck:specille
Ennen kuin ck:spec kirjoittaa uuden §T-taskin, anna konteksti:
1. Lue SPEC.md — mitä T-id tekee?
2. Lue COMPONENTS.md — mitkä komponentit koskevat tätä taskia?
3. Lue ko. `docs/components/`-tiedosto
4. Tulosta: "Task TXX koskee komponentteja: [lista]. Moduulit: [polut]. Testattavuus: [tasot]. Pilkkomahdollisuus: [kyllä/ei]."

### `sync-spec` — päivitä statukset SPEC:n mukaan
1. Lue SPEC.md §T — mitkä taskit ovat ✓?
2. Vertaa COMPONENTS.md-taulukkoon — onko kaikki ✓-taskit merkitty ✓?
3. Päivitä taulukko ja ko. `docs/components/`-tiedosto

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
- ✓ toinen toteutettu

### Tulossa
- [ ] suunniteltu asia (T-id)
- [ ] toinen suunniteltu

### Käyttäjätarkistus
> Talkoolainen: [max 2 nappia? toimii offline? iso nappi?]
> Järjestäjä: [riittävä hallinta? näkee tilannekuvan?]
```

## COMPONENTS.md-taulukon malli

```markdown
| KomponentinNimi | `src/polku/tiedosto.ts` | ✓ valmis | [tiedosto.md](docs/components/tiedosto.md) |
| TulevaNimi | `src/logic/tuleva.ts` *(ei vielä)* | ○ T-id | [logic.md](docs/components/logic.md) |
```

Tila-koodit: `✓ valmis` | `○ T-id` (tulossa, viittaa taskiin) | `⚠️ pilkkohälytys`

## Arkkitehtuurirajat (VISION.md:stä)

```
src/logic/    ← puhtaat funktiot, EI Leafletia — Vitest-pure
src/map/      ← Leaflet-glue, ohut kerros — Playwright
src/ui/       ← DOM-komponentit ilman Leafletia — Vitest-jsdom
src/main.ts   ← vain init + wiring (~80 riv max)
server/       ← Hono + Bun + SQLite (tulossa)
```

Jos uusi logiikka yritetään laittaa `src/map/` tai `main.ts`:hen suoraan, liputa se. Oikea paikka on `src/logic/`.

## Pilkkohälytys

Ehdota pilkkomista kun:
- Moduuli > ~150 riviä
- Moduuli vastaa kahdesta erillisestä asiasta
- Sama logiikka on copy-pastettu kahteen paikkaan

Älä pilko vain koon takia — pilko kun vastuut eriytyvät.

Nykyiset hälytykset (päivitä kun korjataan):
- `src/main.ts` 385 riv — pilko ennen T12/T32
- `src/map/markers.ts` 309 riv — pilko ennen T10

## Suhde muihin skilleihin

- `/karttamaster-testaaja` lukee `docs/components/`-tiedostoja testattavuustason selvittämiseksi
- `/ck:spec` saa arkkitehtuurikontekstin `ck:spec-konteksti`-komennolla ennen §T-taskien kirjoittamista
- `/ck:build` käyttää COMPONENTS.md-taulukkoa tietääkseen mihin tiedostoon uusi koodi menee
- Sync-flow: ck:spec lisää task → arkkitehtuuri lisää komponentti (○) → ck:build toteuttaa → arkkitehtuuri merkitsee ✓
