import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock leaflet before importing AreaOverlay
vi.mock('leaflet', () => {
  const makeTooltip = () => ({ getElement: () => null })
  const makePolygon = () => {
    const tooltipSpy = vi.fn()
    const poly = {
      on: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      bindTooltip: tooltipSpy,
      getTooltip: vi.fn().mockReturnValue(makeTooltip()),
      remove: vi.fn(),
    }
    return poly
  }
  const makeMarker = () => ({
    on: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    getLatLng: vi.fn().mockReturnValue({ lat: 0, lng: 0 }),
  })
  return {
    default: {
      polygon: vi.fn(() => makePolygon()),
      marker: vi.fn(() => makeMarker()),
      divIcon: vi.fn(() => ({})),
      DomEvent: { stopPropagation: vi.fn() },
    },
  }
})

import type { AreaMarker } from '../src/logic/area-types'

const makeArea = (featureName?: string): AreaMarker => ({
  id: 'area-1',
  name: 'Huoltopiste',
  centerLat: 63.8,
  centerLng: 28.2,
  widthM: 60,
  heightM: 40,
  rotation: 0,
  markdownDescription: '',
  hashCode: 'abc123',
  status: 'suunniteltu',
  features: featureName !== undefined
    ? [{
        id: 'feat-1',
        name: featureName || undefined,
        centerLat: 63.8001,
        centerLng: 28.2001,
        widthM: 10,
        heightM: 5,
        rotation: 0,
        color: '#4ade80',
      }]
    : [],
})

function makeMap(zoom = 14) {
  return {
    on: vi.fn(),
    getZoom: vi.fn().mockReturnValue(zoom),
  } as unknown as import('leaflet').Map
}

describe('T120 — AreaFeature karttanimet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('feature jolla name → bindTooltip kutsutaan permanent:true', async () => {
    const L = (await import('leaflet')).default
    const { AreaOverlay } = await import('../src/map/area-overlay')
    const overlay = new AreaOverlay(makeMap())
    overlay.update([makeArea('Tarjoilupöytä')])

    // L.polygon called at least twice: main area + feature
    const calls = (L.polygon as ReturnType<typeof vi.fn>).mock.results
    const featurePoly = calls[calls.length - 1].value
    expect(featurePoly.bindTooltip).toHaveBeenCalledWith(
      'Tarjoilupöytä',
      expect.objectContaining({ permanent: true }),
    )
  })

  it('feature ilman name → bindTooltip EI kutsuta feature-polygonille', async () => {
    const L = (await import('leaflet')).default
    const { AreaOverlay } = await import('../src/map/area-overlay')
    const overlay = new AreaOverlay(makeMap())
    const area = makeArea('')  // empty name = falsy
    area.features[0].name = undefined
    overlay.update([area])

    const calls = (L.polygon as ReturnType<typeof vi.fn>).mock.results
    const featurePoly = calls[calls.length - 1].value
    expect(featurePoly.bindTooltip).not.toHaveBeenCalled()
  })

  it('updateFeatureLabels ei kaadu tyhjällä tooltip-elementillä', async () => {
    const { AreaOverlay } = await import('../src/map/area-overlay')
    const overlay = new AreaOverlay(makeMap())
    overlay.update([makeArea('Testi')])
    // getElement() returns null in mock — should not throw
    expect(() => overlay.updateFeatureLabels(16)).not.toThrow()
    expect(() => overlay.updateFeatureLabels(14)).not.toThrow()
  })
})
