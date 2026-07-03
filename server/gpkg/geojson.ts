export interface GpkgMarkerRow {
  id: string
  type: string
  lat: number
  lon: number
  description: string | null
}

export interface GpkgFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; type: string; description: string | null }
}

export interface GpkgFeatureCollection {
  type: 'FeatureCollection'
  features: GpkgFeature[]
}

export function markersToGeoJSON(rows: GpkgMarkerRow[]): GpkgFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows.map((row) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
      properties: {
        id: row.id,
        type: row.type,
        description: row.description,
      },
    })),
  }
}

export function geoJSONToMarkers(fc: GpkgFeatureCollection): GpkgMarkerRow[] {
  return fc.features.map((feature) => ({
    id: feature.properties.id,
    type: feature.properties.type,
    description: feature.properties.description ?? null,
    lon: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
  }))
}
