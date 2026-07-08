One button, five intents — the load-bearing primitive of the whole product; every variant clears the 44px touch floor.

```jsx
<Button variant="primary" iconLeft="＋">Merkki</Button>
<Button variant="confirm" size="lg" fullWidth>Asetettu ✓</Button>
<Button variant="ghost">GPS</Button>
<Button variant="danger" size="sm">Poista</Button>
```

- `variant`: `primary` (amber, one per view), `confirm` (green check-in), `secondary`, `ghost`, `danger`.
- `size`: `sm` / `md` (both ≥44px tall) / `lg` (52px — the volunteer's dominant field button).
- Use `confirm` + `size="lg"` + `fullWidth` for the one-tap check-in. Use `primary` sparingly — it's the organizer's "+ Merkki".
