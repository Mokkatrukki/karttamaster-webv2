import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignLibrary, SignLibraryPanel } from '../src/ui/sign-library-panel'
import { createTemplate, listTemplates } from '../src/logic/sign-library'
import { signImageIds } from '../src/logic/sign-images'

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('T176 — ImageGalleryPicker: kuva-galleria + zoom-lightbox (V99)', () => {
  describe('tabit + grid', () => {
    it('modaalissa on Ikoni/Kuva-tabit', () => {
      const container = setup()
      new SignLibraryPanel(container, createSignLibrary(), vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      const tabs = document.body.querySelectorAll('.sign-visual-tab')
      expect(tabs.length).toBe(2)
      expect(Array.from(tabs).map(t => t.textContent)).toEqual(['Ikoni', 'Kuva'])
    })

    it('Kuva-tabin gridissä on "ei kuvaa" + kaikki signImageIds()-kuvat', () => {
      const container = setup()
      new SignLibraryPanel(container, createSignLibrary(), vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      const thumbs = document.body.querySelectorAll('.sign-image-thumb')
      expect(thumbs.length).toBe(signImageIds().length + 1)
    })

    it('oletuksena Ikoni-tabi aktiivinen, kuva-grid piilossa', () => {
      const container = setup()
      new SignLibraryPanel(container, createSignLibrary(), vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      const iconGrid = document.body.querySelector<HTMLElement>('.sign-lib-icon-grid')!
      const imageGrid = document.body.querySelector<HTMLElement>('.sign-image-gallery')!
      expect(iconGrid.style.display).not.toBe('none')
      expect(imageGrid.style.display).toBe('none')
    })

    it('templaten imageId asetettuna → Kuva-tabi aktiivinen avattaessa', () => {
      const container = setup()
      const lib = createSignLibrary()
      const imgId = signImageIds()[0]
      const t = createTemplate(lib, { label: 'Kuvamalli', color: '#000', description: '', favorite: false, imageId: imgId }, 'kuvamalli-1')
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>(`.sign-lib-dots-btn[data-id="${t.id}"]`)!.click()
      const imageGrid = document.body.querySelector<HTMLElement>('.sign-image-gallery')!
      expect(imageGrid.style.display).toBe('grid')
    })

    it('tabin klikkaus vaihtaa näkyvän gridin', () => {
      const container = setup()
      new SignLibraryPanel(container, createSignLibrary(), vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      const tabs = document.body.querySelectorAll<HTMLButtonElement>('.sign-visual-tab')
      tabs[1].click() // "Kuva"
      const iconGrid = document.body.querySelector<HTMLElement>('.sign-lib-icon-grid')!
      const imageGrid = document.body.querySelector<HTMLElement>('.sign-image-gallery')!
      expect(imageGrid.style.display).toBe('grid')
      expect(iconGrid.style.display).toBe('none')
    })
  })

  describe('valinta + tallennus', () => {
    it('kuvan valinta tallentuu imageId:nä ja tyhjentää iconId:n', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-visual-tab')[1].click()
      const firstRealThumb = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.sign-image-thumb'))
        .find(b => b.dataset.imageId !== '')!
      firstRealThumb.click()
      document.body.querySelector<HTMLInputElement>('.sign-lib-id-input')!.value = 'image-pick-1'
      document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'Kuvavalinta'
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const t = listTemplates(lib).find(t => t.label === 'Kuvavalinta')!
      expect(t.imageId).toBe(firstRealThumb.dataset.imageId)
      expect(t.iconId).toBeUndefined()
    })

    it('ikonin valinta kuvan jälkeen tyhjentää imageId:n (V99: yksi ulkoasu-lähde kerrallaan)', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-visual-tab')[1].click()
      const firstRealThumb = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.sign-image-thumb'))
        .find(b => b.dataset.imageId !== '')!
      firstRealThumb.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-visual-tab')[0].click()
      const firstRealIcon = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.sign-lib-icon-btn'))
        .find(b => b.dataset.iconId !== '')!
      firstRealIcon.click()
      document.body.querySelector<HTMLInputElement>('.sign-lib-id-input')!.value = 'icon-after-image'
      document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'Vaihto'
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const t = listTemplates(lib).find(t => t.label === 'Vaihto')!
      expect(t.iconId).toBe(firstRealIcon.dataset.iconId)
      expect(t.imageId).toBeUndefined()
    })

    it('muokkaus säilyttää aiemman imageId:n jos ei muuteta', () => {
      const container = setup()
      const lib = createSignLibrary()
      const imgId = signImageIds()[0]
      const t = createTemplate(lib, { label: 'Vanha', color: '#000', description: '', favorite: false, imageId: imgId }, 'vanha-kuva')
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>(`.sign-lib-dots-btn[data-id="${t.id}"]`)!.click()
      document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'Uusi nimi'
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(lib.get(t.id)?.imageId).toBe(imgId)
    })

    it('"ei kuvaa" -valinta tyhjentää imageId:n', () => {
      const container = setup()
      const lib = createSignLibrary()
      const imgId = signImageIds()[0]
      const t = createTemplate(lib, { label: 'X', color: '#000', description: '', favorite: false, imageId: imgId }, 'x-kuva')
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>(`.sign-lib-dots-btn[data-id="${t.id}"]`)!.click()
      document.body.querySelector<HTMLButtonElement>('.sign-image-thumb[data-image-id=""]')!.click()
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(lib.get(t.id)?.imageId).toBeUndefined()
    })
  })

  describe('zoom-lightbox', () => {
    it('zoom-napin klikkaus avaa lightboxin eikä valitse kuvaa', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-visual-tab')[1].click()
      const zoomBtn = document.body.querySelector<HTMLElement>('.sign-image-zoom-btn')!
      zoomBtn.click()
      expect(document.body.querySelector('.sign-image-lightbox')).toBeTruthy()
      // Ei vielä valintaa — modaalin gridissä ei pitäisi näkyä valintaa vain zoomista
      const selectedBadges = document.body.querySelectorAll('.sign-image-selected-badge')
      expect(selectedBadges.length).toBe(0)
    })

    it('✕-nappi sulkee lightboxin', () => {
      const container = setup()
      new SignLibraryPanel(container, createSignLibrary(), vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-visual-tab')[1].click()
      document.body.querySelector<HTMLElement>('.sign-image-zoom-btn')!.click()
      document.body.querySelector<HTMLButtonElement>('.sign-image-lightbox-close')!.click()
      expect(document.body.querySelector('.sign-image-lightbox')).toBeNull()
    })

    it('Esc sulkee lightboxin mutta ei edit-modaalia', () => {
      const container = setup()
      new SignLibraryPanel(container, createSignLibrary(), vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-visual-tab')[1].click()
      document.body.querySelector<HTMLElement>('.sign-image-zoom-btn')!.click()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(document.body.querySelector('.sign-image-lightbox')).toBeNull()
      expect(document.body.querySelector('.sign-lib-modal')).toBeTruthy()
    })

    it('backdrop-klikki sulkee lightboxin', () => {
      const container = setup()
      new SignLibraryPanel(container, createSignLibrary(), vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-visual-tab')[1].click()
      document.body.querySelector<HTMLElement>('.sign-image-zoom-btn')!.click()
      const backdrop = document.body.querySelector<HTMLElement>('.sign-image-lightbox-backdrop')!
      backdrop.click()
      expect(document.body.querySelector('.sign-image-lightbox')).toBeNull()
    })

    it('"Valitse tämä kuva" valitsee kuvan gridissä ja sulkee lightboxin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-visual-tab')[1].click()
      const zoomBtn = document.body.querySelector<HTMLElement>('.sign-image-zoom-btn')!
      const imageId = zoomBtn.dataset.imageId!
      zoomBtn.click()
      const chooseBtn = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.sign-image-lightbox button'))
        .find(b => b.textContent === 'Valitse tämä kuva')!
      chooseBtn.click()
      expect(document.body.querySelector('.sign-image-lightbox')).toBeNull()
      document.body.querySelector<HTMLInputElement>('.sign-lib-id-input')!.value = 'lightbox-pick-1'
      document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'Lightbox-valinta'
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const t = listTemplates(lib).find(t => t.label === 'Lightbox-valinta')!
      expect(t.imageId).toBe(imageId)
    })
  })
})
