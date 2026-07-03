import { describe, it, expect, vi, afterEach } from 'vitest'
import { MarkerDetailModal } from '../src/ui/marker-detail-modal'
import type { SignMarker } from '../src/logic/types'

afterEach(() => {
  document.body.innerHTML = ''
})

const makeMarker = (overrides: Partial<SignMarker> = {}): SignMarker => ({
  id: 'test-id',
  type: 'right',
  lat: 63.0,
  lon: 27.0,
  distanceFromStart: 1500,
  routeIds: ['35km'],
  status: 'suunniteltu',
  ...overrides,
})

function makeMockManager(marker: SignMarker) {
  return {
    getAll: vi.fn(() => [marker]),
    updateNote: vi.fn(),
    updateStatus: vi.fn(),
    bulkSetStatus: vi.fn((ids: string[], status: SignMarker['status']) => {
      if (ids.includes(marker.id)) marker.status = status
    }),
    updateType: vi.fn(),
    remove: vi.fn(),
    panTo: vi.fn(),
    updateDescription: vi.fn(),
    addImage: vi.fn().mockResolvedValue(undefined),
  }
}

describe('T137 — järjestäjä voi vaihtaa merkin statuksen modaalista (B56/V84)', () => {
  it('näyttää kaikki 5 statusnappia järjestäjälle', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(manager as any, () => null, () => 'järjestäjä', vi.fn())
    modal.open('test-id')

    const row = document.querySelector('.marker-detail-status-row')!
    expect(row.querySelectorAll('button').length).toBe(5)
  })

  it('klikkaus ei-nykyiseen statukseen kutsuu bulkSetStatus:ia (ei validActions-rajausta)', () => {
    const marker = makeMarker({ status: 'suunniteltu' })
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(manager as any, () => null, () => 'järjestäjä', vi.fn())
    modal.open('test-id')

    // "Kerätty" ei ole validActions('suunniteltu')-osajoukossa — silti klikattavissa järjestäjälle
    const row = document.querySelector('.marker-detail-status-row')!
    const btn = Array.from(row.querySelectorAll('button')).find(b => b.textContent === 'Kerätty') as HTMLButtonElement
    expect(btn).toBeDefined()
    btn.click()

    expect(manager.bulkSetStatus).toHaveBeenCalledWith(['test-id'], 'kerätty')
  })

  it('nykyinen status on disabloitu, muut klikattavissa', () => {
    const marker = makeMarker({ status: 'asetettu' })
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(manager as any, () => null, () => 'järjestäjä', vi.fn())
    modal.open('test-id')

    const row = document.querySelector('.marker-detail-status-row')!
    const current = Array.from(row.querySelectorAll('button')).find(b => b.textContent === 'Asetettu') as HTMLButtonElement
    expect(current.disabled).toBe(true)
  })

  it('talkoolainen ei näe .marker-detail-status-row -riviä (oma validActions-footer säilyy)', () => {
    const marker = makeMarker({ status: 'suunniteltu' })
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(manager as any, () => null, () => 'talkoolainen', vi.fn())
    modal.open('test-id')

    expect(document.querySelector('.marker-detail-status-row')).toBeNull()
  })
})
