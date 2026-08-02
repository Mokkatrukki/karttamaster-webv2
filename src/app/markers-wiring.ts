import type L from 'leaflet'
import { MarkerManager } from '../map/markers'
import { DriveMode } from '../map/drive'
import { RouteBar } from '../map/route-bar'
import { RouteVisibilityControl } from '../map/route-visibility-control'
import { MapFilterBar } from '../ui/map-filter-bar'
import type { MapFilter } from '../logic/map-filter'
import { isolatedMarkerIds, orphanMarkerIds, loadMapFilter } from '../logic/map-filter'
import { MarkerOverviewPanel } from '../ui/marker-overview-panel'
import { getViewPhase } from '../logic/phase-view'
import { createAndPushSegment } from '../logic/segment-create'
import { addMarkersToSegment } from '../logic/segment-actions'
import { unclaimedCollected, pileTemplate, PILE_TEMPLATE_ID } from '../logic/pile'
import { showToast } from '../ui/toast'
import { existingSegmentOwners } from '../logic/segment-membership'
import { getSegmentsForPhase } from '../logic/segments'
import { ProgressBar } from '../ui/progress-bar'
import { PlaceMode } from '../ui/place-mode'
import { SegmentView } from '../ui/segment-view'
import { SignLibraryPanel, createSignLibrary } from '../ui/sign-library-panel'
import { saveLibrary, type SignLibrary, type SignTemplate } from '../logic/sign-library'
import { fetchTemplates, createTemplateRemote, updateTemplateRemote, deleteTemplateRemote } from '../logic/template-sync'
import { StatusPanel } from '../ui/status-panel'
import { calcAllRouteStatus } from '../logic/route-status'
import { getRole } from '../logic/role'
import { MarkerDetailModal } from '../ui/marker-detail-modal'
import { getSegmentForCode, getMarkersForSegment, updateSegment, segmentPrimaryRouteId, segmentPeers } from '../logic/segments'
import { boundsPatch } from '../logic/segment-backfill'
import { backfillNearestRoute } from '../logic/marker-route-backfill'
import { pushMarkerNearestRoute } from '../logic/sync'
import type { Segment } from '../logic/segments'
import { fitMapToSegment } from '../map/segment-fit'
import { firstUnsetMarker, distanceAhead } from '../logic/navigation'
import type { GpsNavigator, GpsState } from '../map/gps-navigator'
import { updateSegmentRemote } from '../logic/segment-sync'
import { outbox, setOutboxChangeHandler } from '../logic/outbox-instance'
import type { RouteConfig } from '../logic/multi-route'
import type { SignMarker } from '../logic/types'
import type { SegmentPanel } from '../ui/segment-panel'
import { mapMode, type MapMode, type MapModeState } from '../logic/map-mode'
import { initMapModeToggle } from '../ui/map-mode-toggle'
import { createGpsControl } from '../ui/gps-control'
import { createMarkerClaimSheet } from '../ui/marker-claim-sheet'
import { gpsControlState } from '../logic/gps-follow'
// T452/V335: sijoitustila ! tuoda kartta näkyviin itse — moodi on tilan EHTO ⊥ ympäristö.
import { startPilePlacement, runPileAction } from './pile-placement'
// T454/V338: esikatselupiste on Leaflet-glue ∴ se tulee `src/map/`istä injektiona.
import { showPilePreview } from '../map/pile-preview'
// T455/V340: luonnin tulos jää ruudulle — rivi ⊥ katoava toast.
import { showPileDoneRow, removePileDoneRow } from '../ui/pile-drop'
// T457/V342: juuri jätetty kasa on vielä kesken — korjausikkuna omana kokonaisuutenaan.
import { openPileEditWindow, type PileEditWindow } from './pile-edit-window'
import { haversineDistance } from '../logic/bearing'

// T307/V218: `document.body.dataset.mapMode` asetetaan TÄSTÄ yhdestä paikasta (CSS-korostus
// T308 + E2E-assertit lukevat sen). UI-toggle EI kirjoita attribuuttia itse — se kutsuu
// `mapMode.toggle()` ja tämä kuuntelija heijastaa tilan DOM:iin ∴ yksi totuus.
// Idempotentti: uusi kutsu korvaa arvon, kuuntelija lisätään kertaalleen per wireMarkers.
export function syncMapModeToBody(state: MapModeState = mapMode): () => void {
  const apply = (m: MapMode): void => { document.body.dataset.mapMode = m }
  apply(state.get())
  return state.onChange(apply)
}

// T341/V247: talkoolaisen GPS-napin label yhdestä paikasta — hero (`.segment-view-gps-btn`) ja
// yläpalkin ⋯ (`#btn-tk-gps`) lukevat SAMAN GpsNavigator-tilan. Kaksi labelia = kaksi totuutta.
export function gpsButtonLabel(state: GpsState): string {
  if (state === 'päällä') return '📍 GPS päällä'
  if (state === 'haetaan') return '📍 Haetaan…'
  return '📍 GPS'
}

// T341/V247 (fix B133): GPS-toggle kytketään ROOLIN perusteella, EI pätkän olemassaolon.
// Oma sijainti on laitteen tieto ∴ jos tämä elää `if (seg)`-lohkon sisällä, nappi renderöityy
// kuuntelijatta aina kun pätkää ei löydy (lataus kaatui / koodilla ei pätkää) → klikkaus ei tee
// mitään eikä mikään kerro siitä. Paikannusvirhe ei myöskään saa olla hiljainen (V247).
//
// T407/V294: sama `sync` ruokkii nyt KOLME pintaa — kartan `#gps-control`, ⋯-valikon
// `#btn-tk-gps` ja heron `.segment-view-gps-btn`. Yksi tilalähde (`GpsNavigator`), yksi
// käännösfunktio (`gpsControlState`) ∴ pinnat eivät voi olla eri mieltä (B133-luokka).
export function wireGpsButton(
  gps: Pick<GpsNavigator, 'start' | 'stop' | 'getState' | 'setFollow' | 'isFollowing' | 'onFollowChange'>,
  showWarning: (msg: string, ms?: number) => void,
): (state: GpsState, msg?: string) => void {
  const control = createGpsControl({
    onTap: (action) => {
      if (action === 'start') { gps.start(sync); return }
      if (action === 'recenter') { gps.setFollow(true); sync(gps.getState()); return }
      gps.stop()
      sync('pois')
    },
  })
  document.getElementById('map-area')?.appendChild(control.el)
  // Hero (`#segment-view`) syntyy vasta pätkähaun jälkeen ∴ tarkkaillaan sen SÄILIÖTÄ, joka
  // on index.html:ssä alusta asti. Säiliön korkeus = heron korkeus (se on ainoa lapsi).
  control.observeHero(document.getElementById('segment-view-container'))

  const sync = (state: GpsState, msg?: string): void => {
    control.setState(gpsControlState(state, gps.isFollowing()))
    document.querySelectorAll<HTMLElement>('#btn-tk-gps, .segment-view-gps-btn').forEach(btn => {
      btn.textContent = gpsButtonLabel(state)
      btn.classList.toggle('gps-active', state !== 'pois')
    })
    if (msg) showWarning(`⚠ ${msg}`, 5000)
  }
  // V295: kartan panorointi purkaa seurannan → nappi ! vaihtua "Keskitä"-tilaan HETI. Ilman
  // tätä kanavaa nappi lukisi "Seuraa" kunnes seuraava fix sattuu saapumaan.
  gps.onFollowChange(() => sync(gps.getState()))
  document.getElementById('btn-tk-gps')?.addEventListener('click', () => {
    if (gps.getState() !== 'pois') { gps.stop(); sync('pois'); return }
    gps.start(sync)
  })
  sync(gps.getState())
  return sync
}

export interface MarkersWiring {
  markerManager: MarkerManager
  driveMode: DriveMode
  routeBar: RouteBar | null
  progressBar: ProgressBar
  placeMode: PlaceMode
  // T404: `#marker-modal` POISTETTU. Esc-ketju (main.ts) sulkee merkkijono-telakan.
  markerOverview: MarkerOverviewPanel | null
  // T237(d)/V243: main.ts kytkee tämän segments-wiringin fokus-refiin.
  // T377/V272: suodatinbar — main.ts kytkee sen korostustilaan (isolointi).
  mapFilterBar: MapFilterBar | null
}

interface MarkersWiringDeps {
  segmentStore: Map<string, Segment>
  renderSegmentOverlay: () => void
  // T374/V269/B157: reittivalitsin asuu täällä, pätkäkerros segments-wiringissä ∴ näkyvyys
  // välitetään setterillä. `renderSegmentOverlay` piirtää uuden tilan.
  setSegmentVisibleRoutes: (ids: string[]) => void
  // T377/V271: suodatin päättää, kerrokset soveltavat — pätkäkerros elää segments-wiringissä.
  setSegmentMapFilter: (filter: MapFilter) => void
  // T377: isoloinnin nollaus barista sammuttaa korostuksen (yksi tila, ⊥ kaksi).
  clearFocusSegment: () => void
  segmentPanel: SegmentPanel
  showWarning: (msg: string, ms?: number) => void
  // T232 (B): GPS-navigaattori (luotu map-init.ts:ssä) → talkoolaisen SegmentView-heron GPS-toggle.
  gpsNavigator: GpsNavigator
}

// T85-T105/T140-T152: merkkien sijoitus, tila, ajotila, tarkastusnäkymä ja liittyvä UI.
// Suurin lohko init()-orkestroinnista — merkkejä käsittelevä osuus koskettaa myös
// pätkän status-päivitystä (renderSegmentOverlay) ja tarkastusnäkymää (talkoolainen),
// koska ne kuuntelevat MarkerManagerin onUpdate-tapahtumaa (sama kuin ennen pilkkoa).
// V301/B169: init ⊥ saa kuolla hiljaa. Runko on yksi pitkä sekvenssi ∴ heitto rivillä N vie
// kaikki N+1… mukanaan — B169:ssä käyttäjä sai tyhjän sivupalkin & kuolleen napin ILMAN
// virhettä (sama hiljaisuuden luokka kuin V296/B168). Heitto EI nielaista: se näkyy
// käyttäjälle bannerina, konsolissa stackina & etenee ylös niin että init pysähtyy äänekkäästi.
export function wireMarkers(
  map: L.Map,
  routes: RouteConfig[],
  polylines: L.Polyline[],
  initialMarkers: SignMarker[],
  talkoolainenCode: string | undefined,
  deps: MarkersWiringDeps,
): MarkersWiring {
  try {
    return wireMarkersInner(map, routes, polylines, initialMarkers, talkoolainenCode, deps)
  } catch (err) {
    deps.showWarning('⚠ Näkymän alustus epäonnistui — lataa sivu uudelleen', 0)
    console.error('[wireMarkers] init epäonnistui', err)
    throw err
  }
}

function wireMarkersInner(
  map: L.Map,
  routes: RouteConfig[],
  polylines: L.Polyline[],
  initialMarkers: SignMarker[],
  talkoolainenCode: string | undefined,
  deps: MarkersWiringDeps,
): MarkersWiring {
  const {
    segmentStore, renderSegmentOverlay, segmentPanel, showWarning, gpsNavigator,
    setSegmentVisibleRoutes, setSegmentMapFilter, clearFocusSegment,
  } = deps

  // V300/B169: EI `let x!: T`. Non-null-assertio vaientaa juuri sen tarkistuksen joka nappaisi
  // "callback lukee sidosta jota ⊥ vielä ole": `MapFilterBar`in ctor kutsuu `onChange`in
  // synkronisesti (map-filter-bar.ts:88) ∴ `onUpdate` ajoi `progressBar.refreshDots()`in ennen
  // kuin `progressBar` oli olemassa → koko `wireMarkers` heitti & sivupalkki jäi rakentamatta.
  let progressBar: ProgressBar | null = null
  let statusPanel: StatusPanel | null = null
  let segmentView: SegmentView | null = null
  let signLibrary: SignLibrary | null = null
  // T224 (b1)/T256: korosta pätkän seuraava asettamaton merkki kartalla (vain asettaminen-phase).
  // R6/V178: ikoni-hehku (.marker-next-highlight) renkaan sijaan → markerManager.setNextHighlight.
  function updateNextHighlight(seg: Segment, segMarkers: SignMarker[]): void {
    // T328/V237: sama akseli kuin herossa — akseli tulee PÄTKÄSTÄ, ei erillisenä parametrina,
    // muuten kartan korostus osoittaisi eri merkkiin kuin "Seuraava merkki" -palkki (B126).
    const next = seg.phase === 'asettaminen' ? firstUnsetMarker(segMarkers, seg) : null
    markerManager.setNextHighlight(next?.id ?? null)
  }

  // T185/V117: outbox-resurssiavaimista ('marker:<id>') pending-merkkien id-joukko listalle.
  const markerPendingIds = (): Set<string> =>
    new Set([...outbox.pendingResourceKeys()].filter(k => k.startsWith('marker:')).map(k => k.slice('marker:'.length)))

  // V33/V142 (B-lista1): talkoolaisen merkkilista näyttää VAIN oman pätkän merkit — myös
  // re-renderissä (status-muutos, outbox-vahvistus, modaalin refresh). Aiemmin re-render-
  // callbackit välittivät segmentMarkerIds=undefined → lista palasi näyttämään kaikki reitin
  // merkit heti ensimmäisen muutoksen jälkeen. Järjestäjälle undefined = kaikki merkit (oikein).
  const currentSegmentMarkerIds = (): Set<string> | undefined => {
    if (!talkoolainenCode) return undefined
    const seg = getSegmentForCode(segmentStore, talkoolainenCode)
    if (!seg) return undefined
    return new Set(getMarkersForSegment(seg, markerManager.getAll(), segmentPeers(segmentStore, seg)).map(m => m.id))
  }

  // Forward declaration — modaali luodaan vasta markerManagerin jälkeen
  let markerDetailModal: MarkerDetailModal | null = null
  const onOpenMarkerDetail = (id: string) => {
    markerManager.panTo(id)
    markerDetailModal?.open(id)
    // V127 (amend T404): mobiilissa overlay-`#left-panel` ! sulkeutua kun merkin detail avataan,
    // muuten valittu merkki & modaali jäävät paneelin alle. Tapahtuman AINOA lähettäjä oli
    // `marker-list.ts` joka poistui ∴ se siirtyy TÄHÄN — detail-polun juureen, ⊥ yhteen listaan.
    // Kuuntelija: `left-panel.ts:19`. `panTo`-only-polku (rivin klikkaus) ⊥ lähetä tätä.
    document.dispatchEvent(new CustomEvent('marker-detail-opened', { detail: { id } }))
  }

  // T402: merkkilistanäkymät päivittyvät YHDESTÄ paikasta. `renderMarkerList` toistui neljässä
  // kutsupaikassa ∴ uusi näkymä olisi joutunut toistumaan niissä samoissa neljässä.
  let markerOverview: MarkerOverviewPanel | null = null
  const refreshMarkerViews = (): void => {
    markerOverview?.render()
  }

  const markerManager = new MarkerManager(map, routes, () => {
    refreshMarkerViews()
    progressBar?.refreshDots()
    statusPanel?.update(calcAllRouteStatus(markerManager.getAll(), routes.map(r => r.id)))
    segmentPanel.refreshCounts()
    // T152/V96: merkin status-muutos päivittää myös kartan pätkän viivatyylin (ei vain sivupalkkia)
    renderSegmentOverlay()
    if (segmentView) {
      const seg = talkoolainenCode ? getSegmentForCode(segmentStore, talkoolainenCode) : undefined
      if (seg) {
        const segMarkers = getMarkersForSegment(seg, markerManager.getAll(), segmentPeers(segmentStore, seg))
        // T232 (F)/V159: segmentView.update() → renderNext → onNavigate synkkaa kartan korostuksen
        // hero:n VALITTUUN merkkiin (◀▶-selailu huomioiden). EI erillistä updateNextHighlightia tässä
        // — se osoittaisi aina firstUnsetMarkeriin ja ohittaisi selatun valinnan (epäjohdonmukainen).
        segmentView.update(segMarkers)
      }
    }
  }, initialMarkers, distM => showWarning(`⚠ Merkki kaukana reitistä (${Math.round(distM)} m)`), msg => showWarning(msg, 5000))

  // T392/V284: merkin lähin reitti johdetaan geometriasta heti kun GPX:t ovat ladattu.
  // B145/V260-amend-kuvio: SIVULATAUS ⊥ SAA OLLA KIRJOITUS talkoolaiselta — taustakirjoitus jota
  // hän ⊥ pyytänyt voi 401:llä nostaa reauth-overlayn & lukita kenttänäkymän (V18-luokan vika).
  // Arvo on silti MUISTISSA ∴ tämän istunnon jäsenyys noudattaa jo uutta sääntöä; vain serverin
  // kopio odottaa järjestäjän istuntoa.
  const nearestBackfilled = backfillNearestRoute(markerManager.getAll(), routes)
  if (getRole() !== 'talkoolainen') {
    for (const m of nearestBackfilled) {
      // Outboxin OHI: johdettu arvo ⊥ tarvitse durabiliteettia (seuraava lataus laskee sen
      // uudelleen) & taustamigraatio ⊥ saa nostaa reauth-overlaytä.
      void pushMarkerNearestRoute(m.id, m.nearestRouteId!, m.nearestRouteDistM!)
    }
  }

  markerDetailModal = new MarkerDetailModal(
    markerManager,
    () => signLibrary,
    getRole,
    () => {
      refreshMarkerViews()
      progressBar?.refreshDots()
    },
    // T225/V151: talkoolaisen oma koodi → kova-poisto vain oman itse-luoman merkin kohdalla.
    () => talkoolainenCode,
    // T437/V323: peruutuksen kohde on VAIHEEN funktio ∴ modaali tarvitsee talkoolaisen oman
    // tehtävän. Sama lähde kuin heron & listan konteksti (getSegmentForCode) — ⊥ toista totuutta.
    () => (talkoolainenCode ? getSegmentForCode(segmentStore, talkoolainenCode) ?? null : null),
  )
  markerManager.setOnMarkerClick((id) => onOpenMarkerDetail(id))

  // T335/V243: talkoolaisella korostus on AUTOMAATTI, ei kytkin — hän katsoo vain omaa pätkäänsä
  // (max 2 nappia -periaate: ei kolmatta valintaa metsässä). Sama omistajapäättely kuin
  // `segmentOverlay.setContextOwn` (segments-wiring) → yksi lähde, ei toisintoa.
  // T416/V306: lukko on `claimable` ⊥ `locked` — himmennetty merkki pysyy read-onlyna (⊥ raahaus,
  // ⊥ status, ⊥ kenttämuokkaus) mutta ottaa YHDEN klikin joka avaa "Lisää tehtävääni" -lehtisen.
  if (talkoolainenCode) {
    const own = getSegmentForCode(segmentStore, talkoolainenCode)
    if (own) markerManager.setFocusSegment(own, { lock: 'claimable', peers: segmentPeers(segmentStore, own) })
  }

  // T416/V305/V306: vieraan merkin liitos omaan tehtävään. Sama jaettu apuri kuin järjestäjän
  // polulla ∴ additiivisuus & idempotenssi ovat identtiset (V305). Serveri laskee unionin
  // uudelleen (V307) ∴ vanhentunut client ⊥ voi typistää listaa.
  const claimSheet = createMarkerClaimSheet((markerId) => {
    const code = talkoolainenCode
    if (!code) return
    const own = getSegmentForCode(segmentStore, code)
    if (!own) return
    const next = addMarkersToSegment(own, [markerId])
    if (next === own) {
      showWarning('Merkki kuuluu jo tehtävääsi', 3000)
      return
    }
    updateSegment(segmentStore, own.id, {
      linkedMarkerIds: next.linkedMarkerIds,
      excludedMarkerIds: next.excludedMarkerIds,
    })
    const flagErr = (): void => showWarning('⚠ Merkin lisäys ei tallentunut — yritä uudelleen', 5000)
    updateSegmentRemote(own.id, { linkedMarkerIds: next.linkedMarkerIds })
      .then(ok => { if (!ok) flagErr() })
      .catch(() => flagErr())
    // Jäsenyys muuttui → fokus, lista & kartta ! lukea sama uusi joukko (⊥ vanha korostus).
    const updated = segmentStore.get(own.id)
    if (updated) markerManager.setFocusSegment(updated, { lock: 'claimable', peers: segmentPeers(segmentStore, updated) })
    renderSegmentOverlay()
    if (updated) segmentView?.update(getMarkersForSegment(updated, markerManager.getAll(), segmentPeers(segmentStore, updated)), updated)
    showWarning('✓ Merkki lisätty tehtävääsi', 3000)
  })
  if (talkoolainenCode) {
    markerManager.setClaimHandler((id) => {
      const m = markerManager.getAll().find(x => x.id === id)
      const own = getSegmentForCode(segmentStore, talkoolainenCode)
      if (!m || !own) return
      claimSheet.open(m, own.displayName?.trim() || 'oma tehtävä')
    })
  }

  // T309/V221: siirron km-akseli = talkoolaisen oman pätkän PRIMARY-reitti (⊥ lähin reitti yli
  // kaikkien) → jaetulla osuudella merkki mitataan samasta reitistä kuin serverin
  // `markerInOwnSegment` ∴ ei putoa pätkästä liikkumatta käytännössä minnekään (B121, B100-oppi).
  // Järjestäjä (ei koodia) → undefined = MarkerManagerin fallback (merkin ENTINEN akseli).
  markerManager.setKmAxisRouteFn(() => {
    if (!talkoolainenCode) return undefined
    const seg = getSegmentForCode(segmentStore, talkoolainenCode)
    return seg ? segmentPrimaryRouteId(seg) : undefined
  })

  // T307/V218 + T222/V150: raahattavuus = muokkaustila JA rooli-/pätkäehto. `baseDraggable`
  // pitää V150-ehdon (talkoolainen: vain oman pätkän merkit; järjestäjä: kaikki) ja
  // `applyDraggable` yhdistää sen moodiin. Kutsutaan (a) initissä, (b) kun pätkän rajat
  // muuttuvat (oma merkki-setti muuttuu), (c) kun moodi vaihtuu → merkit päivittyvät ILMAN
  // reloadia (setDraggablePredicate sovittaa jo piirretyt Leaflet-markerit heti).
  let baseDraggable: (m: SignMarker) => boolean = () => true
  // T457/V342: juuri jätetty kasa on raahattava vaikka se ⊥ kuuluisi käyttäjän pätkään —
  // POIKKEUS on YKSI id kerrallaan & se elää vain korjausikkunan ajan (`pile-edit-window.ts`).
  // Serverin V150-portti on ennallaan: liian kauas raahattu palautuu & sanoo sen (V227-polku).
  let editablePileId: string | null = null
  let pileEdit: PileEditWindow | null = null
  const applyDraggable = (): void => {
    markerManager.setDraggablePredicate(m =>
      mapMode.canDragMarkers() && (baseDraggable(m) || m.id === editablePileId))
  }
  const setEditablePile = (id: string | null): void => {
    editablePileId = id
    applyDraggable()
  }
  const closePileEdit = (): void => {
    pileEdit?.close()
    pileEdit = null
  }
  // Moodinvaihto on teko siinä missä nappikin: katselutilassa raahattava kasa olisi lupaus
  // jota moodi ⊥ pidä.
  mapMode.onChange(() => closePileEdit())
  mapMode.onChange(() => applyDraggable())
  applyDraggable()
  // Yksi paikka joka heijastaa moodin DOM:iin (CSS-korostus T308 lukee body[data-map-mode]).
  syncMapModeToBody()
  // T308/V219: toggle-napit (järjestäjä #btn-map-mode, talkoolainen ⋯ #btn-tk-map-mode) +
  // pysyvä "Muokkaustila"-pilleri. Sama tila molemmille rooleille (ei rooli-logiikkaa).
  initMapModeToggle()

  // T185/V117: outbox-jonon muutos → päivitä kartan pending-korostus + listan "tallentamatta".
  // Käsittelijä kattaa myös 2xx-vahvistuksen (avain poistuu → korostus katoaa).
  setOutboxChangeHandler((keys) => {
    markerManager.setPendingKeys(keys)
    refreshMarkerViews()
  })
  // Edellisen session vahvistamattomat kirjoitukset voivat olla vielä jonossa käynnistyessä.
  markerManager.setPendingKeys(outbox.pendingResourceKeys())

  // T341/V247 (B133): GPS ENNEN pätkähakua — oma sijainti ei riipu pätkästä. Jos tämä
  // siirtyy `if (seg)`:n sisään, talkoolainen jää ilman GPS:ää aina kun pätkä puuttuu.
  // T407/V294: myös ROOLIN ulkopuolella — `#gps-control` on kartalla molemmille. Järjestäjä on
  // VISION §Mobiili mukaan välillä itse kentällä ilman läppäriä; oma sijainti on laitteen tieto
  // eikä rooliominaisuus. ⋯-valikon `#btn-tk-gps` pysyy talkoolaisen omana (V155).
  const syncGpsLabel = wireGpsButton(gpsNavigator, showWarning)

  if (talkoolainenCode) {
    const seg = getSegmentForCode(segmentStore, talkoolainenCode)
    if (seg) {
      // T230/V93 + T257/R8: pätkän valmiiksi-merkintä. Jaettu SegmentView-heron (onComplete)
      // ja yläpalkin ⋯-toiminnon (R8) välillä — sama tallennuspolku (store + backend + refresh).
      const applyComplete = (completed: boolean) => {
        const updatedSeg = updateSegment(segmentStore, seg.id, { completed })
        const flagErr = () => showWarning('⚠ Pätkän valmiiksi-merkinnän tallennus epäonnistui — yritä uudelleen', 5000)
        updateSegmentRemote(seg.id, { completed })
          .then(ok => { if (!ok) flagErr() })
          .catch(() => flagErr())
        if (updatedSeg) {
          renderSegmentOverlay()
          segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll(), segmentPeers(segmentStore, updatedSeg)), updatedSeg)
        }
      }
      // T232/E + T257/R8: "Lisää merkki" — sign-picker kartan keskelle (POST omalle pätkälle V149).
      const openAddMarkerPicker = () => {
        // T307/V218: napin painallus ON eksplisiittinen käyttäjätoimi (kielletty on automaattinen
        // siirtymä merkin/pätkän VALINNASTA) ∴ "+ Merkki" avaa muokkaustilan sen sijaan että
        // olisi hiljaa toimimaton. Tila näkyy heti (pilleri + kehys, T308) → käyttäjä tietää.
        if (!mapMode.canPlaceMarkers()) mapMode.set('muokkaus')
        const c = map.getCenter()
        placeMode.openPicker(c.lat, c.lng, window.innerWidth / 2, window.innerHeight / 2)
      }
      segmentView = new SegmentView(
        document.getElementById('segment-view-container')!,
        seg,
        (updated) => {
          // V28 (B-lista3): bulkCollect palauttaa merkit jo 'kerätty'-tilassa. Käytä suoraa
          // bulkSetStatus-asetusta — EI 'kerää'-actionia, joka heittää "Virheellinen siirtymä"
          // suunniteltu/ei_tarpeen-merkeille (uncaught throw, osittainen päivitys, ei banneria).
          markerManager.bulkSetStatus(updated.map(m => m.id), 'kerätty')
        },
        (inspected, note) => {
          const updatedSeg = updateSegment(segmentStore, seg.id, { inspected, inspectionNote: note || undefined })
          // T149/V93: tarkastuskuittaus EI saa hävitä hiljaa — false-paluu tai reject → virhebanneri
          const flagInspectError = () => showWarning('⚠ Tarkastuskuittauksen tallennus epäonnistui — yritä uudelleen', 5000)
          updateSegmentRemote(seg.id, { inspected, inspectionNote: note || undefined })
            .then(ok => { if (!ok) flagInspectError() })
            .catch(() => flagInspectError())
          if (updatedSeg) segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll(), segmentPeers(segmentStore, updatedSeg)), updatedSeg)
        },
        {
          // "Seuraava merkki" -ohjaus: aseta/ohita etenee pätkän merkit järjestyksessä (V9/V3).
          // markerManager.onUpdate → currentSegmentMarkerIds() + segmentView.update() re-render.
          onSetMarker: (id) => markerManager.updateStatus(id, 'aseta'),
          onSkipMarker: (id) => markerManager.updateStatus(id, 'ohita'),
          onFocusMarker: (id) => onOpenMarkerDetail(id),
          // "Näytä kartalla": panoroi ilman modaalia (näkymä kutistuu → kartta esiin)
          onShowOnMap: (id) => markerManager.panTo(id),
          // T228/T380: "Lisää ohje" hero-overflowsta → avaa detail-modaalin (ohjekenttä,
          // updateNote → location_note-PUT, server sallii omalle pätkälle V93). V275: merkin
          // ohje on YKSISUUNTAINEN & tässä sen ainoa kenttä — kommenttilanka poistettu T380:ssä.
          onComment: (id) => onOpenMarkerDetail(id),
          // T222: "Siirretty" hero-overflowsta → panoroi merkkiin + ohje. Varsinainen siirto =
          // raahaus kartalla (vain oman pätkän merkit draggable, V150). Backend sallii oman pätkän
          // sijaintimuutoksen range-sisällä (V150b).
          onMoveMarker: (id) => {
            markerManager.panTo(id)
            showWarning('Raahaa merkkiä kartalla uuteen paikkaan — muutos tallentuu', 4000)
          },
          // T78/V43: talkoolainen muokkaa oman pätkän rajoja kentällä. Server sallii (V93:
          // talkoolainen_code === assigned_code). Päivitä store + backend + kartta + näkymä.
          onEditBounds: (startDist, endDist) => {
            // T363/V258: rajat & JÄLKI muuttuvat yhdessä. Jälki ⊥ saa jäädä jälkeen — muuten
            // jäsenyys (V259) vastaisi rajaa jota ⊥ enää ole & talkoolainen näkisi merkkejä
            // jotka hän juuri rajasi pois (tai päinvastoin).
            const patch = boundsPatch(seg, routes, startDist, endDist)
            const updatedSeg = updateSegment(segmentStore, seg.id, patch)
            const flagErr = () => showWarning('⚠ Pätkän rajojen tallennus epäonnistui — yritä uudelleen', 5000)
            updateSegmentRemote(seg.id, patch)
              .then(ok => { if (!ok) flagErr() })
              .catch(() => flagErr())
            if (updatedSeg) {
              renderSegmentOverlay()
              segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll(), segmentPeers(segmentStore, updatedSeg)), updatedSeg)
              // T222/V150: rajat muuttuivat → oma merkki-setti muuttuu → päivitä raahattavuus.
              applyDraggable()
            }
          },
          // T224 (C)/V38/V93: talkoolainen muokkaa oman pätkän varustelistaa (valmisteluvaihe).
          // Sama tallennuspolku kuin rajoilla: store + backend + näkymä-refresh.
          onEquipmentChange: (equipment) => {
            const updatedSeg = updateSegment(segmentStore, seg.id, { equipment })
            const flagErr = () => showWarning('⚠ Varustelistan tallennus epäonnistui — yritä uudelleen', 5000)
            updateSegmentRemote(seg.id, { equipment })
              .then(ok => { if (!ok) flagErr() })
              .catch(() => flagErr())
            if (updatedSeg) segmentView?.update(getMarkersForSegment(updatedSeg, markerManager.getAll(), segmentPeers(segmentStore, updatedSeg)), updatedSeg)
          },
          // T230/V93: talkoolainen merkitsee pätkän valmiiksi (asettaminen/purku). Jaettu applyComplete (R8).
          onComplete: applyComplete,
          // T232 (B)/V156: GPS-toggle. Ohjaa GpsNavigatoria (T30, oma sijainti) — ERILLINEN
          // driveModesta. Palauttaa uuden aktiivitilan napin ilmeeseen. R8: GPS myös yläpalkin ⋯:ssä.
          onToggleGps: () => {
            if (gpsNavigator.isActive()) { gpsNavigator.stop(); syncGpsLabel('pois'); return false }
            gpsNavigator.start(syncGpsLabel)
            return gpsNavigator.isActive()
          },
          isGpsActive: () => gpsNavigator.isActive(),
          // T341/V247: hero-nappi lukee saman tilan kuin ⋯-nappi — "Haetaan…" ennen ensimmäistä
          // fixiä, ei valheellista "GPS päällä" (B133).
          gpsLabel: () => gpsButtonLabel(gpsNavigator.getState()),
          // T413/V304: reitittömän tehtävän "seuraava merkki" -oletusvalinta lukee viimeisimmän
          // fixin. Provider ⊥ instanssi: `src/ui/` ⊥ saa nähdä GpsNavigatoria (Leaflet-raja).
          gpsPosition: () => gpsNavigator.getPosition(),
          // T232 (F)/V159: hero:n valittu merkki (◀▶-selailu/reconcile) → synkkaa kartan korostus.
          // null = ei valittua (done/väärä phase) → tyhjennä. Korostus SEURAA valintaa, ei suoraan
          // firstUnsetMarkeria (estää "highlight osoittaa eri merkkiin kuin hero" -epäjohdonmukaisuuden).
          onNavigate: (id) => {
            // R6/V178: ikoni-hehku seuraa hero:n valintaa (◀▶). null = ei korostusta.
            markerManager.setNextHighlight(id ?? null)
          },
          // T232 (E)/T229 + R8: "+ Merkki" hero-overflowsta / yläpalkin ⋯:stä → sign-picker kartan
          // keskelle (POST omalle pätkälle V149). Jaettu openAddMarkerPicker.
          onAddMarker: openAddMarkerPicker,
          // T218/V143 (skenaario 2): keräyslistan "Haettu"-kuittaus. Suora status-asetus (EI 'kerää'-
          // action, joka heittää suunniteltu-tilaisille — sama syy kuin bulkCollect yllä). Kuka tahansa
          // autentikoitu, ei ownership-gatea; kerätty ↔ suunniteltu. bulkSetStatus persistoi + onUpdate.
          onCollectMarker: (id, collected) => markerManager.bulkSetStatus([id], collected ? 'kerätty' : 'suunniteltu'),
          // T409/V292: koti-tabin valikoiva bulk-kuittaus. SAMA reitti kuin järjestäjän
          // paneelilla (rivi ~608) & purkuvaiheen bulkCollectilla ∴ ⊥ uutta mutaatiopolkua:
          // bulkSetStatus persistoi + laukaisee onUpdate → lista & kartta päivittyvät kerralla.
          onBulkStatus: (ids, status) => markerManager.bulkSetStatus(ids, status),
          // T424/V314: kasan ehdokkaat — kerätyt joita ⊥ ole vielä missään kasassa. KOKO
          // merkkijoukko toisena argumenttina: kasa voi olla eri pätkällä kuin sen sisältö.
          pileCandidates: () => unclaimedCollected(
            getMarkersForSegment(seg, markerManager.getAll(), segmentPeers(segmentStore, seg)),
            markerManager.getAll(),
          ),
          // T424/V314: "📦 Jätä kasa tähän" — kasa syntyy olemassa olevalla luontipolulla
          // (POST omalle pätkälle V149 → audit-rivi V227 tulee ilmaiseksi).
          // T430/V320 KUMOSI T424:n eston: kasa syntyy AINA. Fix käytettävissä → kasa siihen
          // (nolla napautusta); ilman fixiä nappi siirtää kartan sijoitustilaan & talkoolainen
          // napauttaa kohdan itse. Kasa on pantava johonkin — muuten merkit jäävät kirjaamatta
          // & tieto katoaa kokonaan. Kasa on merkki (raahattavissa & poistettavissa) ∴ epätarkka
          // kasa ⊥ ole lopullinen vahinko, kirjaamatta jäänyt on.
          // T453/V337: napin painallus joka ⊥ tee mitään on pahin mahdollinen lopputulos —
          // käyttäjä ⊥ tiedä painoiko hän ohi, onko sovellus jumissa vai puuttuuko oikeus.
          onLeavePile: () => runPileAction(leavePile),
        },
      )

      const leavePile = (): void => {
        const candidates = unclaimedCollected(
          getMarkersForSegment(seg, markerManager.getAll(), segmentPeers(segmentStore, seg)),
          markerManager.getAll(),
        )
        // ⊥ hiljaista returnia: nappi kantaa määrän ∴ jos se on 0 tässä, nappi on vanhentunut
        // (lista päivittyi napin alta) & käyttäjä ansaitsee tietää sen ⊥ arvata.
        if (candidates.length === 0) {
          showToast('Kasaan ei ole mitään pantavaa — kuittaa ensin merkkejä kerätyiksi')
          return
        }
        const ids = candidates.map(m => m.id)
        // T452/V336 (B183): ohjerivi PANELIIN (`#segment-view`), ⊥ konttiin — kontti on
        // karttamoodissa `pointer-events:none` ∴ "Peruuta" olisi näkyvä & kuollut.
        const hintHost = document.getElementById('segment-view')
          ?? document.getElementById('segment-view-container') ?? document.body

        // T455/V340 (B188): teko ! päättyä NÄKYVÄÄN kasaan. Kartta jää auki (T454), piste
        // tuodaan ruudulle & rivi kertoo tuloksen + tien kasalistaan — 3 s toast katosi ennen
        // kuin katse ehti kartalta takaisin ∴ ainoa todiste oli uudelleenlataus.
        const create = (lat: number, lon: number): void => {
          const tpl = pileTemplate()
          const pile = markerManager.add(
            lat, lon, PILE_TEMPLATE_ID, tpl.color, tpl.label, tpl.iconId,
            undefined, undefined, PILE_TEMPLATE_ID,
            { pileMarkerIds: ids },
          )
          markerManager.panTo(pile.id)
          showPileDoneRow(hintHost, ids.length, '/kasat', 'Voit vielä siirtää kasaa raahaamalla.')
          // T457/V342: korjausikkuna auki — sulkeutuu seuraavasta napista, ⊥ ajastimesta.
          closePileEdit()
          pileEdit = openPileEditWindow({
            markerId: pile.id,
            host: hintHost,
            setEditable: setEditablePile,
          })
        }

        // T450a: place-modessa pysyvä ohjerivi, ⊥ pieni toast (hanskat, aurinko, kiire).
        // "Peruuta" on SAMASSA paikassa koko tilan ajan ∴ peruutusta ⊥ tarvitse etsiä.
        //
        // T452/V335 (B182): siirtyminen on ATOMINEN — näkymämoodi kartaksi, ohjerivi heroon
        // & viritys päälle samassa teossa (`startPilePlacement`). Kotimoodissa `#map` on
        // `display:none` ∴ ilman moodinvaihtoa sovellus pyysi napauttamaan pintaa jota ⊥ ole.
        //
        // T454/V338 (B185): GPS-oikopolku POISTUI — `getPosition()` palauttaa fixin ilman ikä-
        // tai tarkkuusrajaa ∴ vanha/epätarkka piste loi kasan sinne minne käyttäjä ⊥ sitä
        // laittanut ("kasa ei tule mihin laitan"). GPS keskittää kartan & antaa etäisyyslukeman;
        // SIJAINNIN valitsee ihminen, joka tietää missä on vaikka satelliitti ⊥ tiedä.
        // Edellisen kasan kuittausrivi & korjausikkuna väistyvät heti kun uusi sijoitus alkaa —
        // vanha tulos uuden teon päällä olisi kaksi totuutta siitä mitä juuri tapahtui, & kaksi
        // auki olevaa ikkunaa olisi kaksi raahattavaa kasaa.
        closePileEdit()
        removePileDoneRow(hintHost)
        if (!mapMode.canPlaceMarkers()) mapMode.set('muokkaus')
        const fix = gpsNavigator.getPosition()
        startPilePlacement({
          host: hintHost,
          contents: candidates,
          armPlacer: (fn, onDisarm) => placeMode.armPlacer(fn, onDisarm),
          disarm: () => placeMode.disarm(),
          showPreview: (lat, lon, onMove) => showPilePreview(map, lat, lon, onMove),
          distanceFrom: (lat, lon) => {
            const at = gpsNavigator.getPosition()
            return at ? haversineDistance(at, { lat, lon }) : null
          },
          onConfirm: create,
          onEnterKartta: () => map.invalidateSize(),
        })
        // Fix on ALOITUSNÄKYMÄ ⊥ sijainti: kartta aukeaa siihen mistä käyttäjä katsoo, jotta
        // napautettava kohta on ruudulla ilman selailua. Ajetaan `startPilePlacement`in JÄLKEEN
        // — sitä ennen `#map` voi olla vielä `display:none` & Leaflet laskisi keskityksen
        // nollakokoiselle kontille (V176-suku).
        if (fix) map.setView([fix.lat, fix.lon], Math.max(map.getZoom(), 15))
      }

      const segMarkers0 = getMarkersForSegment(seg, markerManager.getAll(), segmentPeers(segmentStore, seg))
      segmentView.update(segMarkers0)
      // T224 (D): "tässä on sun pätkä" — zoomaa pätkään heti latauksessa.
      fitMapToSegment(map, routes, seg, segMarkers0)
      // T224 (b1)/T256: korosta seuraava asettamaton merkki kartalla (kartta = päänavigointi).
      updateNextHighlight(seg, segMarkers0)
      // T222/V150: vain oman pätkän merkit raahattavia — vieraita ei voi siirtää (backend 403).
      // T307/V218: lisäksi vain muokkaustilassa (applyDraggable yhdistää ehdot).
      baseDraggable = m => currentSegmentMarkerIds()?.has(m.id) ?? false
      applyDraggable()

      // T257/R8/V179: talkoolaisen yläpalkin ⋯-toiminnot (VISION "GPS ym ylävalikkoon").
      // Karttamoodissa hero-chrome minimaali (T255) → Lisää merkki ⋯:ssä.
      // GPS kytkettiin jo ylempänä (T341/V247) — se ei tarvitse pätkää, tämä tarvitsee.
      // T351/V254 (B140): "Merkitse pätkä valmiiksi" EI enää täällä — se on hero:n done-rivillä
      // (`segment-hero.ts`, `actions.onComplete` → applyComplete). Yksi sisääntulo per rooli.
      document.getElementById('btn-tk-add-marker')?.addEventListener('click', openAddMarkerPicker)
    }
  }

  const driveMode = new DriveMode(map, routes[0].routePoints, km => {
    progressBar?.update(km)
  })

  // T204/V134: RouteBar-jako. Talkoolainen saa täyden drive-kontrollin (RouteBar: reittivalinta
  // + ◀▶-nuolet + km-scrubber); järjestäjä saa vain kevyen näytä/piilota-reittivalitsimen
  // (RouteVisibilityControl). Drive-DOM (scrubber, ◀▶) renderöityy VAIN talkoolaiselle —
  // piilotetaan järjestäjältä. (GpsDrivePanel poistettu T224/V148 — hero on ainoa ohjaus.)
  const isTalkoolainen = getRole() === 'talkoolainen'
  let routeBar: RouteBar | null = null
  let routeVis: RouteVisibilityControl | null = null
  const routeSelectorEl = document.getElementById('route-selector')!

  if (isTalkoolainen) {
    // T224 (A/V148): talkoolaisen alapalkki (`#route-bar`) POISTETTU kokonaan — se ei tuonut
    // arvoa pätkäkeskeisessä flowssa (hero + kartta + "Kaikki merkit"/"Varustelista" -napit riittää).
    // RouteBar luodaan yhä driveMode-reitin + activeRouteProviderin vuoksi, mutta itse palkki
    // piilotetaan. (◀▶/scrubber ohjasi koko reittiä, ei pätkää → hämäävä; pois näkyvistä.)
    routeBar = new RouteBar(
      routes, polylines, map, driveMode, markerManager,
      routeSelectorEl,
      document.getElementById('route-track-fill') as HTMLElement,
      () => { progressBar?.update(0); progressBar?.refreshDots() },
    )
    document.getElementById('route-bar')?.setAttribute('hidden', '')
  } else {
    routeVis = new RouteVisibilityControl(routes, polylines, map, markerManager, ids => {
      // T374/V269/B157: reitin piilotus vie pätkäviivat & nimilaput mukanaan.
      setSegmentVisibleRoutes(ids)
      renderSegmentOverlay()
    })
    // T377: järjestäjän alapalkki poistuu kokonaan — reittivalinta asuu suodatinbarissa
    // kartan yläpuolella (yksi "mitä näkyy" -pinta, ⊥ kahta). Drive-osat olivat jo piilossa (V134).
    document.getElementById('route-bar')?.setAttribute('hidden', '')
  }

  const activeRouteProvider = () => (routeBar ?? routeVis!).getActiveRoute()
  const activeTotalProvider = () => (routeBar ?? routeVis!).getActiveTotalM()

  // V300/B169: ProgressBar ENNEN MapFilterBaria. `MapFilterBar`in ctor ajaa `onChange`in
  // synkronisesti (persistoitu suodatin ! päätyä kartalle heti, map-filter-bar.ts:88) →
  // `routeVis.setVisibleRoutes` → `markerManager.onUpdate` → `progressBar.refreshDots()`.
  // Aiemmin luonti oli VASTA barin jälkeen ∴ persistoitu `visibleRouteIds` kaatoi koko initin.
  // Providerit ovat laiskoja closureja & `routeBar`/`routeVis` on jo ratkaistu tässä kohtaa.
  progressBar = new ProgressBar(
    activeRouteProvider,
    activeTotalProvider,
    driveMode,
    markerManager,
  )
  progressBar.update(0)

  // T377/V272: suodatinbar kartan yläpuolelle. Järjestäjä saa 4 akselia, talkoolainen kapean
  // "Näytä"-valinnan (T379). Bar PÄÄTTÄÄ tilan; sovellus tapahtuu tässä callbackissa (V271).
  const filterBarEl = document.getElementById('map-filter-bar')
  let mapFilterBar: MapFilterBar | null = null
  if (filterBarEl) {
    mapFilterBar = new MapFilterBar(filterBarEl, {
      routes: routes.map(r => ({ id: r.id, label: r.label, color: r.color, dashArray: r.dashArray, event: r.event })),
      getSegmentName: id => segmentStore.get(id)?.displayName,
      narrow: isTalkoolainen,
      onIsolationClear: () => clearFocusSegment(),
      onChange: filter => {
        // V243-amend: himmennysporras on JÄRJESTÄJÄN asetus. Talkoolaisen automaattifokus pysyy
        // kevyt-portaassa ∴ attribuuttia ⊥ kirjoiteta talkoolaisen näkymään lainkaan.
        if (!isTalkoolainen) document.body.dataset.dimLevel = filter.dimLevel
        // Reittiakseli menee Leaflet-kerrokseen kontrollin kautta (se omistaa polylinet).
        if (routeVis && filter.visibleRouteIds) routeVis.setVisibleRoutes(filter.visibleRouteIds)
        markerManager.setMapFilter(filter, {
          isolatedMarkerIds: isolatedMarkerIds(filter, Array.from(segmentStore.values()), markerManager.getAll()),
          // T391/V283/B165: orpojoukko lasketaan vain kun sitä kysytään — se on koko
          // jäsenyysratkaisu (kaikki pätkät × kaikki merkit), ⊥ ilmainen.
          orphanMarkerIds: filter.onlyOrphans
            ? orphanMarkerIds(Array.from(segmentStore.values()), markerManager.getAll())
            : undefined,
        })
        setSegmentMapFilter(filter)
        renderSegmentOverlay()
      },
    })
    filterBarEl.removeAttribute('hidden')
  }

  // T224 (F)/V148: talkoolaisen seuraava-merkki-ohjaus asuu YKSIN SegmentView-herossa (ylhäällä).
  // Vanha alapalkin GpsDrivePanel (⇒ Seuraava / ✓ Aseta / Ei tarpeen) poistettu duplikaationa —
  // hero on ainoa Aseta/ohjaa-kontrolli. Oikea GPS-geolokaatio elää erikseen (gps-navigator.ts).

  statusPanel = new StatusPanel(document.getElementById('status-panel')!)
  statusPanel.update(calcAllRouteStatus(markerManager.getAll(), routes.map(r => r.id)))

  signLibrary = createSignLibrary()
  const placeMode = new PlaceMode(markerManager, signLibrary, mapMode)
  const signLibraryContainer = document.getElementById('sign-type-dropdown')
  let signLibraryPanel: SignLibraryPanel | null = null
  if (signLibraryContainer) {
    signLibraryPanel = new SignLibraryPanel(
      signLibraryContainer,
      signLibrary,
      () => saveLibrary(signLibrary),
      // T307/V218: sivupalkin "aseta kartalle" on eksplisiittinen käyttäjätoimi → avaa
      // muokkaustila ennen viritystä (PlaceMode.armFromSidebar itse on no-op katselussa).
      // Sama linja kuin talkoolaisen "+ Merkki" — nappi ei jää hiljaa toimimattomaksi.
      (t) => {
        if (!mapMode.canPlaceMarkers()) mapMode.set('muokkaus')
        placeMode.armFromSidebar(t)
      },
      // T193/V123: luonti/päivitys → backend outboxin kautta (jaettu kaikille järjestäjille)
      (template: SignTemplate, isNew: boolean) => {
        void (isNew ? createTemplateRemote(template) : updateTemplateRemote(template))
      },
      (id: string) => { void deleteTemplateRemote(id) },
    )
    // T444/V250: purussa merkkejä ⊥ aseteta ∴ kirjasto kutistuu — mutta ⊥ katoa (järjestäjä voi
    // tarvita sitä korjaukseen kesken purun). Lähde on KATSELUvaihe: paneeli on järjestäjän pinta.
    signLibraryPanel.setPhase(getViewPhase())
  }

  // T193/V123: backend on kirjaston totuus. Lataa mallit initissä ja korvaa cache-/seed-sisältö
  // in-place (Map-referenssi jaettu PlaceModelle + paneelille). Lataus-epäonnistuminen (V118) →
  // säilytä cache + varoita, älä tyhjennä kirjastoa hiljaa.
  void fetchTemplates().then((result) => {
    if (!signLibrary) return
    if (!result.ok) {
      showWarning('⚠ Merkkikirjaston lataus epäonnistui — näytetään paikallinen kopio', 5000)
      return
    }
    signLibrary.clear()
    for (const t of result.templates) signLibrary.set(t.id, t)
    saveLibrary(signLibrary)
    signLibraryPanel?.refresh()
  })

  // T402/V290: järjestäjän merkkijono — telakoitu paneeli, ⊥ modaali. `#btn-list` togglaa sen.
  // Talkoolaiselle paneelia ⊥ luoda lainkaan: hänen "Kaikki merkit" on koti-tab (V183/V184) &
  // `#btn-list` on häneltä piilotettu jo T264:ssä.
  const markerOverviewEl = document.getElementById('marker-overview')
  if (markerOverviewEl && !isTalkoolainen) {
    markerOverview = new MarkerOverviewPanel(markerOverviewEl, {
      getMarkers: () => markerManager.getAll(),
      // V290/V91: VAIN aktiivisen vaiheen pätkät — sama fyysinen merkki elää eri pätkäjaossa
      // eri vaiheessa ∴ vaiheiden yli koottu lista näyttäisi sen monta kertaa eri omistajilla.
      getSegments: () => getSegmentsForPhase(segmentStore, getViewPhase()),
      // V271: suodatin luetaan barista kun se on; muuten persistoidusta tilasta (sama lähde).
      getFilter: () => mapFilterBar?.getFilter() ?? loadMapFilter(),
      onPanTo: id => markerManager.panTo(id),
      onOpenDetail: onOpenMarkerDetail,
      // V117/T185: "tallentamatta" seurasi vanhaa listaa ∴ se ! seurata myös korvaajaa —
      // muuten vahvistamaton kirjoitus katoaa näkyvistä (kääntäjä nappasi tämän T404:ssä).
      getPendingIds: markerPendingIds,
      // T404-parity: järjestäjän bulk-status kulkee SAMAA reittiä kuin ennen
      // (`manager.bulkSetStatus`) ∴ ⊥ uutta mutaatiopolkua.
      onBulkStatus: (ids, status) => markerManager.bulkSetStatus(ids, status),
      // T179-oppi: telakka muuttaa #map-arean leveyttä → Leaflet ! saada tietää.
      onVisibilityChange: () => map.invalidateSize(),
      // T403/V299: luonti on kolmikko (createSegment + pushSegment + näkymän päivitys) ∴ se
      // kulkee jaetun apurin kautta — unohtunut push = pätkä joka elää vain selaimessa (V18).
      // V299: `phase` AKTIIVISESTA vaiheesta, muuten tehtävä katoaa siitä listasta josta se
      // juuri luotiin (paneeli on vaiherajattu, V290).
      onCreateTask: markerIds => {
        const seg = createAndPushSegment(segmentStore, {
          // V139: reititön tehtävä — EI route-kenttiä. createSegment ohittaa V11/V25 (T212).
          equipment: [],
          phase: getViewPhase(),
          displayName: `Jälkihoito ${new Date().toLocaleDateString('fi-FI')}`,
          linkedMarkerIds: markerIds,
        })
        segmentPanel.refreshCounts()
        renderSegmentOverlay()
        showWarning(`✓ Tehtävä "${seg.displayName}" luotu (${markerIds.length} merkkiä)`, 4000)
      },
      // T415/V305: valitut OLEMASSA OLEVAAN tehtävään. Jaettu apuri (`addMarkersToSegment`)
      // ∴ additiivisuus & idempotenssi ovat samat kaikilla kolmella kutsupaikalla (V305).
      // Kohde tulee samasta vaiherajatusta listasta kuin `getSegments` (V290/V91).
      onAddToSegment: (markerIds, segmentId) => {
        const target = segmentStore.get(segmentId)
        if (!target) return
        const next = addMarkersToSegment(target, markerIds)
        if (next === target) {
          showWarning('Kaikki valitut kuuluvat jo tähän tehtävään', 3000)
          return
        }
        updateSegment(segmentStore, segmentId, {
          linkedMarkerIds: next.linkedMarkerIds,
          excludedMarkerIds: next.excludedMarkerIds,
        })
        // V115/V220-kanava: hiljainen optimismi on kielletty — epäonnistuminen ! näkyä.
        const flagErr = (): void => showWarning('⚠ Merkkien lisäys ei tallentunut — yritä uudelleen', 5000)
        updateSegmentRemote(segmentId, {
          linkedMarkerIds: next.linkedMarkerIds,
          excludedMarkerIds: next.excludedMarkerIds,
        })
          .then(ok => { if (!ok) flagErr() })
          .catch(() => flagErr())
        segmentPanel.refreshCounts()
        renderSegmentOverlay()
        const name = target.displayName?.trim() || target.id
        const added = (next.linkedMarkerIds?.length ?? 0) - (target.linkedMarkerIds?.length ?? 0)
        showWarning(`✓ ${added} merkkiä lisätty tehtävään "${name}"`, 4000)
      },
      // T415: merkkimäärä valikkoriville — laskenta on jäsenyyden asia (V259) ∴ UI ⊥ laske itse.
      getSegmentMarkerCount: id => {
        const seg = segmentStore.get(id)
        if (!seg) return 0
        return getMarkersForSegment(seg, markerManager.getAll(), segmentPeers(segmentStore, seg)).length
      },
      // V291: mihin valitut kuuluvat JO — operaatio on additiivinen ∴ tämä on informaatio
      // ⊥ varoitus menetyksestä (mitattu: reititön tehtävä ⊥ vie merkkiä nykyiseltä pätkältä).
      getExistingOwners: ids =>
        existingSegmentOwners(ids, getSegmentsForPhase(segmentStore, getViewPhase()), markerManager.getAll()),
    })
    // T402: panorointi kompensoi telakan leveyden ∴ "näytä kartalla" ⊥ osoita paneelin alle.
    markerManager.setPanPaddingRight(() => markerOverview?.visibleWidth() ?? 0)
    markerOverview.render()
  }
  // T404: `#btn-list` = merkkijono-telakan toggle. Vanha `#marker-modal` POISTETTU — se oli
  // järjestäjän pintaa & talkoolaiselta piilotettu jo T264:ssä (V292) ∴ ⊥ fallback-haaraa.
  //
  // T469/V356 (B203): nappi on `disabled` HTML:ssä & aukeaa VASTA tässä. `wireMarkers` ajetaan
  // kahden `await`in (`wireAreas`, `wireSegments`) JÄLKEEN ∴ nappi on ollut ruudulla & painettavissa
  // koko verkkohaun ajan ilman kuuntelijaa — painallus katosi täysin (V337: hiljaisuus ⊥ ole
  // neutraali). Ikkuna on lyhyt hyvällä yhteydellä & pitkä metsässä, eli juuri väärinpäin.
  const btnList = document.getElementById('btn-list') as HTMLButtonElement | null
  btnList?.addEventListener('click', () => markerOverview?.toggle())
  if (btnList) btnList.disabled = false

  // T264/V184: yläpalkin "🎒 Varustelista" -nappi POISTETTU — varuste on nyt koti-Varustelista-tab
  // (inline SegmentEquipment). EquipmentModal avautuu yhä koti-tabin "✎ Muokkaa varusteita" -napista.


  document.getElementById('btn-route-next')!.addEventListener('click', () => driveMode.next())
  document.getElementById('btn-route-prev')!.addEventListener('click', () => driveMode.prev())

  // T39: "hyppää seuraavaan merkkiin" — siirtää driveMode-kursorin seuraavan merkin kohtaan
  // aktiivisella reitillä (edessäpäin). Ei GPS-riippuvainen. T327/V235: sekä valinta että
  // kursorin kohde luetaan AKTIIVISEN reitin akselilta (distanceAhead), EI merkin
  // distanceFromStart-skalaarista — se voi olla mitattu toiselta reitiltä ∴ kursori hyppäisi
  // väärään kohtaan (B126). Jos edessä ei ole merkkiä, ei tehdä mitään (kursori jää paikalleen).
  document.getElementById('btn-route-next-marker')?.addEventListener('click', () => {
    const route = activeRouteProvider()
    const currentDistM = driveMode.currentKm() * 1000
    const targetKm = distanceAhead(markerManager.getAll(), currentDistM, route.id)
    if (targetKm !== null) driveMode.jumpToDistance(targetKm)
  })

  // T380/V275: vapaa-piste-huomiot (CommentLayer, CommentPointModal, CommentPanel) POISTETTU.
  // Karttakohteen lisätieto on yksisuuntainen ohje merkin `locationNote`-kentässä, ⊥ keskustelu
  // omassa kerroksessaan — koko kauden tuotantokäyttö oli 1 kommentti, & sekin duplikaatti
  // saman merkin ohjekentästä. Keskustelu käydään WhatsAppissa.

  return { markerManager, driveMode, routeBar, progressBar, placeMode, markerOverview, mapFilterBar }
}
