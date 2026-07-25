// T320: lokin logiikkakerros (Taso 1 Vitest-pure). Regressiofixtuurit ovat 2026-07-25
// tuotantoincidentin TODELLISIA arvoja — jos poikkeaman laskenta rikkoutuu, se rikkoutuu
// juuri sen tapauksen kohdalla jota varten koko näkymä rakennettiin.
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ACTION_VERB,
  describeAuditEntry,
  formatTime,
  moveDeviationM,
  filterEntries,
  distinctActors,
  distinctSegments,
  groupByMarker,
} from '../src/logic/audit-log'
import { fetchAuditLog, undoAuditEntry } from '../src/logic/audit-sync'
import type { AuditEntry } from '../src/logic/audit-sync'

function entry(over: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'a1',
    marker_id: 'm1',
    action: 'move',
    actor: 'Talkoolainen',
    actor_role: 'talkoolainen',
    segment_code: 'SEG-A',
    created_at: '2026-07-25T07:39:33.000Z',
    payload: { lat: 65.57585, lon: 27.65917 },
    ...over,
  }
}

describe('describeAuditEntry', () => {
  it('kuvaa rivin verbillä, tekijällä, ajalla ja pätkällä', () => {
    const d = describeAuditEntry(entry())
    expect(d.verb).toBe(ACTION_VERB.move)
    expect(d.actorLabel).toBe('Talkoolainen')
    expect(d.timeLabel).toBe('25.7. 07:39')
    expect(d.segmentLabel).toBe('SEG-A')
  })

  it('B124-legacy: pätkätön rivi näytetään rehellisesti, ei arvata', () => {
    expect(describeAuditEntry(entry({ segment_code: null })).segmentLabel).toBe('pätkä tuntematon')
  })

  it('nimetön tekijä ei jätä tyhjää solua', () => {
    expect(describeAuditEntry(entry({ actor: null })).actorLabel).toBe('tuntematon')
    expect(describeAuditEntry(entry({ actor: '   ' })).actorLabel).toBe('tuntematon')
  })

  it('tuntematon action ei kaada — näytetään raakana', () => {
    const d = describeAuditEntry(entry({ action: 'jokumuu' as AuditEntry['action'] }))
    expect(d.verb).toBe('jokumuu')
  })
})

describe('formatTime', () => {
  it('ISO → päivä + kello', () => {
    expect(formatTime('2026-07-25T07:30:44.657Z')).toBe('25.7. 07:30')
  })
  it('roskasyöte palautuu sellaisenaan, ei heitä', () => {
    expect(formatTime('ei-aikaleima')).toBe('ei-aikaleima')
  })
})

describe('moveDeviationM — 2026-07-25 regressiofixtuurit', () => {
  it('laskee 7 km siirron (merkki fa79e70e)', () => {
    const d = moveDeviationM(
      entry({ payload: { lat: 65.57585, lon: 27.65917 } }),
      { lat: 65.58250, lon: 27.81166 },
    )
    expect(d).toBeGreaterThan(7000)
    expect(d).toBeLessThan(7100)
  })

  it('laskee 1272 m siirron (merkki 1fb91f20)', () => {
    const d = moveDeviationM(
      entry({ payload: { lat: 65.59542, lon: 27.56850 } }),
      { lat: 65.58988, lon: 27.59271 },
    )
    expect(d).toBeGreaterThan(1250)
    expect(d).toBeLessThan(1300)
  })

  it('ei-move-rivi → null', () => {
    expect(moveDeviationM(entry({ action: 'status', payload: { status: 'asetettu' } }), { lat: 65.1, lon: 27.5 })).toBeNull()
  })

  it('merkki poistettu → null, ei 0 m (0 valehtelisi "ei liikkunut")', () => {
    expect(moveDeviationM(entry(), undefined)).toBeNull()
  })

  it('vajaa payload → null, ei kaadu', () => {
    expect(moveDeviationM(entry({ payload: null }), { lat: 65.1, lon: 27.5 })).toBeNull()
    expect(moveDeviationM(entry({ payload: { lat: 65.1 } }), { lat: 65.1, lon: 27.5 })).toBeNull()
    expect(moveDeviationM(entry({ payload: 'roska' }), { lat: 65.1, lon: 27.5 })).toBeNull()
  })
})

describe('filterEntries', () => {
  const rows = [
    entry({ id: '1', actor: 'Liisa', actor_role: 'talkoolainen', segment_code: 'SEG-A', created_at: '2026-07-25T07:00:00.000Z' }),
    entry({ id: '2', actor: 'Kalle', actor_role: 'talkoolainen', segment_code: 'SEG-B', created_at: '2026-07-25T09:00:00.000Z' }),
    entry({ id: '3', actor: 'krossikommuuni', actor_role: 'järjestäjä', segment_code: 'SEG-A', created_at: '2026-07-24T12:00:00.000Z' }),
  ]

  it('tyhjä suodatin palauttaa kaiken', () => {
    expect(filterEntries(rows, {}).length).toBe(3)
  })
  it('rooli', () => {
    expect(filterEntries(rows, { role: 'järjestäjä' }).map(r => r.id)).toEqual(['3'])
  })
  it('tekijä', () => {
    expect(filterEntries(rows, { actor: 'Liisa' }).map(r => r.id)).toEqual(['1'])
  })
  it('pätkä', () => {
    expect(filterEntries(rows, { segmentCode: 'SEG-A' }).map(r => r.id)).toEqual(['1', '3'])
  })
  it('aikaväli', () => {
    expect(filterEntries(rows, { since: '2026-07-25T00:00:00.000Z' }).map(r => r.id)).toEqual(['1', '2'])
    expect(filterEntries(rows, { since: '2026-07-25T08:00:00.000Z', until: '2026-07-25T10:00:00.000Z' }).map(r => r.id)).toEqual(['2'])
  })
  it('suodattimet yhdistyvät JA-logiikalla', () => {
    expect(filterEntries(rows, { role: 'talkoolainen', segmentCode: 'SEG-A' }).map(r => r.id)).toEqual(['1'])
  })
})

describe('valikkojen sisältö luetaan datasta', () => {
  const rows = [
    entry({ actor: 'Liisa', segment_code: 'SEG-B' }),
    entry({ actor: 'Kalle', segment_code: 'SEG-A' }),
    entry({ actor: 'Liisa', segment_code: null }),
  ]
  it('tekijät uniikkeina ja aakkosjärjestyksessä', () => {
    expect(distinctActors(rows)).toEqual(['Kalle', 'Liisa'])
  })
  it('pätkät uniikkeina, NULL karsiutuu', () => {
    expect(distinctSegments(rows)).toEqual(['SEG-A', 'SEG-B'])
  })
})

describe('groupByMarker', () => {
  it('kokoaa saman merkin ketjun vanhin ensin', () => {
    const chains = groupByMarker([
      entry({ id: '2', marker_id: 'm1', created_at: '2026-07-25T07:45:00.000Z' }),
      entry({ id: '1', marker_id: 'm1', created_at: '2026-07-25T07:30:00.000Z' }),
      entry({ id: '3', marker_id: 'm2', created_at: '2026-07-25T07:32:00.000Z' }),
    ])
    expect(chains.length).toBe(2)
    const m1 = chains.find(c => c.markerId === 'm1')!
    expect(m1.entries.map(e => e.id)).toEqual(['1', '2'])
  })
  it('tyhjä syöte → tyhjä tulos', () => {
    expect(groupByMarker([])).toEqual([])
  })
})

describe('audit-sync (fetch-mock)', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('fetchAuditLog rakentaa suodatinparametrit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [entry()] })
    vi.stubGlobal('fetch', fetchMock)
    const rows = await fetchAuditLog({ actorRole: 'talkoolainen', since: '2026-07-25', limit: 50 })
    expect(rows?.length).toBe(1)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('actor_role=talkoolainen')
    expect(url).toContain('since=2026-07-25')
    expect(url).toContain('limit=50')
  })

  it('fetchAuditLog: ei-array-vastaus → null, ei kaada renderiä', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'x' }) }))
    expect(await fetchAuditLog()).toBeNull()
  })

  it('undoAuditEntry erittelee virheet statuksen mukaan', async () => {
    const cases: Array<[number, string]> = [[409, 'already_undone'], [404, 'not_found'], [403, 'forbidden'], [400, 'not_undoable'], [500, 'network']]
    for (const [status, expected] of cases) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }))
      const res = await undoAuditEntry('a1')
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toBe(expected)
    }
  })

  it('undoAuditEntry onnistuu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    expect((await undoAuditEntry('a1')).ok).toBe(true)
  })

  it('verkkovirhe → network, ei heitä', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const res = await undoAuditEntry('a1')
    expect(res.ok).toBe(false)
  })
})
