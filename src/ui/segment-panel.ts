import { nearestPointIndex, haversineDistance } from '../logic/bearing'
import { buildTrackFromAnchors, nextAnchorIndex, type AnchorHit } from '../logic/segment-track'
import {
  validateNoOverlap,
  getSegmentStatusCounts,
  segmentPeers,
  formatStatusCounts,
  getPhaseProgress,
  formatPhaseProgress,
  getSegmentsForPhase,
  segmentPath,
} from '../logic/segments'
import type { SegmentStore, Segment } from '../logic/segments'
import { SHARED_THRESHOLD_M, type RouteConfig } from '../logic/multi-route'
import type { SignMarker } from '../logic/types'
import { SegmentCreationModal, type CreationState } from './segment-creation-modal'
import { SegmentDetailsModal } from './segment-details-modal'
import { openSegmentRowMenu } from './segment-row-menu'
import { createSectionHeader, type SectionHeader } from './section-header'

export interface SegmentPanelCallbacks {
  onFirstPoint?: (lat: number, lon: number) => void
  onFirstPointClear?: () => void
  onEnterEditMode?: (seg: Segment, onSave: (startDist: number, endDist: number) => void) => void
  onExitEditMode?: () => void
  onSaveError?: (err: unknown) => void
  getMarkers?: () => SignMarker[]
  onEnterCreationMode?: () => void
  onExitCreationMode?: () => void
  onShowSnapMarkers?: (onSnap: (routeId: string, dist: number, lat: number, lon: number) => void) => void
  onHideSnapMarkers?: () => void
  // T148: globaali phase-näkymän suodin — undefined = näytä kaikki (taaksepäin yhteensopiva)
  getActivePhase?: () => Segment['phase']
  // T335/V243: kartan korostus vain valittuun pätkään — tila asuu wiringissä, paneeli välittää
  isFocusSegment?: (seg: Segment) => boolean
  onToggleFocusSegment?: (seg: Segment, on: boolean) => void
  // T345: rajaa kartta pätkään (`···` → Näytä kartalla). Puuttuu → riviä ei näytetä valikossa.
  onShowSegmentOnMap?: (seg: Segment) => void
  // T345: näkyvä palaute (linkin kopiointi). Puuttuu → hiljainen onnistuminen.
  onNotify?: (msg: string) => void
}

export class SegmentPanel {
  private readonly statusEl: HTMLElement
  private readonly listEl: HTMLUListElement
  // T371/V267: header on jaetun apurin kahva (nimi+count yhtenä stringinä, kuten ennen).
  private readonly header: SectionHeader
  private state: CreationState = { mode: 'idle' }
  private collapsed = true
  private readonly creationModal: SegmentCreationModal
  private readonly detailsModal: SegmentDetailsModal

  constructor(
    container: HTMLElement,
    private readonly routes: RouteConfig[],
    private readonly store: SegmentStore,
    private readonly onUpdate: () => void,
    private readonly callbacks: SegmentPanelCallbacks = {},
  ) {
    const { panel, statusEl, listEl, header } = this.build()
    this.statusEl = statusEl
    this.listEl = listEl
    this.header = header
    container.appendChild(panel)

    this.creationModal = new SegmentCreationModal(
      store,
      () => this.cancelCreation(),
      (seg) => {
        this.state = { mode: 'idle' }
        this.callbacks.onExitCreationMode?.()
        this.render()
        this.onUpdate()
        // T298/V209/B113: luotu pätkä aukeaa suoraan lisätiedot-modaaliin — järjestäjä näkee
        // linkin ja voi muokata heti. Slug syntyy luonnissa (T297), ei "jaa linkki" -porttia.
        this.detailsModal.open(seg)
      },
      () => this.creationPhase(),
      () => this.callbacks.getMarkers?.() ?? [],
      () => this.undoAnchor(),
      () => this.finishPath(),
    )

    this.detailsModal = new SegmentDetailsModal(
      store,
      onUpdate,
      () => this.render(),
      {
        getMarkers: callbacks.getMarkers,
        // T363: modaali johtaa jäljen rajamuokkauksessa — reitit tulevat paneelilta.
        getRoutes: () => this.routes,
        onEnterEditMode: callbacks.onEnterEditMode,
        onExitEditMode: callbacks.onExitEditMode,
        isFocusSegment: callbacks.isFocusSegment,
        onToggleFocusSegment: callbacks.onToggleFocusSegment,
      },
    )

    this.render()
  }

  // T141/B61: kutsutaan merkin status-muutoksesta (main.ts MarkerManager onUpdate) — päivittää
  // rivien status-lukumäärät ilman että segmentin oma data on muuttunut.
  refreshCounts(): void {
    this.render()
  }

  isCreationMode(): boolean {
    return this.state.mode !== 'idle'
  }

  // T150/T151/V94: uusi pätkä + overlap-validointi kohdistuu aktiiviseen phase-näkymään
  private creationPhase(): Segment['phase'] {
    return this.callbacks.getActivePhase?.() ?? 'asettaminen'
  }

  cancelCreation(): void {
    if (this.state.mode === 'idle') return
    this.state = { mode: 'idle' }
    this.statusEl.hidden = true
    this.creationModal.close()
    this.callbacks.onFirstPointClear?.()
    this.callbacks.onHideSnapMarkers?.()
    this.callbacks.onExitCreationMode?.()
    this.applyCollapsed()
  }

  onMapClick(lat: number, lon: number): void {
    // reititön/tiedot/idle eivät ota kartta-klikkejä (vain reitin piste-poiminta vaihe1/polku)
    if (this.state.mode !== 'vaihe1' && this.state.mode !== 'polku') return
    this.receivePoint(lat, lon)
  }

  onSnapClick(_routeId: string, _dist: number, lat: number, lon: number): void {
    // T362: snap-markerin routeId/dist ⊥ ohita ankkurilogiikkaa — sama eteenpäin-haku ratkaisee
    // kierroksen myös snapissa. Muuten snap olisi takaovi jolla B144 palaisi.
    if (this.state.mode !== 'vaihe1' && this.state.mode !== 'polku') return
    this.receivePoint(lat, lon)
  }

  openDetailsModal(seg: Segment): void {
    this.detailsModal.open(seg)
  }

  // T362/B144: klikki → ANKKURI. Ensimmäinen lukitsee reitin (& näyttää sen), seuraavat haetaan
  // edellisestä indeksistä ETEENPÄIN ∴ edestakainen osuus ⊥ ole arvaus.
  private receivePoint(lat: number, lon: number): void {
    if (this.state.mode === 'vaihe1') {
      const first = this.resolveClick(lat, lon)
      if (!first) return
      const route = this.routes.find(r => r.id === first.routeId)
      this.state = {
        mode: 'polku',
        routeId: first.routeId,
        routeLabel: route?.label ?? first.routeId,
        anchors: [first.hit],
      }
      this.callbacks.onFirstPoint?.(first.hit.lat, first.hit.lon)
      this.creationModal.updatePhase(this.state)
      return
    }

    if (this.state.mode === 'polku') {
      const st = this.state
      const route = this.routes.find(r => r.id === st.routeId)
      if (!route) return
      const last = st.anchors[st.anchors.length - 1]
      // +1: sama piste kahdesti ⊥ ole ankkuri (buildTrackFromAnchors vaatii aidon kasvun).
      const hit = nextAnchorIndex(route.routePoints, lat, lon, last.idx + 1, SHARED_THRESHOLD_M)
      if (!hit) {
        this.creationModal.setError(
          `Ei osumaa reitillä ${st.routeLabel} eteenpäin — klikkaa reittiviivan varrelta`,
        )
        return
      }
      this.state = { ...st, anchors: [...st.anchors, hit] }
      this.creationModal.updatePhase(this.state)
    }
  }

  /** T362: "Poista viimeinen" — ankkurit ovat paneelin tilaa, modaali vain pyytää. */
  private undoAnchor(): void {
    if (this.state.mode !== 'polku' || this.state.anchors.length < 2) return
    this.state = { ...this.state, anchors: this.state.anchors.slice(0, -1) }
    this.creationModal.updatePhase(this.state)
  }

  /** T362/V258: "Valmis" — ankkureista jälki, jäljestä rajat. */
  private finishPath(): void {
    if (this.state.mode !== 'polku' || this.state.anchors.length < 2) return
    const st = this.state
    const route = this.routes.find(r => r.id === st.routeId)
    if (!route) return

    const anchors = st.anchors
    const track = buildTrackFromAnchors(route.routePoints, anchors.map(a => a.idx))
    const startDist = anchors[0].dist
    const endDist = anchors[anchors.length - 1].dist

    if (endDist - startDist < 1) {
      this.creationModal.setError('Pätkä on liian lyhyt — klikkaa kauempaa')
      return
    }

    // T362/V25/V259: päällekkäisyys on VAROITUS ⊥ este. Jaettu korridori on laillinen (V25) &
    // jäsenyys ratkeaa nyt lähimmällä jäljellä (V259) ∴ luontieste torjuisi oikeita pätkiä.
    // Saman primaryn päällekkäisyys on silti todennäköinen virhe → kerro se ääneen.
    if (!validateNoOverlap(this.store, st.routeId, startDist, endDist, this.creationPhase())) {
      this.callbacks.onNotify?.('Huom: pätkä menee päällekkäin toisen kanssa samalla reitillä')
    }

    this.state = {
      mode: 'tiedot',
      routeIds: this.sharedRouteIds(st.routeId, startDist, endDist),
      primaryRouteId: st.routeId,
      startDist,
      endDist,
      track,
    }
    this.callbacks.onFirstPointClear?.()
    this.callbacks.onHideSnapMarkers?.()
    this.creationModal.updatePhase(this.state)
  }

  // T299/V25/V211: pätkän jäsenreitit = ne jotka kulkevat pätkän MATKALLA primaryn rinnalla
  // (≤SHARED_THRESHOLD_M koko välin ajan), ei "se reitti johon klikki 2 sattui osumaan".
  // Otos primaryn pisteistä välillä [startDist,endDist]; reitti kelpaa vain jos se on lähellä
  // JOKAISTA otospistettä — yhdessä kohdassa risteävä reitti ei tee siitä jaettua osuutta.
  private sharedRouteIds(primaryRouteId: string, startDist: number, endDist: number): string[] {
    const primary = this.routes.find(r => r.id === primaryRouteId)
    if (!primary) return [primaryRouteId]

    const inRange = primary.routePoints.filter(
      p => p.distanceFromStart >= startDist && p.distanceFromStart <= endDist,
    )
    if (inRange.length === 0) return [primaryRouteId]
    const step = Math.max(1, Math.floor(inRange.length / 12))
    const samples = inRange.filter((_, i) => i % step === 0)

    const ids = [primaryRouteId]
    for (const route of this.routes) {
      if (route.id === primaryRouteId || route.routePoints.length === 0) continue
      const alongside = samples.every(s => {
        const pt = route.routePoints[nearestPointIndex(route.routePoints, s.lat, s.lon)]
        return haversineDistance(pt, s) <= SHARED_THRESHOLD_M
      })
      if (alongside) ids.push(route.id)
    }
    return ids
  }

  // T362: ensimmäinen klikki — lähin reitti yli kaikkien, ILMAN kynnystä (snap, kuten ennen).
  // Kynnys tässä olisi väärä: klikki reittiviivan vierestä ⊥ tuottaisi mitään & käyttäjä jäisi
  // ilman palautetta. Valinta ⊥ ole enää hiljainen — modaali näyttää reitin nimen & ankkurin
  // km:n (B144(a)) ∴ väärä snap on NÄHTÄVISSÄ & peruttavissa. Jatkoklikeillä kynnys ON
  // (SHARED_THRESHOLD_M) koska niillä on virheteksti joka kertoo mitä tapahtui.
  private resolveClick(lat: number, lon: number): { routeId: string; hit: AnchorHit } | null {
    let best: { routeId: string; hit: AnchorHit } | null = null
    let bestDist = Infinity
    for (const route of this.routes) {
      const hit = nextAnchorIndex(route.routePoints, lat, lon, 0, Infinity)
      if (!hit) continue
      const d = haversineDistance({ lat: hit.lat, lon: hit.lon }, { lat, lon })
      if (d < bestDist) {
        bestDist = d
        best = { routeId: route.id, hit }
      }
    }
    return best
  }

  private applyCollapsed(): void {
    const count = this.store.size
    this.header.setName(`Reittipätkät (${count})`)
    this.header.setCollapsed(this.collapsed)
    this.listEl.hidden = this.collapsed
    if (this.collapsed) this.statusEl.hidden = true
  }

  private build(): {
    panel: HTMLElement
    statusEl: HTMLElement
    listEl: HTMLUListElement
    header: SectionHeader
  } {
    const panel = document.createElement('div')
    panel.id = 'segment-panel'

    // T371/V267: jaettu apuri. `.segment-panel-header` säilyy lisäluokkana (testiselektori),
    // samoin `.btn-segment-toggle` toggle-spanissa.
    const header = createSectionHeader({
      name: 'Reittipätkät (0)',
      collapsed: true,
      toggleClass: 'btn-segment-toggle',
      onToggle: () => {
        this.collapsed = !this.collapsed
        this.render()
      },
    })
    header.el.classList.add('segment-panel-header')

    panel.appendChild(header.el)

    const statusEl = document.createElement('div')
    statusEl.className = 'segment-panel-status'
    statusEl.hidden = true
    panel.appendChild(statusEl)

    const listEl = document.createElement('ul')
    listEl.id = 'segment-list'
    listEl.className = 'segment-list'
    panel.appendChild(listEl)

    return { panel, statusEl, listEl, header }
  }

  private enterCreationMode(): void {
    this.collapsed = false
    this.applyCollapsed()
    this.state = { mode: 'vaihe1' }
    this.callbacks.onEnterCreationMode?.()
    this.callbacks.onShowSnapMarkers?.((routeId, dist, lat, lon) =>
      this.onSnapClick(routeId, dist, lat, lon),
    )
    this.creationModal.open(this.state)
  }

  // T216/V139: reititön (alue)tehtävä — ei kartta-klikkiflowta, avaa suoraan tiedot+liitoslomake.
  private enterRoutelessCreation(): void {
    this.collapsed = false
    this.applyCollapsed()
    this.state = { mode: 'reititon' }
    this.callbacks.onEnterCreationMode?.()
    this.creationModal.open(this.state)
  }

  private render(): void {
    this.applyCollapsed()
    this.listEl.innerHTML = ''

    const panel = this.listEl.parentElement
    panel?.querySelectorAll('.btn-segment-footer').forEach(el => el.remove())

    const activePhase = this.callbacks.getActivePhase?.()
    const segments = activePhase ? getSegmentsForPhase(this.store, activePhase) : Array.from(this.store.values())
    if (segments.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'segment-empty'
      empty.textContent = activePhase ? `Ei pätkiä ${activePhase}-vaiheessa` : 'Ei pätkiä — luo ensimmäinen'
      this.listEl.appendChild(empty)
    } else {
      for (const seg of segments) {
        this.listEl.appendChild(this.buildRow(seg))
      }
    }

    if (!this.collapsed) {
      const footerStyle =
        'min-height:44px;width:100%;background:var(--field-tint);border:1px solid var(--border-default);border-top:none;color:var(--text-muted);font-size:12px;cursor:pointer;text-align:left;padding:0 12px'

      const footerBtn = document.createElement('button')
      footerBtn.id = 'btn-segment-create'
      footerBtn.className = 'btn-segment-footer'
      footerBtn.textContent = '+ Luo uusi pätkä'
      footerBtn.style.cssText = footerStyle
      footerBtn.addEventListener('click', () => this.enterCreationMode())
      panel?.appendChild(footerBtn)

      // T216/V139: reitittömän (alue)tehtävän luonti — maali/keräysalue ilman reittipätkää.
      const routelessBtn = document.createElement('button')
      routelessBtn.id = 'btn-segment-create-routeless'
      routelessBtn.className = 'btn-segment-footer'
      routelessBtn.textContent = '+ Luo aluetehtävä (reititön)'
      routelessBtn.style.cssText = footerStyle
      routelessBtn.addEventListener('click', () => this.enterRoutelessCreation())
      panel?.appendChild(routelessBtn)
    }
  }

  private buildRow(seg: Segment): HTMLLIElement {
    const li = document.createElement('li')
    li.className = 'segment-item'
    li.dataset.id = seg.id

    // T344/V250: nimi on SISÄÄNTULO, ei koriste — DESIGN §K "Item-label: klikkaus = toiminto".
    // Aiemmin `span` ∴ ~80 % rivin leveydestä oli kuollutta aluetta & ainoa reitti asetuksiin oli
    // 44px `···`. Klikkikuuntelija on VAIN tässä napissa, ei `li`:ssä — kaksi sisäkkäistä kohdetta
    // laukaisisi modaalin kahdesti.
    const info = document.createElement('button')
    info.type = 'button'
    info.className = 'segment-info'
    const name = seg.displayName ?? `(#${seg.id.slice(0, 6)})`
    info.textContent = name
    info.setAttribute('aria-label', `Avaa ${name} lisätiedot`)
    info.addEventListener('click', () => this.detailsModal.open(seg))

    const kmSpan = document.createElement('span')
    kmSpan.className = 'segment-km'
    const markers = this.callbacks.getMarkers?.() ?? []
    // V259: rivin lukema ! olla eksklusiivinen — ilman kilpailijoita se putoaisi legacy-sääntöön.
    const peers = segmentPeers(this.store, seg)
    kmSpan.textContent = formatPhaseProgress(getPhaseProgress(seg, markers, peers))
    // V139: reitittömällä tehtävällä ei km-aluetta.
    const kmRange = seg.startDist !== undefined && seg.endDist !== undefined
      ? `${(seg.startDist / 1000).toFixed(1)}–${(seg.endDist / 1000).toFixed(1)} km · `
      : ''
    kmSpan.title = `${kmRange}${formatStatusCounts(getSegmentStatusCounts(seg, markers, peers))}`

    // T353/V256 (B142): talkoolaisen kuittaus omana merkintänään — EI laskurin tilalla. Ne voivat
    // olla eri mieltä (kuitattu vaikka merkkejä kesken, tai kaikki asetettu mutta ⊥ kuitattu) &
    // järjestäjä tarvitsee molemmat: laskuri kertoo mitä kartalla on, kuittaus kertoo mitä
    // talkoolainen sanoo. Ristiriita on TIETOA, ⊥ virhe jota pitäisi piilottaa.
    const doneMark = document.createElement('span')
    doneMark.className = 'segment-kuitattu'
    doneMark.textContent = '✓ Kuitattu'
    doneMark.title = 'Talkoolainen on merkinnyt pätkän valmiiksi'
    doneMark.hidden = !(seg.completed ?? false)

    // T345/V250: `···` avaa pikavalikon, ei enää suoraan modaalia — katselutoiminnot (zoom,
    // korostus, linkki) eivät saa kulkea modaalin kautta. Modaali on valikon viimeinen rivi.
    const detailsBtn = document.createElement('button')
    detailsBtn.className = 'btn-segment-details-open'
    detailsBtn.setAttribute('aria-label', `${name} — toiminnot`)
    detailsBtn.setAttribute('aria-haspopup', 'menu')
    detailsBtn.setAttribute('aria-expanded', 'false')
    detailsBtn.textContent = '···'
    detailsBtn.addEventListener('click', () => {
      openSegmentRowMenu(detailsBtn, {
        onShowOnMap: this.callbacks.onShowSegmentOnMap
          ? () => this.callbacks.onShowSegmentOnMap?.(seg)
          : undefined,
        isFocused: this.callbacks.isFocusSegment
          ? () => this.callbacks.isFocusSegment?.(seg) ?? false
          : undefined,
        onToggleFocus: this.callbacks.onToggleFocusSegment
          ? (on) => this.callbacks.onToggleFocusSegment?.(seg, on)
          : undefined,
        // V250: sama osoitelähde kuin modaalilla (`segmentPath`) — ⊥ toista `/s/<koodi>`-muotoa.
        shareUrl: segmentPath(this.store.get(seg.id) ?? seg),
        onOpenDetails: () => this.detailsModal.open(seg),
        onNotify: this.callbacks.onNotify,
      })
    })

    li.appendChild(info)
    li.appendChild(kmSpan)
    li.appendChild(doneMark)
    li.appendChild(detailsBtn)
    return li
  }
}
