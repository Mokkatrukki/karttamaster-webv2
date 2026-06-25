import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSignLibrary, SignLibraryPanel } from '../src/ui/sign-library-panel'
import { createTemplate, listTemplates, listFavorites } from '../src/logic/sign-library'

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  document.body.innerHTML = ''
})

// T93: edit/create form now opens in modal (document.body), not inline in container
function bodyQuery<T extends Element>(selector: string): T | null {
  return document.body.querySelector<T>(selector)
}

describe('T22 SignLibraryPanel — V10', () => {
  describe('seedDefaults', () => {
    it('luo kirjaston 4 oletusmalleilla', () => {
      const lib = createSignLibrary()
      const templates = listTemplates(lib)
      expect(templates).toHaveLength(4)
    })

    it('oletusmalleilla V10-kentät: label, shortLabel, color, description', () => {
      const lib = createSignLibrary()
      for (const t of listTemplates(lib)) {
        expect(t.label).toBeTruthy()
        expect(t.shortLabel).toBeTruthy()
        expect(t.color).toMatch(/^#[0-9a-f]{6}$/i)
      }
    })

    it('ei alusta toistamiseen jos kirjastossa jo sisältöä', () => {
      const lib = createSignLibrary()
      const lib2 = lib
      createSignLibrary()
      expect(listTemplates(lib2)).toHaveLength(4)
    })
  })

  describe('render', () => {
    it('renderöi sign-type-btn default-malleille', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const btns = container.querySelectorAll('.sign-type-btn')
      expect(btns.length).toBe(4)
    })

    it('default-napilla on data-type joka vastaa MarkerType:a', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const types = Array.from(container.querySelectorAll<HTMLElement>('.sign-type-btn'))
        .map(b => b.dataset.type)
      expect(types).toContain('right')
      expect(types).toContain('left')
      expect(types).toContain('upcoming-right')
      expect(types).toContain('upcoming-left')
    })

    it('jokainen rivi sisältää dots-napin (···)', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const dotsBtns = container.querySelectorAll('.sign-lib-dots-btn')
      expect(dotsBtns.length).toBe(4)
    })

    // V62: no inline delete in item rows
    it('item-riveillä ei ole inline ★- tai ×-nappia (V62)', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const favBtns = container.querySelectorAll('.sign-lib-fav-btn')
      const deleteBtns = container.querySelectorAll('.sign-lib-delete-btn')
      expect(favBtns.length).toBe(0)
      expect(deleteBtns.length).toBe(0)
    })

    it('sisältää "Uusi merkki" -napin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const addBtn = container.querySelector('.sign-lib-add-btn')
      expect(addBtn).toBeTruthy()
    })

    it('section-header löytyy ja sisältää Merkkikirjasto-tekstin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const header = container.querySelector('.left-panel-section-header')
      expect(header).toBeTruthy()
      expect(header?.textContent).toContain('Merkkikirjasto')
    })
  })

  describe('muokkaa default-mallia', () => {
    it('dots-nappi avaa modaalin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      const modal = bodyQuery('.sign-lib-modal')
      expect(modal).toBeTruthy()
    })

    it('modaalissa on label-input esitäytettynä', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      const input = bodyQuery<HTMLInputElement>('.sign-lib-label-input')!
      expect(input.value).not.toBe('')
    })

    it('tallenna päivittää mallin kirjastossa', () => {
      const container = setup()
      const lib = createSignLibrary()
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange)
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      const labelInput = bodyQuery<HTMLInputElement>('.sign-lib-label-input')!
      labelInput.value = 'Muutettu nimi'
      const shortInput = bodyQuery<HTMLInputElement>('.sign-lib-short-input')!
      shortInput.value = 'M'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const templates = listTemplates(lib)
      const updated = templates.find(t => t.label === 'Muutettu nimi')
      expect(updated).toBeTruthy()
    })

    it('tallenna kutsuu onChange', () => {
      const container = setup()
      const lib = createSignLibrary()
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange)
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'X'
      bodyQuery<HTMLInputElement>('.sign-lib-short-input')!.value = 'X'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(onChange).toHaveBeenCalledOnce()
    })

    it('peruuta sulkee modaalin ilman muutoksia', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      bodyQuery<HTMLButtonElement>('.sign-lib-cancel-btn')!.click()
      expect(bodyQuery('.sign-lib-modal')).toBeNull()
      expect(listTemplates(lib)).toHaveLength(4)
    })

    it('default-mallin modaalissa ei ole poisto-nappia', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      expect(bodyQuery('.modal-btn-destructive')).toBeNull()
    })
  })

  describe('uusi malli', () => {
    it('"Uusi merkki" -klikki avaa modaalin tyhjällä lomakkeella', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      const modal = bodyQuery('.sign-lib-modal')
      expect(modal).toBeTruthy()
      const labelInput = bodyQuery<HTMLInputElement>('.sign-lib-label-input')!
      expect(labelInput.value).toBe('')
    })

    it('tallenna luo uuden mallin kirjastoon', () => {
      const container = setup()
      const lib = createSignLibrary()
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange)
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Huolto 25km'
      bodyQuery<HTMLInputElement>('.sign-lib-short-input')!.value = 'H'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const templates = listTemplates(lib)
      expect(templates).toHaveLength(5)
      const newT = templates.find(t => t.label === 'Huolto 25km')
      expect(newT).toBeTruthy()
      expect(newT?.shortLabel).toBe('H')
    })

    it('tyhjä label: tallenna ei luo mallia', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-short-input')!.value = 'H'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(listTemplates(lib)).toHaveLength(4)
    })

    it('uudella custom-mallin modaalissa on poisto-nappi (V62)', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Kasa'
      bodyQuery<HTMLInputElement>('.sign-lib-short-input')!.value = 'K'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      // Open the custom template's dots btn
      const allDotsBtns = container.querySelectorAll<HTMLButtonElement>('.sign-lib-dots-btn')
      const customDotsBtn = allDotsBtns[allDotsBtns.length - 1]
      customDotsBtn.click()
      expect(bodyQuery('.modal-btn-destructive')).toBeTruthy()
    })
  })

  describe('suosikki-toggle (T83) — via modal checkbox', () => {
    it('modaalissa on suosikki-checkbox', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!.click()
      expect(bodyQuery('.sign-lib-fav-checkbox')).toBeTruthy()
    })

    it('checkbox tallentuu favorite:ksi', () => {
      const container = setup()
      const lib = createSignLibrary()
      const t = createTemplate(lib, { label: 'Testi', shortLabel: 'T', color: '#000', description: '', favorite: false })
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange)
      const dotsBtn = container.querySelector<HTMLButtonElement>(`.sign-lib-dots-btn[data-id="${t.id}"]`)!
      expect(dotsBtn).toBeTruthy()
      dotsBtn.click()
      const checkbox = bodyQuery<HTMLInputElement>('.sign-lib-fav-checkbox')!
      checkbox.checked = true
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Testi'
      bodyQuery<HTMLInputElement>('.sign-lib-short-input')!.value = 'T'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(lib.get(t.id)?.favorite).toBe(true)
      expect(onChange).toHaveBeenCalled()
    })

    it('default-mallit ovat suosikkeja seedDefaults jälkeen', () => {
      const lib = createSignLibrary()
      const favs = listFavorites(lib)
      expect(favs).toHaveLength(4)
    })

    it('uusi custom-malli on automaattisesti suosikki (T91)', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Uusi'
      bodyQuery<HTMLInputElement>('.sign-lib-short-input')!.value = 'U'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const templates = listTemplates(lib)
      const custom = templates.find(t => t.label === 'Uusi')!
      expect(custom.favorite).toBe(true)
    })
  })

  describe('XSS-suojaus (B19/V44)', () => {
    it('label jossa HTML-tagi ei luo DOM-elementtiä', () => {
      const container = setup()
      const lib = createSignLibrary()
      createTemplate(lib, { label: '<img src=x id="xss-label">', shortLabel: 'X', color: '#000', description: '', favorite: false })
      new SignLibraryPanel(container, lib, vi.fn())
      expect(document.getElementById('xss-label')).toBeNull()
    })

    it('shortLabel jossa HTML-tagi ei luo DOM-elementtiä', () => {
      const container = setup()
      const lib = createSignLibrary()
      createTemplate(lib, { label: 'Ok', shortLabel: '<img src=x id="xss-short">', color: '#000', description: '', favorite: false })
      new SignLibraryPanel(container, lib, vi.fn())
      expect(document.getElementById('xss-short')).toBeNull()
    })

    it('description jossa HTML-tagi ei luo DOM-elementtiä lomakkeessa', () => {
      const container = setup()
      const lib = createSignLibrary()
      createTemplate(lib, { label: 'Ok', shortLabel: 'O', color: '#000', description: '<img src=x id="xss-desc">', favorite: false })
      new SignLibraryPanel(container, lib, vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      expect(document.getElementById('xss-desc')).toBeNull()
    })
  })

  describe('poista custom-malli — via modal destructive (V62)', () => {
    function addCustom(container: HTMLElement, lib: ReturnType<typeof createSignLibrary>, onChange = vi.fn()) {
      new SignLibraryPanel(container, lib, onChange)
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Poistettava'
      bodyQuery<HTMLInputElement>('.sign-lib-short-input')!.value = 'P'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
    }

    function openCustomDotsModal(container: HTMLElement) {
      const dotsBtns = container.querySelectorAll<HTMLButtonElement>('.sign-lib-dots-btn')
      dotsBtns[dotsBtns.length - 1].click()
    }

    it('poisto-nappi poistaa mallin kirjastosta (window.confirm = true)', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
      const container = setup()
      const lib = createSignLibrary()
      addCustom(container, lib)
      openCustomDotsModal(container)
      bodyQuery<HTMLButtonElement>('.modal-btn-destructive')!.click()
      expect(listTemplates(lib)).toHaveLength(4)
    })

    it('poisto kutsuu onChange', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
      const container = setup()
      const lib = createSignLibrary()
      const onChange = vi.fn()
      addCustom(container, lib, onChange)
      onChange.mockClear()
      openCustomDotsModal(container)
      bodyQuery<HTMLButtonElement>('.modal-btn-destructive')!.click()
      expect(onChange).toHaveBeenCalledOnce()
    })

    it('confirm=false ei poista mallia', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
      const container = setup()
      const lib = createSignLibrary()
      addCustom(container, lib)
      openCustomDotsModal(container)
      bodyQuery<HTMLButtonElement>('.modal-btn-destructive')!.click()
      expect(listTemplates(lib)).toHaveLength(5)
    })

    it('poistettu malli ei näy listassa', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
      const container = setup()
      const lib = createSignLibrary()
      addCustom(container, lib)
      openCustomDotsModal(container)
      bodyQuery<HTMLButtonElement>('.modal-btn-destructive')!.click()
      const rows = container.querySelectorAll('.sign-lib-row')
      expect(rows.length).toBe(4)
    })
  })
})
