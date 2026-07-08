# Volunteer UI kit — Talkoolainen (mobile)

The volunteer's field view, recreated as an interactive click-through. Android phone, outdoors, gloves, poor signal: the design goal is **max one tap to the common case**.

## Screen
`index.html` — the live field view:
- **Toolbar** — `GPS` toggle + overflow `⋯`. No `+ Merkki` (volunteer-gated).
- **Segment view** — the volunteer's *assigned segment only* (`Pohjoislenkki`, 12–24 km) as a scrollable marker list with live done-count.
- **Map** — stylised forest-topo backdrop with `SignMarker` pins (type hue, status opacity) and the volunteer's own GPS dot.
- **Route bar** — `RouteTab` + `ProgressBar`; flips to a glanceable `DriveBanner` ("Seuraava merkki 300 m →") when GPS is on.
- **Check-in modal** — tap any sign (list or map) → `CheckInButton` does the one-tap status advance, with "Ei tarpeen" / "Lisäsin toisen" beneath.

## Try it
- Tap **GPS** → route bar becomes drive mode.
- Tap any marker → check-in sheet; confirm advances its status (`suunniteltu → asetettu → kerätty`).

## Components used
`IconButton`, `Button`, `RouteTab`, `ProgressBar`, `SignMarker`, `MarkerListItem`, `CheckInButton`, `DriveBanner`, `StatusBadge`, `Card`.

## Notes
- Replicates the existing dark chrome over the (light) map — faithful to the shipped app.
- The map backdrop (`MapBackdrop.jsx`) is a stylised stand-in for the third-party Maanmittauslaitos tiles, not a design asset.
- The recommended **daylight** theme for outdoor use is shown in the foundations ("Role-based theming" card); swap `data-theme="dark"` → `"daylight"` on the root to preview it.
