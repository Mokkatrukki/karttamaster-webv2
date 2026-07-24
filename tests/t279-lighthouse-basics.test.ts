import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// T279–T282 / V195–V198: Lighthouse-perusparannukset (perf/seo/a11y/cls).
// Lähdetiedostot luetaan suoraan (kuten t233/t207) — koostumus varmistetaan ilman selainta.

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8')
}

const PAGES = ['index.html', 'admin.html', 'patkat.html', 'inventory.html']

describe('T279/V195 — cache + gzip (nginx)', () => {
  const nginx = read('nginx.conf')

  it('content-hashatut /assets/ saavat immutable-cachen', () => {
    expect(nginx).toMatch(/location \/assets\/\s*\{[\s\S]*Cache-Control "public, immutable"/)
  })

  it('gzip päällä tekstivaroille', () => {
    expect(nginx).toMatch(/gzip on;/)
    expect(nginx).toMatch(/gzip_types[\s\S]*application\/javascript/)
  })

  it('HTML (location /) ei saa immutable-cachea — deploy näkyy heti', () => {
    expect(nginx).toMatch(/location \/\s*\{[\s\S]*Cache-Control "no-cache"/)
  })
})

describe('T280/V196 — SEO-perusta', () => {
  it('robots.txt on olemassa ja validi (User-agent + Allow)', () => {
    const robots = read('public/robots.txt')
    expect(robots).toMatch(/User-agent:\s*\*/)
    expect(robots).toMatch(/Allow:\s*\//)
    // ei HTML-fallbackia
    expect(robots).not.toMatch(/<!DOCTYPE|<html/i)
  })

  it('jokaisella HTML-sivulla meta-description', () => {
    for (const p of PAGES) {
      expect(read(p), `${p} puuttuu meta description`).toMatch(/<meta name="description" content="[^"]{20,}"/)
    }
  })
})

describe('T281/V197 — a11y-nimet', () => {
  it('index.html: <main>-landmark', () => {
    expect(read('index.html')).toMatch(/<main id="app-main">/)
  })

  it('status-panel progressbar saa aria-labelin', () => {
    const sp = read('src/ui/status-panel.ts')
    expect(sp).toMatch(/setAttribute\('role', 'progressbar'\)/)
    expect(sp).toMatch(/setAttribute\('aria-label'/)
  })

  it('sign-lib-place-btn: ei aria-label-name-mismatchia (nimi sisällöstä)', () => {
    const s = read('src/ui/sign-library-panel.ts')
    // place-btn ei saa aria-labelia (nimi tulee näkyvästä label+kuvaus-sisällöstä)
    expect(s).not.toMatch(/sign-lib-place-btn[^>]*aria-label=/)
    // dots-btn: koristeellinen "···" aria-hidden, nimi aria-labelista
    expect(s).toMatch(/sign-lib-dots-btn[\s\S]*aria-label="Muokkaa mallia"/)
    expect(s).toMatch(/<span aria-hidden="true">···<\/span>/)
  })

  it('Leaflet-merkeille annetaan title+alt (aria-command-name)', () => {
    const m = read('src/map/markers.ts')
    expect(m).toMatch(/L\.marker\([\s\S]*title: accName, alt: accName/)
  })
})

describe('T282/V198 — CLS route-bar', () => {
  it('route-bar renderöityy hidden-tilassa (ei full-bar→pilli-siirtymää)', () => {
    expect(read('index.html')).toMatch(/id="route-bar" hidden/)
  })

  it('järjestäjä-wiring paljastaa route-barin vasta moodin asetuksen jälkeen', () => {
    const w = read('src/app/markers-wiring.ts')
    expect(w).toMatch(/setAttribute\('data-mode', 'visibility'\)[\s\S]*removeAttribute\('hidden'\)/)
  })
})
