import { describe, it, expect } from 'vitest'
import { resolveTaskMarkers, type TaskMarkerSource } from '../src/logic/task-markers'
import { getMarkersForSegment, createSegmentStore, createSegment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

function makeMarker(
  id: string,
  routeIds: string[],
  dist: number,
  templateId?: string,
): SignMarker {
  return {
    id,
    type: 'right',
    lat: 0,
    lon: 0,
    distanceFromStart: dist,
    routeIds,
    status: 'suunniteltu',
    templateId,
  }
}

describe('resolveTaskMarkers (V140)', () => {
  const markers: SignMarker[] = [
    makeMarker('m1', ['r1'], 2000, 'tpl-wc'),
    makeMarker('m2', ['r2'], 3000, 'tpl-keräys'),
    makeMarker('m3', ['r3'], 2000, 'tpl-keräys'),
    makeMarker('m4', ['r1'], 500, 'tpl-wc'),   // ennen startDistiä
    makeMarker('m5', ['r1'], 6000, 'tpl-wc'),  // endDistin jälkeen
  ]

  // V140: reitilliselle lähteelle sama tulos kuin vanha route+dist-filtteri
  it('reitillinen lähde: routeIds-leikkaus ∩ dist-range', () => {
    const source: TaskMarkerSource = { routeIds: ['r1', 'r2'], startDist: 1000, endDist: 5000 }
    expect(resolveTaskMarkers(source, markers).map(m => m.id)).toEqual(['m1', 'm2'])
  })

  it('reitillinen: sisällyttää raja-arvot [startDist, endDist]', () => {
    const source: TaskMarkerSource = { routeIds: ['r1'], startDist: 500, endDist: 6000 }
    expect(resolveTaskMarkers(source, markers).map(m => m.id)).toEqual(['m1', 'm4', 'm5'])
  })

  // V140: reititön + eksplisiittiset linkedMarkerIds
  it('reititön lähde + linkedMarkerIds: vain eksplisiittisesti liitetyt', () => {
    const source: TaskMarkerSource = { linkedMarkerIds: ['m2', 'm5'] }
    expect(resolveTaskMarkers(source, markers).map(m => m.id)).toEqual(['m2', 'm5'])
  })

  // V140: reititön + dynaaminen markerTypeFilter (V143 — täsmää templateId:llä)
  it('reititön lähde + markerTypeFilter: templateId-osumat elävästi', () => {
    const source: TaskMarkerSource = { markerTypeFilter: 'tpl-keräys' }
    expect(resolveTaskMarkers(source, markers).map(m => m.id)).toEqual(['m2', 'm3'])
  })

  it('markerTypeFilter täsmää templateId:llä, EI labelilla (V143)', () => {
    const withLabel = [makeMarker('x', ['r1'], 100, 'tpl-A')]
    // label ei vaikuta — vain templateId
    expect(resolveTaskMarkers({ markerTypeFilter: 'tpl-A' }, withLabel).map(m => m.id)).toEqual(['x'])
    expect(resolveTaskMarkers({ markerTypeFilter: 'right' }, withLabel)).toEqual([])
  })

  // V140: unioni deduplikoi implisiittisesti (merkki reitillä JA linkattu → kerran)
  it('unioni deduplikoi: merkki reittiosumassa JA linkedMarkerIds:ssä palautuu kerran', () => {
    const source: TaskMarkerSource = { routeIds: ['r1'], startDist: 1000, endDist: 5000, linkedMarkerIds: ['m1'] }
    const result = resolveTaskMarkers(source, markers)
    expect(result.filter(m => m.id === 'm1')).toHaveLength(1)
  })

  it('unioni: reitti ∪ typeFilter yhdistyy (eri lähteet)', () => {
    // reitti r1[1000-5000] → m1; typeFilter tpl-keräys → m2, m3
    const source: TaskMarkerSource = { routeIds: ['r1'], startDist: 1000, endDist: 5000, markerTypeFilter: 'tpl-keräys' }
    expect(resolveTaskMarkers(source, markers).map(m => m.id).sort()).toEqual(['m1', 'm2', 'm3'])
  })

  // V140: tyhjä source = tyhjä tulos
  it('tyhjä source (ei route-kenttiä, ei linked, ei typeFilter) → tyhjä', () => {
    expect(resolveTaskMarkers({}, markers)).toEqual([])
  })

  it('tyhjä markers-lista → tyhjä', () => {
    expect(resolveTaskMarkers({ routeIds: ['r1'], startDist: 0, endDist: 9999 }, [])).toEqual([])
  })
})

// V140: getMarkersForSegment delegoi resolveTaskMarkers:iin — regressio reitilliselle ennallaan
describe('getMarkersForSegment delegoi resolveTaskMarkers (V140)', () => {
  it('reitillinen segmentti: sama tulos kuin ennen (regressio)', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, { routeIds: ['r1', 'r2'], startDist: 1000, endDist: 5000, equipment: [], phase: 'asettaminen' })
    const markers: SignMarker[] = [
      makeMarker('m1', ['r1'], 2000),
      makeMarker('m2', ['r2'], 3000),
      makeMarker('m3', ['r3'], 2000),
    ]
    expect(getMarkersForSegment(seg, markers).map(m => m.id)).toEqual(['m1', 'm2'])
  })

  it('reititön segmentti + linkedMarkerIds: palauttaa liitetyt', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, { equipment: [], phase: 'asettaminen', linkedMarkerIds: ['m2'] })
    const markers: SignMarker[] = [
      makeMarker('m1', ['r1'], 2000),
      makeMarker('m2', ['r2'], 3000),
    ]
    expect(getMarkersForSegment(seg, markers).map(m => m.id)).toEqual(['m2'])
  })

  it('reititön segmentti + markerTypeFilter: palauttaa tyyppiosumat', () => {
    const store = createSegmentStore()
    const seg = createSegment(store, { equipment: [], phase: 'purku', markerTypeFilter: 'tpl-keräys' })
    const markers: SignMarker[] = [
      makeMarker('m1', ['r1'], 2000, 'tpl-wc'),
      makeMarker('m2', ['r2'], 3000, 'tpl-keräys'),
    ]
    expect(getMarkersForSegment(seg, markers).map(m => m.id)).toEqual(['m2'])
  })
})
