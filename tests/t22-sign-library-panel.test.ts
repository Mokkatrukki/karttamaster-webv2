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

    it('jokainen rivi sisältää muokkaa-napin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const editBtns = container.querySelectorAll('.sign-lib-edit-btn')
      expect(editBtns.length).toBe(4)
    })

    it('default-malleilla ei ole poisto-nappia', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const deleteBtns = container.querySelectorAll('.sign-lib-delete-btn')
      expect(deleteBtns.length).toBe(0)
    })

    it('sisältää "Uusi malli" -napin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const addBtn = container.querySelector('.sign-lib-add-btn')
      expect(addBtn).toBeTruthy()
    })
  })

  describe('muokkaa default-mallia', () => {
    it('muokkaa-klikki avaa modaalin', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const editBtn = container.querySelector<HTMLButtonElement>('.sign-lib-edit-btn')!
      editBtn.click()
      // T93: form in modal appended to body
      const modal = bodyQuery('.sign-lib-modal')
      expect(modal).toBeTruthy()
    })

    it('modaalissa on label-input esitäytettynä', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const editBtn = container.querySelector<HTMLButtonElement>('.sign-lib-edit-btn')!
      editBtn.click()
      const input = bodyQuery<HTMLInputElement>('.sign-lib-label-input')!
      expect(input.value).not.toBe('')
    })

    it('tallenna päivittää mallin kirjastossa', () => {
      const container = setup()
      const lib = createSignLibrary()
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange)
      const editBtn = container.querySelector<HTMLButtonElement>('.sign-lib-edit-btn')!
      editBtn.click()
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
      const editBtn = container.querySelector<HTMLButtonElement>('.sign-lib-edit-btn')!
      editBtn.click()
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'X'
      bodyQuery<HTMLInputElement>('.sign-lib-short-input')!.value = 'X'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(onChange).toHaveBeenCalledOnce()
    })

    it('peruuta sulkee modaalin ilman muutoksia', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const editBtn = container.querySelector<HTMLButtonElement>('.sign-lib-edit-btn')!
      editBtn.click()
      bodyQuery<HTMLButtonElement>('.sign-lib-cancel-btn')!.click()
      expect(bodyQuery('.sign-lib-modal')).toBeNull()
      expect(listTemplates(lib)).toHaveLength(4)
    })
  })

  describe('uusi malli', () => {
    it('"Uusi malli" -klikki avaa modaalin tyhjällä lomakkeella', () => {
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

    it('uudella custom-mallilla on poisto-nappi', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Kasa'
      bodyQuery<HTMLInputElement>('.sign-lib-short-input')!.value = 'K'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const deleteBtns = container.querySelectorAll('.sign-lib-delete-btn')
      expect(deleteBtns.length).toBe(1)
    })
  })

  describe('suosikki-toggle (T83)', () => {
    it('jokaisella rivillä on fav-nappi', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const favBtns = container.querySelectorAll('.sign-lib-fav-btn')
      expect(favBtns.length).toBe(4)
    })

    it('toggle vaihtaa favorite false→true ja kutsuu onChange', () => {
      const container = setup()
      const lib = createSignLibrary()
      const t = createTemplate(lib, { label: 'Testi', shortLabel: 'T', color: '#000', description: '', favorite: false })
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange)
      const btn = container.querySelector<HTMLButtonElement>(`.sign-lib-fav-btn[data-id="${t.id}"]`)!
      expect(btn).toBeTruthy()
      btn.click()
      expect(lib.get(t.id)?.favorite).toBe(true)
      expect(onChange).toHaveBeenCalledOnce()
    })

    it('toggle vaihtaa favorite true→false', () => {
      const container = setup()
      const lib = createSignLibrary()
      const lib_templates = listTemplates(lib)
      const firstId = lib_templates[0].id
      new SignLibraryPanel(container, lib, vi.fn())
      const btn = container.querySelector<HTMLButtonElement>(`.sign-lib-fav-btn[data-id="${firstId}"]`)!
      btn.click()
      expect(lib.get(firstId)?.favorite).toBe(false)
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
      const editBtn = container.querySelector<HTMLButtonElement>('.sign-lib-edit-btn')!
      editBtn.click()
      expect(document.getElementById('xss-desc')).toBeNull()
    })
  })

  describe('poista custom-malli', () => {
    function addCustom(container: HTMLElement, lib: ReturnType<typeof createSignLibrary>, onChange = vi.fn()) {
      new SignLibraryPanel(container, lib, onChange)
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Poistettava'
      bodyQuery<HTMLInputElement>('.sign-lib-short-input')!.value = 'P'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
    }

    it('poisto-nappi poistaa mallin kirjastosta', () => {
      const container = setup()
      const lib = createSignLibrary()
      addCustom(container, lib)
      container.querySelector<HTMLButtonElement>('.sign-lib-delete-btn')!.click()
      expect(listTemplates(lib)).toHaveLength(4)
    })

    it('poisto kutsuu onChange', () => {
      const container = setup()
      const lib = createSignLibrary()
      const onChange = vi.fn()
      addCustom(container, lib, onChange)
      onChange.mockClear()
      container.querySelector<HTMLButtonElement>('.sign-lib-delete-btn')!.click()
      expect(onChange).toHaveBeenCalledOnce()
    })

    it('poistettu malli ei näy listassa', () => {
      const container = setup()
      const lib = createSignLibrary()
      addCustom(container, lib)
      container.querySelector<HTMLButtonElement>('.sign-lib-delete-btn')!.click()
      const rows = container.querySelectorAll('.sign-lib-row')
      expect(rows.length).toBe(4)
    })
  })
})
