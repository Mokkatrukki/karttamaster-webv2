import { describe, test, expect } from 'bun:test'
import { markersToGeoJSON, geoJSONToMarkers, type GpkgMarkerRow } from './geojson'

describe('markersToGeoJSON', () => {
  test('exports id, type, bearing, description as properties + Point geometry', () => {
    const rows: GpkgMarkerRow[] = [
      { id: 'm1', type: 'nuoli-oikea', lat: 65.123, lon: 27.456, bearing: 90, description: 'Käännös oikealle' },
    ]
    const fc = markersToGeoJSON(rows)
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(1)
    const [feature] = fc.features
    expect(feature.geometry).toEqual({ type: 'Point', coordinates: [27.456, 65.123] })
    expect(feature.properties).toEqual({
      id: 'm1',
      type: 'nuoli-oikea',
      bearing: 90,
      description: 'Käännös oikealle',
    })
  })

  test('null description passes through as null', () => {
    const rows: GpkgMarkerRow[] = [{ id: 'm2', type: 'huolto', lat: 1, lon: 2, bearing: 0, description: null }]
    const fc = markersToGeoJSON(rows)
    expect(fc.features[0].properties.description).toBeNull()
  })
})

describe('geoJSONToMarkers', () => {
  test('round-trip marker -> geojson -> marker preserves id/type/bearing/description', () => {
    const original: GpkgMarkerRow[] = [
      { id: 'm1', type: 'nuoli-oikea', lat: 65.123, lon: 27.456, bearing: 90, description: 'Käännös oikealle' },
      { id: 'm2', type: 'huolto', lat: 65.2, lon: 27.5, bearing: 180, description: null },
    ]
    const roundTripped = geoJSONToMarkers(markersToGeoJSON(original))
    expect(roundTripped).toEqual(original)
  })

  test('missing properties.description treated as null', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [1, 2] as [number, number] },
          properties: { id: 'm3', type: 'huolto', bearing: 0, description: undefined as unknown as null },
        },
      ],
    }
    const [marker] = geoJSONToMarkers(fc)
    expect(marker.description).toBeNull()
  })
})
