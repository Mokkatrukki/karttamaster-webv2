// T448/V332: `/kasat` — autoporukan entrypoint. Sama kuvio kuin `patkat.ts`/`inventory.ts`:
// auth-gate → data → render. Init + wiring, ei logiikkaa (V-arkkitehtuuriraja).
//
// Kartta on tässä TAHALLAAN riisuttu: kasat + oma sijainti, EI reittejä eikä pätkiä.
// Autoporukka ajaa teitä ⊥ polkuja ∴ MTB-urat kartalla olisivat kohinaa jonka seasta pitäisi
// etsiä ne neljä pistettä joihin ollaan menossa.

import 'leaflet/dist/leaflet.css'
import './style.css'
import L from 'leaflet'
import { TILE_LAYERS } from './logic/tile-layers'
import { GpsNavigator } from './map/gps-navigator'
import { fetchMarkers } from './logic/sync'
import { loadActivePhase, getActivePhase } from './logic/phase-view'
import { listPiles, type PileRow } from './logic/pile-list'
import { PILE_TARGET } from './logic/pile-list'
import { pushPileStatus } from './logic/pile-sync'
import { renderKasatPage } from './ui/kasat-page'
import { showToast } from './ui/toast'
import { startOutboxRetry } from './logic/outbox-instance'
import type { SignMarker } from './logic/types'

const content = document.getElementById('kasat-content')!

// Syötteen keskusta — ensimmäinen näkymä ennen kuin kasat tai GPS-fix kertovat paremman.
const FALLBACK_CENTER: [number, number] = [65.63, 27.55]

let markers: SignMarker[] = []
let map: L.Map | null = null
let gps: GpsNavigator | null = null
const pileLayers = new Map<string, L.CircleMarker>()

async function boot(): Promise<void> {
  // Auth-gate: ilman sessiota → `/patkat`, jossa yleissalasana-login jo on. Toinen
  // login-lomake olisi toinen ylläpidettävä auth-pinta samasta asiasta.
  let authed = false
  try {
    authed = (await fetch('/api/auth/me')).ok
  } catch {
    authed = false
  }
  if (!authed) {
    window.location.href = '/patkat'
    return
  }

  startOutboxRetry()

  const [, markerRes] = await Promise.all([loadActivePhase(), fetchMarkers()])
  markers = markerRes.ok ? markerRes.markers : []

  const phase = getActivePhase()
  render()

  // §C: kartta & GPS vain purussa — muissa vaiheissa pinta ⊥ ole olemassa ∴ ⊥ syytä
  // käynnistää paikannusta (akku on metsässä niukka).
  if (phase !== 'purku') {
    document.getElementById('kasat-map')?.remove()
    return
  }
  initMap()
}

function currentRows(): PileRow[] {
  return listPiles(markers, gps?.getPosition() ?? null)
}

function render(): void {
  const rows = currentRows()
  renderKasatPage(content, {
    piles: rows,
    phase: getActivePhase(),
    hasFix: gps?.getPosition() != null,
    onCollected: markCollected,
    onSelect: id => {
      const m = markers.find(x => x.id === id)
      if (m && map) map.setView([m.lat, m.lon], Math.max(map.getZoom(), 15))
    },
  })
  syncPileLayers(rows)
}

function markCollected(id: string): void {
  const m = markers.find(x => x.id === id)
  if (!m) return
  // Optimistinen: metsässä vastausta odottava nappi on nappi joka ⊥ reagoi (V116-henki).
  // Outbox kantaa kirjoituksen perille myös katvealueelta.
  const previous = m.status
  m.status = PILE_TARGET.targetStatus
  render()
  void pushPileStatus(id, PILE_TARGET.targetStatus).then(delivered => {
    if (delivered) return
    // Jonoon jäänyt kirjoitus ⊥ ole virhe (V116) — mutta se sanotaan, ⊥ jätetä arvattavaksi.
    showToast('Kuittaus jäi jonoon — lähtee kun verkko palaa.')
  }).catch(() => {
    m.status = previous
    render()
    showToast('Kuittaus ei mennyt läpi.')
  })
}

function initMap(): void {
  const el = document.getElementById('kasat-map')
  if (!el) return
  map = L.map(el, { zoomControl: false }).setView(FALLBACK_CENTER, 11)
  L.control.zoom({ position: 'topright' }).addTo(map)
  const cfg = TILE_LAYERS[0]
  L.tileLayer(cfg.urlTemplate, {
    attribution: cfg.attribution,
    maxZoom: cfg.maxZoom,
    maxNativeZoom: cfg.maxNativeZoom,
  }).addTo(map)

  const rows = currentRows()
  syncPileLayers(rows)
  fitToPiles(rows)

  gps = new GpsNavigator(map)
  gps.start()
  // GpsNavigator ⊥ tarjoa fix-callbackia (se piirtää pisteen itse) ∴ lista järjestetään
  // uudelleen kevyellä kellolla. Autossa on virta & näyttö auki, mutta järjestys ! seurata
  // liikettä — pysähtynyt lista lähettäisi auton juuri sinne mistä se tuli.
  setInterval(() => render(), 5000)
  // V332: kasa syntyy metsässä toisen ihmisen kädestä ∴ lista ! päivittyä ilman että
  // autoporukka lataa sivun uudelleen. Pollaus, ⊥ kertalataus.
  setInterval(() => void refreshMarkers(), 30_000)
}

async function refreshMarkers(): Promise<void> {
  const res = await fetchMarkers()
  if (!res.ok) return
  markers = res.markers
  render()
}

function syncPileLayers(rows: PileRow[]): void {
  if (!map) return
  const seen = new Set<string>()
  for (const row of rows) {
    seen.add(row.marker.id)
    const existing = pileLayers.get(row.marker.id)
    const color = row.done ? '#8A968D' : '#8A5CD1'
    if (existing) {
      existing.setLatLng([row.marker.lat, row.marker.lon])
      existing.setStyle({ fillColor: color, color })
      continue
    }
    const dot = L.circleMarker([row.marker.lat, row.marker.lon], {
      radius: 10,
      weight: 3,
      color,
      fillColor: color,
      fillOpacity: 0.85,
    }).addTo(map)
    dot.on('click', () => {
      const el = content.querySelector(`.kasat-row[data-id="${row.marker.id}"]`)
      el?.scrollIntoView({ block: 'center' })
      el?.classList.add('kasat-row--flash')
      setTimeout(() => el?.classList.remove('kasat-row--flash'), 1200)
    })
    pileLayers.set(row.marker.id, dot)
  }
  for (const [id, layer] of pileLayers) {
    if (seen.has(id)) continue
    layer.remove()
    pileLayers.delete(id)
  }
}

function fitToPiles(rows: PileRow[]): void {
  if (!map || rows.length === 0) return
  map.fitBounds(L.latLngBounds(rows.map(r => [r.marker.lat, r.marker.lon] as [number, number])), {
    padding: [40, 40],
    maxZoom: 14,
  })
}

void boot()
