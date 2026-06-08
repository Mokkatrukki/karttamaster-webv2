import { describe, it, expect, vi } from 'vitest'

vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts: { html: string; className: string; iconSize: number[]; iconAnchor: number[] }) => opts,
  },
}))

import { createSignIcon } from '../src/map/icons'

function getHtml(type: Parameters<typeof createSignIcon>[0], status: Parameters<typeof createSignIcon>[2]): string {
  const icon = createSignIcon(type, 0, status) as unknown as { html: string }
  return icon.html
}

describe('T23: createSignIcon status-visualisointi', () => {
  describe('opacity', () => {
    it('suunniteltu → opacity 0.45', () => {
      expect(getHtml('right', 'suunniteltu')).toContain('opacity:0.45')
    })

    it('asetettu → opacity 1', () => {
      const html = getHtml('right', 'asetettu')
      expect(html).toContain('opacity:1')
      expect(html).not.toContain('opacity:0.45')
    })

    it('tarkistettu → opacity 1', () => {
      expect(getHtml('left', 'tarkistettu')).toContain('opacity:1')
    })

    it('kerätty → opacity 1', () => {
      expect(getHtml('upcoming-right', 'kerätty')).toContain('opacity:1')
    })

    it('ei_tarpeen → opacity 1', () => {
      expect(getHtml('upcoming-left', 'ei_tarpeen')).toContain('opacity:1')
    })
  })

  describe('status-piste', () => {
    it('suunniteltu → ei status-pistettä', () => {
      const html = getHtml('right', 'suunniteltu')
      expect(html).not.toContain('#4ade80')
      expect(html).not.toContain('#93c5fd')
      expect(html).not.toContain('#fbbf24')
      expect(html).not.toContain('#6ee7b7')
    })

    it('asetettu → vihreä piste #4ade80', () => {
      expect(getHtml('right', 'asetettu')).toContain('#4ade80')
    })

    it('tarkistettu → sininen piste #93c5fd', () => {
      expect(getHtml('left', 'tarkistettu')).toContain('#93c5fd')
    })

    it('kerätty → mint piste #6ee7b7', () => {
      expect(getHtml('upcoming-right', 'kerätty')).toContain('#6ee7b7')
    })

    it('ei_tarpeen → keltainen piste #fbbf24', () => {
      expect(getHtml('upcoming-left', 'ei_tarpeen')).toContain('#fbbf24')
    })
  })

  describe('default status', () => {
    it('ilman status-param → suunniteltu (opacity 0.45)', () => {
      const icon = createSignIcon('right', 0) as unknown as { html: string }
      expect(icon.html).toContain('opacity:0.45')
    })
  })

  describe('tyyppiväri säilyy', () => {
    it('right → vihreä #16a34a statuksesta riippumatta', () => {
      expect(getHtml('right', 'suunniteltu')).toContain('#16a34a')
      expect(getHtml('right', 'asetettu')).toContain('#16a34a')
    })

    it('left → sininen #2563eb', () => {
      expect(getHtml('left', 'tarkistettu')).toContain('#2563eb')
    })
  })
})
