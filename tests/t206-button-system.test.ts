import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// T206/V135: yhtenäinen .btn-nappijärjestelmä. Testi lukee style.css:n suoraan ja
// varmistaa että base + variantit ovat olemassa ja vanhat luokat aliasoitu variantteihin.

function readCss(): string {
  const fs = require('fs')
  const path = require('path')
  return fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf-8')
}

describe('T206 — nappijärjestelmä (.btn base + variantit)', () => {
  let css: string
  let style: HTMLStyleElement
  let btn: HTMLButtonElement

  beforeEach(() => {
    css = readCss()
    style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    btn = document.createElement('button')
    document.body.appendChild(btn)
  })
  afterEach(() => {
    style.remove()
    btn.remove()
  })

  it('base + kaikki 5 varianttia + koko määritelty', () => {
    for (const sel of ['.btn', '.btn--primary', '.btn--secondary', '.btn--confirm', '.btn--danger', '.btn--ghost', '.btn--sm']) {
      expect(css).toContain(sel)
    }
  })

  it('.btn base = 44px touch-target (§R)', () => {
    btn.className = 'btn'
    expect(getComputedStyle(btn).minHeight).toBe('44px')
  })

  it('.btn--confirm käyttää confirm-tokenia', () => {
    btn.className = 'btn btn--confirm'
    // jsdom ei laske var()-arvoa laskennalliseen väriin luotettavasti → tarkista lähde
    expect(css).toMatch(/\.btn--confirm[^{]*\{[^}]*background:\s*var\(--confirm\)/)
  })

  it('.btn--sm pienentää touch-targetin 36px:ään', () => {
    btn.className = 'btn btn--sm'
    expect(getComputedStyle(btn).minHeight).toBe('36px')
  })

  it('vanhat kertakäyttöluokat aliasoitu variantteihin (confirm/secondary/danger)', () => {
    // Edustava otos: jokainen legacy-luokka jakaa variantin väri-token-määrittelyn.
    expect(css).toMatch(/\.btn--confirm[\s\S]*?\.modal-btn-primary[\s\S]*?background:\s*var\(--confirm\)/)
    expect(css).toMatch(/\.btn--secondary[\s\S]*?\.modal-btn-secondary[\s\S]*?background:\s*var\(--field-tint\)/)
    expect(css).toMatch(/\.btn--danger[\s\S]*?\.btn-segment-delete[\s\S]*?background:\s*var\(--danger-soft\)/)
  })

  it('modal-footer-pattern säilyy 1:1 (primary/secondary/destructive luokat olemassa)', () => {
    for (const sel of ['.modal-btn-primary', '.modal-btn-secondary', '.modal-btn-destructive']) {
      expect(css).toContain(sel)
    }
  })
})
