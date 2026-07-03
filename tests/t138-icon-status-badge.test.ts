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

describe('T138 — ikoni ei toista tyyppitekstiä (B57)', () => {
  it('custom-mallin shortLabel esiintyy HTML:ssä vain kerran (ei duplikoitu nurkkabadgeen)', () => {
    const html = getHtml('my-custom-type', 'suunniteltu', '#ff0000', 'XY')
    const occurrences = html.split('XY').length - 1
    expect(occurrences).toBe(1)
  })

  it('oletustyyppien vanha kirjain-nurkkabadge (top:16px;right:-4px) on poistettu', () => {
    const html = getHtml('right', 'suunniteltu')
    expect(html).not.toContain('top:16px;right:-4px')
  })
})
