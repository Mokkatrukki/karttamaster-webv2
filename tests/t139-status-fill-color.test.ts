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

describe('T139 — statusväri koko ympyrälle, ei vain pieneen badgeen (B58/V86)', () => {
  it('asetettu → vihreä täyttö #22c55e', () => {
    expect(getHtml('right', 'asetettu')).toContain('fill="#22c55e"')
  })

  it('tarkistettu → sininen täyttö #0ea5e9', () => {
    expect(getHtml('left', 'tarkistettu')).toContain('fill="#0ea5e9"')
  })

  it('kerätty → violetti täyttö #8b5cf6', () => {
    expect(getHtml('right', 'kerätty')).toContain('fill="#8b5cf6"')
  })

  it('ei_tarpeen → harmaa täyttö #78716c', () => {
    expect(getHtml('right', 'ei_tarpeen')).toContain('fill="#78716c"')
  })

  it('asetettu/tarkistettu/kerätty ovat kaikki eri väriset keskenään', () => {
    const asetettu = getHtml('right', 'asetettu')
    const tarkistettu = getHtml('right', 'tarkistettu')
    const kerätty = getHtml('right', 'kerätty')
    const colors = new Set(
      [asetettu, tarkistettu, kerätty].map(h => h.match(/fill="(#[0-9a-f]{6})" stroke="white" stroke-width="2"\/>/)?.[1])
    )
    expect(colors.size).toBe(3)
  })

  it('suunniteltu säilyttää tyyppivärin (ei statusväriä) — ennallaan', () => {
    const html = getHtml('right', 'suunniteltu')
    expect(html).toContain('fill="#16a34a" fill-opacity="0.55"')
  })

  it('kerätty näyttää ison ✓-glyfin tyyppi-ikonin/nuolen sijaan', () => {
    const html = getHtml('right', 'kerätty')
    expect(html).toContain('✓')
    expect(html).not.toContain('>→<')
  })

  it('ei_tarpeen näyttää ison ✕-glyfin', () => {
    const html = getHtml('right', 'ei_tarpeen')
    expect(html).toContain('✕')
  })

  it('asetettu ja tarkistettu säilyttävät tyyppi-ikonin/nuolen (ei terminaalitila)', () => {
    expect(getHtml('right', 'asetettu')).toContain('>→<')
    expect(getHtml('left', 'tarkistettu')).toContain('>←<')
  })
})
