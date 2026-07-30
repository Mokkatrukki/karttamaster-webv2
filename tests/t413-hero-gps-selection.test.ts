// T413/V304: hero:n OLETUSVALINTA lukee GPS-fixin reitittömällä tehtävällä — mutta jo valittu
// merkki ⊥ vaihdu alta uuden fixin takia (hysteresis). Taso 2: rakenne todistetaan DOM:ista,
// koska juuri kytkentä (⊥ pure-funktio) on se joka voi hiljaa pudota pois.
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentView } from '../src/ui/segment-view'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

function marker(over: Partial<SignMarker> & { id: string }): SignMarker {
  return {
    type: 'right',
    lat: 65.6,
    lon: 27.5,
    distanceFromStart: 0,
    routeIds: ['smtb-60'],
    status: 'suunniteltu',
    ...over,
  } as SignMarker
}

/** Reititön tehtävä (V139): ⊥ routeIds ⊥ rajoja. */
function routelessSeg(): Segment {
  return {
    id: 'seg-r',
    equipment: [],
    phase: 'asettaminen',
    displayName: 'Keräystehtävä',
    linkedMarkerIds: ['far', 'near'],
  } as Segment
}

// Skalaari on käänteinen etäisyyteen: 'far' on listan ensimmäinen km-järjestyksessä mutta
// kaukana GPS:stä ∴ testi kaatuu jos valinta lipsuu skalaariin.
const far = marker({ id: 'far', lat: 65.7, lon: 27.7, distanceFromStart: 10, label: 'Kaukainen' })
const near = marker({ id: 'near', lat: 65.6001, lon: 27.5001, distanceFromStart: 9000, label: 'Lähin' })

const heroName = (c: HTMLElement): string | undefined =>
  c.querySelector('.segment-view-next-name')?.textContent ?? undefined

describe('T413/V304 — hero:n GPS-oletusvalinta', () => {
  let container: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('reititön tehtävä + fix → hero avaa LÄHIMMÄN, ei km-järjestyksen ensimmäistä', () => {
    const sv = new SegmentView(container, routelessSeg(), undefined, undefined, {
      gpsPosition: () => ({ lat: 65.6, lon: 27.5 }),
    })
    sv.update([far, near])
    expect(heroName(container)).toContain('Lähin')
  })

  it('ilman fixiä (provider puuttuu) → nykykäytös: km-järjestyksen ensimmäinen', () => {
    const sv = new SegmentView(container, routelessSeg())
    sv.update([far, near])
    expect(heroName(container)).toContain('Kaukainen')
  })

  it('provider palauttaa null (fixiä ⊥ vielä) → sama fallback, ⊥ heitto', () => {
    const sv = new SegmentView(container, routelessSeg(), undefined, undefined, {
      gpsPosition: () => null,
    })
    sv.update([far, near])
    expect(heroName(container)).toContain('Kaukainen')
  })

  it('HYSTERESIS: valittu merkki ⊥ vaihdu kun fix siirtyy toisen merkin viereen', () => {
    let pos = { lat: 65.6, lon: 27.5 }
    const sv = new SegmentView(container, routelessSeg(), undefined, undefined, {
      gpsPosition: () => pos,
    })
    sv.update([far, near])
    expect(heroName(container)).toContain('Lähin')
    // Talkoolainen ajaa kaukaisen merkin viereen KESKEN työn — valinta pysyy siinä mitä hän katsoo.
    pos = { lat: 65.7, lon: 27.7 }
    sv.update([far, near])
    expect(heroName(container)).toContain('Lähin')
  })

  it('valittu poistuu asettamattomista → uusi oletus lukee fixin uudelleen', () => {
    let pos = { lat: 65.7, lon: 27.7 }
    const sv = new SegmentView(container, routelessSeg(), undefined, undefined, {
      gpsPosition: () => pos,
    })
    sv.update([far, near])
    expect(heroName(container)).toContain('Kaukainen')
    // 'far' asetetaan → reconcile nollaa valinnan → oletus tulee nykyisestä sijainnista.
    pos = { lat: 65.6, lon: 27.5 }
    sv.update([{ ...far, status: 'asetettu' }, near])
    expect(heroName(container)).toContain('Lähin')
  })

  it('reitillinen pätkä ⊥ regressoi: km-järjestys voittaa fixin (V237/V238)', () => {
    const routed = {
      id: 'seg-k',
      routeIds: ['smtb-60'],
      primaryRouteId: 'smtb-60',
      startDist: 0,
      endDist: 20000,
      equipment: [],
      phase: 'asettaminen',
      displayName: 'Reitillinen',
    } as Segment
    const a = marker({ id: 'a', lat: 65.7, lon: 27.7, distanceFromStart: 1000, label: 'Ensimmäinen' })
    const b = marker({ id: 'b', lat: 65.6001, lon: 27.5001, distanceFromStart: 9000, label: 'Lähin' })
    const sv = new SegmentView(container, routed, undefined, undefined, {
      gpsPosition: () => ({ lat: 65.6, lon: 27.5 }),
    })
    sv.update([a, b])
    expect(heroName(container)).toContain('Ensimmäinen')
  })
})
