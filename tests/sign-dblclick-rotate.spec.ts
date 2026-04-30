import { describe, it, expect } from 'vitest'
import { createSignIcon } from '../src/icons'

describe('Sign placement — double-click flow', () => {
  it.todo('double-click on map opens bottom panel sign picker')
  it.todo('bottom panel shows "Lisää kyltti" heading')
  it.todo('clicking ← in panel places sign at dblclick coordinates and closes panel')
  it.todo('clicking → in panel places sign at dblclick coordinates and closes panel')
  it.todo('Escape closes panel without placing sign')
  it.todo('clicking outside panel closes panel without placing sign')
  it.todo('addMode does not trigger when double-clicking (no extra sign placed)')
})

describe('Sign rotation', () => {
  it.todo('clicking existing sign enters rotation mode (no popup)')
  it.todo('mouse drag from sign changes bearing in real-time')
  it.todo('touch drag on sign changes bearing in real-time')
  it.todo('mouseup/touchend saves new bearing and exits rotation mode')
  it.todo('rotation mode does not move the sign marker on map')
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
