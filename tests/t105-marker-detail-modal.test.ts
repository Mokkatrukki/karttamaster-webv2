import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarkerDetailModal } from '../src/ui/marker-detail-modal'
import type { SignMarker } from '../src/logic/types'

const makeMarker = (overrides: Partial<SignMarker> = {}): SignMarker => ({
  id: 'test-id',
  type: 'right',
  lat: 63.0,
  lon: 27.0,
  bearing: 0,
  distanceFromStart: 1500,
  routeIds: ['35km'],
  status: 'suunniteltu',
  ...overrides,
})

const makeMockManager = (marker: SignMarker) => ({
  getAll: vi.fn(() => [marker]),
  updateNote: vi.fn(),
  updateStatus: vi.fn(),
  updateType: vi.fn(),
  remove: vi.fn(),
  panTo: vi.fn(),
})

describe('MarkerDetailModal', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('avautuu oikealla merkillä (otsikko + km)', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      () => null,
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    const title = document.querySelector('.marker-detail-title')
    expect(title?.textContent).toContain('1.50 km')
  })

  it('näyttää status-badgen', () => {
    const marker = makeMarker({ status: 'asetettu' })
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      () => null,
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    const badge = document.querySelector('.marker-status--asetettu')
    expect(badge).not.toBeNull()
  })

  it('locationNote textarea auto-save blurilla', () => {
    const marker = makeMarker({ locationNote: 'kiinnitä puuhun' })
    const manager = makeMockManager(marker)
    const onUpdate = vi.fn()
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      () => null,
      vi.fn(),
      onUpdate,
    )
    modal.open('test-id')
    const textarea = document.querySelector<HTMLTextAreaElement>('.marker-detail-note')
    expect(textarea?.value).toBe('kiinnitä puuhun')

    textarea!.value = 'kiinnitä puuhun, vasemmalle'
    textarea!.dispatchEvent(new Event('blur'))
    expect(manager.updateNote).toHaveBeenCalledWith('test-id', 'kiinnitä puuhun, vasemmalle')
    expect(onUpdate).toHaveBeenCalled()
  })

  it('sulkeutuu ✕-napista', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      () => null,
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    expect(document.querySelector('.marker-detail-modal')).not.toBeNull()

    const closeBtn = document.querySelector<HTMLButtonElement>('.marker-detail-close')
    closeBtn!.click()
    expect(document.querySelector('.marker-detail-modal')).toBeNull()
  })

  it('sulkeutuu backdrop-klikistä', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      () => null,
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    const backdrop = document.querySelector<HTMLElement>('.marker-detail-backdrop')
    backdrop!.click()
    expect(document.querySelector('.marker-detail-modal')).toBeNull()
  })

  it('sulkeutuu Esc-näppäimestä', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      () => null,
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('.marker-detail-modal')).toBeNull()
  })

  it('järjestäjä näkee type-select + rotate + delete', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      () => null,
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    expect(document.querySelector('.marker-detail-type-select')).not.toBeNull()
    expect(document.querySelector('.modal-btn-secondary')).not.toBeNull() // ↻ Käännä
    expect(document.querySelector('.modal-btn-destructive')).not.toBeNull() // Poista
  })

  it('järjestäjä näkee Tallenna-nappin footerissa', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      () => null,
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    expect(document.querySelector('.modal-btn-primary')).not.toBeNull()
    expect(document.querySelector('.modal-btn-primary')?.textContent).toBe('Tallenna')
  })

  it('talkoolainen ei näe type-select eikä delete-nappia', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'talkoolainen',
      () => 'abc123',
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    expect(document.querySelector('.marker-detail-type-select')).toBeNull()
    expect(document.querySelector('.modal-btn-destructive')).toBeNull()
  })

  it('talkoolainen näkee status-napit footerissa', () => {
    const marker = makeMarker({ status: 'suunniteltu' })
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'talkoolainen',
      () => 'abc123',
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    const btns = document.querySelectorAll('.modal-btn-primary')
    expect(btns.length).toBeGreaterThan(0)
  })

  it('B31: talkoolainen ilman koodia näkee silti status-napit (V59)', () => {
    const marker = makeMarker({ status: 'suunniteltu' })
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'talkoolainen',
      () => null, // ei koodia
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    const btns = document.querySelectorAll('.modal-btn-primary')
    expect(btns.length).toBeGreaterThan(0)
  })

  it('delete vaatii confirm (V58) — confirm false = ei poisteta', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      () => null,
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    const deleteBtn = document.querySelector<HTMLButtonElement>('.modal-btn-destructive')
    deleteBtn!.click()
    expect(manager.remove).not.toHaveBeenCalled()
    expect(document.querySelector('.marker-detail-modal')).not.toBeNull()
  })

  it('delete vaatii confirm (V58) — confirm true = poistetaan ja suljetaan', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      () => null,
      vi.fn(),
      vi.fn(),
    )
    modal.open('test-id')
    const deleteBtn = document.querySelector<HTMLButtonElement>('.modal-btn-destructive')
    deleteBtn!.click()
    expect(manager.remove).toHaveBeenCalledWith('test-id')
    expect(document.querySelector('.marker-detail-modal')).toBeNull()
  })

  it('rotate-nappi kutsuu onArmRequest + sulkee modaalin', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const onArmRequest = vi.fn()
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      () => null,
      onArmRequest,
      vi.fn(),
    )
    modal.open('test-id')
    const rotateBtn = document.querySelector<HTMLButtonElement>('.modal-btn-secondary')
    rotateBtn!.click()
    expect(onArmRequest).toHaveBeenCalledWith('test-id')
    expect(document.querySelector('.marker-detail-modal')).toBeNull()
  })
})
