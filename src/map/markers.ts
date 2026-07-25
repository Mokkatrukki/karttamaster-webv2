import L from 'leaflet'
import type { SignMarker, MarkerType, RoutePoint } from '../logic/types'
import { createSignIcon } from './icons'
import { signImageSrc } from '../logic/sign-images'
import { compactLabel, signVisualParts } from '../logic/sign-visual'
import { genId } from '../logic/uid'
import type { SignPart } from '../logic/sign-library'
import { FAR_FROM_ROUTE_M } from '../logic/marker-assign'
import {
  resolveMoveAssignment,
  inferKmAxisRouteId,
  snapshotMarkerPosition,
  applyMarkerPosition,
  isServerRejection,
} from '../logic/marker-distance'
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
  // T256/V178 (R6): pätkän seuraava-merkki-korostus — ikoni hehkuu (.marker-next-highlight).
  private highlightNextId: string | null = null
  private map: L.Map
  private routes: RouteRef[]
  private visibleRouteIds: string[]
  private onUpdate: () => void
  private onFarFromRoute?: (distM: number) => void
  private onMarkerClick: ((id: string) => void) | null = null
  // T222/V150: mitkä merkit ovat raahattavia. Oletus = kaikki (järjestäjä). Talkoolaiselle
  // asetetaan predikaatti joka sallii vain oman pätkän merkit → ei raahaa vieraita (backend 403).
  private draggableFn: (m: SignMarker) => boolean = () => true
  // T309/V220: näkyvä virhe rollbackille (sama kanava kuin outboxin V115-banneri).
  private onSaveError?: (msg: string) => void
  // T309/V221: sen pätkän primaryRouteId jonka näkymässä ollaan (talkoolainen) — km-akseli
  // siirrossa. Wiring (`src/app/markers-wiring.ts`) asettaa; null = ei pätkäkontekstia →
  // akseli pysyy merkin entisessä reitissä (⊥ hypi lähimpään, B121).
  private kmAxisRouteFn: (() => string | undefined) | null = null

  constructor(map: L.Map, routes: RouteRef[], onUpdate: () => void, initialMarkers: SignMarker[] = [], onFarFromRoute?: (distM: number) => void, onSaveError?: (msg: string) => void) {
    this.map = map
    this.routes = routes
    this.visibleRouteIds = routes.map((r) => r.id)
    this.onUpdate = onUpdate
    this.onFarFromRoute = onFarFromRoute
    this.onSaveError = onSaveError
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

  // T256/V178 (R6): korosta pätkän seuraava asettamaton merkki KARTALLA — ei erillistä
  // rengasta (poistettu, V178), vaan ITSE ikoni hehkuu huomiovärillä (.marker-next-highlight,
  // filter-glow CSS). Sama pattern kuin pending-luokka; uudelleensovelletaan addLeafletMarkerissa
  // (setIcon/reload korvaa elementin). null = ei korostusta (done/väärä phase).
  setNextHighlight(id: string | null): void {
    if (this.highlightNextId === id) return
    if (this.highlightNextId) {
      this.leafletMarkers.get(this.highlightNextId)?.getElement()?.classList.remove('marker-next-highlight')
    }
    this.highlightNextId = id
    if (id) {
      this.leafletMarkers.get(id)?.getElement()?.classList.add('marker-next-highlight')
    }
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
        // T300/V212/V213: km per reitti kulkee payloadissa — backendin ownership-tarkistus
        // (markerInOwnSegment) ! nähdä sama km-lähde kuin frontendin suodatin, muuten
        // talkoolainen näkee merkin listalla mutta saa siitä 403:n (B100-oppi toisin päin).
        distance_by_route: marker.distanceByRoute ?? null,
        route_ids: marker.routeIds,
        status: marker.status,
        location_note: marker.locationNote ?? null,
        color: marker.color ?? null,
        label: marker.label ?? null,
        icon_id: marker.iconId ?? null,
        image_id: marker.imageId ?? null,
        template_id: marker.templateId ?? null,
        parts_json: marker.parts ? JSON.stringify(marker.parts) : null,
      }),
      onDelivered: (text) => this.reconcileFromServer(text),
    })
  }

  // T187: yhdenmukaista muistitila palvelimen kanonisen POST-vastauksen kanssa (id/route_ids/
  // distance_from_start). Palvelin toistaa nyt clientin arvot, joten tämä on käytännössä
  // no-op — mutta suojaa jos palvelin joskus laskee kentät itse (ei hiljaista eroa).
  private reconcileFromServer(text: string): void {
    let row: {
      id?: string; route_ids?: string[]; distance_from_start?: number
      distance_by_route?: Record<string, number[]> | null
    }
    try { row = JSON.parse(text) } catch { return }
    if (!row.id) return
    const m = this.markers.find((x) => x.id === row.id)
    if (!m) return
    let changed = false
    if (Array.isArray(row.route_ids) && JSON.stringify(row.route_ids) !== JSON.stringify(m.routeIds)) {
      m.routeIds = row.route_ids; changed = true
    }
    if (typeof row.distance_from_start === 'number' && row.distance_from_start !== m.distanceFromStart) {
      m.distanceFromStart = row.distance_from_start; changed = true
    }
    if (row.distance_by_route && JSON.stringify(row.distance_by_route) !== JSON.stringify(m.distanceByRoute)) {
      m.distanceByRoute = row.distance_by_route; changed = true
    }
    if (changed) this.onUpdate()
  }

  private apiPut(id: string, patch: Record<string, unknown>): void {
    void this.apiPutAwaited(id, patch)
  }

  // T309/V220: sama outbox-polku, mutta VÄLITTÖMÄN yrityksen tulos palautetaan kutsujalle.
  // `delivered=false, status=null` = jäi jonoon (offline / 5xx / saman resurssin FIFO-jono) =
  // laillinen pending-tila. Vain `isServerRejection(status)` (403/400/404…) on hylkäys.
  private apiPutAwaited(id: string, patch: Record<string, unknown>): Promise<{ delivered: boolean; status: number | null }> {
    return outbox.enqueue({
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

  // T300/V212 + T309/V221: sijoitus/siirto käyttävät SAMAA kanonista sijaintiratkaisijaa
  // (`resolveMoveAssignment`) → km-akseli valitaan yhdellä säännöllä, ei kahdessa paikassa.
  private nearestRouteAssignment(lat: number, lon: number, opts: { preferRouteId?: string; fallbackAxisRouteId?: string } = {}): {
    routeIds: string[]
    distanceFromStart: number
    distanceByRoute: Record<string, number[]>
  } {
    const asg = resolveMoveAssignment(lat, lon, this.routes, opts)
    if (asg.distFromNearestRouteM > FAR_FROM_ROUTE_M) this.onFarFromRoute?.(asg.distFromNearestRouteM)
    return {
      routeIds: asg.routeIds,
      distanceFromStart: asg.distanceFromStart,
      distanceByRoute: asg.distanceByRoute,
    }
  }

  add(lat: number, lon: number, type: MarkerType, color?: string, label?: string, iconId?: string, parts?: SignPart[], imageId?: string, templateId?: string): SignMarker {
    const { routeIds, distanceFromStart, distanceByRoute } = this.nearestRouteAssignment(lat, lon)

    const marker: SignMarker = {
      id: genId(),
      type, lat, lon,
      distanceFromStart,
      distanceByRoute,
      routeIds,
      status: DEFAULT_STATUS,
      ...(color ? { color } : {}),
      ...(label ? { label } : {}),
      ...(iconId ? { iconId } : {}),
      ...(imageId ? { imageId } : {}),
      // T215/V143: denormalisoi template-viite dynaamista markerTypeFilter-osumaa varten
      ...(templateId ? { templateId } : {}),
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
      const { routeIds, distanceFromStart, distanceByRoute } = this.nearestRouteAssignment(m.lat, m.lon)
      m.routeIds = routeIds
      m.distanceFromStart = distanceFromStart
      m.distanceByRoute = distanceByRoute
      this.apiPut(m.id, {
        route_ids: routeIds,
        distance_from_start: distanceFromStart,
        distance_by_route: distanceByRoute,
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

  // T222/V150: aseta raahattavuus-predikaatti (talkoolainen = vain oma pätkä) + sovella heti
  // olemassa oleviin Leaflet-merkkeihin. Uudet merkit lukevat predikaatin piirtohetkellä.
  setDraggablePredicate(fn: (m: SignMarker) => boolean): void {
    this.draggableFn = fn
    this.leafletMarkers.forEach((lm, id) => {
      const m = this.markers.find((x) => x.id === id)
      if (!m) return
      if (fn(m)) lm.dragging?.enable()
      else lm.dragging?.disable()
    })
  }

  updateStatus(id: string, action: StatusAction): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.status = transitionStatus(m.status, action)
    const lm = this.leafletMarkers.get(id)
    if (lm) lm.setIcon(createSignIcon(m.type, m.status, m.color, compactOf(m), m.iconId, signImageSrc(m.imageId ?? m.type), visualPartsOf(m)))
    this.apiPut(id, { status: m.status })
    this.onUpdate()
  }

  bulkSetStatus(ids: string[], status: MarkerStatus): void {
    ids.forEach((id) => {
      const m = this.markers.find((x) => x.id === id)
      if (!m) return
      m.status = status
      const lm = this.leafletMarkers.get(id)
      if (lm) lm.setIcon(createSignIcon(m.type, m.status, m.color, compactOf(m), m.iconId, signImageSrc(m.imageId ?? m.type), visualPartsOf(m)))
      this.apiPut(id, { status })
    })
    if (ids.length > 0) this.onUpdate()
  }

  updateType(id: string, newType: MarkerType, color?: string, label?: string, iconId?: string, parts?: SignPart[], imageId?: string, templateId?: string): void {
    const m = this.markers.find((x) => x.id === id)
    if (!m) return
    m.type = newType
    m.color = color ?? undefined
    m.label = label ?? undefined
    m.iconId = iconId ?? undefined
    m.imageId = imageId ?? undefined
    // T215/V143: uudelleentyypitys päivittää template-viitteen → typeFilter täsmää uuteen templateen
    m.templateId = templateId ?? undefined
    m.parts = (parts && parts.length > 0) ? parts : undefined
    const lm = this.leafletMarkers.get(id)
    if (lm) lm.setIcon(createSignIcon(newType, m.status, m.color, compactOf(m), m.iconId, signImageSrc(m.imageId ?? newType), visualPartsOf(m)))
    this.apiPut(id, { type: newType, color: color ?? null, icon_id: iconId ?? null, image_id: imageId ?? null, template_id: templateId ?? null, parts_json: m.parts ? JSON.stringify(m.parts) : null })
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

  // T309/V221: wiring kertoo minkä pätkän km-akselia vasten jäsenyys ratkeaa (pätkän
  // `primaryRouteId`) → siirto mittaa km:n SAMASTA reitistä kuin serverin `markerInOwnSegment`
  // (V213/B100-oppi). Ilman tätä akseli valittiin "lähin yli kaikkien reittien" (B121).
  setKmAxisRouteFn(fn: (() => string | undefined) | null): void {
    this.kmAxisRouteFn = fn
  }

  // T309/V220/V221: merkin siirto on optimistinen VAIN kunnes serveri vahvistaa.
  //  1. snapshot ENNEN mutaatiota
  //  2. km-akseli = pätkän primary (⊥ lähin reitti) → merkki ei putoa pätkästä jaetulla osuudella
  //  3. optimistinen tila + onUpdate() → UI reagoi heti
  //  4. serverin hylkäys (403, V150) → palauta kentät + Leaflet-marker + re-render + varoitus
  //     Offline/5xx/401 ⊥ rollbackaa: kirjoitus on jonossa (V116) ja retrytään.
  private async handleDragEnd(m: SignMarker, lm: L.Marker): Promise<void> {
    const { lat, lng } = lm.getLatLng()
    const before = snapshotMarkerPosition(m)
    const { routeIds, distanceFromStart, distanceByRoute } = this.nearestRouteAssignment(lat, lng, {
      preferRouteId: this.kmAxisRouteFn?.() ?? undefined,
      fallbackAxisRouteId: inferKmAxisRouteId(m),
    })
    applyMarkerPosition(m, { lat, lon: lng, distanceFromStart, distanceByRoute, routeIds })
    this.onUpdate()

    const { delivered, status } = await this.apiPutAwaited(m.id, {
      lat,
      lon: lng,
      distance_from_start: distanceFromStart,
      distance_by_route: distanceByRoute,
      route_ids: routeIds,
    })
    if (delivered || !isServerRejection(status)) return

    applyMarkerPosition(m, before)
    lm.setLatLng([before.lat, before.lon])
    this.onUpdate()
    this.onSaveError?.('⚠ Siirto ei sallittu — merkki palautettiin')
  }

  private addLeafletMarker(m: SignMarker): void {
    const icon = createSignIcon(m.type, m.status, m.color, compactOf(m), m.iconId, signImageSrc(m.imageId ?? m.type), visualPartsOf(m))
    // V197/aria-command-name: Leaflet-merkin role=button tarvitsee saavutettavan nimen (title+alt)
    const accName = m.label ?? m.type
    const lm = L.marker([m.lat, m.lon], { icon, draggable: this.draggableFn(m), title: accName, alt: accName }).addTo(this.map)
    this.leafletMarkers.set(m.id, lm)

    lm.on('dragend', () => { void this.handleDragEnd(m, lm) })

    const el = lm.getElement()
    if (el) el.style.cursor = 'pointer'
    this.applyZoomScale(lm)
    // T185/V117: uusi merkki voi olla jo pending (add() enqueuaa ennen piirtoa) → merkitse heti.
    this.applyPendingClass(lm, this.pendingIds.has(m.id))
    // T256/V178: seuraava-merkki-korostus uudelleen jos tämä on korostettu (setIcon/reload korvaa elementin).
    if (this.highlightNextId === m.id) el?.classList.add('marker-next-highlight')

    // V82: lm.on('click', ...) uses Leaflet's own event system, which suppresses
    // the synthetic click that follows a real drag (Draggable._onUp). A raw DOM
    // addEventListener('click', ...) on the element does not get that suppression.
    lm.on('click', (e) => {
      L.DomEvent.stopPropagation(e)
      this.onMarkerClick?.(m.id)
    })
  }
}
