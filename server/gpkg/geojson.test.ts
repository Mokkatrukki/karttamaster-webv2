import { describe, test, expect } from 'bun:test'
import { markersToGeoJSON, geoJSONToMarkers, type GpkgMarkerRow } from './geojson'

describe('markersToGeoJSON', () => {
  test('exports id, type, name, description as properties + Point geometry', () => {
    const rows: GpkgMarkerRow[] = [
      { id: 'm1', type: 'nuoli-oikea', label: 'Käännösnuoli', lat: 65.123, lon: 27.456, description: 'Käännös oikealle' },
    ]
    const fc = markersToGeoJSON(rows)
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(1)
    const [feature] = fc.features
    expect(feature.geometry).toEqual({ type: 'Point', coordinates: [27.456, 65.123] })
    expect(feature.properties).toEqual({
      id: 'm1',
      type: 'nuoli-oikea',
      name: 'Käännösnuoli',
      description: 'Käännös oikealle',
    })
  })

  test('label -> properties.name (V98 luettava nimi)', () => {
    const rows: GpkgMarkerRow[] = [{ id: 'm1', type: 'huolto', label: 'Huoltopiste', lat: 1, lon: 2, description: null }]
    const fc = markersToGeoJSON(rows)
    expect(fc.features[0].properties.name).toBe('Huoltopiste')
  })

  test('null label/description pass through as null', () => {
    const rows: GpkgMarkerRow[] = [{ id: 'm2', type: 'huolto', label: null, lat: 1, lon: 2, description: null }]
    const fc = markersToGeoJSON(rows)
    expect(fc.features[0].properties.name).toBeNull()
    expect(fc.features[0].properties.description).toBeNull()
  })
})

describe('geoJSONToMarkers', () => {
  test('round-trip marker -> geojson -> marker preserves id/type/label/description', () => {
    const original: GpkgMarkerRow[] = [
      { id: 'm1', type: 'nuoli-oikea', label: 'Käännösnuoli', lat: 65.123, lon: 27.456, description: 'Käännös oikealle' },
      { id: 'm2', type: 'huolto', label: null, lat: 65.2, lon: 27.5, description: null },
    ]
    const roundTripped = geoJSONToMarkers(markersToGeoJSON(original))
    expect(roundTripped).toEqual(original)
  })

  test('missing properties.name/description treated as null', () => {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [1, 2] as [number, number] },
          properties: {
            id: 'm3',
            type: 'huolto',
            name: undefined as unknown as null,
            description: undefined as unknown as null,
          },
        },
      ],
    }
    const [marker] = geoJSONToMarkers(fc)
    expect(marker.label).toBeNull()
    expect(marker.description).toBeNull()
  })
})
