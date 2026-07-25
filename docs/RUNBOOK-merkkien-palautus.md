# Runbook — merkkisiirtojen palautus tuotannossa

Kun merkkejä on siirretty vahingossa tai väärin, `marker_audit`-taulu (T226/V152) sisältää
jokaisen `move`-rivin ENNEN-tilan. Tällä ohjeella palautus tehdään koneellisesti, ei käsin
raahaamalla — audit-koordinaatti on eksakti, käsinraahaus ±metrejä sinne päin.

Työkalu: `scripts/restore-marker-moves.ts`.

> Ensimmäinen oikea ajo: 2026-07-25, 14 merkkiä (talkoo-sessio hyppäytti 1–7 km sivuun).

---

## 0. Edellytykset

- `flyctl` asennettu ja kirjautunut (`fly auth login`)
- Sovellus: `karttamaster-web`, DB `/data/karttamaster.db` (volume `karttamaster_data`)
- Tuotantokoneella on `bun` polussa `/usr/local/bin/bun`

---

## 1. Selvitä mitä tapahtui (read-only)

Vedä tuotanto-DB paikalliselle koneelle. **WAL-tiedosto on pakko ottaa mukaan** — muuten
viimeisimmät kirjoitukset puuttuvat.

```bash
cd /tmp   # tai muu työhakemisto
fly ssh sftp get /data/karttamaster.db      ./prod.db      -a karttamaster-web
fly ssh sftp get /data/karttamaster.db-wal  ./prod.db-wal  -a karttamaster-web
fly ssh sftp get /data/karttamaster.db-shm  ./prod.db-shm  -a karttamaster-web
```

Katso kuka teki mitä:

```bash
bun -e "
const {Database} = require('bun:sqlite')
const db = new Database('./prod.db')
for (const r of db.query(\"SELECT actor, actor_role, action, COUNT(*) n, MIN(created_at) alku, MAX(created_at) loppu FROM marker_audit GROUP BY actor, actor_role, action ORDER BY loppu DESC\").all()) console.log(r)
"
```

Aikajana yhdelle roolille:

```bash
bun -e "
const {Database} = require('bun:sqlite')
const db = new Database('./prod.db')
for (const r of db.query(\"SELECT created_at, actor, action, marker_id, payload_json FROM marker_audit WHERE actor_role='talkoolainen' ORDER BY created_at\").all()) console.log(r.created_at, r.action, r.marker_id.slice(0,8), r.payload_json)
"
```

Merkkejä siirtoketjuineen näkee myös `scripts/restore-marker-moves.ts`:n dry-runilla (kohta 3) —
se listaa poikkeaman metreinä suurin ensin.

---

## 2. Ota varmuuskopio (PAKOLLINEN ennen kirjoitusta)

`VACUUM INTO` tekee konsistentin kopion myös WALin kanssa, ilman että palvelinta pysäytetään:

```bash
fly ssh console -a karttamaster-web -C "/usr/local/bin/bun -e \"const{Database}=require('bun:sqlite');const db=new Database('/data/karttamaster.db');db.run(\\\"VACUUM INTO '/data/karttamaster.db.bak-YYYYMMDD-kuvaus'\\\");console.log('backup ok')\""
```

Tarkista että tiedosto syntyi:

```bash
fly ssh console -a karttamaster-web -C "ls -la /data/"
```

Ota uusi backup jokaista erillistä palautusajoa kohden (`-undo`, `-undo2`, …).

---

## 3. Harjoittele paikallisella kopiolla

Aja aina ensin kohdan 1 kopiota vasten — sama komento, `--db` osoittaa paikalliseen tiedostoon.
`--apply` vasta kun dry-run näyttää oikealta.

```bash
# dry-run: mitä palautettaisiin
bun scripts/restore-marker-moves.ts --db ./prod.db --role talkoolainen --since 2026-07-25

# testiajo kertakäyttökopiolla
cp prod.db test.db && cp prod.db-wal test.db-wal
bun scripts/restore-marker-moves.ts --db ./test.db --role talkoolainen --since 2026-07-25 --apply

# idempotenssi: toisen ajon pitää näyttää "PALAUTETTAVAT: 0"
bun scripts/restore-marker-moves.ts --db ./test.db --role talkoolainen --since 2026-07-25
```

Rajaustapoja:

| Tilanne | Valitsimet |
|---|---|
| Yhden roolin sotku tiettynä päivänä | `--role talkoolainen --since 2026-07-25` |
| Yhden tekijän muutokset | `--actor "Matti"` |
| Aikaikkuna | `--since 2026-07-25T07:00:00Z --until 2026-07-25T08:00:00Z` |
| Yksittäiset merkit | `--marker <uuid> --marker <uuid>` |
| Vain isot hypyt, jätä hienosäätö rauhaan | `--threshold 50` |
| Älä ylikirjoita ihmisen käsinkorjauksia | `--keep-manual` |

Oletuskynnys on 1 m: myös käsin takaisin raahatut merkit siirretään eksaktiin
audit-koordinaattiin. `--keep-manual` kääntää tämän: jos joku muu rooli on siirtänyt merkkiä
suodatusjoukon jälkeen, merkki jätetään rauhaan.

---

## 4. Aja tuotannossa

Skripti kopioidaan koneelle base64:nä (ei riippuvuuksia `src/`:ään):

```bash
B64=$(base64 -w0 scripts/restore-marker-moves.ts)
fly ssh console -a karttamaster-web -C "/bin/sh -c \"echo $B64 | base64 -d > /tmp/restore.ts\""

# dry-run tuotantodatalla — HUOM: tila voi olla eri kuin kohdan 1 kopiossa
fly ssh console -a karttamaster-web -C "/usr/local/bin/bun /tmp/restore.ts --role talkoolainen --since 2026-07-25"

# oikea ajo
fly ssh console -a karttamaster-web -C "/usr/local/bin/bun /tmp/restore.ts --role talkoolainen --since 2026-07-25 --apply"
```

Skripti lukee DB:n oletuksena polusta `/data/karttamaster.db` (`DB_PATH`-ympäristömuuttuja
ohittaa). Palvelinta ei tarvitse pysäyttää — SQLite WAL sallii rinnakkaisen kirjoittajan.

---

## 5. Verifioi ja siivoa

```bash
# uudelleenajo: pitää näyttää "PALAUTETTAVAT: 0" ja kaikki "jo paikallaan (0 m)"
fly ssh console -a karttamaster-web -C "/usr/local/bin/bun /tmp/restore.ts --role talkoolainen --since 2026-07-25"

# poista väliaikaistiedosto
fly ssh console -a karttamaster-web -C "rm -f /tmp/restore.ts"
```

**Kerro käyttäjille että selain pitää päivittää (F5).** Skripti kirjoittaa DB:hen suoraan,
joten auki olevat clientit näyttävät vanhoja sijainteja kunnes hakevat merkit uudelleen.

---

## 6. Jos meni pieleen — palauta backupista

```bash
fly ssh console -a karttamaster-web -C "/bin/sh -c \"cp /data/karttamaster.db.bak-YYYYMMDD-kuvaus /data/karttamaster.db && rm -f /data/karttamaster.db-wal /data/karttamaster.db-shm\""
fly machine restart <machine-id> -a karttamaster-web
```

WAL ja SHM **on** poistettava — muuten SQLite yrittää soveltaa vanhaa WALia uuteen
tiedostoon. Palvelin on syytä käynnistää uudelleen jotta se avaa tiedoston puhtaalta pöydältä.

---

## Mitä skripti tekee ja mitä ei

**Muuttaa:** `markers`-taulun `lat`, `lon`, `distance_from_start`, `route_ids`,
`distance_by_route` (→ NULL, legacy-fallback V213), `updated_at`, `updated_by`.

**Ei koske:** pätkiin, inventaarioon, alueisiin, käyttäjiin, kuviin, kommentteihin, eikä
merkkien tyyppiin, kuvaukseen tai statukseen.

**Jälki:** jokainen palautus kirjataan `marker_audit`iin (`actor='admin (undo-palautus)'`,
`actor_role='admin'`) ennen-tilana nykyinen väärä sijainti → palautuskin on peruttavissa
samalla työkalulla. Koko ajo on yhdessä `db.transaction()`issa (kaikki tai ei mitään).

**Ennen-tilan valinta:** kullekin merkille otetaan suodattimeen osuvista siirroista
**ensimmäisen** ennen-tila → koko sotkuketju peruuntuu kerralla. Suodattimen rajaaminen on
siis tärkeää: liian löysä `--since` peruisi myös vanhoja laillisia siirtoja.

---

## Tunnetut rajoitteet

- **`marker_audit.segment_code` on NULL kaikilla riveillä** (myös talkoolaisen, vastoin T226:ta)
  → pätkäkohtainen suodatus ei toimi, eikä sovelluksen oma `POST /api/audit/undo` löydä
  mitään. Siksi palautus tehdään tällä skriptillä eikä UI:sta. Korjaus kuuluu
  admin-lokinäkymän yhteyteen.
- **`action='remove'` ei ole peruttavissa** — DELETE ei tallenna merkin koko riviä, vain
  audit-merkinnän. Poistettu merkki pitää luoda uudelleen käsin.
- **`distance_by_route` ei ole audit-payloadissa** → palautus nollaa sen. Merkin km-lukema
  lasketaan tällöin `distance_from_start`ista (V213-fallback), joka palautuu oikein.
- **Rinnakkainen muokkaus:** jos joku siirtää merkkejä samaan aikaan kun skripti ajetaan,
  hänen muutoksensa menevät päällekkäin. Aja mieluiten kun kenttätyö ei ole käynnissä.
