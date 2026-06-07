# Karttamaster — SyöteMTB 2026 visio

## Mikä tämä on

Työkalu SyöteMTB 2026 -tapahtuman reittimerkintöjen suunnitteluun, toteutukseen ja purkuun. Korvaa paperisen kartan + metsässä otetut kuvat. Kaveriporukka tekee talkootyönä — fiilis on luottavainen ja rento, ei firmafiilistä.

## Käyttäjät

### Tapahtumajärjestäjä
**Konteksti:** toimisto tai koti, iso näyttö, hiiri, hyvä nettiyhteys, rauhallinen tilanne.

- Lataa GPX-reitit, rakentaa merkkikirjaston
- Suunnittelee kaikki merkit kartalle, jakaa pätkät talkoolaisille
- Näkee kokonaistilannekuvan koko ajan
- Suunnittelunäkymässä enemmän työkaluja: merkkikirjasto, pätkäjako, tilannekuva

**Mitä järjestäjä tarvitsee:** tarkkuus ja hallinta. Haluaa nähdä kaikki reitit yhtä aikaa, tehdä muutoksia nopeasti, delegoida selkeästi.

**Suunnittelunäkymä on järjestäjälle** koska sen täytyy tarjota kaikki työkalut — talkoolainen ei tarvitse niitä kaikkia ja ne voisivat sekoittaa metsässä.

### Talkoolainen
**Konteksti:** metsässä tai autossa, Android-puhelin, hanskat kädessä mahdollisesti, huono tai ei ollenkaan nettiyhteys, kiireinen tilanne, akku hupenemassa.

- Saa oman pätkän + automaattisen varustelistan
- Navigoi GPS-avusteisesti pätkää pitkin
- Kuittaa merkit asetetuiksi yhdellä napilla
- Tekee huomioita, lisää merkkejä tarvittaessa
- Purkuvaiheessa kerää merkit samaa logiikkaa käyttäen

**Mitä talkoolainen tarvitsee:** yksinkertaisuus ja nopeus. Yksi iso nappi kuittaukseen. Ei turhia valikkoja. Toimii vaikka netti ei toimi. Virhetilanteessa ei hätäänny — voi aina jälkikäteen korjata.

**Talkoolaiselle kaikki kriittiset toiminnot** ovat max 2 napin päässä. Jos vaatii enemmän, se on arkkitehtuurivirhe.

### Koordinaattori / tarkastaja (rooli, ei erillinen käyttäjätunnus)
Sama kuin talkoolainen mutta ajaa autolla tai pyöräilee tehden tarkastuksen. Käyttää samoja työkaluja mutta eri tilassa. Voi muokata merkkejä metsässä.

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

## Avoimet (selvitetään ennen toteutusta)

1. **Ikonilähde**: mist�� merkkikirjaston ikonit — Lucide, Heroicons, oma SVG-lataus?
2. **Auth-flow**: kutsukoodi ��� oma tunnus tekninen toteutus, admin-generointi
3. **GPX-päivitys**: mitä tapahtuu olemassa oleville merkeille kun GPX korvataan?
