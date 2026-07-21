# Karttamaster

Reittimerkintöjen suunnittelu-, kenttätyö- ja purkutyökalu **SyöteMTB 2026** -tapahtumalle.
Korvaa paperisen kartan. Kaksi roolia: **järjestäjä** (desktop, suunnittelu + tilannekuva)
ja **talkoolainen** (mobiili, kenttätyö metsässä). Kaikki näkevät kaikkien statuksen.

## Stack

Vite + TypeScript + Leaflet + Bun. Ei frameworkkia. Backend: Hono + SQLite. Deploy: Fly.io + Docker.

Kerrosarkkitehtuuri:

```
src/logic/  puhdas logiikka (ei Leafletia, ei DOM:ia) → Vitest-pure
src/map/    ohut Leaflet-glue                          → Playwright
src/ui/     DOM ilman Leafletia                        → Vitest-jsdom
src/main.ts init + wiring
server/     Hono + SQLite (ei src/-importteja)         → Bun-integraatiotestit
```

## Kehitys

```bash
bun install

bun run dev          # Vite-frontend (port 5173)
bun run server       # Hono-backend (port 3001)
bun run dev:all      # molemmat rinnakkain

bun run build        # tsc + vite build
```

## Testit

```bash
bun run test                                    # Vitest (src/ — unit + jsdom)
bun run test:watch                              # watch
bun run test:server                             # Bun-integraatiotestit (server/)
bunx playwright test e2e/ --browser=chromium    # E2E (dev-serveri käyntiin ensin)
```

Flaky-E2E:n juurisyyt + tutkintajärjestys: [`docs/E2E-NOTES.md`](docs/E2E-NOTES.md).

## Dokumentaatio

| Tiedosto | Sisältö |
|---|---|
| [`VISION.md`](VISION.md) | Tuotevisio, käyttäjäroolit, UX-periaatteet |
| [`SPEC.md`](SPEC.md) | Taskit (§T), invariantit (§V), bugit (§B) — ainoa totuus |
| [`COMPONENTS.md`](COMPONENTS.md) | Komponentti-indeksi. Yksityiskohdat: `docs/components/` |
| [`DESIGN.md`](DESIGN.md) | Design-sopimukset: värit, spacing, CSS custom properties |
| [`docs/PM-NOTES.md`](docs/PM-NOTES.md) | Avoimet PM-päätökset + toteutus-riippuvuudet |
| [`CLAUDE.md`](CLAUDE.md) | Claude Code -kehitysflow + skill-ekosysteemi |
