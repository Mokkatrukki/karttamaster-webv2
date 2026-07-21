# REDESIGN — Talkoolaisen näkymä (2026-07-21)

> Lähde: käyttäjän visiodumppi 2026-07-21. Tavoite: lukita IA + polut ENNEN buildia.
> "Menty monta kertaa harhaan" → tämä brief = yksi totuus talkoolaisen flowsta.
> Kun avoimet päätökset (❓) lukittu → `/karttamaster-spec` pilkkoo §T-taskeiksi.

## Ydinperiaate

**Karttanäkymä = tosi yksinkertainen. 80% ruudusta karttaa. Merkki näkyy hyvin.**
Kaikki muu (GPS, varusteet, data, toiminnot) → valikoihin. Ei chromea kartan päälle.

---

## Kaksi näkymää

### Näkymä 1 — Pätkänäkymä (EI karttaa) = "koti"

Talkoolainen saa oman pätkänsä. Tämä on landing / lähtökohta.

- **Varustarkastus ensin:** varustelista näkyvissä. Ota kaikki merkit + kyltit + tavarat mukaan.
  Merkitse "otin nämä" (check-off per rivi). → lähtövalmis.
- **Kaikki merkit -lista** (siirtyy tänne yläpalkista)
- **Varustemodal-sisältö** (siirtyy tänne)
- **Koko pätkän kommentit** ("elä laita tähän etusivulle sekavasti" — omana selkeänä osiona/valikosta)
- **Merkitse pätkä/reitti tehdyksi** (mahd. tänne)
- **Muokkaa pätkän rajoja**
- → siirry **karttanäkymään**

### Näkymä 2 — Karttanäkymä (~current, 80% kartta)

- **Alapalkki:** "seuraava merkki" -palikka — kuva mistä merkistä on kyse; kartalla näkyy mitä tarkoitetaan.
- **Kartalla korostus:** ~~rengas~~ → korosta ITSE IKONI huomiovärein (näkyvämpi kuin rengas).
- **Merkin tap →** kommentti ("laitettiin se puuhun") + siirrä merkkiä + `⋯` "elä laita".
- **Yläpalkin `⋯`-valikko:** reitti tehdyksi / lisää merkki / muokkaa pätkää / GPS.

---

## Toolbar (yläpalkki) -remontti — "vähän köpö"

Kaikki pienemmäksi. Sinne kaikki data + tarvikkeet + asetukset.

| Ongelma | Korjaus |
|---------|---------|
| 🐛 Teema "Kaamos-tumma" ei aktivoidu (jää vaaleaksi) | **BUGI** — theme.ts/setTheme ei applyaa |
| Teemanimet pitkät, epäsymmetriset (tumma-fontti pienempi) | Nimet → **"Tumma" / "Vaalea"** tai pelkät ikonit |
| Karttatyyli = outo nappi, ei kerro mikä käytössä | Näytä **aktiivinen tyyli** (label) tai **radiobutton** |
| "Kirjaudu ulos" iso | Pienemmäksi |
| GPS erillään | GPS → **valikkoon** |
| Yleisesti kaikki isoa | Tiivistä; kaikki data valikkoon |

---

## Poista sekaannus

**"En ymmärrä mikä toi kommenttti juttu on tässä etusivulla."**
→ Nykyinen `.segment-view-comments` (pätkänäkymän kommenttilanka "etusivulla") on sekava.
Kommentit kuuluvat **kahteen paikkaan:**
1. **Merkkimodaali** — per-merkki kommentit ("laitettiin se puuhun")
2. **Koko pätkän kommentit** — pätkänäkymässä, saavutettavissa valikosta (ei liimattuna etusivulle)

---

## Lukitut päätökset (2026-07-21)

1. ✅ **Navigointi:** Pätkänäkymä = LANDING (avautuu ensin). Iso **"Kartalle →"** -nappi → karttanäkymä.
   Kartalta paluu **yläpalkin napista** (🏠/⋯). Ei tab-toggle, ei kartta-landing.
2. ✅ **Varustarkastus:** VAPAAEHTOINEN — ei gatea. Pätkänäkymä näyttää varusteet, mutta kartalle
   pääsee heti. Talkoolainen tietää mitä tekee.
3. ✅ **"Reitti tehdyksi" = OMA PÄTKÄ** (yksi pätkä, `Segment.completed`). "Reitti" oli löysä sana.
   EI erillistä koko-reitti-toimintoa.
4. ✅ **Valikot karttanäkymässä:** YKSI yläpalkin **⋯** = kaikki (reitti tehdyksi, lisää merkki,
   muokkaa pätkää, GPS, → pätkänäkymä, tili/teema/karttatyyli/logout). Merkin tap = **oma pieni
   toimintovalikko** (kommentti / siirrä / elä laita). Kaksi eri valikkoa OK (eri konteksti).

---

## Talkoolaisen journey (käyttäjän 2026-07-21 kuvaama flow + VISION.md r34–57)

```
Assignment          Kuka menee mille pätkälle → saa /s/<koodi> (WhatsApp/QR)
   ↓
KOTI (pätkänäkymä)  Katso tavarat mukana → varustarkastus (checkoff "otin nämä")
   ↓  [ Kartalle → ]
KARTTA (merkkaus)   Mene pätkän alkuun → aseta merkkejä:
                      • kuittaa "aseta" (asetin sen)
                      • lisää merkki jos maasto vaatii
                      • siirrä suunniteltu merkki toisaalle
                      • "elä laita" (ei tarpeen)
                      • kommentoi merkkiä ("laitettiin puuhun")
   ↓  [ 🏠 koti / ⋯ ]
KOTI (yhteenveto)   Kuittaa "kaikki tehty" → yhteenveto: onko tehty,
                    lisätyt merkit näkyvät hyvin
```

## Kolme momenttia (2 näkymää, koti tuplaroolissa)

### Pätkänäkymä = KOTI (landing + yhteenveto, sama näkymä kaksi tilaa)
- **Header:** pätkän nimi + pituus + edistymispalkki (aina).
- **Ennen (varustarkastus):** varustelista + checkoff. Vapaaehtoinen (ei gate).
- **Aina:** Kaikki merkit -lista, koko-pätkän kommentit (valikosta/omana osiona), muokkaa rajoja.
- **Yhteenveto-tila (completed):** "✓ Pätkä valmis" + **lisätyt/muutetut merkit korostettuna** (talkoolainen näkee mitä sai aikaan).
- **Iso primary:** `Kartalle →`.
- Filosofia: koti = konteksti + raportointi, EI kartta. Kartta on erillinen työkalu.

### Karttanäkymä = TYÖ (80% karttaa)
- **Kartta 80%.** Ei chromea päällä.
- **Alapalkki:** seuraava merkki -palikka (kuva) — kartalla ikoni korostuu huomiovärein (ei rengasta).
- **Yläpalkki:** `🏠 koti` (paluu) + `⋯` (kaikki: reitti tehdyksi, lisää merkki, muokkaa pätkää, GPS, tili/teema/karttatyyli/logout).
- **Merkki-tap:** oma pieni valikko (kommentti / siirrä / elä laita).
- Filosofia: yksi asia kerrallaan — seuraava merkki. Max 2 nappia näkyvissä.

## Bugit (pilkotaan §B:hen, viilataan JÄLKEENPÄIN — ei blokkaa redesignia)

- **B(theme):** teema-toggle "Kaamos-tumma" ei aktivoidu, jää vaaleaksi.
- **B(label-kontrasti):** kartan "Pätkä 1" -label tumma tummalla kartalla → ei erotu. Kaipaa kontrastia (tausta/varjo/väri).
- **B(pätkän pituus kartalla):** ❓ kartan pätkän pituus "ei tarpeeksi pitkä" — selvitä: reittiviiva liian lyhyt vai visuaali ei kata koko pätkää?
- ✅ **B105 (korjattu):** comment-form 0 CSS → tokenit + 44px touch + "Ikoni ja nimi" -label + "Lisää ⋯" napiksi.

## Toteutuksen eteneminen (§T) — VALMIS 2026-07-21 (autonominen sessio)

- ✅ **R1 = T254**: kaksi-moodi-kehys koti↔kartta. `src/app/talkoolainen-mode.ts` + `[data-view-mode]` CSS + 🏠/Kartalle→. Vitest 6/6 + e2e + kriittinen polku.
- ✅ **R5 = T255**: karttanäkymä minimal — kartta ~80% + hero alapalkkina (segment-view absolute bottom). CSS-vain. Playwright.
- ✅ **R6 = T256**: seuraava-merkki-korostus rengas → ikoni-hehku (`setNextHighlight` + drop-shadow glow). Marker-vitest 135 + Playwright.
- ✅ **R8 = T257**: yläpalkin ⋯ = GPS + Lisää merkki + Merkitse valmiiksi (GPS pois herosta). Playwright.
- ✅ **R2 = T258**: varustarkastus "otin nämä" checkoff (client-only, `varustarkastus.ts`). Vitest-pure 7/7 + Playwright.
- ✅ **R9 = T259**: toolbar/tilivalikko — teemat "☀️ Vaalea"/"🌙 Tumma" (aktiivinen ✓; toggle TOIMII — ei bugi), karttatyyli näyttää aktiivisen, logout kevyeksi, kartta-toolbar declutter. Playwright.
- ✅ **R4 = T260**: pätkän kommentit koti-etusivulta "Lisää ⋯"-valikkoon (poisti sekaannuksen). Vitest t232 + Playwright.
- ✅ **B106**: kartan pätkä-label luettavaksi vaaleassa teemassa (color #fff, oli var(--text-body) fixed-tummalla pillillä).
- ✅ **R7**: KATETTU olemassa olevalla — merkki-tap → MarkerDetailModal jo sisältää kommentti (locationNote) + "Ei tarpeen" (elä laita) + status + raahaus (siirrä). Erillinen mini-menu = duplikaatti, ei rakennettu.
- ✅ **T262/V182 (2026-07-21, iteraatio 2):** KOTI-swap — varustelista+varustarkastus INLINE (`src/ui/segment-equipment.ts`) heron tilalle; "seuraava merkki" -hero piilotettu kodista (jää kartan alapalkiksi). Checkoff jakaa client-only-tilan + label-avaimet EquipmentModalin kanssa (`varustarkastus.ts`). Käyttäjän lukittu päätös (AskUserQuestion): varuste→KOTI, hero→kartta-only. Vitest 7 + Playwright 3, täysregressio vihreä.
- ✅ **T263/V183 (2026-07-21, iteraatio 2):** R3 — "Kaikki merkit" -lista INLINE koti-näkymään (`src/ui/segment-marker-list.ts`, koti-only; rivi→MarkerDetailModal). Käyttäjän lukittu päätös: kyllä, inline kotiin (koti = ei karttaa → T228:n tilaperuste ei päde). Vitest 5 + Playwright 1.
- ✅ **T264/V184 (2026-07-21, iteraatio 3):** KOTI = 3 välilehteä (`src/ui/segment-koti-tabs.ts`): **Varustelista · Kaikki merkit · Kommentit**. "Lisää ⋯" -accordion POISTETTU — "Merkitse pätkä valmiiksi" + "Muokkaa rajoja" siirtyivät Kaikki merkit -tabiin (ei enää haitarin alla, käyttäjäpalaute). Kaikki merkit -lista ryhmitelty asetetut/asettamatta/ei tarpeen. Yläpalkin 🎒 Varustelista-nappi poistettu + Kaikki merkit -nappi piilotettu talkoolaiselta (molemmat koti-tabeja). Lukittu tab-rakenne AskUserQuestionilla (3 tabia). Vitest 88 (kosketut) + e2e 105 vihreä; korjattu 2 orpoa e2e-testiä (T257-GPS-siirron jäljiltä).
- ⏭️ **AVOIN — B(kartan pätkän pituus "liian lyhyt"):** JUURISYY LÖYTYI — `planSegmentZoom` (`src/logic/segment-zoom.ts`) `maxFitLengthM=4000` ankkuroi >4km pätkän VAIN ensimmäiseen 4km:iin (tahallinen T224/D anchor). Käyttäjä 2026-07-21: "en osaa vielä sanoa" → korjaus (fit-koko vs nosta raja) odottaa konkreettista toistettavaa pätkää (pituus+reitti). EI muuteta arvaamalla.

Kaikki paikallista (ei tuotantoon). Täysregressio vihreä joka incrementin jälkeen.

## Jo tehty tällä kierroksella

- Comment-form styling + label + "Lisää ⋯" (B105). HUOM: näiden PAIKKA muuttuu redesignissa,
  mutta CSS-tokenointi + touch pysyy validina.
