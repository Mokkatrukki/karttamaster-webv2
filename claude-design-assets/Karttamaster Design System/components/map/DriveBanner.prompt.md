Glanceable GPS drive read-out — "Seuraava merkki 300 m →". The distance is the biggest thing on screen and turns green within range.

```jsx
<DriveBanner distance="300 m" label="Seuraava merkki" direction="→" />
<DriveBanner distance="20 m" label="Olet perillä" direction="↓" near
  action={<Button variant="confirm">Kuittaa</Button>} />
```

- `near` flips the whole banner to the green "asetettu" palette.
- Uses the `--text-drive` scale — the only place the 11–14px ceiling is broken, on purpose.
