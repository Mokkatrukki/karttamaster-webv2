---
name: korjaus
description: >
  Lightweight bug fix and UX polish skill — the focused companion to /ominaisuus.
  Use this skill when the user reports a bug, an existing feature behaves wrong,
  or wants a small targeted UX tweak to something already built. NOT for new features.
  Trigger on: "korjaa", "bugi", "ei toimi", "ongelma", "fix", "hioa", "säädä",
  "muuta käyttäytymistä", "pieni muutos", "viilaa", /korjaus, or any description
  of broken/unexpected behavior in existing code. Prefer this over /ominaisuus
  whenever the request is "change how X works" rather than "add X".
---

# Korjaus — Bug Fix & UX Polish

Nopea, fokusoitu flow olemassa olevan koodin korjaamiseen. Ei täyttä specsiä. Ei uusia ominaisuuksia.

## Milloin käyttää

- Jokin ei toimi kuten pitäisi (bugi)
- UX-käyttäytyminen on väärä tai kömpelö
- Pieni, rajattu muutos jo rakennettuun ominaisuuteen
- Ei uusi feature → käytä /ominaisuus

## Flow

### Vaihe 1 — Skannaa relevantti koodi

Lue **vain** ne tiedostot jotka liittyvät ongelmaan. Älä skannaa koko projektia.

- Jos bugi on UI:ssa → lue `index.html` + `src/main.ts`
- Jos bugi on logiikassa → lue relevantti moduuli (`src/markers.ts`, `src/drive.ts`, jne.)
- Jos epäselvää → lue `src/` tiedostot lyhyesti, valitse 1–3 relevanttia

### Vaihe 2 — Diagnoosi + ehdotus

Esitä lyhyesti:

```
**Ongelma:** [mitä tapahtuu nyt, missä koodissa]
**Syy:** [miksi se tapahtuu — viittaa riviin/funktioon]
**Korjaus:** [mitä muutetaan, 1–3 lausetta]
```

Älä kirjoita SPEC-dokumenttia. Älä listaa OUTCOMES tai CONSTRAINTS.
Jos korjaus on triviaali (ilmeinen 1-rivi fix), voit ehdottaa ja kysyä hyväksyntää samassa viestissä.

Kirjoita lopuksi:
> **Korjataanko näin?**

Odota vastausta ennen koodauksen aloittamista.

### Vaihe 3 — Toteuta

Kun käyttäjä hyväksyy:
1. Tee **minimaalinen** muutos — älä siivoa ympäröivää koodia ellei se suoraan aiheuta bugin
2. Aja `npm test` — varmista ettei regressioita
3. Jos korjaus on puhdas funktio (ei DOM/Leaflet), lisää testi joka osoittaa korjauksen toimivan

### Vaihe 4 — Raportoi

Lyhyesti: mitä muutettiin ja missä. Testien tulos. Ei pitkiä yhteenvetoja.

## Periaatteet

**Minimaliteetti:** Korjaa juuri se mikä on rikki. Ei refaktorointia sivussa.

**Diagnoosi ensin:** Näytä missä koodi menee pieleen ennen kuin ehdotat ratkaisua. Käyttäjä näkee että ymmärrät ongelman.

**Odota hyväksyntä:** Älä aloita koodausta ennen kuin käyttäjä on sanonut ok — myös triviaaleissa korjauksissa. Yllätykset ärsyttävät.

**Testit:** Jos muutos on testattavissa ilman DOM:ia, kirjoita testi. Muuten varmista manuaalinen testaus flow.

## Esimerkkejä

**Bugi-tapaus:**
> "Merkki pyörii heti kun klikkaan sitä, pitäisi ensin avata menu"

→ Lue `src/markers.ts` (addLeafletMarker) ja `src/main.ts`
→ "Ongelma: mousedown startää rotaation heti. Korjaus: vaihda mousedown → click + kontekstimenu"
→ Odota ok → toteuta

**UX-tweak-tapaus:**
> "Progress bar on liian ohut mobiilissa"

→ Lue `index.html` (`#route-track` CSS)
→ "Ongelma: height:12px liian pieni touch-targetille. Korjaus: height:20px + touch-action:none"
→ Odota ok → toteuta
