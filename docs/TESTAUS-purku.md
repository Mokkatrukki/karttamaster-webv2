# Purkuvaiheen testausohje (T420–T430)

Mitä tässä testataan: purku käy **samalla tavalla kuin merkkaaminen** — sama suunta, sama hero,
sama yhden napin kuittaus. Lisäksi kasat: talkoolainen jättää merkkinipun maastoon, autoporukka
hakee sen autolla.

Kaikki alla oleva on jo automaattitestattu (2155 Vitest + 412 Bun + 197 Playwright).
Tämä ohje on **käsin läpikävelyyn** — sitä varten että näet omin silmin miltä kentällä näyttää.

---

## 0. Käynnistys

Kaksi prosessia, molemmat omaan terminaaliin:

```bash
bun run server     # backend, portti 3001
bun run dev        # frontend, portti 5173
```

Avaa <http://localhost:5173>. Kirjaudu järjestäjänä.

> Jos et halua sotkea `dev.db`:tä, aja `bun run dev:e2e` (oma kanta `dev.e2e.db`, portti 5180).

---

## 1. Järjestäjä: tee eka pätkä ja merkit

1. Valitse kartalta reitti (esim. **55 km**).
2. Piirrä pätkä: sivupalkin **Pätkäjako** → uusi pätkä → vedä rajat kartalle.
3. Anna pätkälle nimi (esim. *"Matin pätkä"*) ja **jaa koodi** — modaalista saat linkin `/s/<koodi>`.
   Ota koodi talteen, sitä tarvitaan kohdassa 3.
4. Sijoita pätkälle **3–5 merkkiä** (tuplaklikkaus kartalla → merkkipohja).

### Tarkistus
- [ ] Pätkän rivi sivupalkissa näyttää `0/5 asetettu`.

---

## 2. Merkkaa pätkä (asetusvaihe) — vertailukohta

Avaa `/s/<koodi>` (sama selain käy). Näet talkoolaisen näkymän.

1. Hero näyttää **"Seuraava merkki · 1/5"** ja alimmaisena napit `✓ Aseta` + `Näytä kartalla`.
2. Paina `✓ Aseta` kunnes kaikki on asetettu.
3. **Katso mihin suuntaan hero etenee** — kirjaa ylös ensimmäinen ja viimeinen merkki.

### Tarkistus
- [ ] Hero etenee pätkän alusta loppuun.
- [ ] Lopuksi *"✓ Kaikki asetettu 🎉"* + `✓ Merkitse pätkä valmiiksi`.

---

## 3. Purkuvaihe — tämä on uutta

Järjestäjänä:

1. Avaa pätkän modaali → **"Kloonaa Tarkastus-vaiheeseen"**, ja klooni uudelleen →
   **"Kloonaa Purku-vaiheeseen"**. (Vaiheketju on `asettaminen → tarkastus → purku`.)
   Klooni perii reitin, rajat ja jäljen mutta **ei koodia** — anna purkupätkälle oma koodi.
2. Vaihda yläpalkin **Vaihe: Purku**.

### Tarkistus — T426 (vaihe on koko järjestelmän tila)
- [ ] Avaa `/patkat` **toisessa selaimessa tai incognitossa** talkoolaisena.
      Hubin otsikko lukee **"Pätkät · Purku"** — vaihe ei ole selainkohtainen asetus.
- [ ] Talkoolaiselle näkyy **vain purkuvaiheen pätkät** — asetusvaiheen kloonit eivät.
      Sama fyysinen maasto elää kolmena pätkänä; kolme riviä samasta metsästä olisi ansa.
- [ ] Jos purkuvaiheessa ei ole vielä pätkiä, lista sanoo *"Purku-vaiheessa ei ole vielä
      pätkiä sinulle"* — ei tyhjää ruutua.
- [ ] Järjestäjä näkee hubissa yhä **kaikki** vaiheet (hän vaihtaa vaihetta).

> Vaihe luetaan **sivun latauksessa**, ei pollata. Jos vaihdat vaiheen kesken talkoolaisen
> session, hän näkee muutoksen kun sivu latautuu uudelleen. Tämä on tietoinen raja: metsässä
> yhteys on kallis ja vaihe vaihtuu kerran tapahtumassa.

Avaa purkupätkän `/s/<koodi>`:

### Tarkistus — T420 (suunta)
- [ ] Hero näyttää **"Seuraava purettava · 1/5"**.
- [ ] **Ensimmäinen purettava on SAMA merkki kuin ensimmäinen asetettava** kohdassa 2.
      Tämä on koko korjauksen ydin (B172): purkua ei ajeta vastasuuntaan.
- [ ] `▶` etenee samaan suuntaan kuin asetusvaiheessa; viimeisessä `▶` on harmaana.

### Tarkistus — T422 (hero + kuittaus)
- [ ] Primary-nappi lukee **`✓ Kerätty`** (ei "Aseta").
- [ ] Nappi on vähintään peukalon kokoinen (44 px) — kokeile puhelimella tai
      selaimen mobiiliemulaatiolla (390×844).
- [ ] Kuittaus siirtää merkin `kerätty`-tilaan: edistymispalkki kasvaa `N/5 kerätty`.
- [ ] Kun kaikki on kerätty: *"✓ Kaikki kerätty 🎉"* + `✓ Merkitse pätkä valmiiksi`.

### Tarkistus — T429 (tasan kaksi toimintoa)
- [ ] Avaa heron **⋯**-valikko: siellä on **tasan yksi rivi, "Ei löytynyt"**.
- [ ] *Siirretty*, *Lisää ohje*, *+ Merkki* ja *Ota kuva* **eivät ole olemassa** purussa —
      eivät myöskään harmaina. Ne ovat suunnittelun työkaluja; purussa merkki on jo maastossa.
- [ ] "Ei löytynyt" siirtää merkin pois avoimista ja järjestäjä näkee sen tilannekuvassa.
- [ ] Palaa asetusvaiheen pätkälle: **viisi** riviä valikossa, ensimmäinen "Ei tarpeen".

### Tarkistus — T428 (ei varusteita purussa)
- [ ] Siirry koti-näkymään (🏠): **"🎒 Varustelista" -välilehteä ei ole** purkupätkällä.
- [ ] Asetusvaiheen pätkällä välilehti on ennallaan.

> **Huom:** purussa hero näyttää vain merkit jotka on **asetettu**. Merkki jota ei koskaan
> asetettu ei ole purettavissa — se on tarkoituksellista, ei bugi.
>
> Jätesäkit/työkalut purun omana listana on kirjattu (**§T431**) mutta ei rakennettu.

---

## 4. Kasan jättäminen (T424)

Pysy purkupätkän näkymässä.

1. Kuittaa **2–3 merkkiä** kerätyksi.
2. Heron alle ilmestyy **`📦 Jätä kasa tähän (3 merkkiä)`**.
3. **GPS päällä:** käynnistä GPS (kartan `📍 GPS`) ja paina kasanappia → kasa syntyy siihen
   missä olet, nolla lisänapautusta.
4. **Ilman GPS:ää:** paina kasanappia ilman GPS:ää → sovellus pyytää *"Napauta kartalta kohta
   johon jätit kasan"*, ja seuraava kartan napautus luo kasan. Esc peruu.

### Tarkistus
- [ ] Nappi **ei näy** ennen kuin jotain on kerätty (ei tyhjää nappia).
- [ ] Napin luku vastaa kerättyjen määrää.
- [ ] Kasa ilmestyy kartalle omalla ikonillaan siihen missä olet.
- [ ] Alareunaan tulee ilmoitus *"📦 Kasa jätetty — 3 merkkiä"*.
- [ ] **Nappi katoaa heti kasan jälkeen** — samat merkit eivät voi mennä kahteen kasaan.
- [ ] Kerää loput merkit → nappi ilmestyy uudelleen uudella luvulla.
- [ ] **Ilman GPS-fixiä kasa syntyy silti** — napautuksesta (T430/V320). Kirjaamaton kasa on
      lopullinen vahinko; epätarkka ei ole, koska kasa on merkki: sen voi raahata oikeaan
      paikkaan tai poistaa.

---

## 5. Autoporukka hakee kasat (T425)

Järjestäjänä, kerran koko tapahtumaa kohti:

1. Luo **reititön tehtävä**: sivupalkki → uusi pätkä → **älä piirrä reittirajoja**, anna nimeksi
   *"Keräyskasat"*.
2. Aseta sen **merkkityyppisuodattimeksi** `Keräyskasa` (kasa-merkkipohja on valmiina kirjastossa —
   sitä ei tarvitse luoda käsin).
3. Anna tehtävälle oma koodi ja jaa se autoporukalle.

Avaa keräystehtävän `/s/<koodi>`:

### Tarkistus
- [ ] Jokainen jätetty kasa näkyy listalla **elävästi** — ei järjestäjän hyväksyntää, ei viivettä.
- [ ] Rivillä lukee **montako merkkiä kasassa on** (esim. `3 merkkiä`) → tiedät tarvitsetko ison auton.
- [ ] Rivillä on **📍-nappi** joka avaa Google Mapsin kasan koordinaatteihin (vaatii verkon).
- [ ] GPS päällä: listan yläpuolella **"📍 Lähin kasa: … · N merkkiä"**.
- [ ] **Listan järjestys EI hypi** kun liikut — vain "lähin"-rivi vaihtuu. (Joka GPS-fixillä
      liikkuva lista on lukukelvoton hanskat kädessä.)
- [ ] `✓ Haettu` merkitsee kasan haetuksi; rivi himmenee.
- [ ] Jos autoporukka löytää kasan jota listalla ei ole, he voivat lisätä sen itse (`+ Merkki`).

---

## 6. Regressiotarkistus (että vanha ei rikkoutunut)

- [ ] Asetusvaiheen hero toimii täsmälleen kuten ennen (kohta 2).
- [ ] Tarkastusvaiheen pätkällä **ei ole merkkiheroa** — siinä on pätkän oma tarkastuskuittaus.
- [ ] Järjestäjän merkkijono-paneeli näyttää saman järjestyksen kuin talkoolaisen lista.

---

## Jos jokin ei toimi

Kirjaa löydös bugina — älä korjaa ohimennen:

```
/karttamaster-pm bugiraportoi <mitä teit, mitä odotit, mitä tapahtui>
```

Automaattitestit ajetaan näin:

```bash
bun run test                                   # 2155 yksikkö-/DOM-testiä
bun test server/                               # 412 backend-testiä
bunx playwright test e2e/ --browser=chromium   # 197 selaintestiä (vaatii ~8 min)

# vain purkuvaiheen selaintestit:
bunx playwright test e2e/t420-t425-purku.spec.ts --browser=chromium
```
