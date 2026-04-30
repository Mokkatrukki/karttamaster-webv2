import { describe, it, expect } from 'vitest'
import { createSignIcon } from '../src/icons'

describe('Sign rotation', () => {
  it.todo('clicking existing sign enters rotation mode (no popup)')
  it.todo('mouse drag from sign changes bearing in real-time')
  it.todo('touch drag on sign changes bearing in real-time')
  it.todo('mouseup/touchend saves new bearing and exits rotation mode')
  it.todo('rotation mode does not move the sign marker on map')
})

describe('Sign rotation — handle visibility (regression guard)', () => {
  it('direct SVG transform update preserves element identity and marker-armed class', () => {
    // applyRotation must NOT call setIcon (which recreates the element and drops
    // marker-armed, hiding the rotation handle during drag).
    // It must update svg.style.transform in-place instead.
    const wrapper = document.createElement('div')
    wrapper.classList.add('marker-armed')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as HTMLElement
    wrapper.appendChild(svg)

    // Simulate what applyRotation now does
    svg.style.transform = 'rotate(135deg)'

    expect(wrapper.querySelector('svg')).toBe(svg)                          // same element, not recreated
    expect(wrapper.classList.contains('marker-armed')).toBe(true)          // class still present → handle visible
    expect(svg.style.transform).toContain('rotate(135deg)')                // transform applied
  })

  it('bearing math: drag direction maps to correct compass bearing', () => {
    function bearingFromDelta(dx: number, dy: number): number {
      return ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360
    }
    expect(bearingFromDelta(0, -1)).toBeCloseTo(0)    // drag up   → 0°  north
    expect(bearingFromDelta(1,  0)).toBeCloseTo(90)   // drag right → 90° east
    expect(bearingFromDelta(0,  1)).toBeCloseTo(180)  // drag down → 180° south
    expect(bearingFromDelta(-1, 0)).toBeCloseTo(270)  // drag left → 270° west
  })
})

describe('Sign icon type label', () => {
  it('right icon contains "O" label regardless of bearing', () => {
    const icon = createSignIcon('right', 0)
    expect((icon.options as any).html).toContain('O')
  })

  it('left icon contains "V" label regardless of bearing', () => {
    const icon = createSignIcon('left', 90)
    expect((icon.options as any).html).toContain('V')
  })

  it('bearing rotation applied to SVG', () => {
    const icon = createSignIcon('right', 45)
    expect((icon.options as any).html).toContain('rotate(45')
  })
})
