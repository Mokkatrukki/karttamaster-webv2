# Karttamaster — Design System

Trail-sign management for **SyöteMTB 2026**, a volunteer-run mountain-bike event in Syöte, Finland. Karttamaster replaces a paper map + phone photos: volunteer crews plan, place, check, and collect physical trail signs along four overlapping GPX routes. It is one tool with two contexts, not two apps.

> Fiilis on luottavainen ja rento, ei firmafiilistä. — *The feeling is trusting and relaxed, not corporate.* (VISION.md)

## The two contexts (this is the whole design)

| | **Järjestäjä** (Organizer) | **Talkoolainen** (Volunteer) |
|---|---|---|
| Where | Office / home, desk | Forest or car, on the move |
| Device | Large screen, mouse | Android phone, maybe gloves |
| Network | Good | Poor or none |
| State of mind | Calm, precise | Stressed, battery low |
| Needs | Full map, sign library, segment assignment, situational overview. Power tools. | Their assigned segment only, GPS navigation, **one dominant check-in button**. Max 2 taps to any critical action. |

The decision rule for any UX call: **"Works one-handed, in the forest, with gloves, in 10 seconds?"**

## Sources

This system was derived from the team's own artifacts (read into this project under `uploads/`, kept for reference — assume the reader may not have them):
- `DESIGN.md` — the team's style contract (Finnish): colours, type, spacing, touch, component specs, UX-debt log. The closest thing to a spec; this system is its faithful tokenization.
- `VISION.md` — product vision, personas, phases, principles.
- `style.css` — the shipped global stylesheet (1670 lines). Every token here traces back to it.
- `01–04 *.png` — the four real screenshots (organizer/volunteer × desktop/mobile).

Architecture (from VISION.md, for anyone building the real thing): pure TS logic in `src/logic/`, thin Leaflet glue in `src/map/`, DOM UI in `src/ui/`. Leaflet is a thin map layer; business logic knows nothing about it.

---

## ⚑ Open question answered: theming

The team asked whether dark theme is right for outdoor forest use. **Recommendation: role-based theming.**

- **Organizer → dark** (current). Indoors, calm, big screen — dark is comfortable and matches the shipped product. Keep it.
- **Volunteer → daylight** (new, light, high-contrast). The volunteer is *always* outdoors, often in direct sun with screen brightness fighting glare. A near-white surface with near-black text is dramatically more legible in sunlight than `#0f172a`. The Leaflet map tiles are already light, so a light chrome also stops the UI fighting the map.

Both themes share the **same semantic token names** (`--surface-app`, `--text-body`, `--accent`, `--status-*`…); only the values swap, driven by one attribute: `data-theme="dark"` / `data-theme="daylight"` on the root (or `<body data-role>`). Components never reference raw palette values, so the switch is free. Status and danger colours are re-tuned per theme for WCAG AA on the new surface. See the **"Role-based theming"** foundation card.

> The shipped UI kits replicate the existing dark chrome faithfully. Daylight is offered as the recommended volunteer evolution — confirm before we make it the volunteer default.

---

## CONTENT FUNDAMENTALS

**Language: Finnish, always.** Every label, button, and status is Finnish. UI copy is never translated to English in-product.

**Voice: plain, calm, trusting.** This is friends doing volunteer work (talkoot), not a corporate product. No exclamation marks, no marketing, no cheerleading. Instructions are short imperatives: `Klikkaa karttaa`, `Luo uusi pätkä`, `Merkitse asetetuksi`.

**Casing:**
- Buttons & body: **sentence case** — `Lisää merkki`, `Ei tarpeen`, `Lisäsin toisen`.
- Section headers (panel titles): **UPPERCASE** with `0.04em` tracking — `MERKKIKIRJASTO`, `PÄTKÄJAKO`, `LUO VARMUUSKOPIO`.
- Status pills: **UPPERCASE** — `SUUNNITELTU`, `ASETETTU`.

**Person:** mostly impersonal imperative (`Klikkaa…`, `Merkitse…`). First-person only for the volunteer's own actions framed as a fact: `Lisäsin toisen` ("I added another"). Never "you should".

**Numbers:** Finnish decimal comma — `12,4 km`, `0,00 / 34,1 km`. Tabular figures for all distances/percentages.

**Status vocabulary** (the lifecycle — learn these five words):
`suunniteltu` → `asetettu` → `tarkistettu` → `kerätty`, plus `ei tarpeen`. These are *the* domain nouns; reuse them exactly, don't paraphrase.

**Emoji:** used **sparingly, only as functional toolbar glyphs** — `📍` (GPS), `⋯` (menu), `☰` (list). Never decorative, never in body copy, never as bullet points or status. When in doubt, no emoji.

**Examples of real copy:** `+ Merkki` · `📍 GPS` · `Järjestäjä` / `Talkoolainen` · `Seuraava merkki 300 m →` · `Olet perillä` · `Klikkaa reittiä: 1. / 2. piste` · `jakamaton` (unassigned) · `Luo uusi pätkä`.

---

## VISUAL FOUNDATIONS

**Overall feel.** A dense, functional map utility. The map is the hero; chrome is thin slate bars top and bottom that float over it. Nothing decorative. High contrast, high information density, big touch targets. Reads like a field instrument, not a consumer app.

**Colour.**
- *Neutral* is the slate family — dark chrome (`#0f172a` app, `#1e293b` card) in the organizer theme; near-white surfaces in daylight.
- *One accent*: **amber `#f59e0b`**. It means "the single most important action" — `+ Merkki`. Used with restraint; one amber thing per view.
- *Confirm* is **green `#15803d`** — the volunteer's check-in. *Danger* is **red `#ef4444`**, always soft-tinted (`rgba(239,68,68,0.10)` bg), never a solid red button except active place-mode.
- *Marker-type hues* (green/blue/orange/violet) identify **what** a sign is and never change. *Status colours* identify **where it is in its lifecycle** and are the only thing that changes. Keep these two systems separate.

**Typography.** `Inter` with a system-ui fallback (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`). Deliberately tight scale: **11 / 12 / 13 / 14px** for the entire product. Going bigger means a *new hierarchy level*, not emphasis. The single exception is **drive mode** (28–40px) — a distance read-out built to be glanced at in motion. Weights: 400 body, 600 buttons/labels, 700 titles/distances.

**Spacing.** Strict **4px grid**. 5/7/9px are bugs. Gaps cluster at 4/6/8/10/12/16. Toolbar padding `6px 8px`; row padding `10px 14px`.

**Touch.** The load-bearing rule: **44px minimum** on every interactive element. 36px only for dense controls already nested inside a large row. The volunteer wears gloves.

**Corners.** Three radii: `6px` buttons/swatches/pills, `10px` dropdowns/menus, `14px` modals. `999px` for progress tracks.

**Cards & surfaces.** Card = `--surface-card` fill + 1px hairline border (`rgba(255,255,255,0.10)` on dark) + radius. No drop shadow at rest; shadow appears only on *floating* surfaces (dropdowns, modals, panels lifting off the map).

**Borders.** A four-step hairline ladder of translucent white (dark) / translucent slate (daylight): `subtle 0.06` (section dividers) → `card 0.08` (list rows) → `default 0.10` (cards, dropdowns) → `strong 0.12` (buttons). Borders do the separation work that shadows would in a lighter UI.

**Shadows.** Restrained, dark-biased. `dropdown 0 8 24 /.4`, `modal 0 16 48 /.5`, `bar-up` (the route-bar lifts off the map with an upward shadow), `marker 0 2 6 /.5` for pins. Daylight softens all of these.

**Transparency & blur.** Modal/panel backdrops use `--overlay` (50% black on dark) + `backdrop-filter: blur(2px)`. Chips and hovers are translucent white/slate washes (`--field-tint`, `--hover`) rather than solid fills, so the map subtly shows through the chrome.

**Hover / press.** Hover = a small lightening wash (`rgba(255,255,255,0.08)` → `0.14`), never a colour change. Press = the big check-in button scales to `0.985` (tactile, glove-friendly); everything else just darkens. No bounce, no overshoot.

**Animation.** Fast and functional. `0.1s` hover/press, `0.15s` tab borders & toggles, `0.3s` progress fills and panel collapse. Standard ease `cubic-bezier(0.4,0,0.2,1)`. No decorative motion, no infinite loops. Respects `prefers-reduced-motion`.

**Layout rules.** Fixed toolbar top (z 200), fixed route-bar bottom (z 2000, above Leaflet controls), map fills the middle. Floating panels open *over* the map (z 1100). Mobile-first, no fixed breakpoints — `min()`, `clamp()`, `vw`. Modals are `min(340px, 92vw)` so they fit a 320px Android.

**Imagery.** The only imagery is the map itself — a light Finnish topographic basemap (Maanmittauslaitos) with coloured GPX route loops (violet/amber/green/pink) drawn over it. Cool, light, cartographic. No photography, no illustration, no gradients-as-decoration.

---

## ICONOGRAPHY

The product currently uses two icon sources, and one is an open question in VISION.md:

1. **Chrome glyphs — emoji + Unicode, used sparingly.** `📍` GPS, `⋯` overflow menu, `☰` list, `◀ ▶` route nav, `✕` close, `👁 / 👁-off` route visibility. These are functional controls, not decoration.
2. **Map sign markers — inline SVG** (recreated in `SignMarker`): a 32×52 teardrop = a rotating coloured head (type hue, `r=14`) + a fixed tip path `M8,0 L16,10 L24,0 Z` anchored at the exact ground point `(16,52)`. Upcoming types get a dashed ring; planned status fades to 0.45; a small status dot sits bottom-right.

**Recommendation (answering VISION.md open question #1):** adopt **[Lucide](https://lucide.dev)** for chrome icons — clean 2px stroke, matches the minimal aesthetic, free, CDN-available — replacing the emoji glyphs (`MapPin`, `MoreHorizontal`, `List`, `ChevronLeft/Right`, `X`, `Eye/EyeOff`). This system's `RouteTab` already uses Lucide-style eye / eye-off SVGs as a preview of that direction. Keep the custom teardrop `SignMarker` SVG (it's domain-specific and bearing-aware — no icon set provides it). **No icon font or sprite is committed yet**; if you build the real thing, pull Lucide from CDN or as a dependency and we'll vendor the exact glyph set used.

---

## INDEX

**Root**
- `styles.css` — the single entry point consumers link. `@import`s everything below.
- `readme.md` — this guide.
- `SKILL.md` — Agent-Skills-compatible entry for using this system in Claude Code.

**Tokens** (`tokens/`, all reached from `styles.css`)
- `fonts.css` — Inter webfont (Google Fonts CDN — see Fonts note).
- `palette.css` — raw, theme-agnostic palette (slate, amber, red, greens/blues, marker + route hues).
- `colors.css` — semantic aliases for both themes (`dark` / `daylight`).
- `markers.css` — sign-type hues + status-lifecycle colours (per theme).
- `typography.css` · `spacing.css` · `elevation.css` — type scale, 4px grid + touch + z-index, shadows + motion.

**Components** (`components/`) — React primitives, `window.KarttamasterDesignSystem_…`
- `core/` — `Button`, `IconButton`, `Input`, `Select`, `StatusBadge`, `Card`, `ProgressBar`.
- `map/` — `SignMarker`, `RouteTab`, `DriveBanner`, `CheckInButton`, `MarkerListItem`.

**UI kits** (`ui_kits/`)
- `volunteer/` — mobile field view, one-tap check-in (interactive).
- `organizer/` — desktop planning view, collapsible library + segment panel (interactive).

**Foundation cards** (`guidelines/`) — the specimen cards in the Design System tab (Type, Colors, Spacing).

## Fonts
**Inter** is the named brand font (it's in the shipped stack). It's loaded here from the **Google Fonts CDN**, not self-hosted binaries. If you need an offline/vendored build, drop the `.woff2` files in and add `@font-face` rules — flagging this so it's a conscious choice. The system-ui fallback means the product still renders instantly on a cold offline phone.
