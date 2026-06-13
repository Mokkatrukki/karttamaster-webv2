# Karttamaster — SyöteMTB 2026 visio

## Mikä tämä on

Työkalu SyöteMTB 2026 -tapahtuman reittimerkintöjen suunnitteluun, toteutukseen ja purkuun. Korvaa paperisen kartan + metsässä otetut kuvat. Kaveriporukka tekee talkootyönä — fiilis on luottavainen ja rento, ei firmafiilistä.

## Käyttäjät

### Tapahtumajärjestäjä

**Persoona:** Kokeneempi tyyppi joka tuntee reitin. Tietää jo ennen kuin avaa sovelluksen suunnilleen minne merkit tulee — sovellus on paikka tehdä se näkyväksi ja jakaa muille. Tekee työtä omassa tahdissaan, useassa sessiossa, kotona tai toimistolla. Ei stressiä, mutta haluaa että asiat pysyvät järjestyksessä ja kaikki tietävät missä mennään.

**Konteksti:** toimisto tai koti, iso näyttö (laptop/desktop), hiiri, hyvä nettiyhteys, rauhallinen tilanne. Ei kiirettä mutta paljon yksityiskohtia hallittavana.

**Mitä järjestäjä tekee:**
- Lataa GPX-reitit (gravel + MTB, osin päällekkäiset). GPX voi päivittyä — merkit säilyvät, koska ne eivät ole sidottuja GPX-pisteisiin vaan kartalla itsenäisesti.
- Rakentaa merkkikirjaston: "Huoltopiste 25km", "Alueella pyöräkilpailu", nuolet jne.
- Käy reittiä osissa läpi ja merkkaa kylttejä — sessioiden välinen työ säilyy.
- Luo erikoismerkkejä: huoltoalueet (nimi + kuvaus/kuva/aukioloaika), noutopisteet, pudotuspisteet.
- Jakaa reitin pätkiin talkoolaisille — näkyy kartalla värillisinä kaistoina.
- Seuraa edistymistä kartalta: pätkien värit/statusit kertovat tilanteen ilman mittareita.
- Voi itse merkata yksittäisen merkin laitetuksi.

**Mitä järjestäjä tarvitsee:** selkeys ja hallinta. Kaikki reitit näkyvissä yhtä aikaa. Muutokset nopeasti. Delegointi selkeästi. Tilannekuva ilman numeropaneeleja — kartalta näkee.

**Näkymä:** Täysin oma näkymä ja flow. Ei rooli-togglea. Järjestäjä ei näe talkoolaisen UI:ta eikä toisinpäin — eri URL, eri autentikaatio, eri layout.

**Mitä järjestäjä EI tarvitse:** valmiusprosenttimittareita, drive mode (nice-to-have), talkoolaisen kuittaus-UI.

**UX-testi järjestäjälle:** "Näenkö kartalta yhdellä silmäyksellä missä vaiheessa mikäkin pätkä on? Voinko tehdä muutoksen kolmella klikkauksella?"

### Talkoolainen

**Persoona:** Talkoolainen tietää mitä pitää tehdä — hän on saanut tehtävän, tuntee alueen, ja menee maastoon tekemään sen. Sovellus on väline raportoida miten pätkä meni: mitä tehtiin, mitä muutettiin, mitä huomattiin. Ei tarvitse järjestäjän kokonaiskuvaa — oma pätkä riittää.

**Konteksti:** metsässä tai autossa. Android-puhelin. Hanskat kädessä mahdollisesti. Huono tai ei ollenkaan nettiyhteys. Akku hupenemassa. Muut talkoolaiset odottavat tai ovat omilla pätkillään — koordinointi WhatsAppissa.

**Mitä talkoolainen tekee:**
- Vastaanottaa pätkän hash-URL:n (WhatsApp tai QR-koodi) — avaa suoraan omaan näkymään
- Tarkistaa tehtävälistan ja varustelistan, päivittää tarvittaessa ennen lähtöä
- Navigoi merkiltä merkille, kuittaa tehdyksi
- Bulk-kuittaa useita merkkejä kerralla kun on selvää mitä tehtiin
- Siirtää tai poistaa merkin jos maasto vaatii
- Lisää merkin jota ei suunniteltu, tai huomion/kommentin (ikoni + teksti)
- Muokkaa pätkän pituutta kentällä — voi laajentaa tai lyhentää
- Kirjaa materiaalit: "otin 10 keppiä mukaan", merkkaa kasan kartalle
- Merkkaa pätkä valmiiksi

**Mitä talkoolainen tarvitsee:** nopea raportointi omasta pätkästä. Kriittiset toiminnot max 2 napin päässä. Toimii huonolla netillä. Voi korjata jälkikäteen — virhe ei ole katastrofi.

**Mitä talkoolainen EI tarvitse:** järjestäjän kokonaiskuvaa, merkkikirjaston hallintaa, muiden pätkien tietoja, rooli-valikointia.

**Näkymä:** Täysin oma näkymä ja flow. Avautuu suoraan omaan pätkään hash-URL:sta. Ei järjestäjän UI:ta näkyvissä.

**UX-testi talkoolaiselle:** "Saako oman pätkän tilanteen raportoitua nopeasti ja tarkasti? Toimiiko metsässä puhelimella huonolla netillä?"

### Koordinaattori / tarkastaja

Sama flow kuin talkoolaisella — eri pätkä, tarkastusvaihe. Ajaa autolla tai pyöräilee, merkitsee että on tarkastanut, voi lisätä huomioita tai kylttejä. Ei erillinen rooli tai tunnus — talkoolainen eri tehtävässä.

Sama henkilö voi tehdä useita pätkiä eri vaiheissa. Kaikki näkevät kaikkien statuksen — avoimuus on tarkoituksellista.

## Reitit

4 GPX-reittiä, osin päällekkäisiä (35km + 60km jakavat pitkän yhteisen osuuden). Lähtö ja maali samat kaikille. Fyysinen merkki voi palvella useampaa reittiä samanaikaisesti — se on yksi esine, ei monta.

## Merkkijärjestelmä

**Merkkikirjasto** (järjestäjä rakentaa): ikoni + teksti + kuvaus. Esimerkkejä: nuoli oikealle, nuoli vasemmalle, "Varo hyppy", "Muurahaispesä", "Huolto 25km", "->". Ikonilähde selvitetään tutkimusvaiheessa.

**Kartalla oleva merkki** = kirjaston instanssi + sijainti + suunta (bearing) + paikkaohjeet.

**Merkin elinkaari**: `suunniteltu → asetettu → tarkistettu → kerätty`

Merkki voi olla myös "ei tarpeen" — talkoolainen voi ohittaa sen perustellusti.

## Vaiheet

### 1. Suunnittelu (järjestäjä, toimistossa)
GPX sisään → merkkikirjasto → merkit kartalle → pätkäjako talkoolaisille. Pätkä on maantieteellinen väli reitillä pisteestä Y pisteeseen X, voi kattaa useamman reitin päällekkäisyyden. Pätkää voidaan lyhentää jälkikäteen (sairastuminen, ongelmat).

### 2. Valmistelu (talkoolainen, kotona/autossa)
Näkymä: oma karttapätkä + varustelista (automaattinen merkkimäärälaskuri + manuaaliset lisäykset kuten "5 rullaa nauhaa") + järjestäjän ohjeteksti. Offline-lataus omalle pätkälle tässä vaiheessa.

### 3. Kenttätyö — asettaminen (talkoolainen, metsässä)
GPS-navigointi Google Maps -tyyliin: "seuraava merkki 300m päässä". Jos GPS ei ole päällä, näyttää listan seuraavista asettamattomista merkeistä. Kuittaus: asetettu / ei tarpeen / lisäsin toisen. Voi merkata jälkikäteen listasta.

### 4. Tarkastus (järjestäjä tai talkoolainen, pyörällä/autolla)
Samat työkalut kuin kenttätyössä. Voi lisätä, poistaa, muokata merkkejä suoraan metsässä. Huomiot vapaakenttänä.

### 5. Purku (talkoolainen, tapahtuman jälkeisenä päivänä)
Sama logiikka kuin asettamisessa, mutta kerätään merkit. Pätkällä voi valita lähtösuunnan (kummasta päästä aloitetaan). "Kasatut merkit" = erityinen keräyspiste johon on kasattu monta merkkiä, merkitään haetuksi kun auto käy hakemassa.

### 6. Kokonaistilannekuva (kaikki näkevät)
Kartta värikoodauksella: suunniteltu / asetettu / tarkistettu / kerätty / ongelma. Prosenttiluvut per reitti ja kokonaisuus.

## UX-periaatteet

- **Metsässä toimiva**: isot napit, selkeä navigaatio, toimii huonolla yhteydellä
- **Luottavainen**: kaikki näkevät kaikkien työn, ei hierarkiaa käytännössä
- **Nopea kuittaus**: yksi nappi riittää normaalitapauksessa
- **Sama työkalu eri rooleille**: ei kahta eri sovellusta, vain eri näkymät
- **Max 2 nappia kriittisiin toimintoihin**: talkoolaisen flow ei saa vaatia enempää

## Arkkitehtuuriperiaatteet

Nämä periaatteet ohjaavat kaikkia rakennuspäätöksiä. Ne on kirjoitettu tänne jotta suunnittelija ja testaaja voi tarkistaa niistä onko feature tehty oikein.

### Loogisuus ennen Leafletia
Kaikki bisneslogiikka (merkkien laskenta, pätkälogiikka, navigointi, statuslogiikka) elää puhtaissa TypeScript-funktioissa tai -luokissa jotka eivät tiedä Leafletista mitään. Leaflet on ohut karttakerros jonka päälle UI rakennetaan. Tämä mahdollistaa nopean testauksen ilman selainta.

```
src/logic/    ← puhtaat funktiot, ei Leafletia, Vitest-testattavia
src/map/      ← Leaflet-glue, ohut kerros
src/ui/       ← DOM-komponentit ilman Leafletia
src/main.ts   ← vain init + wiring
```

### Komponenttirekisteri
COMPONENTS.md on arkkitehtuurin lähde totuus. Jokainen näkymä/komponentti on siellä kuvattuna: vastuu, nykyiset ominaisuudet, tulossa-lista, käyttäjäkonteksti, testattavuustaso. Kun uusi feature lisätään, COMPONENTS.md päivitetään ensin.

### Muutettavuus
Asiat tulevat muuttumaan. Merkkityypit muuttuvat, reitit muuttuvat, statuslogiikka laajenee. Moduulit ovat pieniä ja yhden vastuun periaatteella. Kun komponentti kasvaa yli ~150 riviä tai saa toisen vastuun, se pilkotaan.

## Testausperiaatteet

Nämä periaatteet kertovat miten testaus toimii tässä projektissa. Playwright on kallis — käytetään sitä vain kun se on ainoa tapa.

### Testauskolmio

**Taso 1 — Nopeat Vitest-testit (ei DOM):** `src/logic/` moduulit. Bearing, GPX-parsinta, merkkikirjasto, pätkälogiikka, statuslogiikka, navigointilogiikka. Näitä voi ajaa satoja sekunnissa. Jokainen logiikkamuutos saa testit täällä.

**Taso 2 — Vitest + jsdom:** UI-komponentit jotka eivät tarvitse Leafletia. Merkkilistat, varustelista, statuspaneeli, lomakkeet. Näissä testataan DOM-logiikkaa ilman oikeaa selainta.

**Taso 3 — Playwright (minimaalinen):** Vain kriittiset end-to-end -polut joita ei voi testata muuten. Merkki kartalle ja se näkyy listassa. Drive mode käynnistyy ja navigoi. Ei enempää kuin on pakko.

### Käyttäjätestausperspektiivi
Tekninen testi ei riitä. Jokainen feature tarkistetaan myös roolinäkökulmasta:
- **Talkoolainen:** toimiiko tämä yhdellä kädellä, metsässä, stressaantuneena?
- **Järjestäjä:** saako tästä riittävän tilannekuvan, onko kaikki tarvittava käden ulottuvilla?

Jos feature on teknisesti oikein mutta ei läpäise käyttäjätestiä, se on kesken.

## Tekninen rajaus

- Tämä versio: SyöteMTB 2026 -tapahtuma, ei multi-event tuki
- Offline: valinnainen, oma pätkä ladattavissa etukäteen
- Live tracking v1: oma GPS-sijainti näkyvissä itselle, ei muille
- Ei PDF-tulostusta

## Järjestäjän käyttäjätarinat

### GPX & karttapohja

- Lataan GPX-tiedostot (gravel + MTB, osin päällekkäiset reitit).
- GPX voi päivittyä milloin tahansa — merkit säilyvät, koska ne eivät ole sidottuja GPX-pisteisiin. Merkit ovat kartalla itsenäisesti.
- Nykyinen kartan siirto/zoom toimii hyvin, säilytetään.

### Merkkien suunnittelu

- Käyn reittiä läpi osissa, merkkaan kylttejä järjestyksessä alusta eteenpäin.
- Voin keskeyttää ja jatkaa myöhemmin — työ säilyy sessioiden välillä.
- Merkkikirjasto on laajennettavissa: "Huoltopiste 25km", "Alueella pyöräkilpailu", nuolet jne. — helposti lisättäviä uusia tyyppejä.
- Näkymällä tarvitsen vain kartan + merkit. Ei mittareita, ei paneeleja täyttämään ruutua.
- Drive mode on nice-to-have järjestäjälle, ei kriittinen.
- Voin itse merkata yksittäisen merkin laitetuksi (ei vain talkoolaisen toiminto).

### Erikoismerkit / POI

- **Huoltoalue** = "laatikko" tai custom karttamerkki (ei pelkkä pin). Sisältää: nimi + vapaamuotoinen teksti + kuva(t) + aukioloaika. Rich content, ei pelkkä teksti.
- **Noutopiste / pudotuspiste** = custom karttamerkki joka kertoo mistä tullaan hakemaan / mihin pudotetaan tarvikkeet. Näkyy kartalla omana symbolinaan.
- Tulevaisuudessa: huoltoalue jaettavissa huoltohenkilöille omana näkymänä.

### Pätkäjako kartalla

- Jokainen pätkä omalla värillä kartalla — kokonaiskuva silmäiltävissä yhdellä vilkaisulla.
- Pätkän status luettavissa kartalta suoraan (väri/visuaalinen) — ei tarvitse avata listaa.
- Pätkä klikattavissa kartalta → avautuu modaalina kartan päälle. Modaalissa: kuka tekee, mitä tehty, talkoolaisen merkinnät.
- Talkoolaisen merkinnät näkyvät järjestäjälle reaaliajassa: "ei tarvittu merkki X", "lisätty merkit → ja →". Myös nämä lisätyt merkit näkyvät kartalla.
- Uudelle talkoolaiselle: näytetään mitä pätkällä pitää tehdä + noutopiste + pudotuspiste.

### Näkymäfilosofia — ero nykytilaan

- **Järjestäjä ja talkoolainen ovat täysin erilliset näkymät ja flow.** Eri URL, eri autentikaatio, eri layout. Ei rooli-togglea. Järjestäjä ei näe talkoolaisen UI:ta lainkaan.
- Tilannekuva luetaan kartalta pätkien värien ja statusten kautta — ei numeromittareita.
- Reaaliaikainen sync: talkoolaisen muutokset näkyvät järjestäjälle kartalla heti.

### Vaiheistus (event lifecycle)

```
1. Suunnittelu    → GPX sisään, merkit kartalle, merkkikirjasto rakennetaan
2. Pätkäjako      → alueet jaetaan talkoolaisille värillisinä kaistoina kartalla
3. Tarkastus      → järjestäjä merkkaa kartan "merkatuksi"
                    → tarkastuskierros: sama talkoolainen-flow, tarkastaja = talkoolainen eri pätkällä
                    → merkitään tarkastetuksi pätkä kerrallaan
4. Purku          → uudet pätkät purkamista varten (eri jako kuin asettaminen)
```

---

## Talkoolaisen käyttäjätarinat

### Pätkän vastaanotto

- Kuuntelee tehtävänjakoa (WhatsApp / suullinen), ilmoittaa "otan tämän".
- Avaa pätkänäkymän linkistä → näkee tehtävälistan + varustelistan.
- Voi päivittää varustelistan ennen lähtöä: "otetaan 3 lisäkylttiä, 1 vasara, 5 rullaa nauhaa, 50 keppiä".

### Kenttätyö — navigointi ja kuittaus

- Näkee kartalla missä eka merkki on — navigoi sinne.
- Klikkaa merkkiä → näkee järjestäjän ohjeet jos merkille on kirjoitettu.
- "Seuraava merkki" -toiminto: hyppy ilman drive modea.
- **Bulk-kuittaus:** voi merkitä monta merkkiä tehdyksi kerralla — ei halua olla koko ajan puhelimella, tietää mitä piti tehdä.
- Voi kliksutella listasta kaikki tässä alueen merkit tehdyiksi.
- Jos GPS päällä: merkki asettuu siihen missä seisoo, sijainti säädettävissä jälkikäteen.

### Muutokset kentällä

- **Merkin siirto:** paikka oli parempi toisaalla — siirtää kartalla tai GPS-paikalla.
- **Merkin poisto:** ei tarvittu — merkitään "ei tarpeen" + syy.
- **Uusi merkki:** tässä olisi hyvä olla merkki jota ei ollut suunnitelmassa.
- **Kommentti/huomio (yleinen systeemi):** kuka tahansa voi lisätä kommentin mihin tahansa karttakohteeseen (merkki, pätkä, vapaa piste). Kommentilla voi olla ikoni (valinnaisesti). Nimi valinnainen mutta suositeltava. Geneerinen — ei erillisiä kenttiä eri tilanteille. "Puu kaatuu tänne", "blokattiin polku", "hyvä parkkipaikka tässä" — kaikki samaan systeemiin.
- **Este/blokki:** toteutetaan kommentti+ikoni-yhdistelmänä, ei erillinen merkki. Karttamerkki-järjestelmä suunnitellaan erikseen.

### Pätkän päättäminen

- Merkkaa pätkä tehdyksi + mahdolliset kommentit.
- **Pätkän muokkaus kentällä:** nappi "muokkaa pätkän pituutta" — talkoolainen voi siirtää päätepistettä kartalla, myös pidemmälle kuin järjestäjä alun perin asetti. Järjestäjä voi yliajaa jälkikäteen. Käyttää samoja yleiskäyttöisiä komponentteja kuin järjestäjän pätkämuokkaus.
- "Käyn purkamassa tämän alueen" — impromptu-jako, avoin kysymys toteutuksesta.

### Tarkastusvaihe (talkoolainen tarkastajana)

- Sama flow kuin asettamisessa — eri pätkä, tarkastus-rooli.
- Merkitsee että on tarkastanut pätkän.
- Voi lisätä kylttejä, merkitä huomioita yksittäisille merkeille.

### Purku

- Ottaa merkin pois maastosta → merkitsee otetuksi yhdellä klikillä.
- Näkymä näyttää laskurin: "tällä pätkällä 30 merkkiä, otettu 12".
- Merkkaa pätkä puretuksi kun valmis.
- **Materiaalit:** "täällä oli 10 keppiä jotka otin mukaan" — helppo kirjata paljonko materiaalia otettu mukaan.
- **Kasa:** merkitsee kasapaikan kartalle (kepit/nastat/nauhat). Toinen talkoolainen tai järjestäjä merkitsee "keräsin kasan pois".

### Tietoturva ja URL-jako

- Kaikki talkoolaisten URL:t ovat **hash-pohjaisia** — ei arvattavissa, ei sekvenssimäisiä.
- Jako: WhatsApp-viesti tai QR-koodi (esim. tulostettu tai näytöllä järjestäjän laitteessa).
- Talkoolaiset toimivat yhteisymmärryksessä keskenään — voivat koordinoida ilman järjestäjää.
- **Järjestäjä voi yliajaa kaiken** — pätkärajat, statusit, kommentit, assignoinnit.

---

## Avoimet (selvitetään ennen toteutusta)

1. **Ikonilähde**: Lucide — selvitetty (T9 ✓)
2. **Auth-flow**: hash-URL talkoolaiselle (V27 ✓), invite-flow järjestäjälle (T36 ✓)
3. **GPX-päivitys**: mitä tapahtuu olemassa oleville merkeille kun GPX korvataan? (T34, auki)
4. **Impromptu-pätkäjako:** "käyn purkamassa tämän alueen" — miten talkoolainen ottaa alueen ilman järjestäjää? Hash-URL generointi talkoolaiselle itse?
5. **Kasa-kuittaus:** kuka voi merkata kasan otetuksi — vain assignattu, vai kaikki autentikoidut?
6. **Kommentti-systeemi:** yleiskäyttöinen (merkki + pätkä + vapaa piste), ikoni valinnaisesti, nimi valinnaisesti. Suunnitellaan ennen toteutusta — vaikuttaa tietomalliin laajasti.
7. **Karttamerkki-järjestelmä (POI/este/kasa):** custom karttamerkkien tyypit ja tietomalli suunnittelematta. Eri asia kuin reittimerkki (SignMarker).
