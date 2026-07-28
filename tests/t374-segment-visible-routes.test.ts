import { describe, it, expect } from 'vitest'
import { segmentVisibleOnRoutes } from '../src/logic/segment-visibility'
import type { Segment } from '../src/logic/segments'

// T374/V269/B157: reitin piilotus vie pätkäviivat & nimilaput mukanaan. Sääntö on puhdas
// predikaatti `src/logic/`ssa — map-kerros vain soveltaa (V271).
// Taso 1 Vitest-pure, ⊥ Leafletia ⊥ DOM:ia.

const seg = (over: Partial<Segment>): Pick<Segment, 'primaryRouteId' | 'routeIds'> =>
  ({ routeIds: ['r1'], ...over }) as Pick<Segment, 'primaryRouteId' | 'routeIds'>

describe('T374/V269 — segmentVisibleOnRoutes', () => {
  it('näkyvä primary-reitti → pätkä näkyy', () => {
    expect(segmentVisibleOnRoutes(seg({ routeIds: ['r1'] }), ['r1', 'r2'])).toBe(true)
  })

  it('piilotettu primary-reitti → pätkä katoaa', () => {
    expect(segmentVisibleOnRoutes(seg({ routeIds: ['r1'] }), ['r2'])).toBe(false)
  })

  it('V211: jäsenyys ratkeaa PRIMARYsta ⊥ routeIds-listasta — jaetun osuuden pätkä katoaa primaryn mukana', () => {
    // Jaettu osuus: pätkä on tägätty kolmelle reitille, mutta km-akseli & viivan geometria
    // tulevat primarysta (B114). Jos naapurireitti riittäisi näkyvyyteen, viiva jäisi kartalle
    // vaikka sen oma reitti on piilotettu.
    const shared = seg({ primaryRouteId: 'r1', routeIds: ['r1', 'r2', 'r3'] })
    expect(segmentVisibleOnRoutes(shared, ['r2', 'r3'])).toBe(false)
    expect(segmentVisibleOnRoutes(shared, ['r1'])).toBe(true)
  })

  it('V139: reititön tehtävä ⊥ katoa reittisuodatuksesta', () => {
    expect(segmentVisibleOnRoutes(seg({ routeIds: undefined }), ['r2'])).toBe(true)
    expect(segmentVisibleOnRoutes(seg({ routeIds: [] }), [])).toBe(true)
  })

  it('suodatinta ⊥ asetettu (undefined) → kaikki näkyvät', () => {
    expect(segmentVisibleOnRoutes(seg({ routeIds: ['r1'] }), undefined)).toBe(true)
  })

  it('tyhjä näkyvien lista → reitilliset katoavat, reitittömät jäävät', () => {
    // V6 estää tämän tilan UI:ssa; predikaatti on silti johdonmukainen ⊥ vuoda "näytä kaikki".
    expect(segmentVisibleOnRoutes(seg({ routeIds: ['r1'] }), [])).toBe(false)
    expect(segmentVisibleOnRoutes(seg({ routeIds: undefined }), [])).toBe(true)
  })
})
