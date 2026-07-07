import { describe, expect, it } from 'vitest'
import { getIconById, renderIconSvg } from '../src/logic/icon-set'

describe('T159 u-turn icons', () => {
  it('getIconById finds u-turn-right', () => {
    const icon = getIconById('u-turn-right')
    expect(icon).toBeDefined()
    expect(icon?.label).toBe('U-käännös oikea')
  })

  it('getIconById finds u-turn-left', () => {
    const icon = getIconById('u-turn-left')
    expect(icon).toBeDefined()
    expect(icon?.label).toBe('U-käännös vasen')
  })

  it('renderIconSvg produces valid SVG for both', () => {
    for (const id of ['u-turn-right', 'u-turn-left']) {
      const svg = renderIconSvg(id, 24)
      expect(svg).toContain('<svg')
      expect(svg).toContain('viewBox="0 0 24 24"')
      expect(svg).toContain('</svg>')
    }
  })
})
