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
  it('asetettu → reunus vihreä #22c55e, täyttö silti tyyppiväri', () => {
    const html = getHtml('right', 'asetettu')
    expect(html).toContain('stroke="#22c55e"')
    expect(html).toContain('fill="#16a34a"')
  })

  it('tarkistettu → reunus sininen #0ea5e9, täyttö tyyppiväri', () => {
    const html = getHtml('left', 'tarkistettu')
    expect(html).toContain('stroke="#0ea5e9"')
    expect(html).toContain('fill="#2563eb"')
  })

  it('kerätty → reunus violetti #8b5cf6, täyttö tyyppiväri', () => {
    const html = getHtml('right', 'kerätty')
    expect(html).toContain('stroke="#8b5cf6"')
    expect(html).toContain('fill="#16a34a"')
  })

  it('ei_tarpeen → reunus harmaa #78716c, täyttö tyyppiväri', () => {
    const html = getHtml('right', 'ei_tarpeen')
    expect(html).toContain('stroke="#78716c"')
  })

  it('asetettu/tarkistettu/kerätty ovat eri reunusväriset keskenään', () => {
    const colors = ['asetettu', 'tarkistettu', 'kerätty'].map(s =>
      getHtml('right', s as any).match(/stroke="(#[0-9a-f]{6})" stroke-width="4"/)?.[1]
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
