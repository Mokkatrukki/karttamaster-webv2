import { describe, it, expect, vi, beforeEach } from 'vitest'

// T445/V324 — kartan nimilappu kulkee `segmentDisplayName`in läpi.
// `segment-overlay.ts` oli AINOA näyttöpaikka joka luki `seg.displayName`in suoraan ∴ kartalla
// luki "Pätkä 3" ja sivupaneelissa "Purku Pätkä 3" samasta pätkästä. Kaksi nimeä yhdelle asialle
// on tarkalleen se mitä T445:n yksi-kutsu-sääntö on olemassa estämään.
// V248: jaettu leaflet-mock (isolate:false ⇒ yksi rekisteri, ⊥ omaa tehdasta per tiedosto).
vi.mock('leaflet', async () => ({ default: (await import('./helpers/leaflet-mock')).L }))
import { installLeafletMock } from './helpers/leaflet-mock'

import type { Segment, SegmentStore } from '../src/logic/segments'

const ROUTE = {
  id: '35km',
  color: '#ff0000',
  routePoints: Array.from({ length: 20 }, (_, i) => ({
    lat: 63 + i * 0.001, lon: 27, distanceFromStart: i * 100,
  })),
}

function makeSeg(o: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1', routeIds: ['35km'], primaryRouteId: '35km',
    startDist: 100, endDist: 1500, equipment: [], phase: 'purku',
    displayName: 'Pätkä 3', ...o,
  } as Segment
}

function makeMap(zoom = 14) {
  return { on: vi.fn(), getZoom: vi.fn(() => zoom) } as unknown as import('leaflet').Map
}

async function tooltips(seg: Segment): Promise<string[]> {
  const L = (await import('leaflet')).default
  const { SegmentOverlay } = await import('../src/map/segment-overlay')
  const overlay = new SegmentOverlay(makeMap(), [ROUTE])
  const store: SegmentStore = new Map([[seg.id, seg]])
  overlay.update(store, [])
  return (L.polyline as ReturnType<typeof vi.fn>).mock.results
    .flatMap(r => (r.value.bindTooltip as ReturnType<typeof vi.fn>).mock.calls)
    .map(c => c[0] as string)
}

describe('T445/V324 — kartan pätkälappu käyttää nimiapuria', () => {
  beforeEach(() => {
    installLeafletMock()
    vi.clearAllMocks()
  })

  it('purkupätkän automaattinimi saa vaihe-etuliitteen kartalla', async () => {
    expect(await tooltips(makeSeg({ phase: 'purku', displayName: 'Pätkä 3' })))
      .toContain('Purku Pätkä 3')
  })

  it('tarkastusvaihe saa oman etuliitteensä', async () => {
    expect(await tooltips(makeSeg({ phase: 'tarkastus', displayName: 'Pätkä 7' })))
      .toContain('Tarkastus Pätkä 7')
  })

  it('asettaminen ⊥ saa etuliitettä — oletusvaihe', async () => {
    expect(await tooltips(makeSeg({ phase: 'asettaminen', displayName: 'Pätkä 3' })))
      .toContain('Pätkä 3')
  })

  it('käyttäjän oma nimi voittaa — etuliitettä ⊥ liimata päälle', async () => {
    expect(await tooltips(makeSeg({ phase: 'purku', displayName: 'Kalliolenkki' })))
      .toContain('Kalliolenkki')
  })

  it('lappu antaa saman nimen kuin apuri suoraan kutsuttuna', async () => {
    const { segmentDisplayName } = await import('../src/logic/segment-name')
    const seg = makeSeg({ phase: 'purku', displayName: 'Pätkä 12' })
    expect(await tooltips(seg)).toContain(segmentDisplayName(seg))
  })

  it('valmis-merkki (✓) säilyy vaihe-etuliitteen EDESSÄ — eri kanava, molemmat näkyvät', async () => {
    // Valmis = ei merkkejä avoinna; `completed` on eksplisiittinen kuittaus (T353/V256).
    expect(await tooltips(makeSeg({ phase: 'purku', displayName: 'Pätkä 3', completed: true })))
      .toContain('✓ Purku Pätkä 3')
  })

  it('nimeämätön pätkä ⊥ saa lappua — apurin fallback ⊥ ole tietoa', async () => {
    expect(await tooltips(makeSeg({ displayName: undefined }))).toHaveLength(0)
    expect(await tooltips(makeSeg({ displayName: '   ' }))).toHaveLength(0)
  })
})
