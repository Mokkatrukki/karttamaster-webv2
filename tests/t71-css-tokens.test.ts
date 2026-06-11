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

  it('dark theme: --surface-app on #0f172a', () => {
    html.setAttribute('data-theme', 'dark')
    const val = getComputedStyle(html).getPropertyValue('--surface-app').trim()
    expect(val).toBe('#0f172a')
  })

  it('dark theme: --surface-card on #1e293b', () => {
    html.setAttribute('data-theme', 'dark')
    const val = getComputedStyle(html).getPropertyValue('--surface-card').trim()
    expect(val).toBe('#1e293b')
  })

  it('dark theme: --text-body on #e2e8f0', () => {
    html.setAttribute('data-theme', 'dark')
    const val = getComputedStyle(html).getPropertyValue('--text-body').trim()
    expect(val).toBe('#e2e8f0')
  })

  it('dark theme: --confirm on #15803d', () => {
    html.setAttribute('data-theme', 'dark')
    const val = getComputedStyle(html).getPropertyValue('--confirm').trim()
    expect(val).toBe('#15803d')
  })

  it('dark theme: --gps-active on #1d4ed8', () => {
    html.setAttribute('data-theme', 'dark')
    const val = getComputedStyle(html).getPropertyValue('--gps-active').trim()
    expect(val).toBe('#1d4ed8')
  })

  it('daylight theme: --surface-app on #ffffff', () => {
    html.setAttribute('data-theme', 'daylight')
    const val = getComputedStyle(html).getPropertyValue('--surface-app').trim()
    expect(val).toBe('#ffffff')
  })

  it('daylight theme: --surface-card on #f1f5f9', () => {
    html.setAttribute('data-theme', 'daylight')
    const val = getComputedStyle(html).getPropertyValue('--surface-card').trim()
    expect(val).toBe('#f1f5f9')
  })

  it('daylight theme: --text-body on #020617', () => {
    html.setAttribute('data-theme', 'daylight')
    const val = getComputedStyle(html).getPropertyValue('--text-body').trim()
    expect(val).toBe('#020617')
  })

  it('daylight theme: --text-muted tumma (ei vaalea)', () => {
    html.setAttribute('data-theme', 'daylight')
    const val = getComputedStyle(html).getPropertyValue('--text-muted').trim()
    expect(val).toBe('#334155')
  })

  it('default (no data-theme): dark tokenit käytössä', () => {
    html.removeAttribute('data-theme')
    const val = getComputedStyle(html).getPropertyValue('--surface-app').trim()
    expect(val).toBe('#0f172a')
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
