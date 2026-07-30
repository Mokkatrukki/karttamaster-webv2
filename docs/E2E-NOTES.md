# E2E-testien juurisyy-muistiinpanot

Tarkoitus: säästää Playwright-flakyn uudelleentutkinta. Siirretty auto-memorystä repoon 2026-07-21.

## Suite-tila (2026-07-30)
**178 passed, 0 failed** (T400–T404 + T405–T408 yhdistetty). Edellinen: 172 passed 2026-07-29 (B167).

## Opetus: kun E2E "flakaa", tutki TÄMÄ järjestys ENNEN kuin syytät headlessiä

Aiempi oletus "headless-chromium ei rekisteröi synteettisiä hiiritapahtumia" oli **pääosin VÄÄRÄ**.
`page.click('#map', {position})`, `page.mouse.dblclick`, `page.mouse.down/move/up` TOIMIVAT
tässä setupissa. Todelliset juurisyyt olivat muualla:

1. **auth-screen-reauth kaappaa klikit** — kirjoitus (POST/DELETE) osuu e2e-backendiin ilman
   sessiota → 401 → outbox-reauth avaa `#auth-screen.open` joka kaappaa myöhemmät klikit.
   Fix: `mockSegmentWrites()` / kirjoitusmockit (`e2e/helpers/auth.ts`).
2. **Tyhjä seed-tila** — kirjasto/merkit seedaa TYHJÄNÄ backendistä (T195/V125) → rivejä ei renderöi
   → napit (esim. `.sign-lib-dots-btn`) ei koskaan ilmesty. Fix: `mockTemplates()` / `mockMarkers()` ennen goto.
3. **Väärä klikkikohde** — raaka `page.mouse.click(nurkka)` osuu kontrolliin/paneeliin, ei Leaflet-
   map-clickiin. Fix: `page.click('#map', {position})` tyhjään kohtaan (VÄLTÄ zoom-kontrolli oikea
   ylänurkka, T191).

4. **Kartan mittakaava ei ole vakio** (T324/T325, 2026-07-25) — `src/logic/route-defs.ts` kasvoi
   2→6 reittiin (T285) → `fitBounds` kattaa isomman alueen → **alkuzoom romahti 13.4:ään**.
   Seuraukset joita testit eivät kestäneet: 500×300 m alue renderöityi 12×8 px:iin (center-drag-
   handle peitti sen → dblclick ei tavoittanut polygonia), `flyTo` kesti ~4 s eikä 2.5 s,
   status-panel sai 6 riviä kahden sijaan. Sääntö: **älä koodaa kartan mittakaavaa äläkä
   rivimäärää testiin** — `setView(center, zoom)` ennen geometria-mittauksia, `waitForFunction`
   animaation loppuun (ei `waitForTimeout`), rivimäärä `ROUTE_DEFS.length`:stä. Tyhjä klikkikohta
   etsitään `elementFromPoint`illa (`area-interaction.spec.ts` `clickEmptyMapSpot`), ei arvata —
   status-panel kasvoi ja söi entisen kiinteän pisteen.
5. **Tuotemuutos siirtää testin ENNAKKOEHTOA — se ei ole flaky** (T325, 2026-07-25). Kaksi tapausta:
   T296/V208 navigoi kylmän talkoo-loginin `/patkat`-hubiin ∴ `#auth-screen` ei ole enää DOMissa
   (odota `waitForURL('**/patkat')`); T298/V209/B113 avaa luodun pätkän details-modaalin
   automaattisesti ∴ rivin `···`-nappi on backdropin takana (älä klikkaa sitä, modaali on auki).
6. **Vihreä testi voi olla kilpajuoksu** (B130/T332, 2026-07-25). `t321-audit-log` meni läpi yksin
   mutta failasi koko suitessa: `/loki`-undo asetti vahvistuksen DOM-solmuun jonka sen oma
   uudelleenlataus pyyhki. Yksikkötesti oli vihreä koska `onReload` oli `vi.fn()` joka ei
   renderöi. Ordering-riippuvainen punainen ⇒ etsi kilpajuoksu, älä lisää odotusta.

7. **Fixturen koordinaatti ⊥ saa olla keksitty** (B167, 2026-07-29). Kuusi testiä muuttui punaiseksi
   ilman että niiden koodiin koskettiin: T391/V283 toi pätkäjäsenyyteen 200 m kynnyksen
   (`MEMBERSHIP_THRESHOLD_M`), & fixtureiden ruudukko (`lat: 65.6 + i * 0.001`) on **1191 m**
   smtb-30:n jäljestä. Kynnyksetön vanha sääntö hyväksyi sen, uusi ⊥. Oireet eivät näytä
   jäsenyydeltä: lista 30 → 6 riviä, hero ⊥ renderöi ◀▶, merkki sai `marker-dimmed--locked`
   & lakkasi olemasta raahattava. Sääntö: pätkämerkin lat/lon ! tulla siitä GPX:stä jonka appi
   lataa — `e2e/helpers/route-points.ts` (`pointAtDistance`, `pointsAlongRoute`) lukee tiedoston
   ajossa ∴ reittipäivitys siirtää fixturet mukanaan. Sama opetus kuin §4, eri akseli.

8. **Sviitin NELJÄ ENSIMMÄISTÄ testiä maksavat viten kylmäkäynnistyksen** (2026-07-30, T404-merge).
   `area-interaction.spec.ts` on aakkosissa ensimmäinen ∴ sen testit ovat `[1/178]`–`[4/178]` &
   ne odottavat kiinteillä rajoilla (`waitForTimeout(2000)` + `waitForFunction(…, 8000)`).
   Kun koneella pyöri samaan aikaan muuta (vitest-ajo, `bun run build`, juuri tapetun ajon
   orpo vite sammumassa), vite kääntää 700+ moduulia hitaammin & nämä neljä kaatuivat —
   **yksinään 4/4 vihreä 17 s:ssa, puhtaassa täydessä ajossa vihreä.** ⊥ tuotebugi & ⊥ syy
   löysentää odotusta: raja on jo 8 s. Sääntö: **aja E2E yksin.** Jos juuri tapoit ajon,
   varmista portit vapaiksi (`ss -ltn | grep -E ':5180|:3099'`) ENNEN uutta — orpo vite
   pitää porttia & `reuseExistingServer:false` kaataa koko ajon heti
   (`Error: http://localhost:5180 is already used`).
   Diagnoosivinkki: `--reporter=line` käyttää `\r`-ylikirjoitusta ∴ lokista puuttuvat rivit
   eivät ole ajamattomia testejä — lue `tr '\r' '\n' < loki`.

## Talkoolainen-E2E-sudenkuoppa (V27)
Talkoolaisen koodi tulee **URL-polusta `/s/<koodi>`**, EI `/api/auth/me`-mockista.
Talkoolaisen pätkänäkymä-testit tarvitsevat `mockTalkoolainenSegment` (`e2e/helpers/auth.ts`)
+ `goto('/s/TEST01')`. Vanhat testit `mockAuthAsTalkoolainen` + `goto('/')` → pätkä ei lataudu
→ hero/picker ei renderöi.

## Aidon regression erottaminen
Jos testijoukko muuttuu (uusi fail joka EI ole mainilla) → tutki.
Metodi: `git worktree add` mainiin + aja sama joukko → jos failaa siellä = pre-existing.
Esim. "Drive mode" -testi failasi branchilla mutta passasi mainilla → ei flaky vaan orpo testi
(T224/V148 piilotti `#route-barin`) → poistettu (B102).

Todellinen drive-/marker-/segment-logiikka katetaan Vitest-jsdomilla (vihreitä).
