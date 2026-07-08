import { describe, it, expect, vi } from 'vitest'

vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts: { html: string }) => opts,
  },
}))

import { createSignIcon } from '../src/map/icons'

function getHtml(...args: Parameters<typeof createSignIcon>): string {
  return (createSignIcon(...args) as unknown as { html: string }).html
}

describe('T140 — statusväri ulkoreunassa, täyttö pysyy tyyppikuvana (B59/V87)', () => {
  // V132/T202: statusvärit Reittimerkki-palettiin, tyyppivärit uuteen palettiin.
  it('asetettu → reunus vihreä #2FA35B, täyttö silti tyyppiväri', () => {
    const html = getHtml('right', 'asetettu')
    expect(html).toContain('stroke="#2FA35B"')
    expect(html).toContain('fill="#16A34A"')
  })

  it('tarkistettu → reunus sininen #3B82C4, täyttö tyyppiväri', () => {
    const html = getHtml('left', 'tarkistettu')
    expect(html).toContain('stroke="#3B82C4"')
    expect(html).toContain('fill="#2563EB"')
  })

  it('kerätty → reunus violetti #8A5CD1, täyttö tyyppiväri', () => {
    const html = getHtml('right', 'kerätty')
    expect(html).toContain('stroke="#8A5CD1"')
    expect(html).toContain('fill="#16A34A"')
  })

  it('ei_tarpeen → reunus kulta #C9922E, täyttö tyyppiväri', () => {
    const html = getHtml('right', 'ei_tarpeen')
    expect(html).toContain('stroke="#C9922E"')
  })

  it('asetettu/tarkistettu/kerätty ovat eri reunusväriset keskenään', () => {
    const colors = ['asetettu', 'tarkistettu', 'kerätty'].map(s =>
      getHtml('right', s as any).match(/stroke="(#[0-9a-fA-F]{6})" stroke-width="4"/)?.[1]
    )
    expect(new Set(colors).size).toBe(3)
  })

  it('kerätty näyttää tyyppi-ikonin/nuolen edelleen (ei ✓-glyfikorvausta, B59)', () => {
    const html = getHtml('right', 'kerätty')
    expect(html).toContain('>→<')
    expect(html).not.toContain('✓')
  })

  it('ei_tarpeen näyttää tyyppi-ikonin/nuolen edelleen (ei ✕-glyfikorvausta, B59)', () => {
    const html = getHtml('left', 'ei_tarpeen')
    expect(html).toContain('>←<')
    expect(html).not.toContain('✕')
  })

  it('suunniteltu säilyttää valkoisen dashed-reunan (ei statusreunusta)', () => {
    const html = getHtml('right', 'suunniteltu')
    expect(html).toContain('stroke="white" stroke-width="2" stroke-dasharray="4 2"')
  })
})
