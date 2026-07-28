import L from 'leaflet'
import { nearestPointIndex } from '../logic/bearing'
import type { RoutePoint, SignMarker } from '../logic/types'
import type { Segment, SegmentStore, SegmentLineState } from '../logic/segments'
import { segmentLineColor, segmentLineState, getPhaseProgress, segmentPrimaryRouteId } from '../logic/segments'
import { segmentLayerStyles } from '../logic/segment-style'
import { segmentVisibleOnRoutes } from '../logic/segment-visibility'
import type { MapFilter } from '../logic/map-filter'
import { defaultMapFilter, segmentVisibility, DIM_OPACITY } from '../logic/map-filter'

// T336: casing tarvitsee reitin VÄRIN sisukseen. Valinnainen ∴ vanhat kutsupaikat & testit
// (jotka antavat vain geometrian) toimivat ennallaan — ilman väriä piirtyy yksi viiva.
interface RouteRef { id: string; routePoints: RoutePoint[]; color?: string }

// T152/V96: viivatyyli = status. Väri = tunniste (colorForSegment) paitsi valmiina (T348).
// T348/V252/B135: dashArray oli '1 9' MOLEMMISSA katkotiloissa = 1px viiva 9px aukosta ∴ kuvio
// hajosi pistesarjaksi joka katosi MML-taustakartan tekstuuriin — kolme tilaa erottui käytännössä
// vain valmiin ehjyydestä. Nyt viivanpätkä on aukon kokoluokkaa & kolme tilaa erottuu myös
// AKROMAATTISESTI (ehjä / karkea katko / haalea harva katko), ⊥ vain leveydellä tai värillä.
export const LINE_STATE_STYLE: Record<SegmentLineState, { opacity: number; weight: number; dashArray?: string }> = {
  valmis:     { opacity: 0.9,  weight: 11 },                     // ehjä
  kesken:     { opacity: 0.85, weight: 11, dashArray: '10 8' },  // karkea katko
  ei_alkanut: { opacity: 0.7,  weight: 9,  dashArray: '6 12' },  // harva katko, kevyin
}
// UX-audit 2026-07-27: ei_alkanut oli `opacity 0.4` = efektiivinen kontrasti 1.79:1 vaaleaa
// MML-taustaa vasten (WCAG non-text min 3:1) ∴ "ei aloitettu" katosi kirkkaassa — & juuri se on
// tila jonka järjestäjän ! bongata kartalta (kuka ⊥ ole aloittanut). 0.7 = 3.0:1. Hierarkia ⊥
// katoa: valmis/kesken/ei_alkanut erottuvat yhä kuviolla ('' / '10 8' / '6 12'), leveydellä
// (11/11/9) & alfalla (.9/.85/.7) ∴ kevein on yhä kevein, muttei näkymätön.

export interface ContextLineStyle {
  opacity: number
  weight: number
  dashArray?: string
  interactive: boolean
  /** T375/V270: himmennetty = ⊥ huomion kohde. ERI asia kuin `interactive` (= omistajuus). */
  dimmed: boolean
}

// V142: talkoolaisen näkymässä oma tehtävä kirkas + klikattava, muut himmeä + read-only.
// Pure — Leaflet vain soveltaa. contextOwnId === undefined = ei kontekstia (kaikki kirkkaita).
//
// T375/V270/B158: `locked` erottaa HIMMENNYKSEN & INTERAKTIOLUKON. Ennen tätä ne olivat samassa
// boolissa ∴ järjestäjän korostuskytkin (T335) ⊥ voinut himmentää pätkäviivoja lainkaan — se
// olisi samalla lukinnut ne klikkaamattomiksi, & järjestäjä omistaa kaiken. Talkoolainen saa
// molemmat (locked=true, V142/V93/V150: vieras pätkä ⊥ ole hänen muokattavissaan), järjestäjä
// vain himmennyksen (locked=false: himmeä MUTTA klikattava, korostus on lukemisen apu).
//
// Testattavuus: Vitest-pure.
export const CONTEXT_DIM_OPACITY = 0.22
export function contextSegmentStyle(
  base: { opacity: number; weight: number; dashArray?: string },
  contextOwnId: string | undefined,
  segId: string,
  locked = true,
): ContextLineStyle {
  const isOwn = contextOwnId === undefined || segId === contextOwnId
  if (isOwn) return { ...base, interactive: true, dimmed: false }
  return {
    opacity: Math.min(base.opacity, CONTEXT_DIM_OPACITY),
    weight: Math.max(base.weight - 4, 5),
    dashArray: base.dashArray,
    interactive: !locked,
    dimmed: true,
  }
}

// T347/V250: nimilappu on pätkän ainoa LUETTAVA kohde kartalla ∴ sen ! olla myös klikattava
// sisääntulo — muuten käyttäjä osoittaa nimeä eikä mitään tapahdu (klikkaus läpäisee kartalle,
// Leaflet-tooltip on oletuksena pointer-events:none) & osuma vaatii ~8px viivan klikkausta lapun
// vierestä. `interactive` on SAMA lippu joka ohjaa polylinen interactivea & click-kytkentää ∴
// V142-himmennys pitää ilman toista totuutta: vieraan pätkän lappu pysyy läpäisevänä.
// Klikkiä ⊥ kytketä tooltipiin: Leaflet tekee `addEventParent(this._source)` tooltipin avautuessa
// (leaflet-src.js:10685) ∴ lapun klikki propagoi polylinelle & olemassa oleva `line.on('click')`
// hoitaa modaalin. Oma kuuntelija tooltipille = tuplalaukaisu.
// T348/V96-amend: `done` lisää `--done`-luokan (vihreä reunus, ✓ tulee tekstiin kutsupaikalla).
// Luokkajonon kokoaminen pysyy TÄSSÄ yhdessä funktiossa ⊥ valu kutsupaikalle. `--dim` & `--done`
// ⊥ ole toisensa poissulkevia: talkoolaisen konteksti-lappu voi olla valmis (V142 himmennys pätee
// silti — se on eri kanava kuin status).
// Testattavuus: Vitest-pure.
// T375/V270: `dimmed` on OMA parametrinsa — oletuksena se seuraa `interactive`ia (vanha
// kaksoismerkitys säilyy kutsupaikoille jotka tuntevat vain klikattavuuden), mutta järjestäjän
// korostuksessa lappu on himmeä JA klikattava. Yksi lippu ⊥ voi kantaa kahta merkitystä (B158).
export function segmentLabelOptions(interactive: boolean, done = false, dimmed = !interactive): L.TooltipOptions {
  const classes = ['segment-label']
  if (dimmed) classes.push('segment-label--dim')
  if (done) classes.push('segment-label--done')
  return {
    permanent: true,
    className: classes.join(' '),
    direction: 'center',
    interactive,
  }
}

export class SegmentOverlay {
  private layers: L.Layer[] = []
  private editMarkers: L.Marker[] = []
  private snapMarkers: L.CircleMarker[] = []
  private onSegmentClick?: (seg: Segment) => void
  private contextOwnId?: string
  private contextLocked = true
  private visibleRouteIds?: string[]
  private mapFilter: MapFilter = defaultMapFilter()

  constructor(
    private readonly map: L.Map,
    private readonly routes: RouteRef[],
  ) {}

  setOnSegmentClick(cb: (seg: Segment) => void): void {
    this.onSegmentClick = cb
  }

  // V142: talkoolaisen näkymä — oma tehtävä kirkas+klikattava, muut himmeä+read-only.
  // undefined = järjestäjä (kaikki kirkkaita, klikattavia). Kutsu ennen update():a.
  // T375/V270: `locked` = interaktiolukko. Talkoolainen true (V142: vieras pätkä ⊥ hänen),
  // järjestäjän korostus false (himmeä mutta klikattava — hän omistaa kaiken).
  setContextOwn(ownId: string | undefined, locked = true): void {
    this.contextOwnId = ownId
    this.contextLocked = locked
  }

  // T374/V269/B157: reittinäkyvyys koskee myös pätkäkerrosta. Sama V137-kuvio kuin
  // setContextOwn — kutsu ENNEN update():a, tila jää voimaan seuraaviin rendereihin.
  // undefined = ⊥ suodatinta (talkoolainen; järjestäjä ennen ensimmäistä valintaa).
  setVisibleRoutes(ids: string[] | undefined): void {
    this.visibleRouteIds = ids
  }

  // T377/V271: suodatin päättää, overlay soveltaa. Kutsu ENNEN update():a (V137-kuvio).
  setMapFilter(filter: MapFilter): void {
    this.mapFilter = filter
    this.visibleRouteIds = filter.visibleRouteIds
  }

  update(store: SegmentStore, markers: SignMarker[] = []): void {
    this.clear()
    const segments = Array.from(store.values())

    // T378/V273/B159: AUKKORENDER POISTETTU. Aukko (= reitin osuus jolla ⊥ pätkää) luetaan
    // PALJAASTA REITTIVIIVASTA — pätkä on värillinen casing (T336), sen puuttuminen ON aukko.
    // Vanha harmaa `#94a3b8 @ 0.3` -viiva oli kolmas visuaalinen kanava reitin & pätkän päällä,
    // & mitattavasti näkymätön maastokartalla ∴ järjestäjä pyysi 2026-07-28 ominaisuutta joka
    // oli koodissa jo. Aukon havaittavuus ratkeaa PÄTKÄN kontrastilla (§K alfa-alaraja ≥3:1),
    // ⊥ aukon omalla tyylillä — yksi säädin ⊥ kaksi.

    // T152/V96: väri = tunniste (stabiili per id), viivatyyli = phase-status.
    // T348: valmis-tila ohittaa tunnistevärin (segmentLineColor) — status voittaa identiteetin.
    for (const seg of segments) {
      // T374/V269/B157: piilotetun reitin pätkäviiva & nimilappu katoavat reitin mukana.
      // Reititön tehtävä (V139) läpäisee aina — predikaatti hoitaa sen, ⊥ toista sääntöä tänne.
      if (!segmentVisibleOnRoutes(seg, this.visibleRouteIds)) continue
      // V259: `segments` on kutsujan phase-suodatettu joukko (`phaseFilteredStore`) ∴ se ON
      // kilpailijajoukko. Ilman sitä laskuri putoaisi legacy-sääntöön & kartan viivatyyli
      // kertoisi eri tarinan kuin pätkän oma lista — tilannekuva ⊥ saa olla kahta mieltä.
      const progress = getPhaseProgress(seg, markers, segments)
      // T353/V256 (B142): talkoolaisen kuittaus (`completed`) voittaa merkkilaskurin — ilman tätä
      // eksplisiittinen "pätkä valmis" ⊥ näkynyt kartalla lainkaan.
      const state = segmentLineState(progress, seg.completed)
      const color = segmentLineColor(seg.id, state)
      const done = state === 'valmis'
      // T377/V271: suodatin päättää — overlay soveltaa. 'hidden' = ⊥ renderöidä (eksplisiittinen
      // käyttäjävalinta, V243-amend), 'dim' = sama himmennyskieli kuin fokuksella.
      const filterVis = segmentVisibility(seg, this.mapFilter, { state, markers, peers: segments })
      if (filterVis === 'hidden') continue
      // V142: himmennä muut tehtävät talkoolaisen näkymässä; oma säilyy kirkkaana.
      let style = contextSegmentStyle(LINE_STATE_STYLE[state], this.contextOwnId, seg.id, this.contextLocked)
      if (filterVis === 'dim' && !style.dimmed) {
        // V270: suodattimen himmennys ⊥ ole lukko — pätkä pysyy klikattavana (järjestäjän
        // työkalu). Alfa portaasta jonka käyttäjä valitsi (V243-amend).
        const lineAlpha = DIM_OPACITY[this.mapFilter.dimLevel === 'kevyt' ? 'kevyt' : 'vahva'].line
        style = { ...style, opacity: Math.min(style.opacity, lineAlpha), dimmed: true }
      }
      // T348/V252/B135: ✓ KAIKISSA phaseissa (ennen: vain tarkastus) & PREFIXINÄ — nimi voi
      // katketa lapun leveyteen, merkki ⊥ saa. "Valmis" ⊥ saa olla pääteltävissä vain katkon
      // puuttumisesta: positiivinen tila tarvitsee positiivisen merkin jota etsiä.
      const labelPrefix = done ? '✓ ' : ''
      // V139: reititön tehtävä ei piirrä reitti-polylinea (T217 tuo oman render-haaran).
      if (!seg.routeIds || seg.startDist === undefined || seg.endDist === undefined) continue
      const segStart = seg.startDist
      const segEnd = seg.endDist
      // T299/V211/B114: km-väli leikataan VAIN primary-reitistä. Ennen tätä sama [start,end]
      // leikattiin jokaisesta jäsenreitistä ∴ jaetun osuuden pätkä piirtyi naapurireitin
      // km-kohtaan = kartalle ilmestyi viiva aivan väärään paikkaan.
      {
        const routeId = segmentPrimaryRouteId(seg)
        const route = this.routes.find(r => r.id === routeId)
        if (!route) continue
        const pts = sliceRoutePoints(route.routePoints, segStart, segEnd)
        if (pts.length < 2) continue
        // T336/V244/B137: casing — pätkäväri reunaksi, valkoinen erotin, reitin väri sisukseksi.
        // Piirtojärjestys on merkitsevä (Leaflet: myöhempi päälle) ∴ tyylit tulevat valmiiksi
        // järjestettynä puhtaalta funktiolta. Kaikki kerrokset samaan this.layers-listaan ⇒
        // clear() poistaa parin/kolmikon, ⊥ jätä orpoa viivaa kartalle.
        const layerStyles = segmentLayerStyles({
          segmentColor: color,
          routeColor: route.color,
          base: { opacity: style.opacity, weight: style.weight, dashArray: style.dashArray },
          // T375/V270: casing seuraa KOROSTUSTA, klikki seuraa OMISTAJUUTTA — järjestäjän
          // himmennetty pätkä on yksiviivainen mutta yhä klikattava (B158).
          highlighted: !style.dimmed,
          interactive: style.interactive,
        })
        let line: L.Polyline | undefined
        for (const ls of layerStyles) {
          const pl = L.polyline(pts, {
            color: ls.color, weight: ls.weight, opacity: ls.opacity,
            dashArray: ls.dashArray, lineCap: 'round',
            // V142 + T336: VAIN casing ottaa klikin. Sisus/erotin non-interactive ∴ klikki
            // läpäisee niistä alle casingiin — muuten kolme kerrosta = kolme kuuntelijaa.
            interactive: ls.interactive,
          })
          pl.addTo(this.map)
          this.layers.push(pl)
          if (ls.interactive) line = pl
        }
        if (line && seg.displayName) {
          line.bindTooltip(labelPrefix + seg.displayName, segmentLabelOptions(style.interactive, done, style.dimmed))
        }
        if (line && this.onSegmentClick && style.interactive) {
          const clickedSeg = seg
          line.on('click', (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e)
            this.onSegmentClick!(clickedSeg)
          })
        }
      }
    }
  }

  clear(): void {
    this.layers.forEach(l => l.remove())
    this.layers = []
  }

  isEditMode(): boolean {
    return this.editMarkers.length > 0
  }

  exitEditMode(): void {
    this.editMarkers.forEach(m => m.remove())
    this.editMarkers = []
  }

  showCreationSnapMarkers(
    store: SegmentStore,
    onSnap: (routeId: string, dist: number, lat: number, lon: number) => void,
  ): void {
    this.hideCreationSnapMarkers()
    for (const seg of store.values()) {
      if (!seg.routeIds || seg.startDist === undefined || seg.endDist === undefined) continue
      const segStart = seg.startDist
      const segEnd = seg.endDist
      // T299/V211: snap-pisteet primary-reitin km-kohtiin (ks. render-haaran perustelu).
      {
        const routeId = segmentPrimaryRouteId(seg)
        const route = this.routes.find(r => r.id === routeId)
        if (!route || !routeId) continue
        for (const [dist, color] of [[segStart, '#f59e0b'], [segEnd, '#10b981']] as [number, string][]) {
          const pos = routePointAtDist(route.routePoints, dist)
          const m = L.circleMarker(pos, { radius: 8, color, fillColor: color, fillOpacity: 0.9, weight: 2 })
          m.on('click', (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e)
            onSnap(routeId, dist, pos[0], pos[1])
          })
          m.addTo(this.map)
          this.snapMarkers.push(m)
        }
      }
    }
  }

  hideCreationSnapMarkers(): void {
    this.snapMarkers.forEach(m => m.remove())
    this.snapMarkers = []
  }

  // Place draggable start/end markers for the segment. onSave called on each snap.
  enterEditMode(seg: Segment, onSave: (startDist: number, endDist: number) => void): void {
    this.exitEditMode()
    // V139: reitittömällä tehtävällä ei raahattavia raja-merkkejä.
    if (!seg.routeIds || seg.startDist === undefined || seg.endDist === undefined) return
    // T299/V211/B114: A/B-raahausmerkit primary-reitille — `find(includes)` otti listajärjestyksen
    // ensimmäisen jäsenen ∴ jaetulla osuudella rajat piirtyivät eri geometriaan kuin km:t mittaavat.
    const primaryId = segmentPrimaryRouteId(seg)
    const route = this.routes.find(r => r.id === primaryId)
    if (!route) return

    let editStartDist = seg.startDist
    let editEndDist = seg.endDist

    const startPos = routePointAtDist(route.routePoints, seg.startDist)
    const endPos = routePointAtDist(route.routePoints, seg.endDist)

    const startIcon = L.divIcon({ className: 'segment-edit-marker segment-edit-marker--start', html: 'A', iconSize: [24, 24] })
    const endIcon = L.divIcon({ className: 'segment-edit-marker segment-edit-marker--end', html: 'B', iconSize: [24, 24] })

    const startMarker = L.marker(startPos, { draggable: true, icon: startIcon, title: 'Aloituspiste (raahaa)' })
    const endMarker = L.marker(endPos, { draggable: true, icon: endIcon, title: 'Lopetuspiste (raahaa)' })

    startMarker.on('dragend', () => {
      const { lat, lng } = startMarker.getLatLng()
      const idx = nearestPointIndex(route.routePoints, lat, lng)
      const pt = route.routePoints[idx]
      editStartDist = pt.distanceFromStart
      startMarker.setLatLng([pt.lat, pt.lon])
      if (editStartDist < editEndDist) onSave(editStartDist, editEndDist)
    })

    endMarker.on('dragend', () => {
      const { lat, lng } = endMarker.getLatLng()
      const idx = nearestPointIndex(route.routePoints, lat, lng)
      const pt = route.routePoints[idx]
      editEndDist = pt.distanceFromStart
      endMarker.setLatLng([pt.lat, pt.lon])
      if (editEndDist > editStartDist) onSave(editStartDist, editEndDist)
    })

    startMarker.addTo(this.map)
    endMarker.addTo(this.map)
    this.editMarkers = [startMarker, endMarker]
  }
}

function routePointAtDist(routePoints: RoutePoint[], dist: number): [number, number] {
  let closest = routePoints[0]
  let minDiff = Math.abs(routePoints[0].distanceFromStart - dist)
  for (const pt of routePoints) {
    const diff = Math.abs(pt.distanceFromStart - dist)
    if (diff < minDiff) {
      minDiff = diff
      closest = pt
    }
  }
  return [closest.lat, closest.lon]
}

function sliceRoutePoints(points: RoutePoint[], startDist: number, endDist: number): [number, number][] {
  return points
    .filter(p => p.distanceFromStart >= startDist && p.distanceFromStart <= endDist)
    .map(p => [p.lat, p.lon])
}

