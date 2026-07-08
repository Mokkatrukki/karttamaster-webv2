Text input sized for the field — 44px tall, uppercase meta label, accent focus ring.

```jsx
<Input label="Pätkän nimi" placeholder="esim. Pohjoislenkki" />
<Input label="Kutsukoodi" invalid hint="Koodi ei kelpaa" />
```

- `label` renders an uppercase meta-caps label; `hint` sits below (turns red when `invalid`).
- Spreads native input props (`value`, `onChange`, `type`, etc.).
