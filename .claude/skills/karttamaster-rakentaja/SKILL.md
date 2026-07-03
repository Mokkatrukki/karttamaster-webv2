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
8. Jos task koskee src/map/ TAI §T-kuvauksessa lukee "Playwright":
   → Aja: bunx playwright test e2e/ --browser=chromium --reporter=line
   → Tarkista COMPONENTS.md E2E-sarake: onko muutetulla komponentilla testi?
   → Jos testi hajoaa: korjaa ennen ✓-merkintää
   → Jos E2E-sarake on "—" mutta src/map/-komponentti on kriittinen: lisää testi
9. AINA taskin jälkeen — COMPONENTS.md-synkronointi:
   → Tarkista: loiko ck:build uuden .ts-tiedoston src/:ssa tai server/:ssa?
   → Tarkista: muuttuiko olemassa olevan komponentin status (○ → ✓)?
   → Jos kyllä: kutsu /karttamaster-arkkitehtuuri sync-spec
   → COMPONENTS.md ei saa jäädä vanhentuneeksi — tämä on pakollinen askel ennen ✓
```

## Käyttö

```
/karttamaster-rakentaja T29          → build T29, sitten testaaja T29
/rakennus --next       → build seuraava auki-task, sitten testaaja
/rakennus --all        → build kaikki auki-taskit järjestyksessä, testaaja per task
```

## Haiku-subagentit (token-säästö)

Mekaaniset askeleet delegoidaan `Agent(model="haiku")`:

**1. grep-navigator — ennen koodimuutosta (askeleet ennen Editiä)**
```
Agent(model="haiku", prompt="""
Lue ensin COMPONENTS.md — löydä komponentin tiedostopolku.
Sitten grep näistä tiedostoista: [symbolit].
Raportoi: tiedosto + rivinumero per symboli. Ei muuta.
""")
```
COMPONENTS.md on index — Haiku lukee sen ensin, greppaa vain oikeat tiedostot.

**2. test-runner — testien ajo + raportti**
```
Agent(model="haiku", prompt="""
Aja: bun run test 2>&1 | tail -30
Raportoi: pass-count, fail-count, failing test names + virherivi.
Älä korjaa mitään.
""")
```

**3. git-committer — taskin lopussa**
```
Agent(model="haiku", prompt="""
Seuraa caveman-commit-säännöt (conventional commits, ≤50 chars subject).
git add [tiedostot]
git commit -m "[viesti jonka pääagentti on valmistellut]"
Raportoi onnistuiko.
""")
```
Pääagentti (Sonnet) päättää commit-viestin sisällön — Haiku vain ajaa komennot.

## Ei tee

- Ei muuta SPEC.md:tä (ck:spec tekee sen)
- Ei pilko moduuleja (karttamaster-arkkitehtuuri tekee sen)
- Ei muuta testejä ennen buildia (testit kirjoitetaan osana buildia)
