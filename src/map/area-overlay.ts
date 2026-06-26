import L from 'leaflet'
import type { AreaMarker, AreaFeature } from '../logic/area-types'
import { cornersFromRect } from '../logic/area-geometry'
import type { MapRectEditor } from './map-rect-editor'

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
  private featureDragHandles: Map<string, L.Marker> = new Map()
  private areaFeatureIds: Map<string, string[]> = new Map()
  private onAreaClick?: (area: AreaMarker) => void
  private onAreaMove?: (area: AreaMarker) => void
  private mapRectEditor?: MapRectEditor

  constructor(private readonly map: L.Map) {}

  setOnAreaClick(cb: (area: AreaMarker) => void): void {
    this.onAreaClick = cb
  }

  setOnAreaMove(cb: (area: AreaMarker) => void): void {
    this.onAreaMove = cb
  }

  setMapRectEditor(editor: MapRectEditor): void {
    this.mapRectEditor = editor
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
    // Clean up feature handles for this area
    const oldFeatureIds = this.areaFeatureIds.get(area.id) ?? []
    for (const fid of oldFeatureIds) {
      this.featureDragHandles.get(fid)?.remove()
      this.featureDragHandles.delete(fid)
    }
    this.areaFeatureIds.delete(area.id)
    this.renderArea(area)
  }

  private renderArea(area: AreaMarker): void {
    const layers: L.Layer[] = []
    const featureIds: string[] = []

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

    let currentArea = area
    poly.on('dblclick', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e)
      this.mapRectEditor?.startEdit(
        area.id,
        currentArea,
        (updated) => {
          currentArea = { ...currentArea, ...updated }
          this.updateOne(currentArea)
          this.onAreaMove?.(currentArea)
        },
        () => { this.mapRectEditor?.stopEdit() },
      )
    })

    poly.addTo(this.map)
    layers.push(poly)

    // Feature sub-rectangles + move handles
    for (const feature of area.features) {
      const fpoly = this.renderFeature(feature, area)
      fpoly.addTo(this.map)
      layers.push(fpoly)

      const fHandle = this.createFeatureDragHandle(feature, area)
      fHandle.addTo(this.map)
      this.featureDragHandles.set(feature.id, fHandle)
      featureIds.push(feature.id)
    }

    // Area center drag handle (moves whole area + all features)
    const handle = this.createDragHandle(area, (updatedArea) => {
      this.updateOne(updatedArea)
      this.onAreaMove?.(updatedArea)
    })
    handle.addTo(this.map)

    this.areaLayers.set(area.id, layers)
    this.dragHandles.set(area.id, handle)
    this.areaFeatureIds.set(area.id, featureIds)
  }

  private renderFeature(feature: AreaFeature, parentArea: AreaMarker): L.Polygon {
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

    let currentFeature = feature
    poly.on('dblclick', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e)
      this.mapRectEditor?.startEdit(
        feature.id,
        currentFeature,
        (updated) => {
          currentFeature = { ...currentFeature, ...updated }
          const updatedParent: AreaMarker = {
            ...parentArea,
            features: parentArea.features.map(f => f.id === feature.id ? currentFeature : f),
          }
          this.updateOne(updatedParent)
          this.onAreaMove?.(updatedParent)
        },
        () => { this.mapRectEditor?.stopEdit() },
      )
    })

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

  private createFeatureDragHandle(
    feature: AreaFeature,
    parentArea: AreaMarker,
  ): L.Marker {
    const icon = L.divIcon({
      className: 'area-drag-handle',
      html: '⊕',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })
    const marker = L.marker([feature.centerLat, feature.centerLng], {
      draggable: true,
      icon,
      title: 'Siirrä sisäistä aluetta',
    })
    let currentFeature = feature
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng()
      currentFeature = { ...currentFeature, centerLat: lat, centerLng: lng }
      const updatedParent: AreaMarker = {
        ...parentArea,
        features: parentArea.features.map(f => f.id === feature.id ? currentFeature : f),
      }
      this.updateOne(updatedParent)
      this.onAreaMove?.(updatedParent)
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
    for (const handle of this.featureDragHandles.values()) {
      handle.remove()
    }
    this.areaLayers.clear()
    this.dragHandles.clear()
    this.featureDragHandles.clear()
    this.areaFeatureIds.clear()
  }
}
