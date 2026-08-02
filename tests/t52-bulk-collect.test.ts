// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { bulkCollect } from '../src/logic/segment-actions'
import { SegmentView } from '../src/ui/segment-view'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    routeIds: ['35km'],
    startDist: 5000,
    endDist: 12000,
    equipment: [],
    phase: 'purku',
    displayName: 'Purku-pätkä 1',
    ...overrides,
  }
}

function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm-1',
    type: 'right',
    lat: 63.0,
    lon: 27.0,
    distanceFromStart: 7000,
    routeIds: ['35km'],
    status: 'suunniteltu',
    ...overrides,
  }
}

// ── Taso 1: Vitest-pure ──────────────────────────────────────────────────────

describe('T52 — bulkCollect (logiikka, V28)', () => {
  it('palauttaa kaikki ei-terminal-merkit statuksella kerätty', () => {
    const seg = makeSeg()
    const markers = [
      makeMarker({ id: 'm-1', status: 'suunniteltu' }),
      makeMarker({ id: 'm-2', status: 'asetettu' }),
      makeMarker({ id: 'm-3', status: 'tarkistettu' }),
    ]
    const updated = bulkCollect(seg, markers)
    expect(updated.length).toBe(3)
    expect(updated.every(m => m.status === 'kerätty')).toBe(true)
  })

  it('vain kerätty on terminal — ei_tarpeen sisällytetään (V28)', () => {
    const seg = makeSeg()
    const markers = [
      makeMarker({ id: 'm-1', status: 'kerätty' }),   // terminal → skip
      makeMarker({ id: 'm-2', status: 'ei_tarpeen' }), // not terminal → include
      makeMarker({ id: 'm-3', status: 'suunniteltu' }), // not terminal → include
    ]
    const updated = bulkCollect(seg, markers)
    expect(updated.length).toBe(2)
    expect(updated.every(m => m.status === 'kerätty')).toBe(true)
    expect(updated.map(m => m.id)).not.toContain('m-1')
  })

  it('palauttaa tyhjä lista jos kaikki terminal (vain kerätty)', () => {
    const seg = makeSeg()
    const markers = [
      makeMarker({ id: 'm-1', status: 'kerätty' }),
      makeMarker({ id: 'm-2', status: 'kerätty' }),
    ]
    const updated = bulkCollect(seg, markers)
    expect(updated.length).toBe(0)
  })

  it('palauttaa tyhjä lista jos ei merkkejä', () => {
    const updated = bulkCollect(makeSeg(), [])
    expect(updated.length).toBe(0)
  })

  it('ei muuta alkuperäisiä merkkejä (immutability)', () => {
    const seg = makeSeg()
    const m = makeMarker({ status: 'suunniteltu' })
    bulkCollect(seg, [m])
    expect(m.status).toBe('suunniteltu')
  })
})

// ── Taso 2: Vitest-jsdom ─────────────────────────────────────────────────────
//
// T471/V358: PANEELIN JOUKKONAPPI ON POISTETTU. Tässä oli viisi testiä jotka koodasivat sen
// lupauksen (piilossa asetuksessa, näkyvissä purussa, klikki → `onBulkCollect`) — ne olivat
// oikeassa siihen asti kun kysymys oli "toimiiko nappi". Kysymys on nyt "onko nappia", & vastaus
// on invariantti ⊥ kertaluontoinen poisto: paneeli on kartan päällä ∴ täysleveä rivi joka näkyy
// koko purkutyön ajan maksaa juuri sitä tilaa jota talkoolainen tarvitsee eniten.
//
// Kyky ⊥ kadonnut vaan palasi kotiinsa: `SegmentMarkerList`in "Valitse kaikki" + `bulkLabel`
// (T409/T468) tekee saman kahdella napautuksella pinnalla joka NÄYTTÄÄ mitä kuitataan —
// paneelinappi kuittasi 12 merkkiä näyttämättä yhtäkään. Alla molemmat puolet: ⊥ nappia
// paneelissa, & korvaava reitti on olemassa.

describe('T471/V358 — joukkokuittaus asuu listassa, ⊥ navigaatiopaneelissa', () => {
  let container: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('paneelissa ⊥ ole joukkonappia purkuvaiheessa (V358)', () => {
    const view = new SegmentView(container, makeSeg({ phase: 'purku' }))
    view.update([makeMarker({ status: 'suunniteltu' }), makeMarker({ id: 'm-9', status: 'asetettu' })])
    expect(container.querySelector('.btn-bulk-collect')).toBeNull()
  })

  it('⊥ myöskään asetusvaiheessa — sääntö ⊥ ole vaihekohtainen', () => {
    const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
    view.update([makeMarker({ status: 'suunniteltu' })])
    expect(container.querySelector('.btn-bulk-collect')).toBeNull()
  })

  it('korvaava reitti: listan "Valitse kaikki" + kuittausnappi vie merkit kerätyksi', () => {
    const onBulkStatus = vi.fn()
    const view = new SegmentView(container, makeSeg({ phase: 'purku' }), undefined, { onBulkStatus })
    view.update([
      makeMarker({ id: 'm-1', status: 'asetettu' }),
      makeMarker({ id: 'm-2', status: 'tarkistettu' }),
    ])

    const all = container.querySelector('.bulk-select-all') as HTMLInputElement
    all.checked = true
    all.dispatchEvent(new Event('change'))
    const bulk = container.querySelector('.btn-bulk-checkin-aseta') as HTMLButtonElement
    expect(bulk.textContent).toContain('(2)')
    bulk.click()

    expect(onBulkStatus).toHaveBeenCalledOnce()
    const [ids, status] = onBulkStatus.mock.calls[0]
    expect((ids as string[]).sort()).toEqual(['m-1', 'm-2'])
    expect(status).toBe('kerätty')
  })
})
