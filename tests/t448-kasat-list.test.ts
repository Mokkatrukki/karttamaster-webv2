import { describe, it, expect } from 'vitest'
import { listPiles, allPileRows, formatPileDistance, formatPileSummary, PILE_TARGET } from '../src/logic/pile-list'
import { PILE_TEMPLATE_ID } from '../src/logic/pile'
import type { SignMarker } from '../src/logic/types'

function marker(id: string, over: Partial<SignMarker> = {}): SignMarker {
  return {
    id,
    type: 'nuoli',
    lat: 65.6,
    lon: 27.5,
    distanceFromStart: 0,
    routeIds: [],
    status: 'suunniteltu',
    templateId: 'nuoli-vasen',
    ...over,
  } as SignMarker
}

function pile(id: string, lat: number, lon: number, over: Partial<SignMarker> = {}): SignMarker {
  return marker(id, { templateId: PILE_TEMPLATE_ID, type: PILE_TEMPLATE_ID, lat, lon, pileMarkerIds: ['x'], ...over })
}

describe('T448/V332 — kasalista johdetaan kasoista, ⊥ tehtäväoliosta', () => {
  it('lista on `kind === kasa` -suodatin koko merkkijoukosta', () => {
    const rows = allPileRows(listPiles([marker('kyltti1'), pile('k1', 65.6, 27.5), marker('kyltti2')]))
    expect(rows.map(r => r.marker.id)).toEqual(['k1'])
    // ⊥ markerTypeFilteriä, ⊥ pätkää, ⊥ järjestäjän luontiaskelta: kasa riittää itsessään.
  })

  it('tyhjä joukko → tyhjä lista (⊥ kaadu, ⊥ arvaa)', () => {
    expect(listPiles([])).toEqual({ open: [], done: [] })
    expect(listPiles([marker('a')])).toEqual({ open: [], done: [] })
  })

  it('järjestys: lähin ensin kun GPS-fix on', () => {
    const kaukana = pile('kaukana', 65.9, 27.5)
    const lahella = pile('lahella', 65.61, 27.5)
    const keski = pile('keski', 65.7, 27.5)
    const rows = listPiles([kaukana, keski, lahella], { lat: 65.6, lon: 27.5 }).open
    expect(rows.map(r => r.marker.id)).toEqual(['lahella', 'keski', 'kaukana'])
    expect(rows[0].distanceM).toBeLessThan(rows[1].distanceM!)
  })

  it('ilman fixiä järjestys on luontijärjestys & etäisyys on null (⊥ arvattu nolla)', () => {
    const rows = listPiles([pile('b', 65.9, 27.5), pile('a', 65.61, 27.5)]).open
    expect(rows.map(r => r.marker.id)).toEqual(['b', 'a'])
    expect(rows.every(r => r.distanceM === null)).toBe(true)
  })

  it('haettu kasa ⊥ katoa listalta mutta on OMASSA ryhmässään (⊥ hännillä hiljaa)', () => {
    const groups = listPiles(
      [pile('haettu', 65.601, 27.5, { status: 'kerätty' }), pile('avoin', 65.8, 27.5)],
      { lat: 65.6, lon: 27.5 },
    )
    // Haettu on FYYSISESTI lähempänä mutta ⊥ ole työtä ∴ se ⊥ ole avoimien joukossa.
    expect(groups.open.map(r => r.marker.id)).toEqual(['avoin'])
    expect(groups.done.map(r => r.marker.id)).toEqual(['haettu'])
    expect(groups.done[0].done).toBe(true)
  })

  it('molemmat ryhmät järjestyvät erikseen lähin ensin', () => {
    const groups = listPiles([
      pile('haettu-kaukana', 65.9, 27.5, { status: 'kerätty' }),
      pile('avoin-kaukana', 65.8, 27.5),
      pile('haettu-lahella', 65.61, 27.5, { status: 'kerätty' }),
      pile('avoin-lahella', 65.62, 27.5),
    ], { lat: 65.6, lon: 27.5 })
    expect(groups.open.map(r => r.marker.id)).toEqual(['avoin-lahella', 'avoin-kaukana'])
    expect(groups.done.map(r => r.marker.id)).toEqual(['haettu-lahella', 'haettu-kaukana'])
  })

  it('allPileRows: avoimet ennen haettuja — kartta piirtää kaikki', () => {
    const groups = listPiles([pile('haettu', 65.6, 27.5, { status: 'kerätty' }), pile('avoin', 65.6, 27.5)])
    expect(allPileRows(groups).map(r => r.marker.id)).toEqual(['avoin', 'haettu'])
  })

  it('sisältömäärä tulee pileMarkerIds:istä (puuttuva → 0, ⊥ undefined)', () => {
    const rows = listPiles([pile('k', 65.6, 27.5, { pileMarkerIds: ['a', 'b', 'c'] }), pile('tyhja', 65.6, 27.5, { pileMarkerIds: undefined })]).open
    expect(rows.find(r => r.marker.id === 'k')!.count).toBe(3)
    expect(rows.find(r => r.marker.id === 'tyhja')!.count).toBe(0)
  })

  it('kasan elinkaari on KERÄYSTEHTÄVÄ (T421 COLLECTION), ⊥ pätkän vaihe', () => {
    expect(PILE_TARGET.openStatuses).toEqual(['suunniteltu'])
    expect(PILE_TARGET.targetStatus).toBe('kerätty')
    expect(PILE_TARGET.actionLabel).toBe('✓ Haettu')
  })
})

describe('T448 — muotoilu', () => {
  it('etäisyys metreinä alle kilometrin, kilometreinä yli', () => {
    expect(formatPileDistance(340)).toBe('340 m')
    expect(formatPileDistance(1234)).toBe('1,2 km')
    expect(formatPileDistance(null)).toBe('')
    expect(formatPileDistance(NaN)).toBe('')
  })

  it('sisältöyhteenveto', () => {
    expect(formatPileSummary(7)).toBe('7 merkkiä')
    expect(formatPileSummary(0)).toBe('Tyhjä kasa')
  })
})
