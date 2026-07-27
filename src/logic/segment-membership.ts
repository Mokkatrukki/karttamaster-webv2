import type { Segment } from './segments'
import type { SignMarker } from './types'
import { resolveTaskMarkers } from './task-markers'
import { distanceToTrackM } from './segment-track'

// T359/V259: MERKILLÄ ON YKSI OMISTAJA.
//
// Miksi tämä tiedosto on olemassa: jäsenyys oli per-pätkä-kysymys (`resolveTaskMarkers`
// vastasi "kuuluuko tämä merkki tähän pätkään?" katsomatta muita) ∴ kahdella pätkällä sai olla
// sama vastaus. Tuotannossa 10 merkkiä 117:stä kuului kahteen pätkään (B143): kaksi
// talkoolaista sai saman kyltin & toinen ajoi metsään turhaan. Eksklusiivisuus ⊥ ole
// tarkistus jonka voi unohtaa — se on RAKENNE: kysymys on "kuka omistaa", ⊥ "kuuluuko".
//
// V259: lähin jälki voittaa AINA, kynnystä ⊥ ole. Kynnys tuottaisi orpoja & merkki ilman
// pätkää on näkymätön talkoolaiselle (`markers-wiring.ts` rajaa näkymän jäsenyyteen).
// Ehdokasjoukko rajaa sen sijaan reittijäsenyys (V25, 100 m korridori): merkki joka ⊥ ole
// pätkän reitillä ⊥ ole ehdokas ∴ gravel-merkit ⊥ tartu MTB-pätkiin.

/** Pätkän kentät joita jäsenyys lukee. */
export type MembershipSegment = Pick<
  Segment,
  | 'id'
  | 'phase'
  | 'routeIds'
  | 'primaryRouteId'
  | 'startDist'
  | 'endDist'
  | 'track'
  | 'linkedMarkerIds'
  | 'excludedMarkerIds'
  | 'markerTypeFilter'
>

function isExcluded(seg: MembershipSegment, marker: SignMarker): boolean {
  return seg.excludedMarkerIds?.includes(marker.id) ?? false
}

// V259: eksplisiittinen tahto VOITTAA geometrian. Järjestäjä joka on poiminut merkin kartalta
// (`linkedMarkerIds`) tai valinnut tyyppisuodattimen (V143) tietää jotain mitä geometria ⊥ tiedä
// ∴ hän ⊥ joudu taistelemaan heuristiikkaa vastaan. Jos hän linkittää saman merkin kahteen
// pätkään, se on hänen päätöksensä ⊥ bugi — eksklusiivisuus suojaa VAHINGOLTA, ⊥ tahdolta.
function isExplicitMember(seg: MembershipSegment, marker: SignMarker): boolean {
  if (seg.linkedMarkerIds?.includes(marker.id)) return true
  return seg.markerTypeFilter !== undefined && marker.templateId === seg.markerTypeFilter
}

// V25: ehdokkuus = pätkän reitti kulkee merkin ohi. Tämä on SCOPE ⊥ jäsenyyssääntö — se estää
// eri tapahtuman reitin merkkejä kilpailemasta, mutta ⊥ ratkaise ketään.
function isCandidate(seg: MembershipSegment, marker: SignMarker): boolean {
  if (!seg.track || seg.track.length === 0) return false
  return seg.routeIds?.some(r => marker.routeIds.includes(r)) ?? false
}

/**
 * V259: kuka omistaa minkäkin merkin. Avain = pätkän id, arvo = sen merkit.
 *
 * Ryhmittelee pätkät VAIHEEN mukaan itse: eksklusiivisuus on per phase (V91: eri vaiheiden
 * pätkät saavat olla päällekkäin) ∴ kutsuja ⊥ voi rikkoa sääntöä antamalla väärän joukon.
 *
 * V260-välitila: jäljetön pätkä (legacy, backfill ⊥ vielä ajettu) putoaa `resolveTaskMarkers`iin
 * ∴ sen käytös on TÄSMÄLLEEN entinen — myös siltä osin että se voi jakaa merkin toisen
 * jäljettömän pätkän kanssa. Se on laillinen välitila, ⊥ regressio: jälki syntyy heti kun GPX:t
 * ovat latautuneet (T361) & siitä eteenpäin pätkä on eksklusiivisen säännön piirissä.
 */
export function resolveSegmentMarkers(
  segments: MembershipSegment[],
  markers: SignMarker[],
): Map<string, SignMarker[]> {
  const out = new Map<string, SignMarker[]>(segments.map(s => [s.id, []]))
  const add = (segId: string, m: SignMarker): void => {
    out.get(segId)?.push(m)
  }

  const byPhase = new Map<Segment['phase'], MembershipSegment[]>()
  for (const seg of segments) {
    const list = byPhase.get(seg.phase)
    if (list) list.push(seg)
    else byPhase.set(seg.phase, [seg])
  }

  for (const phaseSegs of byPhase.values()) {
    const tracked = phaseSegs.filter(s => s.track && s.track.length > 0)
    const legacy = phaseSegs.filter(s => !s.track || s.track.length === 0)

    // V260: jäljetön pätkä säilyttää entisen per-pätkä-jäsenyytensä.
    for (const seg of legacy) {
      for (const m of resolveTaskMarkers(seg, markers)) {
        if (!isExcluded(seg, m)) add(seg.id, m)
      }
    }

    for (const marker of markers) {
      // 1. Eksplisiittinen tahto — ohittaa etäisyyslaskun kokonaan.
      const explicit = tracked.filter(s => !isExcluded(s, marker) && isExplicitMember(s, marker))
      if (explicit.length > 0) {
        for (const seg of explicit) add(seg.id, marker)
        continue
      }

      // 2. Geometria — lähin jälki voittaa, tasapeli pätkän id:llä (determinismi).
      let winner: MembershipSegment | null = null
      let best = Infinity
      for (const seg of tracked) {
        if (isExcluded(seg, marker)) continue
        if (!isCandidate(seg, marker)) continue
        const d = distanceToTrackM(seg.track!, marker.lat, marker.lon)
        if (d < best || (d === best && winner !== null && seg.id < winner.id)) {
          best = d
          winner = seg
        }
      }
      if (winner) add(winner.id, marker)
    }
  }

  return out
}

/**
 * Yhden pätkän merkit — `resolveSegmentMarkers`in kapea näkymä.
 * `peers` = saman vaiheen muut pätkät. ILMAN sitä eksklusiivisuutta ⊥ voi ratkaista (kysymys
 * "kuka omistaa" vaatii kilpailijat) ∴ tyhjä `peers` = "kilpailijoita ⊥ tiedetä" & tulos putoaa
 * legacy-km-sääntöön. Kutsuja jolla on `SegmentStore` ! antaa `segmentPeers`in.
 */
export function markersForSegment(
  segment: MembershipSegment,
  markers: SignMarker[],
  peers: MembershipSegment[] = [],
): SignMarker[] {
  // Tyhjä `peers` = "kilpailijoita ⊥ TIEDETÄ", ⊥ "kilpailijoita ⊥ OLE". Ero on ratkaiseva:
  // V259 on kynnyksetön ∴ yksin kilpaileva pätkä voittaisi JOKAISEN merkin reitillään (mitattu:
  // 122 merkkiä oikean 12:n sijaan). Ilman kilpailijatietoa palataan siis legacy-km-sääntöön —
  // sama haara kuin jäljettömällä pätkällä (V260) ∴ lukema on entinen & konservatiivinen,
  // ⊥ villisti liian suuri. Eksklusiivisuus vaatii joukon; kutsuja jolla on `SegmentStore`
  // antaa sen `segmentPeers`illa.
  if (peers.length === 0) return resolveTaskMarkers(segment, markers)
  const all = peers.some(p => p.id === segment.id) ? peers : [segment, ...peers]
  return resolveSegmentMarkers(all, markers).get(segment.id) ?? []
}
