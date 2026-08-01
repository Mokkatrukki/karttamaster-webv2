// T448/V332: `/kasat` — autoporukan entrypoint. Sama kuvio kuin `patkat.ts`/`inventory.ts`:
// auth-gate → data → render. Init + wiring, ei logiikkaa (V-arkkitehtuuriraja).
//
// Kartta: kasat + oma sijainti + reittijäljet TAUSTALLA (T458/V343), EI pätkiä.
// T448 jätti reitit pois ("autoporukka ajaa teitä ⊥ polkuja") — käyttäjä 2026-07-31 kumosi sen:
// kasa on reitin varrella & jälki on ainoa asia joka kertoo miten sinne pääsee & kumpi puoli
// järveä on oikea. Jälki on ohut & himmennetty ∴ se ⊥ kilpaile kasapisteiden kanssa.

import 'leaflet/dist/leaflet.css'
import './style.css'
// UX-audit 2026-08-01: teema on KÄYTTÄJÄN valinta (V132/T202) & se persistoituu
// localStorageen — mutta vain `main.ts` sovelsi sen. Talkoolainen joka valitsi Kaamoksen
// karttanäkymässä sai tälle sivulle täyden valkoisen ∴ juuri se pinta joka avataan
// pimeässä metsässä oli ainoa joka ⊥ totellut. `initTheme` ! olla jokaisessa
// entrypointissa ENNEN ensimmäistä renderiä (välkkeen esto).
import { initTheme } from './logic/theme'
import L from 'leaflet'
import { TILE_LAYERS } from './logic/tile-layers'
import { GpsNavigator } from './map/gps-navigator'
// T458/V343: reittijäljet taustaksi — apu ⊥ ehto (lataus ⊥ blokkaa listaa).
import { addRouteTraces } from './map/route-trace'
import { fetchMarkers, startChangeStream } from './logic/sync'
import { loadActivePhase, getActivePhase } from './logic/phase-view'
import { listPiles, allPileRows, type PileGroups, type PileRow } from './logic/pile-list'
import { PILE_TARGET } from './logic/pile-list'
import { pushPileStatus, claimPile, releasePile } from './logic/pile-sync'
import { claimErrorMessage, releaseErrorMessage } from './logic/pile-claim'
import { renderKasatPage, doneGroupCollapsed } from './ui/kasat-page'
import { showToast } from './ui/toast'
import { startOutboxRetry } from './logic/outbox-instance'
import type { SignMarker } from './logic/types'


// Ennen ensimmäistä renderiä: <html data-theme> talteen localStoragesta (ei välkettä).
initTheme()

const content = document.getElementById('kasat-content')!

// Syötteen keskusta — ensimmäinen näkymä ennen kuin kasat tai GPS-fix kertovat paremman.
const FALLBACK_CENTER: [number, number] = [65.63, 27.55]

let markers: SignMarker[] = []
let map: L.Map | null = null
let gps: GpsNavigator | null = null
const pileLayers = new Map<string, L.CircleMarker>()

// T449/V333: varaus on TOINEN VAIHDE ∴ tila alkaa pois päältä & purkautuu kun valinta on tehty.
let selectMode = false
const selected = new Set<string>()

// V333: varaus on ainoa toiminto joka vaatii verkon ∴ sen epäonnistuminen jää RUUDULLE kunnes
// se kuitataan. Toast katoaisi kolmessa sekunnissa & metsässä katse on tiessä ⊥ puhelimessa.
let claimError: string | null = null

// "Haetut (N)" -ryhmän kutistus. `null` = ⊥ vielä koskettu ∴ kasat-page päättää automaatilla.
let doneCollapsed: boolean | null = null

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

function currentRows(): PileGroups {
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
    selectMode,
    selected,
    onToggleSelectMode: () => {
      selectMode = !selectMode
      if (!selectMode) selected.clear()
      render()
    },
    onToggleSelect: id => {
      if (selected.has(id)) selected.delete(id)
      else selected.add(id)
      render()
    },
    onClaimSelected: ids => void claimAll(ids),
    onRelease: id => void release(id),
    error: claimError,
    onDismissError: () => { claimError = null; render() },
    // `null` = automaatti (pitkä ryhmä kiinni). Napautus on käyttäjän oma valinta joka JÄÄ
    // voimaan — 5 s välein tapahtuva uudelleenrender ⊥ saa sulkea ryhmää selän takana.
    doneCollapsed,
    onToggleDone: () => {
      doneCollapsed = !doneGroupCollapsed(rows.done.length, doneCollapsed)
      render()
    },
  })
  syncPileLayers(allPileRows(rows))
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

// T449/V333: varaus epäonnistuu NÄKYVÄSTI & heti (⊥ outboxin kautta) — 20 min myöhässä
// toimitettu "otan nämä" varaa kasan porukalle joka ⊥ enää ole matkalla.
async function claimAll(ids: string[]): Promise<void> {
  claimError = null
  const results = await Promise.all(ids.map(id => claimPile(id)))
  const taken = results.filter(r => !r.ok && r.reason === 'taken')
  const failed = results.filter(r => !r.ok && r.reason === 'error')
  // Valintatila purkautuu kun valinta on tehty — se on väline, ⊥ näkymä johon jäädään.
  selectMode = false
  selected.clear()
  // V333: mikään EI ole optimistista — rivin varaustila tulee serveriltä ∴ läpi menemätön
  // varaus ⊥ voi jäädä ruudulle valheena. Haku ennen banneria: sama render näyttää molemmat.
  if (failed.length > 0) {
    const first = failed[0]
    const status = !first.ok && first.reason === 'error' ? first.status : null
    claimError = claimErrorMessage(status, failed.length)
  }
  await refreshMarkers()
  render()
  if (taken.length > 0) {
    const by = taken.find(r => !r.ok && r.reason === 'taken' && r.by)
    const who = by && !by.ok && by.reason === 'taken' ? by.by : undefined
    // "Joku ehti ensin" ⊥ ole virhe vaan tulos: serveri kertoi totuuden & lista näyttää sen ∴
    // toast riittää. Banneri on varattu sille mikä JÄI TEKEMÄTTÄ.
    showToast(who ? `${who} ehti ensin — ${taken.length} kasaa oli jo varattu.` : `${taken.length} kasaa oli jo varattu.`)
  }
}

async function release(id: string): Promise<void> {
  claimError = null
  const res = await releasePile(id)
  if (!res.ok) {
    claimError = releaseErrorMessage(res.status)
    render()
    return
  }
  await refreshMarkers()
  render()
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

  const rows = allPileRows(currentRows())
  syncPileLayers(rows)
  fitToPiles(rows)

  // T458/V343: reittijäljet TAUSTAKSI — kasa on reitin varrella & jälki kertoo miten sinne
  // pääsee. Lataus ⊥ blokkaa mitään (`void`): lista & pisteet ovat jo ruudulla, jäljet
  // täydentyvät kun GPX:t saapuvat. Ilman kasoja rajaus reitteihin — tyhjä keskitys olisi
  // kartta josta ⊥ näe mitään.
  void addRouteTraces(map).then(traces => {
    if (rows.length > 0 || !map) return
    const b = traces.bounds()
    if (b) map.fitBounds(b, { padding: [20, 20] })
  })

  gps = new GpsNavigator(map)
  gps.start()
  // GpsNavigator ⊥ tarjoa fix-callbackia (se piirtää pisteen itse) ∴ lista järjestetään
  // uudelleen kevyellä kellolla. Autossa on virta & näyttö auki, mutta järjestys ! seurata
  // liikettä — pysähtynyt lista lähettäisi auton juuri sinne mistä se tuli.
  setInterval(() => render(), 5000)
  // V332: kasa syntyy metsässä toisen ihmisen kädestä ∴ lista ! päivittyä ilman että
  // autoporukka lataa sivun uudelleen. Pollaus, ⊥ kertalataus.
  setInterval(() => void refreshMarkers(), 30_000)

  // T446/V330: SSE-heräte pollauksen RINNALLE — toisen porukan varaus ! näkyä sekunneissa,
  // ⊥ puolen minuutin päästä. Pollaus EI poistu: katkennut stream ⊥ saa pysäyttää mitään,
  // & metsässä yhteys katkeaa jatkuvasti. Heräte vain aikaistaa seuraavan haun.
  startChangeStream({
    onWake: events => {
      if (events.some(e => e.type === 'pile' || e.type === 'marker')) void refreshMarkers()
    },
  })
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
