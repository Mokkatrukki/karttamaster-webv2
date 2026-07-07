import L from 'leaflet'
import type { SignMarker, MarkerType, RoutePoint } from '../logic/types'
import { nearestPointIndex, haversineDistance } from '../logic/bearing'
import { createSignIcon } from './icons'
import { signImageSrc } from '../logic/sign-images'
import { compactLabel, signVisualParts } from '../logic/sign-visual'
import type { SignPart } from '../logic/sign-library'
import { assignRoutesToMarker } from '../logic/multi-route'
import { ensureRouteIds, FAR_FROM_ROUTE_M } from '../logic/marker-assign'
import { DEFAULT_STATUS, transitionStatus } from '../logic/marker-status'
import type { StatusAction } from '../logic/marker-status'
import type { MarkerStatus } from '../logic/types'
import { markerScaleForZoom } from '../logic/marker-scale'
import { outbox } from '../logic/outbox-instance'
import { setOutboxSaveErrorHandler } from '../logic/outbox-instance'

interface RouteRef { id: string; routePoints: RoutePoint[] }

// V99/T160: kompakti kartta-teksti johdetaan labelista (custom-tyypeille; default-tyypit käyttävät nuolta)
function compactOf(m: SignMarker): string | undefined {
  return m.label ? compactLabel(m.label) : undefined
}

// T172/V107: resolvoi yhdistelmämerkin osat (jos asetettu) valmiiksi SignVisual-taulukoksi
function visualPartsOf(m: SignMarker): ReturnType<typeof signVisualParts> | undefined {
  if (!m.parts || m.parts.length === 0) return undefined
  return signVisualParts({ iconId: m.iconId, label: m.label ?? '', parts: m.parts }, signImageSrc)
}

export class MarkerManager {
  private markers: SignMarker[] = []
  private leafletMarkers = new Map<string, L.Marker>()
  // T185/V117: merkkien id:t joilla on vahvistamaton kirjoitus outboxissa — piirretään
  // erottuvasti ("tallentamatta") kunnes 2xx vahvistaa. Säilytetään managerissa, koska
  // setIcon (status/tyyppimuutos) korvaa Leaflet-elementin → luokka on osattava piirtää uudelleen.
  private pendingIds = new Set<string>()
  private map: L.Map
  private routes: RouteRef[]
  private visibleRouteIds: string[]
  private onUpdate: () => void
  private onFarFromRoute?: (distM: number) => void
  private onMarkerClick: ((id: string) => void) | null = null

  constructor(map: L.Map, routes: RouteRef[], onUpdate: () => void, initialMarkers: SignMarker[] = [], onFarFromRoute?: (distM: number) => void, onSaveError?: (msg: string) => void) {
    this.map = map
    this.routes = routes
    this.visibleRouteIds = routes.map((r) => r.id)
    this.onUpdate = onUpdate
    this.onFarFromRoute = onFarFromRoute
    // T183: outbox raportoi kirjoitusvirheet keskitetysti (V115).
    if (onSaveError) setOutboxSaveErrorHandler(onSaveError)
    this.markers = initialMarkers
    initialMarkers.forEach((m) => {
      if (m.routeIds.some((id) => this.visibleRouteIds.includes(id))) {
        this.addLeafletMarker(m)
      }
    })
    map.on('zoomend', () => this.applyZoomScaleToAll())
  }

  // T175/V109: skaalaa marker-ikonin sisäwrapperia (EI Leafletin omaa .leaflet-marker-icon
  // -elementtiä — se kantaa Leafletin positio-transformin (translate3d), ylikirjoitus siirtäisi
  // markerin (0,0):aan). Kaikkien icons.ts-html-funktioiden juuri on yksi position:relative-div,
  // joka on aina .leaflet-marker-icon:in ainoa lapsi — sitä skaalataan.
  private applyZoomScale(lm: L.Marker): void {
    const el = lm.getElement()
    const inner = el?.firstElementChild as HTMLElement | null
    if (!inner) return
    const scale = markerScaleForZoom(this.map.getZoom())
    inner.style.transformOrigin = 'center bottom'
    inner.style.transform = `scale(${scale})`
  }

  private applyZoomScaleToAll(): void {
    this.leafletMarkers.forEach((lm) => this.applyZoomScale(lm))
  }

  // T185/V117: outbox ilmoittaa vahvistamattomien kirjoitusten resurssiavaimet
  // ('marker:<id>'). Päivitä pending-joukko ja piirrä erottuva luokka kaikille näkyville.
  setPendingKeys(keys: Set<string>): void {
    this.pendingIds = new Set(
      [...keys].filter((k) => k.startsWith('marker:')).map((k) => k.slice('marker:'.length)),
    )
    this.leafletMarkers.forEach((lm, id) => this.applyPendingClass(lm, this.pendingIds.has(id)))
  }

  private applyPendingClass(lm: L.Marker, on: boolean): void {
    lm.getElement()?.classList.toggle('leaflet-marker-pending', on)
  }

  // T183/V116: kaikki merkkikirjoitukset reititetään durable-outboxin kautta.
  // enqueue yrittää heti; 2xx poistaa jonosta, muu/verkkovirhe jättää jonoon ja
  // retrytään (startup/'online'/backoff) → kirjoitus ei katoa sivun päivityksellä.
  // Virhe surfataan keskitetysti (V115) outboxin onFailure → onSaveError.
  private apiPost(marker: SignMarker): void {
    void outbox.enqueue({
      resourceKey: 'marker:' + marker.id,
      method: 'POST',
      url: '/api/markers',
      body: JSON.stringify({
        id: marker.id,
        type: marker.type,
        lat: marker.lat,
        lon: marker.lon,
        distance_from_start: marker.distanceFromStart,
        route_ids: marker.routeIds,
        status: marker.status,
        location_note: marker.locationNote ?? null,
        color: marker.color ?? null,
        label: marker.label ?? null,
        icon_id: marker.iconId ?? null,
        parts_json: marker.parts ? JSON.stringify(marker.parts) : null,
      }),
    })
  }

  private apiPut(id: string, patch: Record<string, unknown>): void {
    void outbox.enqueue({
      resourceKey: 'marker:' + id,
      method: 'PUT',
      url: `/api/markers/${id}`,
      body: JSON.stringify(patch),
    })
  }

  private apiDelete(id: string): void {
    void outbox.enqueue({
      resourceKey: 'marker:' + id,
      method: 'DELETE',
      url: `/api/markers/${id}`,
    })
  }

  private nearestRouteAssignment(lat: number, lon: number): {
    routeIds: string[]
    distanceFromStart: number
  } {
    let bestIdx = 0, bestRouteIdx = 0, bestDist = Infinity
    this.routes.forEach((r, ri) => {
      const idx = nearestPointIndex(r.routePoints, lat, lon)
      const dist = haversineDistance(r.routePoints[idx], { lat, lon })
      if (dist < bestDist) { bestDist = dist; bestIdx = idx; bestRouteIdx = ri }
    })
    const primaryRoute = this.routes[bestRouteIdx]
    const point = primaryRoute.routePoints[bestIdx]
    const rawRouteIds = assignRoutesToMarker(lat, lon, this.routes)
    const routeIds = ensureRouteIds(rawRouteIds, primaryRoute.id)
    if (bestDist > FAR_FROM_ROUTE_M) this.onFarFromRoute?.(bestDist)
    return { routeIds, distanceFromStart: point.distanceFromStart }
  }

  add(lat: number, lon: number, type: MarkerType, color?: string, label?: string, iconId?: string, parts?: SignPart[]): SignMarker {
    const { routeIds, distanceFromStart } = this.nearestRouteAssignment(lat, lon)

    const marker: SignMarker = {
      id: crypto.randomUUID(),
      type, lat, lon,
      distanceFromStart,
      routeIds,
      status: DEFAULT_STATUS,
      ...(color ? { color } : {}),
      ...(label ? { label } : {}),
      ...(iconId ? { iconId } : {}),
      ...(parts && parts.length > 0 ? { parts } : {}),
    }
    this.markers.push(marker)
    this.apiPost(marker)

    if (marker.routeIds.some((id) => this.visibleRouteIds.includes(id))) {
      this.addLeafletMarker(marker)
    }
    this.onUpdate()
    return marker
  }

  /** Replace marker set (esim. GPKG-tuonnin jälkeen) — piirtää näkyvät merkit uudelleen. */
  reload(markers: SignMarker[]): void {
    this.leafletMarkers.forEach((lm) => lm.remove())
    this.leafletMarkers.clear()
    this.markers = markers
    this.markers.forEach((m) => {
      if (m.routeIds.some((id) => this.visibleRouteIds.includes(id))) {
        this.addLeafletMarker(m)
      }
    })
    this.onUpdate()
  }

  /**
   * Korjaa merkit joilla ei ole route-assignointia (esim. GPKG-tuonnista tulleet uudet
   * merkit — kts. V21/B1: routeIds:[] -> merkki tallentuu mutta katoaa hiljaa kartalta).
   * Käyttää samaa lähin-reitti-logiikkaa kuin add(). Palauttaa korjattujen määrän.
   */
  fixOrphanRouteIds(): number {
    let fixed = 0
    this.markers.forEach((m) => {
      if (m.routeIds.length > 0) return
      const { routeIds, distanceFromStart } = this.nearestRouteAssignment(m.lat, m.lon)
      m.routeIds = routeIds
      m.distanceFromStart = distanceFromStart
      this.apiPut(m.id, {
        route_ids: routeIds,
        distance_from_start: distanceFromStart,
      })
      if (m.routeIds.some((id) => this.visibleRouteIds.includes(id)) && !this.leafletMarkers.has(m.id)) {
        this.addLeafletMarker(m)
      }
      fixed++
    })
    if (fixed > 0) this.onUpdate()
    return fixed
  }

  remove(id: string): void {
    const lm = this.leafletMarkers.get(id)
    if (lm) { lm.remove(); this.leafletMarkers.delete(id) }
    this.markers = this.markers.filter((m) => m.id !== id)
    this.apiDelete(id)
    this.onUpdate()
  }

  /** Returns markers visible under current visibleRouteIds, sorted by distanceFromStart */
  getAll(): SignMarker[] {
    return this.markers
      .filter((m) => m.routeIds.some((id) => this.visibleRouteIds.includes(id)))
      .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
  }

  /** Returns all markers assigned to a specific route, regardless of visibility */
  getForRoute(routeId: string): SignMarker[] {
    return this.markers
      .filter((m) => m.routeIds.includes(routeId))
      .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
  }

  setVisibleRoutes(ids: string[]): void {
    this.visibleRouteIds = ids
    this.markers.forEach((m) => {
      const visible = m.routeIds.some((id) => ids.includes(id))
      const lm = this.leafletMarkers.get(m.id)
      if (visible && !lm) {
        this.addLeafletMarker(m)
      } else if (!visible && lm) {
        lm.remove()
        this.leafletMarkers.delete(m.id)
      }
    })
    this.onUpdate()
  }

  panTo(id: string): void {
    const m = this.markers.find((x) => x.id === id)
    if (m) this.map.setView([m.lat, m.lon], this.map.getZoom())
  }

  setOnMarkerClick(cb: (id: string) => void): void {
    this.onMarkerClick = cb
  }

  updateStatus(id: string, action: StatusAction): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.status = transitionStatus(m.status, action)
    const lm = this.leafletMarkers.get(id)
    if (lm) lm.setIcon(createSignIcon(m.type, m.status, m.color, compactOf(m), m.iconId, signImageSrc(m.type), visualPartsOf(m)))
    this.apiPut(id, { status: m.status })
    this.onUpdate()
  }

  bulkSetStatus(ids: string[], status: MarkerStatus): void {
    ids.forEach((id) => {
      const m = this.markers.find((x) => x.id === id)
      if (!m) return
      m.status = status
      const lm = this.leafletMarkers.get(id)
      if (lm) lm.setIcon(createSignIcon(m.type, m.status, m.color, compactOf(m), m.iconId, signImageSrc(m.type), visualPartsOf(m)))
      this.apiPut(id, { status })
    })
    if (ids.length > 0) this.onUpdate()
  }

  updateType(id: string, newType: MarkerType, color?: string, label?: string, iconId?: string, parts?: SignPart[]): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.type = newType
    m.color = color ?? undefined
    m.label = label ?? undefined
    m.iconId = iconId ?? undefined
    m.parts = (parts && parts.length > 0) ? parts : undefined
    const lm = this.leafletMarkers.get(id)
    if (lm) lm.setIcon(createSignIcon(newType, m.status, m.color, compactOf(m), m.iconId, signImageSrc(newType), visualPartsOf(m)))
    this.apiPut(id, { type: newType, color: color ?? null, icon_id: iconId ?? null, parts_json: m.parts ? JSON.stringify(m.parts) : null })
    this.onUpdate()
  }

  updateNote(id: string, note: string): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.locationNote = note || undefined
    this.apiPut(id, { location_note: note || null })
  }

  // T103
  updateDescription(id: string, description: string): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.description = description || undefined
    this.apiPut(id, { description: description || null })
  }

  // T103 — multipart upload, appends resulting URL to marker.images
  async addImage(id: string, file: File): Promise<void> {
    const form = new FormData()
    form.append('image', file)
    const res = await fetch(`/api/markers/${id}/images`, { method: 'POST', body: form })
    if (!res.ok) throw new Error('image_upload_failed')
    const data = await res.json() as { url: string }
    const m = this.markers.find((x) => x.id === id)
    if (m) m.images = [...(m.images ?? []), data.url]
  }

  private addLeafletMarker(m: SignMarker): void {
    const icon = createSignIcon(m.type, m.status, m.color, compactOf(m), m.iconId, signImageSrc(m.type), visualPartsOf(m))
    const lm = L.marker([m.lat, m.lon], { icon, draggable: true }).addTo(this.map)
    this.leafletMarkers.set(m.id, lm)

    lm.on('dragend', () => {
      const { lat, lng } = lm.getLatLng()
      let bestIdx = 0, bestRouteIdx = 0, bestDist = Infinity
      this.routes.forEach((r, ri) => {
        const idx = nearestPointIndex(r.routePoints, lat, lng)
        const dist = haversineDistance(r.routePoints[idx], { lat, lon: lng })
        if (dist < bestDist) { bestDist = dist; bestIdx = idx; bestRouteIdx = ri }
      })
      const primaryRoute = this.routes[bestRouteIdx]
      const point = primaryRoute.routePoints[bestIdx]
      const rawRouteIds = assignRoutesToMarker(lat, lng, this.routes)
      const routeIds = ensureRouteIds(rawRouteIds, primaryRoute.id)
      if (bestDist > FAR_FROM_ROUTE_M) this.onFarFromRoute?.(bestDist)
      m.lat = lat
      m.lon = lng
      m.distanceFromStart = point.distanceFromStart
      m.routeIds = routeIds
      this.apiPut(m.id, {
        lat,
        lon: lng,
        distance_from_start: point.distanceFromStart,
        route_ids: routeIds,
      })
      this.onUpdate()
    })

    const el = lm.getElement()
    if (el) el.style.cursor = 'pointer'
    this.applyZoomScale(lm)
    // T185/V117: uusi merkki voi olla jo pending (add() enqueuaa ennen piirtoa) → merkitse heti.
    this.applyPendingClass(lm, this.pendingIds.has(m.id))

    // V82: lm.on('click', ...) uses Leaflet's own event system, which suppresses
    // the synthetic click that follows a real drag (Draggable._onUp). A raw DOM
    // addEventListener('click', ...) on the element does not get that suppression.
    lm.on('click', (e) => {
      L.DomEvent.stopPropagation(e)
      this.onMarkerClick?.(m.id)
    })
  }
}
