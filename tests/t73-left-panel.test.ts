import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LeftPanel } from '../src/ui/left-panel'

describe('T73 — LeftPanel toggle', () => {
  let panel: HTMLElement
  let content: HTMLElement
  let toggleBtn: HTMLButtonElement

  beforeEach(() => {
    panel = document.createElement('div')
    panel.id = 'left-panel'
    content = document.createElement('div')
    content.id = 'left-panel-content'
    toggleBtn = document.createElement('button')
    toggleBtn.id = 'left-panel-toggle'
    panel.appendChild(content)
    panel.appendChild(toggleBtn)
    document.body.appendChild(panel)
  })

  afterEach(() => {
    document.body.removeChild(panel)
  })

  it('starts open — content visible, toggle shows ◀', () => {
    const lp = new LeftPanel(panel)
    expect(content.hidden).toBe(false)
    expect(toggleBtn.textContent).toBe('◀')
    expect(lp.isCollapsed()).toBe(false)
  })

  it('toggle click → collapsed — content hidden, toggle shows ▶', () => {
    new LeftPanel(panel)
    toggleBtn.click()
    expect(content.hidden).toBe(true)
    expect(toggleBtn.textContent).toBe('▶')
  })

  it('toggle click twice → back to open', () => {
    new LeftPanel(panel)
    toggleBtn.click()
    toggleBtn.click()
    expect(content.hidden).toBe(false)
    expect(toggleBtn.textContent).toBe('◀')
  })

  it('isCollapsed() reflects state', () => {
    const lp = new LeftPanel(panel)
    expect(lp.isCollapsed()).toBe(false)
    toggleBtn.click()
    expect(lp.isCollapsed()).toBe(true)
    toggleBtn.click()
    expect(lp.isCollapsed()).toBe(false)
  })

  it('open() expands collapsed panel', () => {
    const lp = new LeftPanel(panel)
    toggleBtn.click()
    expect(lp.isCollapsed()).toBe(true)
    lp.open()
    expect(content.hidden).toBe(false)
    expect(lp.isCollapsed()).toBe(false)
    expect(toggleBtn.textContent).toBe('◀')
  })

  it('open() is no-op when already open', () => {
    const lp = new LeftPanel(panel)
    lp.open()
    expect(content.hidden).toBe(false)
    expect(lp.isCollapsed()).toBe(false)
  })

  it('toggle() method collapses and expands', () => {
    const lp = new LeftPanel(panel)
    lp.toggle()
    expect(lp.isCollapsed()).toBe(true)
    expect(content.hidden).toBe(true)
    lp.toggle()
    expect(lp.isCollapsed()).toBe(false)
    expect(content.hidden).toBe(false)
  })

  it('collapsed → aria-label is "Avaa paneeli"', () => {
    new LeftPanel(panel)
    toggleBtn.click()
    expect(toggleBtn.getAttribute('aria-label')).toBe('Avaa paneeli')
  })

  it('open → aria-label is "Sulje paneeli"', () => {
    new LeftPanel(panel)
    expect(toggleBtn.getAttribute('aria-label')).toBe('Sulje paneeli')
  })
})
