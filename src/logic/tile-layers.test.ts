import { describe, it, expect } from 'vitest'
import { TILE_LAYERS } from './tile-layers'

describe('TILE_LAYERS', () => {
  it('MML layers have maxNativeZoom 16 and maxZoom 19', () => {
    const mmlLayers = TILE_LAYERS.filter(l => l.id.startsWith('mml-'))
    expect(mmlLayers.length).toBeGreaterThan(0)
    for (const l of mmlLayers) {
      expect(l.maxNativeZoom).toBe(16)
      expect(l.maxZoom).toBe(19)
    }
  })

  it('OSM layer has no maxNativeZoom and maxZoom 19', () => {
    const osm = TILE_LAYERS.find(l => l.id === 'osm')
    expect(osm).toBeDefined()
    expect(osm!.maxNativeZoom).toBeUndefined()
    expect(osm!.maxZoom).toBe(19)
  })
})
