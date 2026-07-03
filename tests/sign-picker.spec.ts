import { describe, it, expect } from 'vitest'
import { positionPicker } from '../src/logic/sign-picker'
import { createSignIcon } from '../src/map/icons'

describe('positionPicker — viewport-aware placement', () => {
  it('prefers 20px below click when space available', () => {
    const pos = positionPicker(200, 300, 160, 120, 800, 600)
    expect(pos.y).toBeCloseTo(320, 0)
    expect(pos.x).toBeCloseTo(200, 10)
  })

  it('shifts up when too close to bottom', () => {
    const pos = positionPicker(200, 560, 160, 120, 800, 600)
    expect(pos.y + 120).toBeLessThanOrEqual(600)
  })

  it('shifts right when too close to left edge', () => {
    const pos = positionPicker(10, 300, 160, 120, 800, 600)
    expect(pos.x).toBeGreaterThanOrEqual(0)
  })

  it('shifts left when too close to right edge', () => {
    const pos = positionPicker(780, 300, 160, 120, 800, 600)
    expect(pos.x + 160).toBeLessThanOrEqual(800)
  })

  it('corner case: bottom-right shifts diagonally up-left', () => {
    const pos = positionPicker(780, 560, 160, 120, 800, 600)
    expect(pos.x + 160).toBeLessThanOrEqual(800)
    expect(pos.y + 120).toBeLessThanOrEqual(600)
  })
})

describe('Sign icons — all 4 types', () => {
  // T138/V85: kirjain-nurkkabadge poistettu (duplikoi tyyppitekstin) — nuolisymboli ympyrässä riittää tyypin tunnistamiseen
  it('right icon contains → arrow', () => {
    const icon = createSignIcon('right', 'suunniteltu')
    expect((icon.options as any).html).toContain('→')
  })

  it('left icon contains ← arrow', () => {
    const icon = createSignIcon('left', 'suunniteltu')
    expect((icon.options as any).html).toContain('←')
  })

  it('upcoming-right icon renders without error', () => {
    const icon = createSignIcon('upcoming-right', 45)
    expect((icon.options as any).html).toBeTruthy()
  })

  it('upcoming-left icon renders without error', () => {
    const icon = createSignIcon('upcoming-left', 45)
    expect((icon.options as any).html).toBeTruthy()
  })

  it('icons are no wider than 32px', () => {
    for (const type of ['left', 'right', 'upcoming-left', 'upcoming-right'] as const) {
      const icon = createSignIcon(type, 0)
      const size = (icon.options as any).iconSize
      expect(size[0]).toBeLessThanOrEqual(32)
    }
  })
})

describe('Floating sign picker — dblclick flow', () => {
  it.todo('dblclick on map opens floating picker ~20px below click point')
  it.todo('picker position adapts when near viewport edges (shifts diagonally)')
  it.todo('clicking sign type in picker places marker at dblclick coords')
  it.todo('rotation mode activates immediately after placement')
  it.todo('picker closes after type selection')
  it.todo('Escape closes picker without placing marker')
  it.todo('clicking outside picker closes it without placing marker')
})

describe('"Merkit" toolbar dropdown flow', () => {
  it.todo('"Merkit" button exists in toolbar; old btn-add-right/btn-add-left absent')
  it.todo('clicking "Merkit" opens sign type dropdown below button')
  it.todo('dropdown shows all 4 sign types')
  it.todo('selecting type enters place-mode (cursor changes to crosshair)')
  it.todo('map click in place-mode places marker at click coords')
  it.todo('new marker appears highlighted in marker list after placement')
  it.todo('rotation mode activates immediately after map click placement')
  it.todo('Escape in place-mode cancels without placing')
  it.todo('clicking outside dropdown closes without entering place-mode')
})
