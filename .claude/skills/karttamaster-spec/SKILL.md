---
name: karttamaster-spec
description: >
  Karttamaster-projektin spec-enricher. Kerää arkkitehtuuri-, UX- ja testausnäkökulmat
  yhteen ennen kuin kutsuu /ck:spec — tuottaa rikkaamman §T-taskin kuin jos /ck:spec
  kutsuttaisiin suoraan. Tietää mille kerrokselle feature kuuluu, mitä DESIGN.md vaatii,
  millä tasolla testataan ja kumman käyttäjäroolin tarpeeseen vastataan. Käytä aina kun:
  lisätään uusi feature tai task, kirjoitetaan uusi §T-rivi, suunnitellaan isompaa
  kokonaisuutta, tai halutaan varmistaa että spec kattaa arkkitehtuurin + UX:n + testauksen
  ennen rakentamista. Korvaa /ck:spec karttamaster-kontekstissa.
---

# karttamaster-spec — Spec-enricher

`/ck:spec` kirjoittaa mitä sille annetaan. Tämä skill kerää ensin oikean kontekstin kolmesta
suunnasta ja antaa `/ck:spec`:lle valmiiksi pureskellun syötteen.

Ilman tätä skilliä spec-taskit jäävät puolittaisiksi: tiedostopolku puuttuu, testattavuustaso
arvaillaan, UX-vaatimukset unohtuvat, käyttäjärooli jää epäselväksi.

---

## Flow: uusi feature tai task

```
1. Lue VISION.md §Käyttäjät — kumman roolin tarpeeseen feature vastaa?
2. Tee arkkitehtuurianalyysi INLINE (lue COMPONENTS.md + docs/components/):
   → kerros, tiedostopolku, riippuvuudet, pilkkovaara
   → Jos päätös on epäselvä tai feature rikkoo rajoja → VASTA SILLOIN kutsu /karttamaster-arkkitehtuuri
3. Analysoi UX-vaatimukset DESIGN.md:stä:
   → onko §K-sopimus tälle komponentille? touch-target? responsive?
   → Jos UI-komponentti ilman §K-sopimusta → kutsu /karttamaster-ux komponentti <nimi>
4. Päätä testattavuustaso:
   → Vitest-pure (src/logic/), Vitest-jsdom (src/ui/), Playwright (src/map/ kriittiset)
5. Syntetisoi: kirjoita rikastettu task-kuvaus
6. Kutsu /ck:spec amend §T <rikastettu kuvaus>
```

---

## Kontekstin kerääminen

### Arkkitehtuurikonteksti (vaihe 2) — tee inline

Lue `COMPONENTS.md` (tiedostopolut + tila) ja oikea `docs/components/`-tiedosto.
Päätä itse — `/karttamaster-arkkitehtuuri`-kutsu on tarpeen vain kun:
- Feature sopii useampaan kerrokseen eikä ole selvää mihin
- Feature on isompi kokonaisuus joka vaatii uutta komponenttia
- Epäilet arkkitehtuuririkkomusta

| Mihin kuuluu? | Kerros | Testattavuus |
|---|---|---|
| Bisneslogiikka, laskenta, validointi | `src/logic/` | Vitest-pure |
| Leaflet-riippuvainen renderöinti | `src/map/` | Playwright (vain kriittiset) |
| DOM-komponentit ilman Leafletia | `src/ui/` | Vitest-jsdom |
| Reititys, init, wiring | `src/main.ts` | — (pilko ensin) |

Jos feature kuuluu `src/main.ts`:hen → liputa heti: main.ts on jo 386 riv, pilkottava ennen T12/T32.

### UX-konteksti (vaihe 3)

Lue `DESIGN.md` §K. Kysy:
- Onko tälle komponentille jo §K-sopimus? Jos ei, lisätään se samalla.
- Vaatiiko touch-target (≥44px)? Onko mobiili-käyttö todennäköinen?
- Vaatiiko uusia värejä? → lisätään DESIGN.md §C:hen ensin

UX-kysymykset per rooli:
- **Talkoolainen** → isot napit, max 2 toimintoa kriittiseen flowhin, toimii offline
- **Järjestäjä** → tilannekuva, hallinta, voi olla monimutkaisempi

### Testausnäkökulma (vaihe 4)

Testattavuustaso riippuu kerroksesta:

```
src/logic/ → Vitest-pure (nopea, pakollinen)
src/ui/    → Vitest-jsdom (DOM-logiikka)
src/map/   → Playwright vain jos kriittinen karttainteraktio
```

Lisää §T-kuvaukseen: `(Testattavuus: Vitest-pure)` tai vastaava.

Tarkista myös: onko `localStorage`-käyttöä? → muistuta CLAUDE.md:n vi.stubGlobal-mockista.

---

## Synteesi: rikastettu §T-kuvaus

Kirjoita kuvaus joka sisältää:
1. Mitä tehdään (toiminnallinen kuvaus)
2. Kerros + tiedostopolku: `src/logic/foo.ts`
3. Riippuvuudet: `(vaatii T8, T10)`
4. Testattavuus: `(Vitest-pure)`
5. UX-sopimus jos UI: `(touch-target 44px, §K-sopimus lisätty DESIGN.md:hen)`
6. Invariantit: `cites: V9, V10`
7. Käyttäjärooli: `(talkoolainen)` tai `(järjestäjä)` tai `(molemmat)`

**Esimerkki hyvästä §T-kuvauksesta:**
```
T10 | . | MarkerStatus type + tila-siirtymälogiikka (Vitest-pure):
         suunniteltu→asetettu→tarkistettu→kerätty|ei_tarpeen.
         src/logic/marker-status.ts. Riippuu T8:sta.
         Käyttäjä: talkoolainen (kuittaus), järjestäjä (tilannekuva). | V9
```

---

## Erityistapaukset

### Feature vaatii sekä logiikan että UI:n
Tee kaksi §T-riviä: yksi logiikalle (Vitest-pure), yksi UI:lle (Vitest-jsdom).
Logiikkatask ensin — UI viittaa siihen riippuvuutena.

### Feature rikkoo arkkitehtuurirajoja
Liputa: "Tämä feature yritetään laittaa `src/map/`:hen mutta logiikka kuuluu `src/logic/`:een."
Kutsu `/karttamaster-arkkitehtuuri feature <kuvaus>` ennen spec-kirjoitusta.

### Feature vaatii uutta DESIGN.md §K-sopimusta
Luo sopimus ensin: kutsu `/karttamaster-ux komponentti <nimi>`. Sitten spec.

---

## Suhde muihin skilleihin

| Skill | Milloin kutsutaan |
|---|---|
| `/karttamaster-arkkitehtuuri feature` | Kun kerrosvalinta on epäselvä tai vaatii uuden komponentin |
| `/karttamaster-ux komponentti <nimi>` | Kun UI-komponentilla ei vielä ole §K-sopimusta DESIGN.md:ssä |
| `/ck:spec amend §T` | Aina lopuksi — kirjoittaa rikastetun taskin |
| `/karttamaster-pm mitä seuraavaksi` | Ennen spec-kirjoitusta jos prioriteetti epäselvä |

Normaali logiikka- tai UI-task: analyysi inline, ei erillisiä skill-kutsuja ennen `/ck:spec`:iä.

`/karttamaster-rakentaja` lukee valmiin §T:n ja rakentaa. Hyvä spec = nopea rakennus.
