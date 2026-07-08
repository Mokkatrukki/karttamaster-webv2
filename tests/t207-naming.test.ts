import { describe, it, expect } from 'vitest'

// T207/V133: käyttäjänäkyvät tekstit käyttäjän kielelle (ei DOM-id:eitä).
// Luetaan lähdetiedostot suoraan ja varmistetaan uudet nimet.

function read(rel: string): string {
  const fs = require('fs')
  const path = require('path')
  return fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8')
}

describe('T207 — käyttäjänäkyvät nimet', () => {
  const html = read('index.html')

  it('#btn-list → "Kaikki merkit" (ei "Lista")', () => {
    expect(html).toMatch(/<button id="btn-list">Kaikki merkit<\/button>/)
    expect(html).not.toMatch(/<button id="btn-list">Lista<\/button>/)
  })

  it('#btn-gpkg-export/import → "Vie/Tuo kartta-aineisto" (ei "GPKG")', () => {
    expect(html).toContain('>Vie kartta-aineisto</a>')
    expect(html).toContain('>Tuo kartta-aineisto</button>')
    expect(html).not.toContain('Vie GPKG')
    expect(html).not.toContain('Tuo GPKG')
  })

  it('.left-panel-section-title → "Suunnittelu" (ei "Työkalut")', () => {
    expect(html).toMatch(/left-panel-section-title">Suunnittelu</)
    expect(html).not.toMatch(/left-panel-section-title">Työkalut</)
  })

  it('SegmentPanel-otsikko → "Reittipätkät" (ei "Pätkäjako")', () => {
    const src = read('src/ui/segment-panel.ts')
    expect(src).toContain('Reittipätkät')
    expect(src).not.toContain('Pätkäjako')
  })

  it('#btn-layer → kiinteä "Karttatyyli" (ei vaihtuva karttakerroksen nimi)', () => {
    const src = read('src/app/map-init.ts')
    expect(src).toContain("btnLayer.textContent = 'Karttatyyli'")
    expect(src).not.toContain('btnLayer.textContent = TILE_LAYERS')
    expect(src).not.toContain('btnLayer.textContent = cfg.label')
  })
})
