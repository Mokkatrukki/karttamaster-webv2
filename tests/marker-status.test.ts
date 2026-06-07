import { describe, it, expect } from 'vitest'
import {
  transitionStatus,
  canTransition,
  validActions,
  isTerminal,
  DEFAULT_STATUS,
} from '../src/logic/marker-status'
import type { MarkerStatus } from '../src/logic/types'

describe('marker-status: transitionStatus', () => {
  it('suunniteltu → asetettu via aseta', () => {
    expect(transitionStatus('suunniteltu', 'aseta')).toBe('asetettu')
  })

  it('suunniteltu → ei_tarpeen via ohita', () => {
    expect(transitionStatus('suunniteltu', 'ohita')).toBe('ei_tarpeen')
  })

  it('asetettu → tarkistettu via tarkista', () => {
    expect(transitionStatus('asetettu', 'tarkista')).toBe('tarkistettu')
  })

  it('asetettu → suunniteltu via peru', () => {
    expect(transitionStatus('asetettu', 'peru')).toBe('suunniteltu')
  })

  it('tarkistettu → kerätty via kerää', () => {
    expect(transitionStatus('tarkistettu', 'kerää')).toBe('kerätty')
  })

  it('tarkistettu → asetettu via peru', () => {
    expect(transitionStatus('tarkistettu', 'peru')).toBe('asetettu')
  })

  it('ei_tarpeen → suunniteltu via peru', () => {
    expect(transitionStatus('ei_tarpeen', 'peru')).toBe('suunniteltu')
  })

  it('throws on invalid transition', () => {
    expect(() => transitionStatus('suunniteltu', 'tarkista')).toThrow()
    expect(() => transitionStatus('kerätty', 'kerää')).toThrow()
    expect(() => transitionStatus('asetettu', 'ohita')).toThrow()
  })
})

describe('marker-status: canTransition', () => {
  it('returns true for valid transitions', () => {
    expect(canTransition('suunniteltu', 'aseta')).toBe(true)
    expect(canTransition('asetettu', 'tarkista')).toBe(true)
  })

  it('returns false for invalid transitions', () => {
    expect(canTransition('suunniteltu', 'tarkista')).toBe(false)
    expect(canTransition('kerätty', 'aseta')).toBe(false)
  })
})

describe('marker-status: validActions', () => {
  it('suunniteltu has aseta and ohita', () => {
    const actions = validActions('suunniteltu')
    expect(actions).toContain('aseta')
    expect(actions).toContain('ohita')
    expect(actions).toHaveLength(2)
  })

  it('asetettu has tarkista and peru', () => {
    const actions = validActions('asetettu')
    expect(actions).toContain('tarkista')
    expect(actions).toContain('peru')
    expect(actions).toHaveLength(2)
  })

  it('kerätty has no actions', () => {
    expect(validActions('kerätty')).toHaveLength(0)
  })
})

describe('marker-status: isTerminal', () => {
  it('kerätty is terminal', () => {
    expect(isTerminal('kerätty')).toBe(true)
  })

  it('ei_tarpeen is NOT terminal (can be undone)', () => {
    expect(isTerminal('ei_tarpeen')).toBe(false)
  })

  it('suunniteltu is not terminal', () => {
    expect(isTerminal('suunniteltu')).toBe(false)
  })
})

describe('marker-status: DEFAULT_STATUS', () => {
  it('default is suunniteltu', () => {
    expect(DEFAULT_STATUS).toBe('suunniteltu')
  })
})

describe('marker-status: full lifecycle', () => {
  it('happy path: suunniteltu → asetettu → tarkistettu → kerätty', () => {
    let s: MarkerStatus = 'suunniteltu'
    s = transitionStatus(s, 'aseta')
    expect(s).toBe('asetettu')
    s = transitionStatus(s, 'tarkista')
    expect(s).toBe('tarkistettu')
    s = transitionStatus(s, 'kerää')
    expect(s).toBe('kerätty')
    expect(isTerminal(s)).toBe(true)
  })

  it('skip path: suunniteltu → ei_tarpeen → suunniteltu (undo)', () => {
    let s: MarkerStatus = 'suunniteltu'
    s = transitionStatus(s, 'ohita')
    expect(s).toBe('ei_tarpeen')
    s = transitionStatus(s, 'peru')
    expect(s).toBe('suunniteltu')
  })
})
