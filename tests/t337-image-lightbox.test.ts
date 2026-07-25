import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarkerDetailModal } from '../src/ui/marker-detail-modal'
import { openImageLightbox, openLightbox } from '../src/ui/image-lightbox'
import { buildMarkerVisual } from '../src/ui/marker-visual-row'
import type { SignMarker } from '../src/logic/types'

// T337/V246 (fix B132): kentällä otettu valokuva ! olla katsottavissa täysikokoisena.
// Thumb (72px, object-fit:cover) RAJAA ∴ se on kahva, ei kuvan esitys.

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

function openModalWithImages(images: string[], role = 'järjestäjä') {
  const marker = makeMarker({ images, label: 'Varo oikealta' })
  const manager = makeMockManager(marker)
  const modal = new MarkerDetailModal(manager as any, () => null, () => role as any, vi.fn())
  modal.open('test-id')
  return modal
}

describe('T337/V246 — valokuva auki täysikokoisena (B132)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('thumb-klikki avaa lightboxin oikealla src:llä', () => {
    openModalWithImages(['/api/markers/test-id/images/img-1'])
    const thumb = document.querySelector('.marker-detail-image-thumb') as HTMLImageElement
    expect(thumb).not.toBeNull()
    expect(document.querySelector('.marker-visual-lightbox')).toBeNull()

    thumb.click()

    const photo = document.querySelector('.image-lightbox-photo') as HTMLImageElement
    expect(photo).not.toBeNull()
    expect(photo.getAttribute('src')).toBe('/api/markers/test-id/images/img-1')
    // Ydinväite: isossa EI rajata — juuri se rajaus hävittää sen mitä kentällä kuvattiin.
    expect(photo.style.objectFit).toBe('contain')
  })

  it('thumb on saavutettava: role/tabindex/aria-label + Enter avaa', () => {
    openModalWithImages(['/api/markers/test-id/images/img-1'])
    const thumb = document.querySelector('.marker-detail-image-thumb') as HTMLImageElement
    expect(thumb.getAttribute('role')).toBe('button')
    expect(thumb.tabIndex).toBe(0)
    expect(thumb.getAttribute('aria-label')).toBe('Avaa kuva 1')

    thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(document.querySelector('.image-lightbox-photo')).not.toBeNull()
  })

  it('useampi kuva → jokainen thumb avaa OMAN kuvansa', () => {
    openModalWithImages(['/img/a', '/img/b'])
    const thumbs = document.querySelectorAll('.marker-detail-image-thumb')
    expect(thumbs).toHaveLength(2)
    ;(thumbs[1] as HTMLImageElement).click()
    expect((document.querySelector('.image-lightbox-photo') as HTMLImageElement).getAttribute('src')).toBe('/img/b')
  })

  it('Esc sulkee', () => {
    openImageLightbox('/img/a', 'Kuvateksti')
    expect(document.querySelector('.marker-visual-lightbox')).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.querySelector('.marker-visual-lightbox')).toBeNull()
  })

  it('backdrop-klikki sulkee, sisältöklikki EI', () => {
    openImageLightbox('/img/a')
    const backdrop = document.querySelector('.marker-visual-lightbox-backdrop') as HTMLElement
    const box = document.querySelector('.marker-visual-lightbox') as HTMLElement

    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(document.querySelector('.marker-visual-lightbox')).not.toBeNull()

    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(document.querySelector('.marker-visual-lightbox')).toBeNull()
  })

  it('✕ sulkee', () => {
    openImageLightbox('/img/a')
    ;(document.querySelector('.marker-visual-lightbox-close') as HTMLButtonElement).click()
    expect(document.querySelector('.marker-visual-lightbox')).toBeNull()
  })

  it('caption renderöityy vain kun annettu', () => {
    const close = openImageLightbox('/img/a')
    expect(document.querySelector('.marker-visual-lightbox-caption')).toBeNull()
    close()

    openImageLightbox('/img/a', 'Varo oikealta')
    expect(document.querySelector('.marker-visual-lightbox-caption')?.textContent).toBe('Varo oikealta')
  })

  it('regressio: kylttivisuaalin lightbox toimii ennallaan jaetun kuoren päällä', () => {
    const wrap = buildMarkerVisual({ type: 'right', label: 'Varo oikealta' }, { size: 44, zoomable: true })
    document.body.appendChild(wrap)
    ;(wrap.querySelector('.marker-visual-row-zoom') as HTMLButtonElement).click()

    expect(document.querySelector('.marker-visual-lightbox-stage')).not.toBeNull()
    expect(document.querySelector('.marker-visual-lightbox-caption')?.textContent).toBe('Varo oikealta')
    // Kylttivisuaali ⊥ ole valokuva → ei photo-elementtiä, mutta sama sulkemiskäytös.
    expect(document.querySelector('.image-lightbox-photo')).toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.querySelector('.marker-visual-lightbox')).toBeNull()
  })

  it('openLightbox palauttaa close-funktion joka poistaa backdropin', () => {
    const stage = document.createElement('div')
    const close = openLightbox({ stage })
    expect(document.querySelector('.marker-visual-lightbox-backdrop')).not.toBeNull()
    close()
    expect(document.querySelector('.marker-visual-lightbox-backdrop')).toBeNull()
  })
})
