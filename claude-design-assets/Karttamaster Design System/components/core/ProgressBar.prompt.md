Thin green progress track for route completion and the organizer's per-route status overview.

```jsx
<ProgressBar label="35km" value={100} detail="0/0" />
<ProgressBar label="55km" value={62} detail="24/39" />
```

- `value` 0–100; trailing `pct` defaults to the rounded value, `detail` shows a fraction.
- `fill` overrides the bar colour (default green `--confirm`).
