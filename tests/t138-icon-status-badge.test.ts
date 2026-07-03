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

describe('T138 — ikoni ei toista tyyppitekstiä + selkeämpi statusbadge (B57/V85)', () => {
  it('custom-mallin shortLabel esiintyy HTML:ssä vain kerran (ei duplikoitu nurkkabadgeen)', () => {
    const html = getHtml('my-custom-type', 'suunniteltu', '#ff0000', 'XY')
    const occurrences = html.split('XY').length - 1
    expect(occurrences).toBe(1)
  })

  it('oletustyyppien vanha kirjain-nurkkabadge (top:16px;right:-4px) on poistettu', () => {
    const html = getHtml('right', 'suunniteltu')
    expect(html).not.toContain('top:16px;right:-4px')
  })

  it('asetettu-status näyttää ✓-glyfin statusbadgessa', () => {
    const html = getHtml('right', 'asetettu')
    expect(html).toContain('✓')
  })

  it('ei_tarpeen-status näyttää ✕-glyfin', () => {
    const html = getHtml('right', 'ei_tarpeen')
    expect(html).toContain('✕')
  })

  it('suunniteltu-status ei näytä statusbadgea (dasharray-ympyrä riittää, V51)', () => {
    const html = getHtml('right', 'suunniteltu')
    expect(html).not.toContain('✓')
    expect(html).not.toContain('✕')
  })

  it('statusbadge on isompi kuin entinen 8px piste (16px, kontrastia varten)', () => {
    const html = getHtml('right', 'asetettu')
    expect(html).toContain('width:16px;height:16px')
  })
})
