import L from 'leaflet'
import type { MarkerManager } from '../map/markers'
import { SegmentOverlay } from '../map/segment-overlay'
import { SegmentPanel } from '../ui/segment-panel'
import { PhaseSwitcher } from '../ui/phase-switcher'
import { getSegmentsForPhase, getSegmentForCode } from '../logic/segments'
import type { Segment } from '../logic/segments'
import { fetchSegmentByCode, fetchAllSegments } from '../logic/segment-sync'
import { getActivePhase } from '../logic/phase-view'
import type { RouteConfig } from '../logic/multi-route'
import type { SignMarker } from '../logic/types'
import { mapMode } from '../logic/map-mode'
import { initMarkerFocusPill } from '../ui/marker-focus-pill'

export interface SegmentsWiring {
  segmentStore: Map<string, Segment>
  segmentOverlay: SegmentOverlay
  segmentPanel: SegmentPanel
  renderSegmentOverlay: () => void
  phaseFilteredStore: () => Map<string, Segment>
}

// T146-T153: kolmivaiheinen pätkäelinkaari (asettaminen/tarkastus/purku) — pätkävarasto,
// kartan pätkäkerros ja järjestäjän hallintapaneeli. markerManagerRef on forward-ref (V96:
// pätkän viivatyyli tarvitsee merkit, mutta MarkerManager luodaan vasta markers-wiring.ts:ssä).
export async function wireSegments(
  map: L.Map,
  routes: RouteConfig[],
  talkoolainenCode: string | undefined,
  initialMarkers: SignMarker[],
  markerManagerRef: { current: MarkerManager | null },
  onSaveError: () => void,
  onLoadError: () => void = () => {},
): Promise<SegmentsWiring> {
  const segmentStore = new Map<string, Segment>()
  if (talkoolainenCode) {
    const remote = await fetchSegmentByCode(talkoolainenCode)
    if (remote) segmentStore.set(remote.id, remote)
  } else {
    // T184/V118: latausvirhe ≠ "0 pätkää" — älä jätä hiljaa tyhjää järjestäjän kartalle.
    const result = await fetchAllSegments()
    if (result.ok) {
      for (const seg of result.segments) segmentStore.set(seg.id, seg)
    } else {
      onLoadError()
    }
  }

  // T148: järjestäjä näkee kartalla vain aktiivisen phasen pätkät — talkoolainen aina omansa
  const visibleSegments = (): Segment[] =>
    talkoolainenCode ? Array.from(segmentStore.values()) : getSegmentsForPhase(segmentStore, getActivePhase())

  const phaseFilteredStore = (): Map<string, Segment> => {
    const filtered = new Map<string, Segment>()
    for (const seg of visibleSegments()) filtered.set(seg.id, seg)
    return filtered
  }

  const renderSegmentOverlay = (): void => {
    segmentOverlay.update(phaseFilteredStore(), markerManagerRef.current?.getAll() ?? initialMarkers)
  }

  const segmentOverlay = new SegmentOverlay(map, routes)
  // V142: talkoolaisen näkymässä oma tehtävä kirkas+klikattava, muut himmeä+read-only.
  // Oma = koodilla haettu pätkä; muut näkyvät vasta kun kontekstihaku tuo ne (erillinen task).
  if (talkoolainenCode) {
    const own = getSegmentForCode(segmentStore, talkoolainenCode)
    segmentOverlay.setContextOwn(own?.id)
  }
  renderSegmentOverlay()

  // T307/V218: muokkaustilasta poistuminen sulkee auki olevan rajaeditorin — muuten kahvat
  // jäisivät kartalle raahattaviksi katselutilassa (rinnakkainen mekanismi).
  mapMode.onChange(() => {
    if (!mapMode.canDragSegmentBounds() && segmentOverlay.isEditMode()) segmentOverlay.exitEditMode()
  })

  // T335/V243: järjestäjän korostustila. Asuu TÄÄLLÄ eikä modaalissa — modaali tuhoutuu
  // sulkiessa mutta tila jää päälle, ja poistumis-pilleri on ainoa ulospääsy sen jälkeen.
  // Ei localStoragea: korostus on hetken työkalu, ei asetus.
  let focusSegmentId: string | null = null
  const focusPill = initMarkerFocusPill({ onClear: () => setFocusSegment(null) })

  function setFocusSegment(seg: Segment | null): void {
    focusSegmentId = seg?.id ?? null
    // Järjestäjä: himmennetty PYSYY klikattavana (locked=false) — korostus on lukemisen apu.
    markerManagerRef.current?.setFocusSegment(seg ?? undefined)
    if (seg) focusPill.show(seg.displayName ?? 'pätkä')
    else focusPill.hide()
  }

  let tempCreationMarker: L.CircleMarker | null = null

  const segmentPanel = new SegmentPanel(
    document.getElementById('segment-panel-container')!,
    routes,
    segmentStore,
    () => renderSegmentOverlay(),
    {
      getActivePhase: talkoolainenCode ? undefined : getActivePhase,
      onFirstPoint: (lat, lon) => {
        tempCreationMarker?.remove()
        tempCreationMarker = L.circleMarker([lat, lon], {
          radius: 9, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.85, weight: 2,
          className: 'segment-creation-marker',
        }).addTo(map)
      },
      onFirstPointClear: () => {
        tempCreationMarker?.remove()
        tempCreationMarker = null
      },
      // T307/V218: rajakahvat ovat muokkaustilan toiminto — katselussa no-op (kartalla ei
      // ilmesty raahattavia päätepisteitä). Numeerinen rajojen muokkaus (hero/modaali) ei
      // ole kartan ele ∴ ei tämän portin takana.
      onEnterEditMode: (seg, onSave) => {
        if (!mapMode.canDragSegmentBounds()) return
        segmentOverlay.enterEditMode(seg, onSave)
      },
      onExitEditMode: () => segmentOverlay.exitEditMode(),
      onEnterCreationMode: () => { map.getContainer().style.cursor = 'crosshair' },
      onExitCreationMode: () => { map.getContainer().style.cursor = '' },
      // T150/V94: snap-pisteet vain aktiivisen phasen pätkistä — ei piilotettujen vaiheiden endpointteja
      onShowSnapMarkers: (onSnap) => segmentOverlay.showCreationSnapMarkers(phaseFilteredStore(), onSnap),
      onHideSnapMarkers: () => segmentOverlay.hideCreationSnapMarkers(),
      onSaveError,
      getMarkers: () => markerManagerRef.current?.getAll() ?? [],
      // T335/V243: korostuskytkin pätkämodaalissa — tila tässä, pilleri sen näkyvä ulospääsy.
      isFocusSegment: (seg) => focusSegmentId === seg.id,
      onToggleFocusSegment: (seg, on) => setFocusSegment(on ? seg : null),
    },
  )

  if (!talkoolainenCode) {
    segmentOverlay.setOnSegmentClick(seg => segmentPanel.openDetailsModal(seg))
    const phaseSwitcherContainer = document.getElementById('phase-switcher-container')
    if (phaseSwitcherContainer) {
      new PhaseSwitcher(phaseSwitcherContainer, () => {
        renderSegmentOverlay()
        segmentPanel.refreshCounts()
      })
    }
  }

  return { segmentStore, segmentOverlay, segmentPanel, renderSegmentOverlay, phaseFilteredStore }
}
