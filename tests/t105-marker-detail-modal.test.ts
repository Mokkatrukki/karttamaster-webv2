import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarkerDetailModal } from '../src/ui/marker-detail-modal'
import type { SignMarker } from '../src/logic/types'
import { createLibrary, createTemplate } from '../src/logic/sign-library'

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
      vi.fn(),
    )
    modal.open('test-id')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('.marker-detail-modal')).toBeNull()
  })

  it('järjestäjä näkee type-select + delete', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      vi.fn(),
    )
    modal.open('test-id')
    expect(document.querySelector('.marker-detail-type-select')).not.toBeNull()
    expect(document.querySelector('.modal-btn-destructive')).not.toBeNull() // Poista
  })

  it('järjestäjä näkee Tallenna-nappin footerissa', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      vi.fn(),
    )
    modal.open('test-id')
    const saveBtn = Array.from(document.querySelectorAll('.modal-btn-primary')).find(b => b.textContent === 'Tallenna')
    expect(saveBtn).not.toBeUndefined()
  })

  it('talkoolainen ei näe type-select eikä delete-nappia', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'talkoolainen',
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
      vi.fn(),
    )
    modal.open('test-id')
    const deleteBtn = document.querySelector<HTMLButtonElement>('.modal-btn-destructive')
    deleteBtn!.click()
    expect(manager.remove).toHaveBeenCalledWith('test-id')
    expect(document.querySelector('.marker-detail-modal')).toBeNull()
  })

  // ── T103: kuvaus + kuvat ──────────────────────────────────────────────

  it('T103: järjestäjä näkee muokattavan kuvaus-textarean', () => {
    const marker = makeMarker({ description: 'Kiinnitä puuhun' })
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      vi.fn(),
    )
    modal.open('test-id')
    const textarea = document.querySelector<HTMLTextAreaElement>('.marker-detail-description')
    expect(textarea?.value).toBe('Kiinnitä puuhun')
  })

  it('T103: kuvaus-textarea auto-save blurilla', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const onUpdate = vi.fn()
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'järjestäjä',
      onUpdate,
    )
    modal.open('test-id')
    const textarea = document.querySelector<HTMLTextAreaElement>('.marker-detail-description')!
    textarea.value = 'Uusi kuvaus'
    textarea.dispatchEvent(new Event('blur'))
    expect(manager.updateDescription).toHaveBeenCalledWith('test-id', 'Uusi kuvaus')
    expect(onUpdate).toHaveBeenCalled()
  })

  it('T103: talkoolainen näkee kuvauksen readonly-tekstinä, ei textareaa', () => {
    const marker = makeMarker({ description: 'Kiinnitä puuhun' })
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'talkoolainen',
      vi.fn(),
    )
    modal.open('test-id')
    expect(document.querySelector('.marker-detail-description')).toBeNull()
    expect(document.querySelector('.marker-detail-description-readonly')?.textContent).toBe('Kiinnitä puuhun')
  })

  it('T103: talkoolainen näkee "Ei kuvausta" kun description puuttuu', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(
      manager as any,
      () => null,
      () => 'talkoolainen',
      vi.fn(),
    )
    modal.open('test-id')
    expect(document.querySelector('.marker-detail-description-readonly')?.textContent).toBe('Ei kuvausta')
  })

  it('T103: järjestäjä näkee "Lisää kuva" -napin, talkoolainen ei', () => {
    const marker = makeMarker()
    const jManager = makeMockManager(marker)
    const jModal = new MarkerDetailModal(jManager as any, () => null, () => 'järjestäjä', vi.fn())
    jModal.open('test-id')
    expect(document.querySelector('.marker-detail-add-image-btn')).not.toBeNull()

    document.body.innerHTML = ''
    const tManager = makeMockManager(marker)
    const tModal = new MarkerDetailModal(tManager as any, () => null, () => 'talkoolainen', vi.fn())
    tModal.open('test-id')
    expect(document.querySelector('.marker-detail-add-image-btn')).toBeNull()
  })

  it('T103: renderöi kuva-thumbnailit marker.images-listasta', () => {
    const marker = makeMarker({ images: ['/api/markers/test-id/images/a', '/api/markers/test-id/images/b'] })
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(manager as any, () => null, () => 'järjestäjä', vi.fn())
    modal.open('test-id')
    const thumbs = document.querySelectorAll('.marker-detail-image-thumb')
    expect(thumbs.length).toBe(2)
  })

  it('T103: kuva-onerror näyttää offline-placeholderin lazy-loadin sijaan', () => {
    const marker = makeMarker({ images: ['/api/markers/test-id/images/a'] })
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(manager as any, () => null, () => 'järjestäjä', vi.fn())
    modal.open('test-id')
    const img = document.querySelector<HTMLImageElement>('.marker-detail-image-thumb')!
    img.dispatchEvent(new Event('error'))
    expect(document.querySelector('.marker-detail-image-thumb')).toBeNull()
    expect(document.querySelector('.marker-detail-image-placeholder')?.textContent).toBe('[kuva ei saatavilla]')
  })

  it('T103: tiedoston valinta kutsuu manager.addImage', async () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(manager as any, () => null, () => 'järjestäjä', vi.fn())
    modal.open('test-id')
    const fileInput = document.querySelector<HTMLInputElement>('.marker-detail-image-input')!
    const file = new File(['x'], 'kuva.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fileInput.dispatchEvent(new Event('change'))
    await Promise.resolve()
    expect(manager.addImage).toHaveBeenCalledWith('test-id', file)
  })

  // ── T154: type-select interaktio (siirretty tests/t38-type-change.test.ts:stä — T105 korvasi T38 UI:n, B50) ──

  it('type-select sisältää 4 vaihtoehtoa — yksi per SIGN_TYPES', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(manager as any, () => null, () => 'järjestäjä', vi.fn())
    modal.open('test-id')
    const select = document.querySelector<HTMLSelectElement>('.marker-detail-type-select')!
    expect(select.options.length).toBe(4)
  })

  it('type-select esivalitsee merkin nykyisen tyypin', () => {
    const marker = makeMarker({ type: 'upcoming-left' })
    const manager = makeMockManager(marker)
    const modal = new MarkerDetailModal(manager as any, () => null, () => 'järjestäjä', vi.fn())
    modal.open('test-id')
    const select = document.querySelector<HTMLSelectElement>('.marker-detail-type-select')!
    expect(select.value).toBe('upcoming-left')
  })

  it('valinnan muutos kutsuu manager.updateType uudella tyypillä', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const onUpdate = vi.fn()
    const modal = new MarkerDetailModal(manager as any, () => null, () => 'järjestäjä', onUpdate)
    modal.open('test-id')
    const select = document.querySelector<HTMLSelectElement>('.marker-detail-type-select')!
    select.value = 'left'
    select.dispatchEvent(new Event('change'))
    expect(manager.updateType).toHaveBeenCalledWith('test-id', 'left', undefined, undefined)
    expect(onUpdate).toHaveBeenCalled()
  })

  it('kirjaston templaatin valinta välittää color+label updateType:lle', () => {
    const marker = makeMarker()
    const manager = makeMockManager(marker)
    const library = createLibrary()
    createTemplate(library, { label: 'Vaara', color: '#ff0000', description: '', favorite: true }, 'custom-1')
    const modal = new MarkerDetailModal(manager as any, () => library, () => 'järjestäjä', vi.fn())
    modal.open('test-id')
    const select = document.querySelector<HTMLSelectElement>('.marker-detail-type-select')!
    select.value = 'custom-1'
    select.dispatchEvent(new Event('change'))
    expect(manager.updateType).toHaveBeenCalledWith('test-id', 'custom-1', '#ff0000', 'Vaara')
  })
})
