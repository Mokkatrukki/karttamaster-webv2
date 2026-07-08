The marker lifecycle pill. Drives the colour language of the whole product.

```jsx
<StatusBadge status="suunniteltu" />
<StatusBadge status="asetettu" />
<StatusBadge status="tarkistettu" />
<StatusBadge status="keratty" />
<StatusBadge status="ei_tarpeen" />
```

- Lifecycle order: `suunniteltu → asetettu → tarkistettu → keratty`, plus `ei_tarpeen`.
- Default label is the Finnish status name; pass children to override.
- Colours come from `--status-*` tokens and auto-adjust for the daylight theme.
