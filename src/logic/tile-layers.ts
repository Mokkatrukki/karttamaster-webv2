const MML_BASE = 'https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0'
const MML_ATTR = '&copy; <a href="https://www.maanmittauslaitos.fi">Maanmittauslaitos</a>'
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export function buildMmlTileUrl(layer: string, z: number, y: number, x: number, apiKey: string): string {
  return `${MML_BASE}/${layer}/default/WGS84_Pseudo-Mercator/${z}/${y}/${x}.png?api-key=${apiKey}`
}

export interface TileLayerConfig {
  id: string
  label: string
  urlTemplate: string
  attribution: string
  maxZoom: number
  maxNativeZoom?: number
}

function mmlLayer(id: string, layer: string, label: string): TileLayerConfig {
  const key = import.meta.env.VITE_MML_API_KEY ?? ''
  return {
    id,
    label,
    urlTemplate: `${MML_BASE}/${layer}/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.png?api-key=${key}`,
    attribution: MML_ATTR,
    maxZoom: 19,
    maxNativeZoom: 16,
  }
}

export const TILE_LAYERS: TileLayerConfig[] = [
  mmlLayer('mml-tausta',  'taustakartta', 'MML Taustakartta'),
  mmlLayer('mml-maasto',  'maastokartta', 'MML Maastokartta'),
  {
    id: 'osm',
    label: 'OpenStreetMap',
    urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR,
    maxZoom: 19,
  },
]
