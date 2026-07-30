// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { createGpsControl } from '../src/ui/gps-control'
import type { GpsControlState } from '../src/logic/gps-follow'

// T407/V294 — Taso 2 (Vitest-jsdom): kartan GPS-kontrolli on SEKÄ laukaisin ETTÄ tilanäyttö.
// Mitä tämä vahtii: että napautuksen merkitys seuraa tilaa. Jos ne ajautuvat erilleen,
// talkoolainen sammuttaa paikannuksen yrittäessään keskittää kartan — metsässä.

const ALL: GpsControlState[] = ['pois', 'haetaan', 'seuraa', 'vapaa']

describe('T407/V294 — neljä tilaa erottuvat sanoin', () => {
  it('jokainen tila antaa oman tekstin ja oman luokan', () => {
    const c = createGpsControl({ onTap: vi.fn() })
    const seen = ALL.map(s => { c.setState(s); return [c.el.textContent, c.el.className] as const })
    expect(new Set(seen.map(x => x[0])).size).toBe(4)
    expect(new Set(seen.map(x => x[1])).size).toBe(4)
  })

  it('setState on idempotentti — luokkalista ei kasva toistokutsuilla', () => {
    const c = createGpsControl({ onTap: vi.fn() })
    c.setState('seuraa')
    const first = c.el.className
    c.setState('seuraa'); c.setState('seuraa')
    expect(c.el.className).toBe(first)
  })

  it('tilanvaihto ei jätä edellisen tilan luokkaa roikkumaan', () => {
    const c = createGpsControl({ onTap: vi.fn() })
    c.setState('seuraa')
    c.setState('pois')
    expect(c.el.classList.contains('gps-control--seuraa')).toBe(false)
    expect(c.el.classList.contains('gps-control--pois')).toBe(true)
  })

  it('aria-pressed on tosi VAIN seuranta-tilassa (vapaa = päällä muttei seuraa)', () => {
    const c = createGpsControl({ onTap: vi.fn() })
    c.setState('seuraa')
    expect(c.el.getAttribute('aria-pressed')).toBe('true')
    c.setState('vapaa')
    expect(c.el.getAttribute('aria-pressed')).toBe('false')
  })

  it('näkyvä teksti on saavutettava nimi — ⊥ ristiriitaista aria-labelia (V197)', () => {
    const c = createGpsControl({ onTap: vi.fn() })
    ALL.forEach(s => {
      c.setState(s)
      expect(c.el.hasAttribute('aria-label')).toBe(false)
      expect(c.el.title.length).toBeGreaterThan(0)
    })
  })
})

describe('T407/V294 — napautuksen merkitys seuraa tilaa', () => {
  const tapIn = (state: GpsControlState): string | undefined => {
    const onTap = vi.fn()
    const c = createGpsControl({ onTap })
    c.setState(state)
    c.el.click()
    return onTap.mock.calls[0]?.[0]
  }

  it('pois → start, vapaa → recenter, seuraa → stop, haetaan → stop (peruminen)', () => {
    expect(tapIn('pois')).toBe('start')
    expect(tapIn('vapaa')).toBe('recenter')
    expect(tapIn('seuraa')).toBe('stop')
    expect(tapIn('haetaan')).toBe('stop')
  })

  it('napautus ei koskaan ole kuollut — jokainen tila tuottaa toiminnon', () => {
    ALL.forEach(s => expect(tapIn(s)).toBeTruthy())
  })
})

describe('T407 — hero väistetään mitatulla korkeudella, ei arvauksella', () => {
  it('ilman heroa ei aseteta bottom-muuttujaa (CSS-oletus 8px jää voimaan)', () => {
    const c = createGpsControl({ onTap: vi.fn() })
    c.observeHero(null)
    expect(c.el.style.getPropertyValue('--gps-control-bottom')).toBe('')
  })

  it('hero jonka korkeus on 0 (koti-moodi, piilotettu) ei työnnä nappia ylös', () => {
    const observe = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(_cb: () => void) { /* apply ajetaan synkronisesti createssa */ }
      observe = observe
      disconnect = vi.fn()
    })
    const hero = document.createElement('div') // jsdom: offsetHeight = 0
    const c = createGpsControl({ onTap: vi.fn() })
    c.observeHero(hero)
    expect(observe).toHaveBeenCalledWith(hero)
    expect(c.el.style.getPropertyValue('--gps-control-bottom')).toBe('')
    vi.unstubAllGlobals()
  })

  it('mitattu hero-korkeus + 16px päätyy muuttujaan', () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(_cb: () => void) {}
      observe = vi.fn()
      disconnect = vi.fn()
    })
    const hero = document.createElement('div')
    Object.defineProperty(hero, 'offsetHeight', { value: 180, configurable: true })
    const c = createGpsControl({ onTap: vi.fn() })
    c.observeHero(hero)
    expect(c.el.style.getPropertyValue('--gps-control-bottom')).toBe('196px')
    vi.unstubAllGlobals()
  })

  it('destroy irrottaa tarkkailijan ja elementin (⊥ vuotavaa ResizeObserveria)', () => {
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(_cb: () => void) {}
      observe = vi.fn()
      disconnect = disconnect
    })
    const c = createGpsControl({ onTap: vi.fn() })
    document.body.appendChild(c.el)
    c.observeHero(document.createElement('div'))
    c.destroy()
    expect(disconnect).toHaveBeenCalled()
    expect(c.el.isConnected).toBe(false)
    vi.unstubAllGlobals()
  })
})
