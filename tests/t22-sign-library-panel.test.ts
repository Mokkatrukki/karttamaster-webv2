import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSignLibrary, SignLibraryPanel } from '../src/ui/sign-library-panel'
import { listTemplates } from '../src/logic/sign-library'

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  document.body.innerHTML = ''
})

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
    it('muokkaa-klikki avaa lomakkeen', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const editBtn = container.querySelector<HTMLButtonElement>('.sign-lib-edit-btn')!
      editBtn.click()
      const form = container.querySelector('.sign-lib-form')
      expect(form).toBeTruthy()
    })

    it('lomakkeessa on label-input esitäytettynä', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const editBtn = container.querySelector<HTMLButtonElement>('.sign-lib-edit-btn')!
      editBtn.click()
      const input = container.querySelector<HTMLInputElement>('.sign-lib-label-input')!
      expect(input.value).not.toBe('')
    })

    it('tallenna päivittää mallin kirjastossa', () => {
      const container = setup()
      const lib = createSignLibrary()
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange)
      const editBtn = container.querySelector<HTMLButtonElement>('.sign-lib-edit-btn')!
      editBtn.click()
      const labelInput = container.querySelector<HTMLInputElement>('.sign-lib-label-input')!
      labelInput.value = 'Muutettu nimi'
      const shortInput = container.querySelector<HTMLInputElement>('.sign-lib-short-input')!
      shortInput.value = 'M'
      container.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
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
      const labelInput = container.querySelector<HTMLInputElement>('.sign-lib-label-input')!
      labelInput.value = 'X'
      container.querySelector<HTMLInputElement>('.sign-lib-short-input')!.value = 'X'
      container.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(onChange).toHaveBeenCalledOnce()
    })

    it('peruuta sulkee lomakkeen ilman muutoksia', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const editBtn = container.querySelector<HTMLButtonElement>('.sign-lib-edit-btn')!
      editBtn.click()
      container.querySelector<HTMLButtonElement>('.sign-lib-cancel-btn')!.click()
      expect(container.querySelector('.sign-lib-form')).toBeNull()
      expect(listTemplates(lib)).toHaveLength(4)
    })
  })

  describe('uusi malli', () => {
    it('"Uusi malli" -klikki avaa tyhjän lomakkeen', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      const form = container.querySelector('.sign-lib-form')
      expect(form).toBeTruthy()
      const labelInput = container.querySelector<HTMLInputElement>('.sign-lib-label-input')!
      expect(labelInput.value).toBe('')
    })

    it('tallenna luo uuden mallin kirjastoon', () => {
      const container = setup()
      const lib = createSignLibrary()
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange)
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      container.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'Huolto 25km'
      container.querySelector<HTMLInputElement>('.sign-lib-short-input')!.value = 'H'
      container.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
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
      container.querySelector<HTMLInputElement>('.sign-lib-short-input')!.value = 'H'
      container.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(listTemplates(lib)).toHaveLength(4)
    })

    it('uudella custom-mallilla on poisto-nappi', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      container.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'Kasa'
      container.querySelector<HTMLInputElement>('.sign-lib-short-input')!.value = 'K'
      container.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const deleteBtns = container.querySelectorAll('.sign-lib-delete-btn')
      expect(deleteBtns.length).toBe(1)
    })
  })

  describe('poista custom-malli', () => {
    function addCustom(container: HTMLElement, lib: ReturnType<typeof createSignLibrary>, onChange = vi.fn()) {
      new SignLibraryPanel(container, lib, onChange)
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      container.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'Poistettava'
      container.querySelector<HTMLInputElement>('.sign-lib-short-input')!.value = 'P'
      container.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
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
