# E2E-testien juurisyy-muistiinpanot

Tarkoitus: säästää Playwright-flakyn uudelleentutkinta. Siirretty auto-memorystä repoon 2026-07-21.

## Suite-tila (2026-07-10)
**93 passed, 0 skipped, 0 failed.** Karanteeni purettu (4/4 de-quarantined).

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
