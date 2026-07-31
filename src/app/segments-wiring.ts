import L from 'leaflet'
import type { MarkerManager } from '../map/markers'
import { SegmentOverlay } from '../map/segment-overlay'
import { SegmentPanel } from '../ui/segment-panel'
import { PhaseSwitcher } from '../ui/phase-switcher'
import { getSegmentsForPhase, getSegmentForCode, getMarkersForSegment, segmentPeers } from '../logic/segments'
import { segmentDisplayName } from '../logic/segment-name'
import { fitMapToSegment } from '../map/segment-fit'
import type { Segment } from '../logic/segments'
import { fetchSegmentByCode, fetchAllSegments, pushSegmentTrack } from '../logic/segment-sync'
import { backfillSegmentTracks } from '../logic/segment-backfill'
import { getViewPhase } from '../logic/phase-view'
import { getRole } from '../logic/role'
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
  // T446(b)/V330: SSE-heräte kehottaa hakemaan — data tulee SAMASTA polusta kuin alkulataus.
  // Reload asuu täällä koska lataushaara (koodi vs. kaikki) & store ovat täällä; kutsuja
  // (`live-sync.ts`) ⊥ tarvitse tietää kumpi haara on voimassa.
  reloadSegments: () => Promise<void>
  // T377/V272: korostus = suodatinbarin "vain tämä pätkä" -tila ∴ bar ! kuulla muutokset
  // (& tarjota ✕). Kaksi paikkaa jotka ovat eri mieltä tilasta on B131-luokan umpikuja.
  setOnFocusChange: (cb: (segmentId: string | undefined) => void) => void
  clearFocusSegment: () => void
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
  // T345: näkyvä palaute pikavalikon toiminnoille (linkin kopiointi).
  onNotify: (msg: string) => void = () => {},
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

  // T361/V258/V260: legacy-pätkä saa jäljen heti kun GPX:t ovat ladattu (routes on jo tässä).
  // Johdettu jälki on SAMA siivu jonka kartta piirtää ∴ maasto ⊥ muutu — vain esitys.
  const backfilled = backfillSegmentTracks(segmentStore, routes)

  // B145/V260-amend: SIVULATAUS ⊥ SAA OLLA KIRJOITUS. Push vain järjestäjältä — pätkän
  // geometria on järjestäjän dataa (V13/V93) & taustakirjoitus jota käyttäjä ⊥ pyytänyt voi
  // 401:llä laukaista `promptReauth`-overlayn (`main.ts:180`) joka lukitsee koko näkymän.
  // Talkoolaiselle metsässä se on V18-luokan vika. Turvallista koska V260:n välitila on jo
  // laillinen: jäljetön pätkä toimii km-haarassa ∴ push odottaa siihen asti kun joku jolla on
  // oikeus avaa näkymän. Jälki on silti MUISTISSA ∴ tämän istunnon jäsenyys on jo uuden säännön
  // mukainen — vain serverin kopio jää odottamaan.
  if (getRole() !== 'talkoolainen') {
    for (const seg of backfilled) {
      // B145: outboxin OHI — johdettu arvo ⊥ tarvitse durabiliteettia & taustakirjoitus ⊥ saa
      // nostaa reauth-overlaytä. Epäonnistuminen korjautuu seuraavalla latauksella.
      void pushSegmentTrack(seg.id, seg.track)
    }
  }

  // T148: järjestäjä näkee kartalla vain aktiivisen phasen pätkät — talkoolainen aina omansa
  const visibleSegments = (): Segment[] =>
    talkoolainenCode ? Array.from(segmentStore.values()) : getSegmentsForPhase(segmentStore, getViewPhase())

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
  // HUOM: ENSIMMÄINEN render tehdään vasta kuuntelijoiden kytkennän JÄLKEEN (tiedoston lopussa).
  // Aiemmin se ajettiin tässä, ENNEN `setOnSegmentClick`ia ∴ latauksen viivoille ⊥ syntynyt
  // klikkikuuntelijaa lainkaan & pätkä avautui vasta jos jokin muu (merkin muutos, phase-vaihto)
  // sattui renderöimään uudelleen. (B134/T347)

  // T307/V218: muokkaustilasta poistuminen sulkee auki olevan rajaeditorin — muuten kahvat
  // jäisivät kartalle raahattaviksi katselutilassa (rinnakkainen mekanismi).
  mapMode.onChange(() => {
    if (!mapMode.canDragSegmentBounds() && segmentOverlay.isEditMode()) segmentOverlay.exitEditMode()
  })

  // T335/V243: järjestäjän korostustila. Asuu TÄÄLLÄ eikä modaalissa — modaali tuhoutuu
  // sulkiessa mutta tila jää päälle, ja poistumis-pilleri on ainoa ulospääsy sen jälkeen.
  // Ei localStoragea: korostus on hetken työkalu, ei asetus.
  let focusSegmentId: string | null = null
  let onFocusChange: (segmentId: string | undefined) => void = () => {}
  const focusPill = initMarkerFocusPill({ onClear: () => setFocusSegment(null) })

  function setFocusSegment(seg: Segment | null): void {
    focusSegmentId = seg?.id ?? null
    // Järjestäjä: himmennetty PYSYY klikattavana (locked=false) — korostus on lukemisen apu.
    // V259: korostus käyttää samaa eksklusiivista jäsenyyttä kuin lista → anna kilpailijat.
    markerManagerRef.current?.setFocusSegment(seg ?? undefined, seg ? { peers: getSegmentsForPhase(segmentStore, seg.phase) } : {})
    // T375/V270/B158: sama fokus koskee PÄTKÄVIIVOJA & nimilappuja — ennen tätä korostus
    // himmensi vain merkit ∴ "korosta vain tämä pätkä" jätti muut viivat täyteen kirkkauteen.
    // `locked=false`: järjestäjän himmennys on lukemisen apu ⊥ lukko (hän omistaa kaiken).
    // Talkoolaisen oma kutsu (`setContextOwn(own?.id)` yllä) pitää oletuksen locked=true (V142).
    if (!talkoolainenCode) {
      segmentOverlay.setContextOwn(seg?.id, false)
      renderSegmentOverlay()
    }
    if (seg) focusPill.show(segmentDisplayName(seg, 'pätkä'))
    else focusPill.hide()
    onFocusChange(seg?.id)
  }

  // T388/V280/B162: ankkuripalaute on LISTA ⊥ yksi markeri. Ennen tätä kartalle piirtyi tasan
  // ensiklikin kiekko & klikit 2..n eivät näkyneet missään ∴ luonti näytti kuolleelta vaikka
  // tila päivittyi oikein. `previewLine` näyttää kertyvän jäljen ENNEN "Valmis"-nappia.
  const tempAnchorMarkers: L.CircleMarker[] = []
  let tempPreviewLine: L.Polyline | null = null

  const clearCreationFeedback = (): void => {
    for (const m of tempAnchorMarkers) m.remove()
    tempAnchorMarkers.length = 0
    tempPreviewLine?.remove()
    tempPreviewLine = null
  }

  const segmentPanel = new SegmentPanel(
    document.getElementById('segment-panel-container')!,
    routes,
    segmentStore,
    () => renderSegmentOverlay(),
    {
      getActivePhase: talkoolainenCode ? undefined : getViewPhase,
      onAnchorsChanged: (anchors, preview) => {
        clearCreationFeedback()
        // Jälki ENSIN ∴ kiekot jäävät viivan päälle (viiva ⊥ peitä sitä mihin klikattiin).
        if (preview.length >= 2) {
          tempPreviewLine = L.polyline(preview.map(p => [p.lat, p.lon] as [number, number]), {
            color: '#ef4444', weight: 5, opacity: 0.75, dashArray: '8 6',
            className: 'segment-creation-preview',
            interactive: false,
          }).addTo(map)
        }
        for (const [i, a] of anchors.entries()) {
          // Viimeinen ankkuri erottuu: se on se jota "Poista viimeinen" koskee ∴ peruutus on
          // tietoinen ele ⊥ arvaus (sama peruste kuin modaalin listan scroll, T362).
          const isLast = i === anchors.length - 1
          tempAnchorMarkers.push(L.circleMarker([a.lat, a.lon], {
            radius: isLast ? 9 : 6,
            color: '#ef4444', fillColor: isLast ? '#ef4444' : '#fff',
            fillOpacity: isLast ? 0.85 : 1, weight: 2,
            className: 'segment-creation-marker',
            // B147: Leafletin circleMarker on INTERAKTIIVINEN oletuksena ∴ 18px kiekko söi kartan
            // click-eventin & seuraava ankkuriklikki katosi hiljaa (⊥ ankkuria, ⊥ virhetekstiä).
            // Ennen T362:ta oire oli piilossa: flow tarvitsi yhden lisäklikin joka tehtiin kaukana.
            // Klik-klik klikkaa reittiä PITKIN ∴ peräkkäiset pisteet ovat pienellä zoomilla
            // pikselien päässä toisistaan. Tämä markeri on PALAUTE ⊥ kohde — se ⊥ ota klikkejä.
            // T388: sama koskee esikatseluviivaa — se on ankkuriketjun päällä.
            // (Snap-markerit `segment-overlay.ts:213` pysyvät interaktiivisina: niillä on oma
            // click-handler & ne ON tarkoitettu klikattaviksi.)
            interactive: false,
          }).addTo(map))
        }
      },
      onAnchorsClear: () => clearCreationFeedback(),
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
      // T345: sama rajauskuvio kuin talkoolaisen latauszoomissa (`src/map/segment-fit.ts`) —
      // yksi zoom-sääntö, ⊥ kahta erilaista "koko pätkää".
      onShowSegmentOnMap: (seg) => {
        const markers = markerManagerRef.current?.getAll() ?? initialMarkers
        fitMapToSegment(map, routes, seg, getMarkersForSegment(seg, markers, segmentPeers(segmentStore, seg)))
      },
      onNotify: (msg) => onNotify(msg),
    },
  )

  if (!talkoolainenCode) {
    segmentOverlay.setOnSegmentClick(seg => segmentPanel.openDetailsModal(seg))
    const phaseSwitcherContainer = document.getElementById('phase-switcher-container')
    if (phaseSwitcherContainer) {
      // T434/V321: katselusuodin — paikallinen, ⊥ serverikutsua ∴ ⊥ virhepolkua (`onNotify`
      // putosi pois). Vaiheen vaihto kaikille asuu admin-paneelissa (T433).
      new PhaseSwitcher(phaseSwitcherContainer, () => {
        renderSegmentOverlay()
        segmentPanel.refreshCounts()
      })
    }
  }

  // B134: render vasta nyt — kuuntelijat (klikkaus → modaali) ovat kiinni ∴ ensimmäinenkin
  // piirretty pätkä & sen nimilappu reagoivat ilman uudelleenrenderiä.
  renderSegmentOverlay()

  // T446(b)/V330: pätkädatan uudelleenlataus herätteestä. Sama haara kuin alkulatauksessa
  // (talkoolainen: oma koodi; järjestäjä: kaikki) ∴ ⊥ toista latauslogiikkaa.
  async function reloadSegments(): Promise<void> {
    // Kesken oleva luonti/rajamuokkaus omistaa kartan: uudelleenrender veisi kahvat alta &
    // rakenteilla oleva pätkä ⊥ ole vielä storessa. Heräte odottaa — se on kiihdytin ⊥ pakko.
    if (segmentPanel.isCreationMode() || segmentOverlay.isEditMode()) return
    if (talkoolainenCode) {
      const remote = await fetchSegmentByCode(talkoolainenCode)
      if (!remote) return
      segmentStore.set(remote.id, remote)
    } else {
      const result = await fetchAllSegments()
      // T184/V118: latausvirhe ≠ "0 pätkää" — pidä nykyinen store, ⊥ tyhjennä karttaa.
      if (!result.ok) return
      segmentStore.clear()
      for (const seg of result.segments) segmentStore.set(seg.id, seg)
    }
    // V260: jälki johdetaan muistiin kuten alkulatauksessa. Push jätetään pois TARKOITUKSELLA
    // (B145): taustakirjoitus jota käyttäjä ⊥ pyytänyt voi 401:llä lukita näkymän.
    backfillSegmentTracks(segmentStore, routes)
    renderSegmentOverlay()
    segmentPanel.refreshCounts()
  }

  return {
    segmentStore, segmentOverlay, segmentPanel, renderSegmentOverlay, phaseFilteredStore, reloadSegments,
    setOnFocusChange: cb => { onFocusChange = cb },
    clearFocusSegment: () => setFocusSegment(null),
  }
}
