import L from 'leaflet'
import type { AreaMarker, AreaFeature } from '../logic/area-types'
import { cornersFromRect } from '../logic/area-geometry'

const AREA_COLOR = '#3b82f6'
const AREA_FILL_OPACITY = 0.15
const AREA_WEIGHT = 2

function toLatLngs(area: Pick<AreaMarker, 'centerLat' | 'centerLng' | 'widthM' | 'heightM' | 'rotation'>): L.LatLngExpression[] {
  const corners = cornersFromRect(area.centerLat, area.centerLng, area.widthM, area.heightM, area.rotation)
  return corners.map(c => [c.lat, c.lng] as [number, number])
}

export class AreaOverlay {
  private areaLayers: Map<string, L.Layer[]> = new Map()
  private dragHandles: Map<string, L.Marker> = new Map()
  private onAreaClick?: (area: AreaMarker) => void
  private onAreaMove?: (area: AreaMarker) => void

  constructor(private readonly map: L.Map) {}

  setOnAreaClick(cb: (area: AreaMarker) => void): void {
    this.onAreaClick = cb
  }

  setOnAreaMove(cb: (area: AreaMarker) => void): void {
    this.onAreaMove = cb
  }

  update(areas: AreaMarker[]): void {
    this.clear()
    for (const area of areas) {
      this.renderArea(area)
    }
  }

  updateOne(area: AreaMarker): void {
    this.areaLayers.get(area.id)?.forEach(l => l.remove())
    this.dragHandles.get(area.id)?.remove()
    this.areaLayers.delete(area.id)
    this.dragHandles.delete(area.id)
    this.renderArea(area)
  }

  private renderArea(area: AreaMarker): void {
    const layers: L.Layer[] = []

    // Main area polygon
    const poly = L.polygon(toLatLngs(area), {
      color: AREA_COLOR,
      fillColor: AREA_COLOR,
      fillOpacity: AREA_FILL_OPACITY,
      weight: AREA_WEIGHT,
      className: 'area-polygon',
    })

    poly.bindTooltip(area.name, {
      permanent: true,
      className: 'area-label',
      direction: 'center',
    })

    poly.on('click', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e)
      this.onAreaClick?.(area)
      this.map.flyTo([area.centerLat, area.centerLng], 18)
    })

    poly.addTo(this.map)
    layers.push(poly)

    // Feature sub-rectangles
    for (const feature of area.features) {
      const fpoly = this.renderFeature(feature)
      fpoly.addTo(this.map)
      layers.push(fpoly)
    }

    // Draggable center handle
    const handle = this.createDragHandle(area, (updatedArea) => {
      this.areaLayers.get(area.id)?.forEach(l => l.remove())
      this.dragHandles.get(area.id)?.remove()
      this.areaLayers.delete(area.id)
      this.dragHandles.delete(area.id)
      this.renderArea(updatedArea)
      this.onAreaMove?.(updatedArea)
    })
    handle.addTo(this.map)

    this.areaLayers.set(area.id, layers)
    this.dragHandles.set(area.id, handle)
  }

  private renderFeature(feature: AreaFeature): L.Polygon {
    const poly = L.polygon(toLatLngs(feature), {
      color: feature.color,
      fillColor: feature.color,
      fillOpacity: 0.35,
      weight: 2,
      className: 'area-feature-polygon',
    })
    if (feature.name) {
      poly.bindTooltip(feature.name, {
        className: 'area-feature-label',
        direction: 'center',
      })
    }
    return poly
  }

  private createDragHandle(
    area: AreaMarker,
    onDragEnd: (updated: AreaMarker) => void,
  ): L.Marker {
    const icon = L.divIcon({
      className: 'area-drag-handle',
      html: '⊕',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })
    const marker = L.marker([area.centerLat, area.centerLng], {
      draggable: true,
      icon,
      title: 'Siirrä aluetta',
    })
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng()
      const updated: AreaMarker = {
        ...area,
        centerLat: lat,
        centerLng: lng,
        features: area.features.map(f => ({
          ...f,
          centerLat: f.centerLat + (lat - area.centerLat),
          centerLng: f.centerLng + (lng - area.centerLng),
        })),
      }
      onDragEnd(updated)
    })
    return marker
  }

  clear(): void {
    for (const layers of this.areaLayers.values()) {
      layers.forEach(l => l.remove())
    }
    for (const handle of this.dragHandles.values()) {
      handle.remove()
    }
    this.areaLayers.clear()
    this.dragHandles.clear()
  }
}
