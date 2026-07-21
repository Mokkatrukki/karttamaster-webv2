# PM-muistiinpanot — avoimet päätökset & konteksti

Tarkoitus: PM-konteksti jota EI ole koodissa eikä SPECissä.
Työnjako: **SPEC.md** = taskit/bugit/invariantit (§T/§B/§V). **VISION.md §Avoimet** = tuotekysymykset.
Tämä doc = loput (avoimet toteutus-riippuvuudet + arkisto joka estää ratkaistujen uudelleenavaamisen).

Siirretty auto-memorystä repoon 2026-07-21 jotta kulkee gitin mukana koneelta toiselle.

---

## Avoimet (aidosti kesken)

### 1. Sign-kuvat + resize-task
- ~90 merkkikuvaa hakemistoon `src/assets/signs/`, avain = template-id. Osa saapunut, osa puuttuu.
- T158 fallback-ketju (kuva > ikoni > label) rakennettu → build EI blokkaa puuttuviin kuviin.
- **Kun käyttäjä sanoo "kuvat tuli":** specaa resize-task (pienennys + oikea karttamerkki-resoluutio)
  + lisää assetit. Resize-taskia EI ole vielä specattu (kuvaformaatti/koot tuntemattomia).

### 2. Dead-code-siivous: DriveMode + route-bar-drive-kontrollit
- Nämä ovat UI:sta TAVOITTAMATTOMIA (järjestäjä: V134 piilottaa drive-kontrollit;
  talkoolainen: V148 piilottaa koko route-barin):
  - `src/map/drive.ts` (`DriveMode`-luokka)
  - `#btn-route-next`, `#route-track`, `route-bar.ts`, `progress-bar.ts`
  - `main.ts` ArrowRight/Left-navigointi
- Poisto = oma siivoustaski (koskee montaa tiedostoa). Konteksti: §B B102.

---

## Ratkaistut (arkisto — ÄLÄ avaa uudelleen)

Nämä olivat aiemmin avoimia PM-kysymyksiä. Kirjattu tähän jotta ei tutkita samaa kahdesti.

- **B48 `#btn-role`-toggle:** RATKAISTU T203 — poistettu dead codena (`src/app/role-view.ts:21`).
  Rooli tulee tili-per-rooli-authista, ei togglesta.
- **Reittimerkki-facelift (järjestäjä):** rakennettu §T T202–T208. Artifact-mockup "Reittimerkki-v1".
  Design-suunta: vaalea paperi-chrome — `--paper #EDF1EC` / `--ink #17221D` / aksentti `--tape #F2542D`,
  Kaamos-yöteema optiona. Merkit neliökortteina ("kyltti kepissä"), ei teardrop-pyöreitä (T208/V136).
- **Tehtävämalli (Segment reititön + markerSet):** rakennettu §T T212–T219.
  Segment = tehtävä-primitiivi, reitti valinnainen. markerSet = `linkedMarkerIds[] ∪ markerTypeFilter?`.
- **Aluetehtävä / kasa-kuittaus / self-assign:** ratkaistu → VISION.md §Avoimet #4/#5.
  Ei self-assignia (vain järjestäjä jakaa hash-URL:t). Kasa = talkoolaisen droppaama SignMarker,
  autoporukka = dynaaminen tyyppisuodatin.
- **Karttamerkin visuaali (mitä näytetään kartalla):** ratkaistu T152 (status-väri per pätkä)
  + T208 (neliökortit) + V87 (täyttö = tyyppiväri, reuna = status).
- **Näkymä-yhtenäistys (talkoolainen + huoltopiste sama pattern):** toteutunut T220–T224 SegmentView-
  reshapessa (kartta primary + kokoontaitto + hero). Huoltopiste `/a/<hash>` käyttää samaa koko-kartta-
  focus-patternia.

---

## Työkaluohje
- Avoin päätös → nosta esiin seuraavassa `/karttamaster-pm mitä seuraavaksi`.
- Uusi feature → `/karttamaster-pm tarkista <feature>` (vision-yhtenäisyys) ensin.
