import { describe, test, expect } from 'bun:test'
import { geoJSONToGpkg, gpkgToGeoJSON, hasOgr2ogr } from './convert'
import { markersToGeoJSON, type GpkgMarkerRow } from './geojson'

const maybe = hasOgr2ogr() ? describe : describe.skip

maybe('geoJSONToGpkg / gpkgToGeoJSON (vaatii ogr2ogr — skip jos GDAL ei asennettu)', () => {
  test('round-trip: markers -> geojson -> gpkg -> geojson säilyttää id/type/description', async () => {
    const rows: GpkgMarkerRow[] = [
      { id: 'm1', type: 'nuoli-oikea', lat: 65.123, lon: 27.456, description: 'Käännös oikealle' },
      { id: 'm2', type: 'huolto', lat: 65.2, lon: 27.5, description: null },
    ]
    const fc = markersToGeoJSON(rows)
    const gpkgBytes = await geoJSONToGpkg(fc, 'kyltit')
    expect(gpkgBytes.byteLength).toBeGreaterThan(0)

    const roundTripped = await gpkgToGeoJSON(gpkgBytes)
    const ids = roundTripped.features.map((f) => f.properties.id).sort()
    expect(ids).toEqual(['m1', 'm2'])
    const m1 = roundTripped.features.find((f) => f.properties.id === 'm1')!
    expect(m1.properties.type).toBe('nuoli-oikea')
    expect(m1.properties.description).toBe('Käännös oikealle')
  })

  test('lukee layerin vaikka sen nimi ei ole "kyltit" — QGIS nimeää layerin uudelleen tallennuksen yhteydessä', async () => {
    const rows: GpkgMarkerRow[] = [
      { id: 'm1', type: 'huolto', lat: 65.1, lon: 27.1, description: null },
    ]
    const fc = markersToGeoJSON(rows)
    const gpkgBytes = await geoJSONToGpkg(fc, '2026_testikyltit__kyltit')

    const roundTripped = await gpkgToGeoJSON(gpkgBytes)
    expect(roundTripped.features).toHaveLength(1)
    expect(roundTripped.features[0].properties.id).toBe('m1')
  })
})

test('hasOgr2ogr palauttaa boolean', () => {
  expect(typeof hasOgr2ogr()).toBe('boolean')
})
