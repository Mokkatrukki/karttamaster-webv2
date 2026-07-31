// T437/V323 (B176): peruutus näkyy siellä missä merkki on JO päätetilassa — merkin modaalissa,
// ⊥ herossa (hero näyttää avoimia; purussa siellä on tasan kaksi toimintoa, V319).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarkerDetailModal } from '../src/ui/marker-detail-modal'
import { SegmentView } from '../src/ui/segment-view'
import type { SignMarker } from '../src/logic/types'
import type { Segment } from '../src/logic/segments'

const makeMarker = (overrides: Partial<SignMarker> = {}): SignMarker => ({
  id: 'test-id',
  type: 'right',
  lat: 63.0,
  lon: 27.0,
  distanceFromStart: 1500,
  routeIds: ['35km'],
  status: 'kerätty',
  ...overrides,
})

const makeMockManager = (marker: SignMarker) => ({
  getAll: vi.fn(() => [marker]),
  updateNote: vi.fn(),
  updateStatus: vi.fn(),
  bulkSetStatus: vi.fn(),
  updateType: vi.fn(),
  remove: vi.fn(),
  panTo: vi.fn(),
  updateDescription: vi.fn(),
  addImage: vi.fn().mockResolvedValue(undefined),
})

function openTalkoo(marker: SignMarker, task: Partial<Segment> | null) {
  const manager = makeMockManager(marker)
  const modal = new MarkerDetailModal(
    manager as any,
    () => null,
    () => 'talkoolainen',
    vi.fn(),
    () => 'P1',
    () => task as Segment | null,
  )
  modal.open(marker.id)
  return { manager, modal }
}

describe('T437/V323 — peruutus merkin modaalissa', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('purussa kerätty merkki tarjoaa "Palauta keräämättömäksi" → asetettu', () => {
    const marker = makeMarker({ status: 'kerätty' })
    const { manager } = openTalkoo(marker, { phase: 'purku' })
    const btn = document.querySelector('.marker-detail-revert') as HTMLButtonElement
    expect(btn).not.toBeNull()
    expect(btn.textContent).toContain('Palauta keräämättömäksi')
    btn.click()
    expect(manager.bulkSetStatus).toHaveBeenCalledWith(['test-id'], 'asetettu')
  })

  it('asetusvaiheessa asetettu merkki palautuu suunnitelluksi', () => {
    const marker = makeMarker({ status: 'asetettu' })
    const { manager } = openTalkoo(marker, { phase: 'asettaminen' })
    const btn = document.querySelector('.marker-detail-revert') as HTMLButtonElement
    expect(btn.textContent).toContain('Palauta asettamattomaksi')
    btn.click()
    expect(manager.bulkSetStatus).toHaveBeenCalledWith(['test-id'], 'suunniteltu')
  })

  it('purussa "ei löytynyt" palautuu asetetuksi — ⊥ suunnitelluksi', () => {
    const marker = makeMarker({ status: 'ei_tarpeen' })
    const { manager } = openTalkoo(marker, { phase: 'purku' })
    ;(document.querySelector('.marker-detail-revert') as HTMLButtonElement).click()
    expect(manager.bulkSetStatus).toHaveBeenCalledWith(['test-id'], 'asetettu')
  })

  it('geneerinen "Peru" ⊥ jää rinnalle — yksi paluu, yksi kohde', () => {
    const marker = makeMarker({ status: 'ei_tarpeen' })
    openTalkoo(marker, { phase: 'purku' })
    const labels = [...document.querySelectorAll('.modal-footer-actions button')].map(b => b.textContent)
    expect(labels.filter(l => l === 'Peru')).toEqual([])
  })

  it('avoin merkki ⊥ saa peruutusta (⊥ ole mitä perua)', () => {
    const marker = makeMarker({ status: 'asetettu' })
    openTalkoo(marker, { phase: 'purku' })
    expect(document.querySelector('.marker-detail-revert')).toBeNull()
  })

  it('tehtävätön konteksti putoaa asettaminen-oletukseen (⊥ kaadu)', () => {
    const marker = makeMarker({ status: 'kerätty' })
    const { manager } = openTalkoo(marker, null)
    ;(document.querySelector('.marker-detail-revert') as HTMLButtonElement).click()
    expect(manager.bulkSetStatus).toHaveBeenCalledWith(['test-id'], 'suunniteltu')
  })
})

describe('T437(b)/V319 — peruutus ⊥ mene heroon', () => {
  let container: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('purku-hero pysyy kahdessa toiminnossa: ⊥ peruutusnappia', () => {
    const seg = {
      id: 'seg-1', routeIds: ['35km'], startDist: 0, endDist: 12000,
      equipment: [], phase: 'purku', displayName: 'Matin pätkä',
    } as unknown as Segment
    const view = new SegmentView(container, seg)
    view.update([
      makeMarker({ id: 'a', status: 'kerätty', distanceFromStart: 3000 }),
      makeMarker({ id: 'b', status: 'asetettu', distanceFromStart: 5000 }),
    ])
    expect(container.querySelector('.marker-detail-revert')).toBeNull()
    const menuItems = [...container.querySelectorAll('.segment-view-next-menu-item')]
    expect(menuItems.some(b => (b.textContent ?? '').includes('Palauta'))).toBe(false)
  })
})
