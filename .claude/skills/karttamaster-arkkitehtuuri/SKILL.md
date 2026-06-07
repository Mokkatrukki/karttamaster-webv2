---
name: karttamaster-arkkitehtuuri
description: >
  Karttamaster-projektin arkkitehtuurihallinta. Ylläpitää COMPONENTS.md-rekisteriä,
  analysoi komponentteja, ehdottaa pilkkomisia ja varmistaa että uudet featuret menevät
  oikeaan paikkaan. Ottaa kantaa käyttäjäkontekstiin (talkoolainen/järjestäjä) jokaisen
  komponentin kohdalla. Käytä aina kun: lisätään uusi feature ja mietitään mihin se kuuluu,
  komponentti tuntuu kasvavan liian isoksi, halutaan tietää mitä komponentissa on tulossa,
  tai ck:spec tarvitsee arkkitehtuurikontekstin uudelle taskille.
---

# Karttamaster-arkkitehtuuri

Lue ensin VISION.md (arkkitehtuuriperiaatteet + käyttäjäroolit). Se on päätösten lähde.

## Tehtävät

### `analysoi` — tarkastele nykytilaa
Lue src/ rakenne. Vertaa COMPONENTS.md:hen. Ilmoita:
- Mitä COMPONENTS.md:ssä on mitä koodissa ei vielä ole (suunnitelmia)
- Mitä koodissa on mitä COMPONENTS.md ei tunne (dokumentoimatonta)
- Onko jokin moduuli kasvanut liian isoksi (>150 riv tai useita vastuita)

### `lisää <komponentti>` — uusi komponentti rekisteriin
Kysy puuttuvat tiedot, kirjoita COMPONENTS.md:hen käyttäen alla olevaa rakennetta.

### `muokkaa <komponentti>` — päivitä komponentti
Näytä nykyinen. Tee muutos. Näytä diff.

### `feature <kuvaus>` — mihin feature kuuluu?
Arvioi: onko olemassa komponentti joka ottaa tämän vastuun, vai tarvitaanko uusi?
Tarkista VISION.md:stä kumpaa roolia feature palvelee — ohjaa arkkitehtuurivalintoja sen mukaan.
Tulosta: "Feature X → komponentti Y, koska [rooli + vastuu]. Lisätään tulossa-listaan: [kyllä/ei]."

### `ck:spec-konteksti <T-id>` — anna konteksti ck:specille
Kun ck:spec rakentaa uuden taskin, anna sille komponenttikonteksti:
"Task T8 koskee komponentteja: SignLibraryPanel (uusi), MapEditor (muuttuu). Testattavuus: logiikka Vitest, UI Playwright."

## COMPONENTS.md rakenne

Tiedosto sijaitsee projektin juuressa. Jos ei ole olemassa, luo se.

Jokainen komponentti:

```markdown
## <KomponentinNimi>
**Vastuu:** mitä yksi asia tämä tekee
**Käyttäjä:** talkoolainen metsässä | järjestäjä toimistossa | molemmat
**Konteksti:** millä laitteella, missä tilanteessa, mitä rajoituksia
**Moduuli:** src/polku/tiedosto.ts (TODO jos ei vielä refaktoroitu)
**Testattavuus:** Vitest-pure | Vitest-jsdom | Playwright

### Ominaisuudet
- ✓ toteutettu asia
- ✓ toinen toteutettu

### Tulossa
- [ ] suunniteltu asia (T-id jos spec-taskissa)
- [ ] toinen suunniteltu

### Käyttäjätarkistus
> Talkoolainen: [onko max 2 nappia, toimiiko offline, onko iso nappi?]
> Järjestäjä: [onko riittävä hallinta, näkeekö tilannekuvan?]
```

## Arkkitehtuurirajat (VISION.md:stä)

```
src/logic/    ← puhtaat funktiot, EI Leafletia — Vitest-testattavia
src/map/      ← Leaflet-glue, ohut kerros
src/ui/       ← DOM-komponentit ilman Leafletia
src/main.ts   ← vain init + wiring
```

Jos uusi logiikka yritetään laittaa `src/map/` tai `main.ts`:hen suoraan, liputa se. Oikea paikka on `src/logic/`.

## Pilkkohälytys

Ehdota pilkkomista kun:
- Moduuli > ~150 riviä
- Moduuli vastaa kahdesta erillisestä asiasta
- Sama logiikka on copy-pastettu kahteen paikkaan

Älä pilko vain koon takia — pilko kun vastuut eriytyvät.

## Suhde muihin skilleihin

- `/karttamaster-testaaja` käyttää COMPONENTS.md:tä tietääkseen testattavuustason
- `/ck:spec` saa arkkitehtuurikontekstin tästä skillista ennen §T-taskien kirjoittamista
- `/ck:build` käyttää COMPONENTS.md:tä tietääkseen mihin tiedostoon uusi koodi menee
