The teardrop sign pin shown on the map. Type hue is the constant identity; status only changes opacity + a small dot.

```jsx
<SignMarker type="right" glyph="→" status="asetettu" bearing={40} />
<SignMarker type="left"  glyph="←" status="suunniteltu" />
<SignMarker type="up_r"  glyph="↱" status="tarkistettu" />
```

- `type`: `right` (green) / `left` (blue) / `up_r` (orange, dashed) / `up_l` (violet, dashed).
- `status="suunniteltu"` fades the whole pin to 0.45 and hides the dot ("faded = not done").
- Anchored at the tip (16,52); `bearing` rotates only the head.
