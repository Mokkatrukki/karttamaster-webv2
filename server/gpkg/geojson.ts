export interface GpkgMarkerRow {
  id: string
  type: string
  label: string | null
  lat: number
  lon: number
  description: string | null
}

export interface GpkgFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; type: string; name: string | null; description: string | null }
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
        name: row.label,
        description: row.description,
      },
    })),
  }
}

export function geoJSONToMarkers(fc: GpkgFeatureCollection): GpkgMarkerRow[] {
  return fc.features.map((feature) => ({
    id: feature.properties.id,
    type: feature.properties.type,
    label: feature.properties.name ?? null,
    description: feature.properties.description ?? null,
    lon: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
  }))
}
