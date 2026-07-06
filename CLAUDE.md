# Karttamaster — Claude-ohjeet

## Projekti lyhyesti

SyöteMTB 2026 -merkintätyökalu. Vite + TypeScript + Leaflet + Bun. Ei frameworkia.
Stack: `src/logic/` (puhdas logiikka) → `src/map/` (Leaflet) → `src/ui/` (DOM) → `src/main.ts` (init).

## Tärkeimmät tiedostot

- `SPEC.md` — taskit (§T), invariantit (§V), bugit (§B). Ainoa totuus.
- `VISION.md` — product vision + käyttäjäroolit + arkkitehtuuriperiaatteet.
- `COMPONENTS.md` — komponentti-indeksi (lyhyt). Yksityiskohdat: `docs/components/`.
- `DESIGN.md` — design-sopimukset: värit, spacing, komponentit, CSS custom properties.

## Kehitysflow

**Normaali task:**
```
/karttamaster-rakentaja T<n>  →  (testaaja + ux automaattinen)
```

**Uusi feature (täydellinen flow):**
```
/karttamaster-pm tarkista <feature>   ← vision-yhtenäisyys
  → /karttamaster-spec <feature>      ← kerää arch+ux+test konteksti → /ck:spec
  → /karttamaster-rakentaja T<n>      ← build + testaaja + ux
```

**Ei ideoita mitä tehdä:**
```
/karttamaster-pm mitä seuraavaksi
```

**Bugi:**
```
/ck:spec bug: <kuvaus>  →  /karttamaster-rakentaja §T<korjaus>
```

## Skill-ekosysteemi

```
VISIO/SUUNTA          SPEC-KIRJOITUS         RAKENNUS              LAATU
─────────────────     ──────────────────     ─────────────────     ──────────────────
karttamaster-pm    →  karttamaster-spec   →  karttamaster-       →  karttamaster-
(MITÄ ja MIKSI)       (arch+ux+test         rakentaja               testaaja
                       → /ck:spec)           (ck:build)              (testit + UX-audit)
                                                  ↓
                       karttamaster-ux ←──── automaattinen jos UI
                       (DESIGN.md)
                            ↑
                       karttamaster-arkkitehtuuri
                       (kerros, tiedosto, pilkko)
```

## Automaattiset kutsut

| Skill | Kutsuu automaattisesti |
|---|---|
| `/karttamaster-spec` | → `/karttamaster-arkkitehtuuri ck:spec-konteksti` |
| `/karttamaster-spec` | → `/karttamaster-ux` jos UI-komponentti |
| `/karttamaster-spec` | → `/ck:spec amend §T` lopuksi |
| `/karttamaster-rakentaja` | → `/ck:build` + `/karttamaster-testaaja` |
| `/karttamaster-rakentaja` | → `/karttamaster-ux` jos task koskee src/ui/ tai CSS |
| `/karttamaster-testaaja` | → `/ck:spec bug:` jos bugi löytyy |
| `/karttamaster-testaaja` | → `/karttamaster-arkkitehtuuri` jos arkkitehtuuririkkomus |
| `/karttamaster-testaaja` | → `/karttamaster-ux` jos UX-ongelma (touch/kontrasti/mobiili) |
| `/ck:build` | → `/ck:backprop` jos testi hajoaa |

## localStorage-mock (Node v26 conflict)

localStorage-testeissä aina `vi.stubGlobal`-mock — natiivi localStorage konfliktoi Node v26:ssa.
Pohja: `/karttamaster-testaaja` → "localStorage-mock" (ainoa koti, ei kopioita tänne).

## Arkkitehtuurirajat

- `src/logic/` — EI Leafletia, EI DOM:ia → Vitest-pure testattavissa
- `src/map/` — ohut Leaflet-glue → Playwright
- `src/ui/` — DOM ilman Leafletia → Vitest-jsdom
- `src/main.ts` — vain init + wiring, max ~80 riviä
- `server/` — Hono + SQLite, EI src/-importteja → Bun integraatiotestit (`bun test server/`)

Logiikka väärässä kerroksessa = bugi. Kutsu `/karttamaster-arkkitehtuuri`.

## Pilkkohälytykset

Ajantasaiset liput: **COMPONENTS.md §Pilkkohälytykset** — ainoa lista.
Rivimäärät laskee `/karttamaster-arkkitehtuuri analysoi` livenä. Älä kirjaa lukuja tänne — ne mätänevät.

## Testaus

```bash
bun run test                              # Vitest (Taso 1+2 — src/)
bun run test:watch                        # watch mode
bun test server/                          # Bun integraatiotestit (Taso 4 — server/)
bunx playwright test e2e/ --browser=chromium  # Playwright E2E (Taso 3)
```

`↓`-rivit = todo-testit, ei regression.

**E2E-testit:** `e2e/`-hakemisto, `playwright.config.ts`. Käynnistä dev-serveri ensin (`bun run dev`).
`src/map/`-muutos tai kriittinen käyttäjäpolku → playwright-cli -validointi pakollinen ennen ✓.

**Server-testit (Taso 4):** käytä aina `server/test-fixtures.ts` — `seedTestUsers` + `authHeaders`.
Katso pohja: `docs/components/backend.md` → "Testiapurit".
