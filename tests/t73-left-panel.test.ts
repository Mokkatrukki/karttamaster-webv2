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

describe('T179 — LeftPanel onToggle callback (map.invalidateSize hook)', () => {
  let panel: HTMLElement
  let toggleBtn: HTMLButtonElement

  beforeEach(() => {
    panel = document.createElement('div')
    panel.id = 'left-panel'
    const content = document.createElement('div')
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

  it('toggle() invokes onToggle callback', () => {
    let calls = 0
    const lp = new LeftPanel(panel, () => { calls++ })
    lp.toggle()
    expect(calls).toBe(1)
    lp.toggle()
    expect(calls).toBe(2)
  })

  it('open() invokes onToggle only when state actually changes', () => {
    let calls = 0
    const lp = new LeftPanel(panel, () => { calls++ })
    lp.open()
    expect(calls).toBe(0)
    lp.toggle()
    lp.open()
    expect(calls).toBe(2)
  })

  it('constructor does not invoke onToggle on initial render', () => {
    let calls = 0
    new LeftPanel(panel, () => { calls++ })
    expect(calls).toBe(0)
  })

  it('works without onToggle callback (optional param)', () => {
    const lp = new LeftPanel(panel)
    expect(() => lp.toggle()).not.toThrow()
  })
})

describe('T181 — LeftPanel default-collapsed on mobile (V114)', () => {
  let panel: HTMLElement
  let content: HTMLElement
  let toggleBtn: HTMLButtonElement
  let originalWidth: number

  beforeEach(() => {
    originalWidth = window.innerWidth
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
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth })
  })

  it('mobile width (375px) → starts collapsed', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    const lp = new LeftPanel(panel)
    expect(lp.isCollapsed()).toBe(true)
    expect(content.hidden).toBe(true)
  })

  it('breakpoint exact (480px) → still collapsed', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 480 })
    const lp = new LeftPanel(panel)
    expect(lp.isCollapsed()).toBe(true)
  })

  it('desktop width (1280px) → starts open', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 })
    const lp = new LeftPanel(panel)
    expect(lp.isCollapsed()).toBe(false)
    expect(content.hidden).toBe(false)
  })
})
