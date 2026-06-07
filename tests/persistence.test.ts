import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveMarkers, loadMarkers } from '../src/logic/persistence'
import type { SignMarker } from '../src/logic/types'

const MARKER: SignMarker = {
  id: 'test-id',
  type: 'right',
  lat: 61.0,
  lon: 25.0,
  bearing: 90,
  distanceFromStart: 1000,
  routeIds: ['35km'],
}

const LS_KEY = 'karttamaster-markers'

// Minimal localStorage mock (Node v26 native localStorage is undefined/experimental)
function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorageMock())
})

describe('saveMarkers', () => {
  it('writes version:1 + markers to localStorage', () => {
    saveMarkers([MARKER])
    const raw = localStorage.getItem(LS_KEY)!
    const data = JSON.parse(raw)
    expect(data.version).toBe(1)
    expect(data.markers).toHaveLength(1)
    expect(data.markers[0].id).toBe('test-id')
  })

  it('overwrites previous data', () => {
    saveMarkers([MARKER])
    saveMarkers([])
    const data = JSON.parse(localStorage.getItem(LS_KEY)!)
    expect(data.markers).toHaveLength(0)
  })
})

describe('loadMarkers', () => {
  it('returns [] when localStorage empty', () => {
    expect(loadMarkers()).toEqual([])
  })

  it('returns saved markers', () => {
    saveMarkers([MARKER])
    const result = loadMarkers()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('test-id')
  })

  it('returns [] and removes key on corrupt JSON (V14)', () => {
    localStorage.setItem(LS_KEY, 'not-json{{{')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = loadMarkers()
    expect(result).toEqual([])
    expect(localStorage.getItem(LS_KEY)).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns [] and removes key on wrong version (V14)', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 99, markers: [MARKER] }))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = loadMarkers()
    expect(result).toEqual([])
    expect(localStorage.getItem(LS_KEY)).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns [] and removes key when markers is not array (V14)', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 1, markers: 'bad' }))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = loadMarkers()
    expect(result).toEqual([])
    expect(localStorage.getItem(LS_KEY)).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('preserves routeIds even if route no longer exists in app', () => {
    const m = { ...MARKER, routeIds: ['deleted-route'] }
    saveMarkers([m])
    const result = loadMarkers()
    expect(result[0].routeIds).toEqual(['deleted-route'])
  })
})
