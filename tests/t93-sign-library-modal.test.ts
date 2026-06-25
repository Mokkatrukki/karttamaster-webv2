import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSignLibrary, SignLibraryPanel } from '../src/ui/sign-library-panel'
import { createTemplate, listTemplates } from '../src/logic/sign-library'
import { CURATED_ICONS } from '../src/logic/icon-set'

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('T93 — Merkkikirjasto modal + iconId (V10, V50)', () => {
  describe('modal avautuu', () => {
    it('"Uusi malli" avaa .sign-lib-modal document.bodyyn', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      expect(document.body.querySelector('.sign-lib-modal')).toBeTruthy()
    })

    it('dots-nappi (···) avaa modaalin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!.click()
      expect(document.body.querySelector('.sign-lib-modal')).toBeTruthy()
    })

    it('modaalissa on ikoni-grid', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      const grid = document.body.querySelector('.sign-lib-icon-grid')
      expect(grid).toBeTruthy()
    })

    it('ikoni-gridissä on CURATED_ICONS.length + 1 nappia ("ei ikonia" + kaikki ikonit)', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      const btns = document.body.querySelectorAll('.sign-lib-icon-btn')
      expect(btns.length).toBe(CURATED_ICONS.length + 1)
    })
  })

  describe('modal sulkeutuu', () => {
    it('✕-nappi sulkee modaalin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelector<HTMLButtonElement>('.sign-lib-modal-close')!.click()
      expect(document.body.querySelector('.sign-lib-modal')).toBeNull()
    })

    it('Peruuta-nappi sulkee modaalin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelector<HTMLButtonElement>('.sign-lib-cancel-btn')!.click()
      expect(document.body.querySelector('.sign-lib-modal')).toBeNull()
    })

    it('Esc-näppäin sulkee modaalin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      expect(document.body.querySelector('.sign-lib-modal')).toBeTruthy()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(document.body.querySelector('.sign-lib-modal')).toBeNull()
    })

    it('backdrop-klikki sulkee modaalin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      const backdrop = document.body.querySelector<HTMLElement>('.sign-lib-modal-backdrop')!
      backdrop.click()
      expect(document.body.querySelector('.sign-lib-modal')).toBeNull()
    })

    it('tallenna sulkee modaalin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'Testi'
      document.body.querySelector<HTMLInputElement>('.sign-lib-short-input')!.value = 'T'
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(document.body.querySelector('.sign-lib-modal')).toBeNull()
    })
  })

  describe('iconId tallennus (V50)', () => {
    it('tallenna ilman ikoni-valintaa → iconId undefined', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'Testi'
      document.body.querySelector<HTMLInputElement>('.sign-lib-short-input')!.value = 'T'
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const t = listTemplates(lib).find(t => t.label === 'Testi')!
      expect(t.iconId).toBeUndefined()
    })

    it('ikonin valinta tallentuu iconId:nä', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      // Click first non-"no-icon" icon button
      const iconBtns = document.body.querySelectorAll<HTMLButtonElement>('.sign-lib-icon-btn')
      const firstRealIcon = Array.from(iconBtns).find(b => b.dataset.iconId !== '')!
      firstRealIcon.click()
      document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'Ikoni-testi'
      document.body.querySelector<HTMLInputElement>('.sign-lib-short-input')!.value = 'I'
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const t = listTemplates(lib).find(t => t.label === 'Ikoni-testi')!
      expect(t.iconId).toBe(firstRealIcon.dataset.iconId)
    })

    it('muokkaus säilyttää aiemman iconId:n jos ei muuteta', () => {
      const container = setup()
      const lib = createSignLibrary()
      const t = createTemplate(lib, { label: 'Vanha', shortLabel: 'V', color: '#000', description: '', favorite: false, iconId: 'flag' })
      new SignLibraryPanel(container, lib, vi.fn())
      // open edit modal for this template
      container.querySelector<HTMLButtonElement>(`.sign-lib-dots-btn[data-id="${t.id}"]`)!.click()
      // change only label
      document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'Uusi nimi'
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(lib.get(t.id)?.iconId).toBe('flag')
    })

    it('"ei ikonia" -valinta tyhjentää iconId:n', () => {
      const container = setup()
      const lib = createSignLibrary()
      const t = createTemplate(lib, { label: 'X', shortLabel: 'X', color: '#000', description: '', favorite: false, iconId: 'flag' })
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>(`.sign-lib-dots-btn[data-id="${t.id}"]`)!.click()
      // Click the "no icon" button (data-icon-id="")
      const noIconBtn = document.body.querySelector<HTMLButtonElement>('.sign-lib-icon-btn[data-icon-id=""]')!
      noIconBtn.click()
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(lib.get(t.id)?.iconId).toBeUndefined()
    })
  })

  describe('icon-set', () => {
    it('CURATED_ICONS sisältää vähintään 20 ikonia', () => {
      expect(CURATED_ICONS.length).toBeGreaterThanOrEqual(20)
    })

    it('kaikilla ikoneilla on id, label ja svgContent', () => {
      for (const icon of CURATED_ICONS) {
        expect(icon.id).toBeTruthy()
        expect(icon.label).toBeTruthy()
        expect(icon.svgContent).toBeTruthy()
      }
    })

    it('id:t ovat uniikkeja', () => {
      const ids = CURATED_ICONS.map(i => i.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })
})
