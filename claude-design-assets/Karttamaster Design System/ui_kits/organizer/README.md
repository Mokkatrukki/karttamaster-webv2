# Organizer UI kit — Järjestäjä (desktop)

The planning view, recreated as an interactive click-through. Office, large screen, mouse, calm: the design goal is **precision and a full situational picture, all within reach**.

## Screen
`index.html` — the live planning view:
- **Toolbar** — `+ Merkki` (amber primary), `GPS`, the active `Järjestäjä` role toggle, `Kartta` layer, overflow `⋯`.
- **Status overview** — per-route `ProgressBar` rows (35 km 100 %, 55 km 62 %) pinned under the toolbar — the always-on situational picture.
- **Collapsible left panel** — `Merkkikirjasto` (sign library grid) + `Pätkäjako` (segment assignment list with assignees). Collapses so the map keeps center stage (focus area 2).
- **Map** — forest-topo backdrop with all `SignMarker` pins across statuses, zoom control, and the `LUONNOS / HYVÄKSYTTY` map-state badge.
- **Route bar** — `RouteTab` chips + km read-out + prev/next.

## Try it
- **+ Merkki** → enters place-mode (button turns red, crosshair cursor, "klikkaa karttaa" hint).
- **⋯** or the edge tabs → collapse / expand the left panel; the map re-centers.

## Components used
`Button`, `IconButton`, `RouteTab`, `ProgressBar`, `SignMarker`, `MarkerListItem`, `StatusBadge`, `Card`.

## Notes
- Faithful to the shipped dark chrome. The shipped app uses *floating* overlay panels (top, full-width) toggled from `⋯`; this kit presents the same library + segment tools as a **collapsible left panel**, which is the natural desktop reading of focus area 2 ("collapsible side panels, map stays center"). Both are documented in DESIGN.md §K.
- `MapBackdropOrg.jsx` is a stylised stand-in for the third-party Maanmittauslaitos tiles.
