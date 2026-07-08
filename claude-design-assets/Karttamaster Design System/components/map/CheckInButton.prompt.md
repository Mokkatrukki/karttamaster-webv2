The single most important control in the product: the volunteer's one-tap check-in. Huge green primary, small secondaries beneath.

```jsx
<CheckInButton
  label="Merkitse asetetuksi"
  sub="Nuoli oikealle · 12,4 km"
  onConfirm={place}
  secondary={[
    { label: 'Ei tarpeen', variant: 'ghost', onClick: skip },
    { label: 'Lisäsin toisen', variant: 'secondary', onClick: addOther },
  ]}
/>
```

- The green button is 72px tall and presses with a subtle scale — built for gloves.
- Keep `secondary` to two actions max; the common case must be the one big tap.
