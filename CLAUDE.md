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

Testeissä jotka käyttävät localStorage — käytä aina `vi.stubGlobal`:

```typescript
beforeEach(() => {
  let store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  })
})
```

## Arkkitehtuurirajat

- `src/logic/` — EI Leafletia, EI DOM:ia → Vitest-pure testattavissa
- `src/map/` — ohut Leaflet-glue → Playwright
- `src/ui/` — DOM ilman Leafletia → Vitest-jsdom
- `src/main.ts` — vain init + wiring, max ~80 riviä

Logiikka väärässä kerroksessa = bugi. Kutsu `/karttamaster-arkkitehtuuri`.

## Pilkkohälytykset (tarkista ennen T10/T12)

- `src/main.ts` — 385 riviä, 4 vastuuta → pilkottava ennen T12/T32
- `src/map/markers.ts` — 309 riviä → pilkottava ennen T10

## Testaus

```bash
bun run test          # kaikki testit
bun run test:watch    # watch mode
```

`↓`-rivit = todo-testit, ei regression.
