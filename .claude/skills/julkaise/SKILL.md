---
name: julkaise
description: Commit + deploy skill for karttamaster-webv2. Use when user says "deployta", "julkaise", "laita tuotantoon", "vie liveksi", "commit ja deploy", "pushaa", or any variation of wanting to ship changes to fly.io. Runs tests first — stops on failure. Commits staged/unstaged changes then deploys to karttamaster-web.fly.dev.
---

# Julkaise — Test → Commit → Deploy

Workflow aina tässä järjestyksessä. Älä ohita vaiheita.

## 1. Testit

```bash
npm run test:ci 2>&1
```

- Exit code 0 → tulosta "testit ok", jatka
- Exit code != 0 → näytä virheet, **stop** — älä commitoi tai deployta

## 2. Muutokset

```bash
git status --short
git diff --stat
```

Jos ei muutoksia → hyppää suoraan deployiin (vaihe 4).

## 3. Commit

Stage ja commitoi muutokset. Kirjoita commit-viesti Conventional Commits -formaatissa (max 50 merkkiä subject). Body vain jos "miksi" ei ole ilmeistä.

```bash
git add <relevantit tiedostot>   # älä käytä git add -A jos .env-tiedostoja löytyy
git commit -m "..."
```

Tarkista ettei `.env.local` tai muita secrets-tiedostoja mene mukaan.

## 4. Deploy

```bash
fly deploy 2>&1 | tail -20
```

Näytä vain loppuosa outputista (tail). Kun valmis, tulosta:

```
✓ live: https://karttamaster-web.fly.dev/
```

## Virhekäsittely

- Testit failaa → stop, näytä virheet, kerro mitä pitää korjata
- `fly deploy` failaa → näytä virhe sellaisenaan
- Ei muutoksia commitoitavaksi → ok, deployta silti (edellinen commit on jo livessä tai imagea päivitetty)
