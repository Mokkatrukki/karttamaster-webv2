# Karttamaster — SyöteMTB 2026 visio

## Mikä tämä on

Työkalu SyöteMTB 2026 -tapahtuman reittimerkintöjen suunnitteluun, toteutukseen ja purkuun. Korvaa paperisen kartan + metsässä otetut kuvat. Kaveriporukka tekee talkootyönä — fiilis on luottavainen ja rento, ei firmafiilistä.

## Käyttäjät

### Tapahtumajärjestäjä

**Persoona:** Kokeneempi tyyppi joka tuntee reitin. Tietää jo ennen kuin avaa sovelluksen suunnilleen minne merkit tulee — sovellus on paikka tehdä se näkyväksi ja jakaa muille. Tekee työtä omassa tahdissaan, useassa sessiossa, kotona tai toimistolla. Ei stressiä, mutta haluaa että asiat pysyvät järjestyksessä ja kaikki tietävät missä mennään.

**Konteksti:** toimisto tai koti, iso näyttö (laptop/desktop), hiiri, hyvä nettiyhteys, rauhallinen tilanne. Ei kiirettä mutta paljon yksityiskohtia hallittavana.

**Mobiili (välttävä toiminta pakollinen):** Ensisijainen näkymä on desktop, mutta järjestäjän pitää pystyä *välttävään* toimintaan myös puhelimella: kartan katselu ja selailu, yksittäisen merkin lisäys/siirto, merkin tai pätkän tilanteen tarkistus, kokonaistilanteen silmäily. Tyypilliset tilanteet: jakaa testilinkkejä kaverille joka avaa mobiilissa, tai on itse kentällä ilman läppäriä. Ei täys-optimoitua mobiili-UI:ta (raskas suunnittelutyö jää desktopille), mutta core-toiminnot eivät saa olla rikki tai saavuttamattomissa mobiililla — kartan pitää latautua kokonaan, napit pitää osua, moodia ei saa vaihtaa vahingossa.

**Mitä järjestäjä tekee:**
- Lataa GPX-reitit (gravel + MTB, osin päällekkäiset). GPX voi päivittyä — merkit säilyvät, koska ne eivät ole sidottuja GPX-pisteisiin vaan kartalla itsenäisesti.
- Rakentaa merkkikirjaston: "Huoltopiste 25km", "Alueella pyöräkilpailu", nuolet jne.
- Käy reittiä osissa läpi ja merkkaa kylttejä — sessioiden välinen työ säilyy.
- Luo erikoismerkkejä: huoltoalueet (nimi + kuvaus/kuva/aukioloaika), noutopisteet, pudotuspisteet.
- Jakaa reitin pätkiin talkoolaisille — näkyy kartalla värillisinä kaistoina.
- Seuraa edistymistä kartalta: pätkien värit/statusit kertovat tilanteen ilman mittareita.
- Voi itse merkata yksittäisen merkin laitetuksi.

**Mitä järjestäjä tarvitsee:** selkeys ja hallinta. Kaikki reitit näkyvissä yhtä aikaa. Muutokset nopeasti. Delegointi selkeästi. Tilannekuva ilman numeropaneeleja — kartalta näkee.

**Näkymä:** Oma näkymä ja flow — eri layout, eri autentikaatio. Järjestäjä ei näe talkoolaisen työkaluja talkoo-layoutissa eikä toisinpäin. **Poikkeus (T274, 2026-07-22):** järjestäjä (täydet oikeudet) VOI vaihtaa valikosta talkoo-layoutiin ja takaisin tehdäkseen itse pätkiään — sama sessio, ei uutta kirjautumista (SPEC §V13-amend). Talkoolaiselle ei ole tätä togglea.

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

**Näkymä:** Täysin oma näkymä ja flow. Avautuu suoraan omaan pätkään hash-URL:sta. Ei järjestäjän UI:ta näkyvissä. Oma pätkä/tehtävä näkyy kirkkaana ja klikattavana; muut pätkät näkyvät himmeinä ja read-onlyna taustalla — konteksti näkyy, mutta interaktio vain omaan (päätös 2026-07-08, amendaa V33).

**UX-testi talkoolaiselle:** "Saako oman pätkän tilanteen raportoitua nopeasti ja tarkasti? Toimiiko metsässä puhelimella huonolla netillä?"

### Koordinaattori / tarkastaja

Sama flow kuin talkoolaisella — eri pätkä, tarkastusvaihe. Ajaa autolla tai pyöräilee, merkitsee että on tarkastanut, voi lisätä huomioita tai kylttejä. Ei erillinen rooli tai tunnus — talkoolainen eri tehtävässä.

Sama henkilö voi tehdä useita pätkiä eri vaiheissa. Kaikki näkevät kaikkien statuksen — avoimuus on tarkoituksellista.

### Admin / Pääjärjestäjä

**Persoona:** Tapahtuman vetäjä joka vastaa siitä että oikeat ihmiset pääsevät sovellukseen sisään. Tietää ketkä osallistuvat — lisää uusia järjestäjiä etukäteen, poistaa pääsyn jos suunnitelmat muuttuvat. Ei välttämättä tee itse maastotöitä, mutta vastaa kokonaisuudesta.

**Konteksti:** toimisto tai koti, laptop, hyvä nettiyhteys. Ennen tapahtumaa: lisää järjestäjiä joukkoon. Tapahtumapäivänä: reagoi nopeasti jos joku ei pääse sisään tai salasana on hukassa. Yksi tai kaksi adminia koko tapahtumassa.

**Mitä admin tekee:**
- Lisää järjestäjän: luo invite-linkin, lähettää WhatsAppilla tai sähköpostilla. Käyttäjä rekisteröi itse omat tunnukset.
- Deaktivoi järjestäjän joka ei tulekaan paikalle — deaktivoitu henkilö ei pääse enää sisään.
- Resetoi salasanan: luo uuden invite-linkin, lähettää henkilölle — sama mekanismi kuin uusi käyttäjä.
- Näkee kaikki käyttäjät: nimi, rooli, luontiaika, onko aktiivinen.
- Tulevaisuudessa: näkee kuka on muokannut mitäkin (audit trail).

**Mitä admin tarvitsee:** yksinkertainen käyttäjälista, yksi nappi kutsulinkin luontiin, yksi nappi deaktivointiin. Max 3 klikkausta mihinkään toimintoon. Toimii myös puhelimella jos tarve.

**Mitä admin EI tarvitse:** monimutkaista roolienhallintaa, erillisiä oikeustasoja järjestäjien välillä, käyttäjien muokkausta mid-session. Yksinkertaisuus ennen kattavuutta.

**Näkymä:** `/admin`-URL — erillinen sivu karttanäkymästä. Admin kirjautuu samalla lomakkeella kuin järjestäjä (username+password). Admin pääsee myös karttanäkymään — admin-rooli sisältää kaikki järjestäjän oikeudet.

**UX-testi adminille:** "Voinko lisätä uuden järjestäjän alle minuutissa? Voinko deaktivoida henkilön kolmella klikkauksella?"

**Roolihierarkia:**
```
admin      → käyttäjähallinta + kaikki järjestäjän oikeudet + audit-lokit
järjestäjä → merkit, pätkät, alueet, snapshots, talkoolaisen URL:t
talkoolainen → vain oma pätkä, kuittaukset
```

Admin on järjestäjistä se jolle annetaan ylimääräinen vastuu — ei erillinen henkilötyyppi. Käytännössä yksi henkilö koko tapahtumassa.

## Reitit

4 GPX-reittiä, osin päällekkäisiä (35km + 60km jakavat pitkän yhteisen osuuden). Lähtö ja maali samat kaikille. Fyysinen merkki voi palvella useampaa reittiä samanaikaisesti — se on yksi esine, ei monta.

## Merkkijärjestelmä

**Merkkikirjasto** (järjestäjä rakentaa): ikoni + teksti + kuvaus. Esimerkkejä: nuoli oikealle, nuoli vasemmalle, "Varo hyppy", "Muurahaispesä", "Huolto 25km", "->". Ikonilähde selvitetään tutkimusvaiheessa.

**Kartalla oleva merkki** = kirjaston instanssi + sijainti + paikkaohjeet.

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

### Järjestäjä tekee pätkiä itselleen (talkoolais-crossover)

- **Järjestäjä on usein itse reitintekijä.** Hän tekee pätkät ja tarvitsee mennä itse tekemään ne — asettaa merkit maastossa niinkuin talkoolainen. Sama henkilö suunnittelee JA toteuttaa, ei vain "delegoi kaikki muille".
- Siksi järjestäjä pääsee valikosta vaihtamaan **talkoo-layoutiin** (tehdäkseen pätkän merkit) ja takaisin **järjestäjä-näkymään**. Sama tili, sama sessio — ei uutta kirjautumista (client-view-flip, ks. SPEC §V13/V189, T274).
- Talkoolaisen oma flow pysyy silti kapeana: talkoolainen ei näe järjestäjä-työkaluja.

### Talkoolais-hub — /patkat

- Yksi admin-asettama **yleissalasana** on portti (SPEC §V188, Model B). Talkoolainen kirjautuu → `/patkat`-sivu.
- Hub: "Tervetuloa talkoilemaan" + FAQ (aikataulut/ruokailut/sijainnit, admin muokkaa) + lista kaikista pätkistä (nimi + kuka tekee + status + linkki) + "Kartalle →".
- Deep-link `/s/<slug>` (ihmisluettava, reitin nimi) vie suoraan pätkälle, mutta vaatii yleissalasana-session ensin. Turva tulee salasanasta, ei URL:n arvaamattomuudesta (SPEC §V42-amend).

### Pätkäjako kartalla

- Jokainen pätkä omalla värillä kartalla — kokonaiskuva silmäiltävissä yhdellä vilkaisulla.
- Pätkän status luettavissa kartalta suoraan (väri/visuaalinen) — ei tarvitse avata listaa.
- Pätkä klikattavissa kartalta → avautuu modaalina kartan päälle. Modaalissa: kuka tekee, mitä tehty, talkoolaisen merkinnät.
- Talkoolaisen merkinnät näkyvät järjestäjälle reaaliajassa: "ei tarvittu merkki X", "lisätty merkit → ja →". Myös nämä lisätyt merkit näkyvät kartalla.
- Uudelle talkoolaiselle: näytetään mitä pätkällä pitää tehdä + noutopiste + pudotuspiste.

### Näkymäfilosofia — ero nykytilaan

- **Järjestäjä ja talkoolainen ovat erilliset näkymät ja flow.** Eri layout, eri autentikaatio. Talkoolaisella ei ole rooli-togglea. **Poikkeus (T274):** järjestäjä voi vaihtaa talkoo-layoutiin ja takaisin valikosta (tekee usein itse pätkänsä) — sama sessio, client-view-flip. Talkoolainen ei näe järjestäjä-työkaluja.
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

## Tehtävämalli — reittipätkä + aluetehtävä (grill 2026-07-08)

Talkoolaisen työ jaetaan **tehtävinä**. Tehtävä on yleistetty `Segment`: **reitti on valinnainen.**

- **Reitillinen tehtävä** = perinteinen pätkä (`routeIds` + `startDist`/`endDist`): väli reitillä. "Merkkaa km 12–18."
- **Reititön tehtävä** = alue-/tehtäväpätkä ilman reittisidosta. "Rakenna maalialue", "keräysalue".

Jokaisella tehtävällä (reitillisellä tai reitittömällä) on **merkkijoukko**, kaksi tapaa populoida sama joukko:

- **Eksplisiittinen linkki** (staattinen): järjestäjä valitsee kartalta tietyt merkit tehtävään. "Aidat löytyvät täältä →", "sijoita nämä merkit matkalla".
- **Tyyppisuodatin** (dynaaminen): tehtävä seuraa merkkikirjaston tyyppiä. Kuka tahansa lisää sitä tyyppiä olevan merkin → ilmestyy tehtävän listalle heti. "Autoporukka näkee kaikki keräyskasa-merkit."

**Avainperiaate:** merkkikirjaston tyyppi (SignTemplate) on jo "tagi" — ei erillistä tagi-systeemiä. "Hae aidat" = suodata merkit tyypillä aita.

**Kolme käyttötapausta jotka tämä kattaa:**
1. **Maalialue + aidat:** reititön tehtävä (`AreaMarker`-geometria: laatikot + ohje) + eksplisiittinen linkki aita-merkkeihin.
2. **Keräys/autoporukka:** talkoolainen droppaa keräyskasa-merkkejä maastoon → autoporukan reititön tehtävä = tyyppisuodatin niihin, kuittaa "haettu".
3. **Reittipätkä + matkan merkit:** reitillinen tehtävä + eksplisiittinen linkki "sijoita nämä matkalla".

**Toteutussuunta (speksataan erikseen, EI vielä rakennettu):** yleistä olemassa oleva `Segment` (reitti valinnaiseksi) + jaettu `resolveTaskMarkers`-logiikka. Uusiokäyttää navigointi (T16/T31), hash-jako (V42), kuittaus, phase. Ei uutta oliota, ei tagi-systeemiä. Refaktorin blast-radius arvioidaan arkkitehtuuri-passissa.

**Auki spec-vaiheeseen:** näkyykö reititön tehtävä kartalla pelkkänä nimenä+merkkijoukkona vai valinnaisena rajauslaatikkona (uusiokäytä AreaMarker-geometria).

## Avoimet (selvitetään ennen toteutusta)

1. **Ikonilähde**: Lucide — selvitetty (T9 ✓)
2. **Auth-flow**: hash-URL talkoolaiselle (V27 ✓), invite-flow järjestäjälle (T36 ✓). Admin UI käyttäjähallintaan: T121–T123.
3. **GPX-päivitys**: mitä tapahtuu olemassa oleville merkeille kun GPX korvataan? (T34, auki)
4. **Impromptu-pätkäjako:** ~~miten talkoolainen ottaa alueen ilman järjestäjää?~~ **RATKAISTU 2026-07-08: ei self-assignia.** Vain järjestäjä luo ja jakaa pätkät/tehtävät. Talkoolainen vastaanottaa, ei ota omia. **AMEND 2026-07-22 (T267–T276, Talkoolais-hub):** talkoolainen pääsee `/patkat`-hubiin yleissalasanalla ja voi AVATA minkä tahansa pätkän (nähdä + tehdä) — mutta self-select "ota tämä pätkä itselleni" (assign) on yhä PARKISSA, tehdään myöhemmin. Järjestäjä jakaa/nimeää pätkät kuten ennenkin. Deep-linkki muuttui hash→ihmisluettava slug (V42-amend), portti = yleissalasana (V188), ei enää per-pätkä-hash-credentiaali.
5. **Kasa-kuittaus:** ~~kuka voi merkata kasan otetuksi?~~ **RATKAISTU 2026-07-08:** kasa = talkoolaisen droppaama SignMarker (tyyppi esim. "keräyskasa"). Autoporukan tehtävä = dynaaminen tyyppisuodatin (kaikki keräyskasa-merkit, elävä lista). Kuka tahansa autentikoitu kuittaa "haettu". Osa tehtävämallia (ks. §Tehtävämalli).
6. **Kommentti-systeemi:** yleiskäyttöinen (merkki + pätkä + vapaa piste), ikoni valinnaisesti, nimi valinnaisesti. Suunnitellaan ennen toteutusta — vaikuttaa tietomalliin laajasti.
7. **Karttamerkki-järjestelmä (POI/este/kasa):** custom karttamerkkien tyypit ja tietomalli suunnittelematta. Eri asia kuin reittimerkki (SignMarker).
