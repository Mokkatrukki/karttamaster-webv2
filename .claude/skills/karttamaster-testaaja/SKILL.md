---
name: karttamaster-testaaja
description: >
  Karttamaster-projektin älykäs testaaja. Tietää testauskolmion (Vitest-pure / Vitest-jsdom /
  Playwright) ja osaa päättää oikean tason jokaiselle featurelle. Arvioi featuret myös
  käyttäjänäkökulmasta: toimiiko talkoolaiselle metsässä, onko järjestäjällä riittävä
  tilannekuva. Käytä aina kun: kirjoitetaan uusia testejä, arvioidaan onko feature valmis,
  tarkistetaan testikattavuus uudelle taskille, tai mietitään tarvitaanko Playwright vai
  riittääkö Vitest.
---

# Karttamaster-testaaja

Lue ensin:
- VISION.md § Testausperiaatteet ja § Käyttäjät — nämä ovat testauksen lähde
- COMPONENTS.md — kertoo komponentin testattavuustason

## Testauskolmio

### Taso 1: Vitest-pure (nopea, ei DOM)
**Milloin:** logiikka elää `src/logic/` tai vastaavassa puhtaassa moduulissa, ei Leaflet-riippuvuutta.
**Esimerkkejä:** bearing-laskenta, GPX-parsinta, pätkälogiikka, merkkikirjasto-haku, statussiirtymät, varustelistan laskenta.
**Kirjoita ensin tänne.** Jos et pysty, logiikka on väärässä kerroksessa — siiirrä se ensin `src/logic/`-kansioon.

### Taso 2: Vitest + jsdom (keskinopea, DOM ilman selainta)
**Milloin:** DOM-rakenne tai event-logiikka on tärkeä, mutta Leaflet-karttaa ei tarvita.
**Esimerkkejä:** merkkilistat, varustelista-komponentti, statuspaneeli, lomakkeiden validointi, sign-picker sijoittumislogiikka.
**Käytä kun** Taso 1 ei riitä mutta Leaflet ei ole mukana.

### Taso 3: Playwright (hidas, kallis — minimoi)
**Milloin:** kriittinen käyttäjäpolku jota ei voi testata muuten — Leaflet-kartta on mukana tai tarvitaan oikea selain.
**Hyväksyttäviä Playwright-testejä:**
- Merkki asetetaan kartalle → näkyy merkkilistassa
- Drive mode käynnistyy, eteneminen toimii
- GPS-navigointi näyttää seuraavan merkin
**Ei Playwrightia:** logiikka joka voidaan eristää, UI ilman karttaa, laskentafunktiot.

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

## Testitapausten kirjoittaminen

### Rakenne Vitest-pure testille
```typescript
describe('<ModuulinNimi>', () => {
  it('<mitä testataan>', () => {
    // Arrange: minimaalinen syöte
    // Act: kutsu funktiota
    // Assert: tarkista tulos
  })
})
```

### Mitä ei testata
- Leaflet-sisäistä toimintaa (Leaflet testaa itsensä)
- DOM-rakenteen visuaalista ulkonäköä
- Tietoja joita ei voi deterministisesti ennustaa (GPS-koordinaatit oikeassa metsässä)

## Testikattavuuden tarkistus

Kun uusi §T-task on valmis, tarkista:
1. Onko logiikka `src/logic/`-kansiossa? Jos on, onko Taso 1 -testi?
2. Onko UI-komponentti ilman Leafletia? Jos on, onko Taso 2 -testi?
3. Onko kriittinen käyttäjäpolku katettu? Jos on, onko Taso 3 -testi (minimaalinen)?
4. Läpäisee sekä teknisen testin että käyttäjätestiperspektiivin?

Puuttuva testi Taso 1:lla on aina bugiriski — logiikka ilman testiä tarkoittaa että refaktorointi rikkoo sen hiljaa.

## Suhde muihin skilleihin

- `/karttamaster-arkkitehtuuri` kertoo komponentin testattavuustason
- `/ck:build` kutsuu tätä tarkistamaan testikattavuuden ennen kuin task merkataan valmiiksi
- `/ck:spec` käyttää tätä arvioimaan §V-invariantteja uusille featureille
