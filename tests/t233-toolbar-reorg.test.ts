import { describe, it, expect } from 'vitest'

// T233/V155/V157: talkoolaisen yläpalkin reorg + orpo alapalkki-padding (B101). Luetaan
// lähdetiedostot suoraan (kuten t207) — koostumus + CSS-varaus varmistetaan ilman selainta.

function read(rel: string): string {
  const fs = require('fs')
  const path = require('path')
  return fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8')
}

describe('T233 — yläpalkin reorg + orpo-padding', () => {
  const html = read('index.html')
  const css = read('src/style.css')

  const actions = html.match(/<div id="toolbar-actions">([\s\S]*?)<\/div>/)?.[1] ?? ''
  const menu = html.match(/<div id="toolbar-menu">([\s\S]*?)<div id="app-main">/)?.[1] ?? ''

  // ---- Yläpalkki = TASAN {Kaikki merkit, Varustelista, ⋯} (V155) ----
  it('#toolbar-actions sisältää Kaikki merkit + Varustelista + ⋯', () => {
    expect(actions).toContain('id="btn-list"')
    expect(actions).toContain('id="btn-varuste"')
    expect(actions).toContain('id="btn-menu"')
  })

  it('GPS + Merkin-lisäys EIVÄT ole yläpalkissa (siirtyivät heroon T232)', () => {
    expect(actions).not.toContain('id="btn-gps"')
    expect(actions).not.toContain('id="btn-add-marker"')
  })

  it('Karttatyyli EI yläpalkissa vaan ⋯-valikossa', () => {
    expect(actions).not.toContain('id="btn-layer"')
    expect(menu).toContain('id="btn-layer"')
  })

  it('Varustelista-nappi vain talkoolaiselle (data-role-hide="järjestäjä")', () => {
    expect(actions).toMatch(/id="btn-varuste"[^>]*data-role-hide="järjestäjä"/)
  })

  // ---- #btn-gps ei jää orvoksi koodiin (map-init poistanut toolbar-wiringin) ----
  it('map-init.ts EI enää wiraa #btn-gps-toggle (GPS herossa)', () => {
    const mapInit = read('src/app/map-init.ts')
    expect(mapInit).not.toContain("getElementById('btn-gps')")
  })

  it('markers-wiring.ts EI enää wiraa #btn-add-marker; wiraa #btn-varuste', () => {
    const wiring = read('src/app/markers-wiring.ts')
    expect(wiring).not.toContain("getElementById('btn-add-marker')")
    expect(wiring).toContain("getElementById('btn-varuste')")
  })

  // ---- V157/B101: orpo alapalkki-padding poistettu talkoolaiselta ----
  it('talkoolaiselta EI 84px route-bar-varausta (V157)', () => {
    // vanha orpo sääntö poistettu
    expect(css).not.toMatch(/body\[data-role="talkoolainen"\]\s+#app-main\s*\{\s*padding-bottom:\s*84px/)
    // talkoolaiselle #app padding-bottom nollattu (kumoaa globaalin #app 84px)
    expect(css).toMatch(/body\[data-role="talkoolainen"\]\s+#app\s*\{\s*padding-bottom:\s*0/)
  })

  // ---- Mobiili: yläpalkki-säännöt ≤480px ----
  it('mobiili-media-query tiivistää yläpalkin (≤480px)', () => {
    expect(css).toMatch(/@media \(max-width: 480px\)[\s\S]*#toolbar-actions button \{ font-size: 12px/)
  })
})
