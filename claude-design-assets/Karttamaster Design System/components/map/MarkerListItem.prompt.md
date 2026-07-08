A sign row for the marker modal and segment lists — swatch + name + km meta + status pill.

```jsx
<MarkerListItem glyph="→" hue="var(--marker-right)" name="Nuoli oikealle"
  km="12,4 km · 55-reitti" status="asetettu" />
<MarkerListItem glyph="!" hue="var(--marker-up-r)" name="Varo hyppy"
  km="18,1 km" status="suunniteltu" highlight
  trailing={<IconButton label="Poista" variant="danger">✕</IconButton>} />
```

- `highlight` washes the row amber for a just-added marker.
- Put a delete `IconButton` or chevron in `trailing`.
