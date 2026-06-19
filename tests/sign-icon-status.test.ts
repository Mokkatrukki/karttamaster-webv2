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
  describe('V51: suunniteltu-erottelu (dasharray + fill-opacity)', () => {
    it('suunniteltu → stroke-dasharray "4 2"', () => {
      expect(getHtml('right', 'suunniteltu')).toContain('stroke-dasharray="4 2"')
    })

    it('suunniteltu → fill-opacity 0.55', () => {
      expect(getHtml('right', 'suunniteltu')).toContain('fill-opacity="0.55"')
    })

    it('suunniteltu → ei opacity:0.45 wrapperissa', () => {
      expect(getHtml('right', 'suunniteltu')).not.toContain('opacity:0.45')
    })

    it('asetettu → ei stroke-dasharray', () => {
      expect(getHtml('right', 'asetettu')).not.toContain('stroke-dasharray')
    })

    it('asetettu → ei fill-opacity 0.55', () => {
      expect(getHtml('right', 'asetettu')).not.toContain('fill-opacity="0.55"')
    })

    it('tarkistettu → ei stroke-dasharray', () => {
      expect(getHtml('left', 'tarkistettu')).not.toContain('stroke-dasharray')
    })

    it('kerätty → ei stroke-dasharray', () => {
      expect(getHtml('right', 'kerätty')).not.toContain('stroke-dasharray')
    })

    it('ei_tarpeen → ei stroke-dasharray', () => {
      expect(getHtml('right', 'ei_tarpeen')).not.toContain('stroke-dasharray')
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
    it('ilman status-param → suunniteltu (stroke-dasharray)', () => {
      const icon = createSignIcon('right', 0) as unknown as { html: string }
      expect(icon.html).toContain('stroke-dasharray="4 2"')
    })
  })

  describe('T84: custom type — fallback color/shortLabel', () => {
    it('tuntematon type käyttää fallback-väriä #94a3b8', () => {
      const html = getHtml('custom-uuid-123', 'suunniteltu')
      expect(html).toContain('#94a3b8')
    })

    it('tuntematon type käyttää shortLabel "?"', () => {
      const html = getHtml('custom-uuid-123', 'suunniteltu')
      expect(html).toContain('?')
    })

    it('custom type: color override toimii', () => {
      const icon = createSignIcon('my-type', 0, 'suunniteltu', '#ff0000', 'X') as unknown as { html: string }
      expect(icon.html).toContain('#ff0000')
      expect(icon.html).toContain('X')
    })

    it('custom type asetettu: ei stroke-dasharray (vain suunniteltu saa dasharray)', () => {
      const html = getHtml('custom-type', 'asetettu')
      expect(html).not.toContain('stroke-dasharray')
    })
  })
})

describe('T70: teardrop-ikoni', () => {
  function getIcon(type: Parameters<typeof createSignIcon>[0] = 'right') {
    return createSignIcon(type, 0, 'suunniteltu') as unknown as {
      html: string
      iconSize: number[]
      iconAnchor: number[]
      popupAnchor: number[]
    }
  }

  it('iconSize on [32, 52]', () => {
    const icon = getIcon()
    expect(icon.iconSize).toEqual([32, 52])
  })

  it('iconAnchor on kärjen kärki [16, 52]', () => {
    const icon = getIcon()
    expect(icon.iconAnchor).toEqual([16, 52])
  })

  it('popupAnchor avautuu kärjen yläpuolelle [0, -56]', () => {
    const icon = getIcon()
    expect(icon.popupAnchor).toEqual([0, -56])
  })

  it('HTML sisältää kiinteän tip-SVG:n (ei rotoi)', () => {
    const html = getIcon().html
    expect(html).toContain('M8,0 L16,10 L24,0 Z')
    expect(html).toContain('position:absolute;bottom:0;left:0')
  })

  it('tip-SVG väri vastaa tyyppiväriä (right=vihreä)', () => {
    const html = getIcon('right').html
    const tipIdx = html.indexOf('M8,0 L16,10 L24,0 Z')
    const tipContext = html.slice(tipIdx, tipIdx + 80)
    expect(tipContext).toContain('#16a34a')
  })

  it('status-piste ei ole tip-alueella (bottom:12px eikä bottom:2px)', () => {
    const html = createSignIcon('right', 0, 'asetettu') as unknown as { html: string }
    expect(html.html).toContain('bottom:12px')
    expect(html.html).not.toContain('bottom:2px')
  })

  it('kaikki 4 tyyppiä renderoituvat virheettä', () => {
    for (const type of ['right', 'left', 'upcoming-right', 'upcoming-left'] as const) {
      const icon = createSignIcon(type, 45, 'asetettu') as unknown as { html: string }
      expect(icon.html).toContain('M8,0 L16,10 L24,0 Z')
    }
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
