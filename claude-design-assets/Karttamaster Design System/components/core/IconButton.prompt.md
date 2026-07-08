Square, icon-only, 44px touch target. Always labelled for accessibility.

```jsx
<IconButton label="Valikko">⋯</IconButton>
<IconButton label="Edellinen">◀</IconButton>
<IconButton label="GPS" active>📍</IconButton>
<IconButton label="Poista" variant="danger">✕</IconButton>
```

- `label` is required → `aria-label` + `title` (DESIGN.md §A flags missing labels as debt).
- `active` paints the amber accent for on-states (GPS, role).
- For map sign pins use `SignMarker`, not this.
