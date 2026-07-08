Route selector chip for the bottom route-bar — solid route-hue body + divided eye toggle.

```jsx
<RouteTab label="35 km" color="var(--route-2)" active onSelect={pick} onToggleVisibility={toggle} />
<RouteTab label="55 km" color="var(--route-1)" hidden onToggleVisibility={toggle} />
```

- `color` should be one of `--route-1..4`.
- `active` shows the bright outline + drive glyph; `hidden` dims it and flips the eye to eye-off.
