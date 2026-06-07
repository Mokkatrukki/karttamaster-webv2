---
name: karttamaster-rakentaja
description: >
  Karttamaster-projektin build-wrapper. Ajaa /ck:build ja kutsuu automaattisesti
  /karttamaster-testaaja jokaisen valmistuneen taskin jälkeen. Käytä tätä /ck:buildin
  sijaan karttamaster-projektissa — se sulkee loopin automaattisesti ilman erillistä
  testaaja-kutsua. Triggeröi kun: "rakenna T29", "tee T8", "buildaa seuraava task",
  "rakentaja T-id", "karttamaster-rakentaja".
---

# karttamaster-rakentaja — Karttamaster build-wrapper

Tämä skill on ohut wrapper `/ck:build`:n ympärillä. Lisää automaattisen
`/karttamaster-testaaja`-kutsun jokaisen valmistuneen §T-taskin jälkeen.

## Flow

```
1. Kutsu /ck:build §T<n>  (tai --next tai --all)
2. ck:build toteuttaa + ajaa testit + commitoi
3. KUN ck:build merkitsee taskin ✓:
   → Kutsu /karttamaster-testaaja T<n>
4. karttamaster-testaaja tarkistaa kattavuuden + käyttäjäperspektiivin
5. Jos testaaja löytää bugin → se kutsuu /ck:spec bug: automaattisesti
6. Jos testaaja löytää arkkitehtuuririkkomuksen → se kutsuu /karttamaster-arkkitehtuuri
7. Jos task koskee src/ui/ tai index.html (CSS/ulkoasu):
   → Kutsu /karttamaster-ux komponentti <nimi>
```

## Käyttö

```
/karttamaster-rakentaja T29          → build T29, sitten testaaja T29
/rakennus --next       → build seuraava auki-task, sitten testaaja
/rakennus --all        → build kaikki auki-taskit järjestyksessä, testaaja per task
```

## Ei tee

- Ei muuta SPEC.md:tä (ck:spec tekee sen)
- Ei pilko moduuleja (karttamaster-arkkitehtuuri tekee sen)
- Ei muuta testejä ennen buildia (testit kirjoitetaan osana buildia)
