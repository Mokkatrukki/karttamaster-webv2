export interface GpkgMarkerRow {
  id: string
  type: string
  lat: number
  lon: number
  bearing: number
  description: string | null
}

export interface GpkgFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; type: string; bearing: number; description: string | null }
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
        bearing: row.bearing,
        description: row.description,
      },
    })),
  }
}

export function geoJSONToMarkers(fc: GpkgFeatureCollection): GpkgMarkerRow[] {
  return fc.features.map((feature) => ({
    id: feature.properties.id,
    type: feature.properties.type,
    bearing: feature.properties.bearing,
    description: feature.properties.description ?? null,
    lon: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
  }))
}
