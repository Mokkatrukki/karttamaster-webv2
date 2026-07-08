---
name: karttamaster-ux
description: >
  Karttamaster-projektin UX/design-vahtimestari. Ylläpitää DESIGN.md:tä (ainoa totuus
  tyyleistä), auditoi komponentteja, korjaa UX-rikkomukset ja generoi prompteja ulkoisiin
  design-palveluihin (v0, Lovable, Claude Artifacts, Figma). Tuntee käyttäjät: talkoolainen
  metsässä (mobiili, hanskat, aurinko) ja järjestäjä (desktop, kartta pääasia). Integroituu
  rakentajaan ja testaajaan. Käytä aina kun: puhutaan ulkoasusta, tyyleistä, mobiilista,
  responsiivisuudesta, kontrasteista, touch-kohteista, design-yhtenäisyydestä, tai halutaan
  prompt ulkoiseen design-työkaluun. Kutsutaan automaattisesti kun testaaja löytää UX-ongelman
  tai rakentaja rakentaa uuden UI-komponentin.
---

# karttamaster-ux — UX/design-vahtimestari

Lue ensin `DESIGN.md` (design-sopimukset). Jos ei ole, aja `init`.
Lue `VISION.md` §Käyttäjät ennen jokaista UX-päätöstä — siellä on molempien roolien täydet persoonat.
Järjestäjä-konteksti: §Järjestäjän käyttäjätarinat. Talkoolainen-konteksti: §Talkoolaisen käyttäjätarinat.

CSS elää `src/style.css`:ssä. Inline SVG-tyylit: `src/map/icons.ts`.

---

## Käyttäjäpersoonat — pidä nämä mielessä jokaisessa päätöksessä

### Talkoolainen metsässä

**Kuka:** Talkoolainen keskittyy omaan pätkäänsä ja siihen miten se meni. Tietää mitä pitää tehdä — sovellus on väline raportoida se järjestäjälle ja muille. Saa linkin, menee maastoon, tekee homman, merkkaa tulokset.

**Laite:** Android-puhelin, mobiili. Ei tablettia, ei kannettavaa.

**Olosuhteet:** metsässä tai autossa. Aurinko (kontrasti kriittinen). Hanskat kädessä mahdollisesti (touch-target ≥44px pakollinen). Liikkeellä. Huono tai ei ollenkaan netti. Akku hupenemassa. Kiireinen — muut odottavat.

**Mitä tekee:**
- Vastaanottaa pätkän hash-URL:n WhatsAppista tai skannaa QR-koodin
- Katsoo tehtävälistan ja varustelistan, päivittää varustelistan ennen lähtöä
- Navigoi merkiltä merkille, kuittaa tehdyksi yhdellä napilla
- Bulk-kuittaa useita merkkejä kerralla — ei halua olla koko ajan puhelimella
- Siirtää tai poistaa merkin jos paikka ei toimi tai ei tarvita
- Lisää uuden merkin jos maastossa tarvitaan jota ei suunniteltu
- Lisää kommentti/huomion merkille tai pätkälle (yleinen systeemi, ikoni + teksti + nimi valinnaisesti): "puu kaatuu tässä", "blokattiin polku", "lisäsin merkin"
- Kirjaa materiaalit: "otin 10 keppiä mukaan", merkkaa kasan kartalle
- Muokkaa pätkän pituutta kentällä: voi laajentaa pidemmälle tai lyhentää
- Merkkaa pätkä valmiiksi

**Mitä EI tarvitse:** järjestäjän työkaluja (merkkikirjasto, pätkäjako, tilannekuva), rooli-valikointia, mittareita, monimutkaisia valikoita.

**UX-testi:** "Saako talkoolainen oman pätkänsä tilanteen raportoitua nopeasti ja tarkasti? Onko se helppoa tehdä metsässä puhelimella?"

### Järjestäjä toimistossa
- **Kuka:** tuntee reitin entuudestaan, tietää jo minne merkit tulee — sovellus tekee sen näkyväksi ja jaettavaksi. Useita sessioita, ei kiire mutta paljon yksityiskohtia.
- **Laite:** laptop/desktop, iso näyttö, hiiri, hyvä netti
- **Mitä arvostaa:** kartta on pääasia (kaikki muu sen ympärillä), tilannekuva silmäyksellä pätkien väreistä, muutokset nopeasti, pätkä klikattavissa kartalta
- **Mitä EI tarvitse:** valmiusprosenttimittareita, rooli-togglea, drive modea, talkoolaisen kuittaus-UI:ta
- **UX-testi:** "Näkyykö tilanne kartalta yhdellä silmäyksellä? Alle 3 klikkausta muutokseen?"

---

## Komennot

### `init` — luo DESIGN.md

1. Lue `src/style.css` (tai `index.html <style>`) — poimi todelliset arvot
2. Lue `references/design-template.md` — käytä sitä rakennepohjana
3. Kirjoita `DESIGN.md` todellisilla arvoilla (ei placeholdereita)
4. Ilmoita puutteet tai epäyhtenäisyydet

### `auditoi` — tarkista yhtenäisyys

1. Lue `DESIGN.md` — mitkä ovat sopimukset?
2. Lue `src/style.css` + `src/map/icons.ts` — noudatetaanko tokeneja?
3. Tarkista touch-targetit: kaikki interaktiiviset elementit ≥44px?
4. Tarkista kontrasti: WCAG AA (4.5:1)?
5. Tarkista mobiili: rikkoutuuko pienellä näytöllä?

> **Huom §-nimiavaruus:** DESIGN.md:n omat osiot (§C värit, §K komponentit…) ovat ERI
> nimiavaruus kuin cavekit SPEC.md:n osiot (§G §C §I §R §V §T §B). Kirjaimet menevät
> osin päällekkäin (§C, §R, §T) — cavekit v4.1 §R = RESEARCH, ei "Responsive". Älä
> sekoita: tämä audit-raportti käyttää selkokielisiä otsikoita, ei §-sigilejä.

```
## UX-audit YYYY-MM-DD
Värit:         [OK / rikkomukset]
Typografia:    [OK / rikkomukset]
Spacing:       [OK / rikkomukset]
Responsive:    [OK / rikkomukset]
Komponentit:   [OK / rikkomukset]
Accessibility: [OK / rikkomukset]
Kriittiset: [lista]
Korjattu: [lista]
Delegoitu: [bugi → /ck:spec bug: | arkkitehtuuri → /karttamaster-arkkitehtuuri]
```

### `T<n>` tai `komponentti <nimi>` — tarkista yksittäinen komponentti

1. Tunnista mihin HTML/CSS-elementteihin uusi koodi vaikuttaa
2. Tarkista DESIGN.md §K-sopimus kyseiselle komponentille
3. Tarkista: touch target, kontrasti, mobiili, oikea persoona (talkoolainen vai järjestäjä?)
4. Jos rikkomus: korjaa `src/style.css`:ssä tai ao. TS-tiedostossa
5. Raportoi: "Komponentti X: [OK / korjattu / delegoitu]"

### `prompt <palvelu> [kuvaus]` — generoi design-prompti

Generoi valmis tekstiprompt ulkoiseen palveluun:
- `v0` — Vercel v0 (React-komponentti tai layout)
- `lovable` — Lovable.dev (full app tai sivu)
- `artifacts` — Claude Artifacts (interaktiivinen demo)
- `figma` — Figma AI tai FigJam

Promptin rakenne:
1. Konteksti: "SyöteMTB 2026 merkintätyökalu, käyttäjä = [talkoolainen metsässä / järjestäjä toimistossa]"
2. Persoona: kopioi relevantti persoona yllä olevasta §Käyttäjäpersoonat
3. DESIGN.md §C väritokenit
4. Komponenttikohtaiset vaatimukset (DESIGN.md §K)
5. Mikä pitää säilyttää / mikä saa muuttua

Tulosta pelkkä prompti, valmiina copy-pastettavaksi.

### `korjaa <rikkomus>` — ota käyttöön UX-korjaus

1. Tunnista tiedosto (`src/style.css` vai `src/`)
2. Lue tiedosto
3. Tee korjaus
4. Varmista ettei riko muuta

**Älä muuta** `src/logic/` — UX koskee vain `src/ui/`, `src/map/` visual-osat, `src/style.css`.
Jos korjaus vaatii logiikkamuutosta → kutsu `/karttamaster-arkkitehtuuri`.

---

## Automaattiset kutsut

| Tilanne | Kutsu |
|---------|-------|
| UX-ongelma vaatii logiikkamuutosta | `/karttamaster-arkkitehtuuri feature <kuvaus>` |
| Toiminnallinen bugi (ei UX) | `/ck:spec bug: <kuvaus>` |
| Uusi komponentti tarvitsee sopimuksen | Lisää §K-lohkoon `DESIGN.md`:hen |
| Testaaja delegoi UX-ongelman | Suorita `komponentti <nimi>` ja korjaa |

## Suhde muihin skilleihin

- `/karttamaster-rakentaja` kutsuu kun rakentaa `src/ui/`-tason komponentin
- `/karttamaster-testaaja` delegoi UX-bugit (touch target, kontrasti, mobiili)
- `/karttamaster-arkkitehtuuri` koordinoi kun UX-muutos vaatii kerrossiirtoa
- `/ck:spec` lisää UX-taskit §T:hen jos korjaus on iso työ
