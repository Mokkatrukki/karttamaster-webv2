import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// T71: CSS token-migraatio — semanttiset tokeninimet, kaksi teemaa

function applyStyles(html: HTMLElement): void {
  // Read actual CSS file and inject into jsdom
  const fs = require('fs')
  const path = require('path')
  const css = fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf-8')
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
}

describe('T71 CSS token-migraatio', () => {
  let style: HTMLStyleElement
  let html: HTMLElement

  beforeEach(() => {
    const fs = require('fs')
    const path = require('path')
    const css = fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf-8')
    style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    html = document.documentElement
  })

  afterEach(() => {
    style.remove()
    html.removeAttribute('data-theme')
  })

  // V132/T202: kaksi käyttäjän valittavaa teemaa — Reittimerkki-vaalea (:root, oletus)
  // + Kaamos-tumma ([data-theme="dark"]). Roolisidottu daylight/dark poistettu.

  it('Reittimerkki-vaalea (:root, oletus): --surface-app on #EDF1EC (birkkupaperi)', () => {
    html.removeAttribute('data-theme')
    const val = getComputedStyle(html).getPropertyValue('--surface-app').trim()
    expect(val).toBe('#EDF1EC')
  })

  it('Reittimerkki-vaalea: --surface-card on #F6F9F5', () => {
    html.removeAttribute('data-theme')
    const val = getComputedStyle(html).getPropertyValue('--surface-card').trim()
    expect(val).toBe('#F6F9F5')
  })

  it('Reittimerkki-vaalea: --text-body on #17221D (kuusenmusta)', () => {
    html.removeAttribute('data-theme')
    const val = getComputedStyle(html).getPropertyValue('--text-body').trim()
    expect(val).toBe('#17221D')
  })

  it('Reittimerkki-vaalea: --accent on #F2542D (huomionauha, EI amber)', () => {
    html.removeAttribute('data-theme')
    const val = getComputedStyle(html).getPropertyValue('--accent').trim()
    expect(val).toBe('#F2542D')
  })

  it('Reittimerkki-vaalea: data-theme="light" → oletustokenit (ei erillistä override-selektoria)', () => {
    html.setAttribute('data-theme', 'light')
    const val = getComputedStyle(html).getPropertyValue('--surface-app').trim()
    expect(val).toBe('#EDF1EC')
  })

  it('status-tokenit määritelty :rootissa (§C) — asetettu #2FA35B', () => {
    html.removeAttribute('data-theme')
    const val = getComputedStyle(html).getPropertyValue('--status-asetettu').trim()
    expect(val).toBe('#2FA35B')
  })

  it('Kaamos-tumma: --surface-app on lämmin hiilenmusta #1A1614', () => {
    html.setAttribute('data-theme', 'dark')
    const val = getComputedStyle(html).getPropertyValue('--surface-app').trim()
    expect(val).toBe('#1A1614')
  })

  it('Kaamos-tumma: --text-body vaalea #F0EAE4', () => {
    html.setAttribute('data-theme', 'dark')
    const val = getComputedStyle(html).getPropertyValue('--text-body').trim()
    expect(val).toBe('#F0EAE4')
  })

  it('Kaamos-tumma: --accent sama huomionauha #F2542D', () => {
    html.setAttribute('data-theme', 'dark')
    const val = getComputedStyle(html).getPropertyValue('--accent').trim()
    expect(val).toBe('#F2542D')
  })

  it('roolisidottu daylight-teema poistettu CSS:stä', () => {
    const fs = require('fs')
    const path = require('path')
    const css = fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf-8')
    expect(css).not.toMatch(/\[data-theme="daylight"\]/)
  })

  it('radius-sm on 6px (U5-fix)', () => {
    const val = getComputedStyle(html).getPropertyValue('--radius-sm').trim()
    expect(val).toBe('6px')
  })

  it('radius-md on 10px', () => {
    const val = getComputedStyle(html).getPropertyValue('--radius-md').trim()
    expect(val).toBe('10px')
  })

  it('radius-lg on 14px', () => {
    const val = getComputedStyle(html).getPropertyValue('--radius-lg').trim()
    expect(val).toBe('14px')
  })

  it('vanhat tokeninimet (--bg-primary jne.) eivät enää ole :rootissa', () => {
    const fs = require('fs')
    const path = require('path')
    const css = fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf-8')
    // Vanha nimi --bg-primary ei saa enää esiintyä tokeni-määrittelynä
    expect(css).not.toMatch(/--bg-primary\s*:/)
    expect(css).not.toMatch(/--bg-card\s*:/)
    expect(css).not.toMatch(/--text-primary\s*:/)
    expect(css).not.toMatch(/--hover-light\s*:/)
  })
})
