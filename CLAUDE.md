# Karttamaster — Claude-ohjeet

## Projekti lyhyesti

SyöteMTB 2026 -merkintätyökalu. Vite + TypeScript + Leaflet + Bun. Ei frameworkia.
Stack: `src/logic/` (puhdas logiikka) → `src/map/` (Leaflet) → `src/ui/` (DOM) → `src/main.ts` (init).

## Tärkeimmät tiedostot

- `SPEC.md` — taskit (§T), invariantit (§V), bugit (§B). Ainoa totuus.
- `VISION.md` — product vision + käyttäjäroolit + arkkitehtuuriperiaatteet.
- `COMPONENTS.md` — komponentti-indeksi (lyhyt). Yksityiskohdat: `docs/components/`.

## Kehitysflow

**Normaali task:**
```
/ck:spec amend §T  →  /karttamaster-rakentaja T<n>  →  (testaaja automaattinen)
```

**Uusi feature:**
```
/karttamaster-arkkitehtuuri feature <kuvaus>  →  /ck:spec  →  /karttamaster-rakentaja
```

**Bugi:**
```
/ck:spec bug: <kuvaus>  →  /karttamaster-rakentaja §T<korjaus>
```

## Automaattiset kutsut

| Skill | Kutsuu automaattisesti |
|---|---|
| `/karttamaster-rakentaja` | → `/ck:build` + `/karttamaster-testaaja` |
| `/karttamaster-testaaja` | → `/ck:spec bug:` jos bugi löytyy |
| `/karttamaster-testaaja` | → `/karttamaster-arkkitehtuuri` jos arkkitehtuuririkkomus |
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
