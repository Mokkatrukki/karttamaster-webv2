import { describe, it, expect, afterEach } from 'vitest'
import { MapStateBadge, showMapNotReadyBanner } from '../src/ui/map-state-badge'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('MapStateBadge — approval concept removed', () => {
  it('constructor does not throw for järjestäjä', () => {
    document.body.innerHTML = '<div id="toolbar"><button id="btn-layer">MML</button></div>'
    const toolbar = document.getElementById('toolbar') as HTMLElement
    expect(() => new MapStateBadge(toolbar, 'järjestäjä')).not.toThrow()
  })

  it('constructor does not throw for talkoolainen', () => {
    document.body.innerHTML = '<div id="toolbar"></div>'
    const toolbar = document.getElementById('toolbar') as HTMLElement
    expect(() => new MapStateBadge(toolbar, 'talkoolainen')).not.toThrow()
  })

  it('constructor does not throw for admin', () => {
    document.body.innerHTML = '<div id="toolbar"></div>'
    const toolbar = document.getElementById('toolbar') as HTMLElement
    expect(() => new MapStateBadge(toolbar, 'admin')).not.toThrow()
  })

  it('refresh() resolves without throwing', async () => {
    document.body.innerHTML = '<div id="toolbar"></div>'
    const badge = new MapStateBadge(document.getElementById('toolbar')!, 'järjestäjä')
    await expect(badge.refresh()).resolves.not.toThrow()
  })

  it('update() does not throw', () => {
    document.body.innerHTML = '<div id="toolbar"></div>'
    const badge = new MapStateBadge(document.getElementById('toolbar')!, 'järjestäjä')
    expect(() => badge.update('luonnos')).not.toThrow()
    expect(() => badge.update('hyväksytty')).not.toThrow()
  })
})

describe('showMapNotReadyBanner', () => {
  it('does not throw', () => {
    expect(() => showMapNotReadyBanner()).not.toThrow()
  })
})
