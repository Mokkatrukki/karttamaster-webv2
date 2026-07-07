import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSignLibrary, SignLibraryPanel } from '../src/ui/sign-library-panel'
import { createLibrary, createTemplate, listTemplates } from '../src/logic/sign-library'

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('T172/V107 — SignLibraryPanel yhdistelmämerkki-UI (pystypino)', () => {
  it('modaalissa on "Osat"-lisäysnappi + tyhjä osalista aluksi', () => {
    const container = setup()
    const lib = createSignLibrary()
    new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
    container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
    const modal = document.body.querySelector('.sign-lib-modal')!
    expect(modal.querySelector('.sign-lib-part-add-toggle')).toBeTruthy()
    expect(modal.querySelectorAll('.sign-lib-part-row')).toHaveLength(0)
  })

  it('"+ Lisää osa" avaa ikoni-gridin, ikonin klikkaus lisää osan järjestykseen', () => {
    const container = setup()
    const lib = createSignLibrary()
    new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
    container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
    const modal = document.body.querySelector('.sign-lib-modal')!
    modal.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
    const firstIconBtn = modal.querySelector<HTMLButtonElement>('.sign-lib-part-icon-btn')!
    firstIconBtn.click()
    expect(modal.querySelectorAll('.sign-lib-part-row')).toHaveLength(1)
  })

  it('järjestys-nuolet vaihtavat osien paikkaa', () => {
    const container = setup()
    const lib = createSignLibrary()
    new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
    container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
    const modal = document.body.querySelector('.sign-lib-modal')!
    const addTwoParts = () => {
      modal.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
      modal.querySelectorAll<HTMLButtonElement>('.sign-lib-part-icon-btn')[0].click()
      modal.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
      modal.querySelectorAll<HTMLButtonElement>('.sign-lib-part-icon-btn')[1].click()
    }
    addTwoParts()
    const rowsBefore = Array.from(modal.querySelectorAll('.sign-lib-part-row')).map(r => (r as HTMLElement).dataset.idx)
    expect(rowsBefore).toEqual(['0', '1'])
    const firstLabel = modal.querySelector('.sign-lib-part-row[data-idx="0"]')!.textContent
    modal.querySelector<HTMLButtonElement>('.sign-lib-part-row[data-idx="1"] .sign-lib-part-up')!.click()
    const newFirstLabel = modal.querySelector('.sign-lib-part-row[data-idx="0"]')!.textContent
    expect(newFirstLabel).not.toBe(firstLabel)
  })

  it('poisto-nappi poistaa osan listasta', () => {
    const container = setup()
    const lib = createSignLibrary()
    new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
    container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
    const modal = document.body.querySelector('.sign-lib-modal')!
    modal.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
    modal.querySelector<HTMLButtonElement>('.sign-lib-part-icon-btn')!.click()
    expect(modal.querySelectorAll('.sign-lib-part-row')).toHaveLength(1)
    modal.querySelector<HTMLButtonElement>('.sign-lib-part-remove')!.click()
    expect(modal.querySelectorAll('.sign-lib-part-row')).toHaveLength(0)
  })

  it('max 4 osaa — 5. lisäys ei mene läpi, "+ Lisää osa" disabloituu', () => {
    const container = setup()
    const lib = createSignLibrary()
    new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
    container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
    const modal = document.body.querySelector('.sign-lib-modal')!
    const addToggle = modal.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!
    for (let i = 0; i < 4; i++) {
      addToggle.click()
      modal.querySelectorAll<HTMLButtonElement>('.sign-lib-part-icon-btn')[i].click()
    }
    expect(modal.querySelectorAll('.sign-lib-part-row')).toHaveLength(4)
    expect(addToggle.disabled).toBe(true)
  })

  it('tallennus persistoi parts-taulukon järjestyksessä templateen', () => {
    const container = setup()
    const lib = createSignLibrary()
    const onChange = vi.fn()
    new SignLibraryPanel(container, lib, onChange, vi.fn())
    container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
    const modal = document.body.querySelector('.sign-lib-modal')!
    ;(modal.querySelector('.sign-lib-label-input') as HTMLInputElement).value = 'Combo'
    modal.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
    modal.querySelectorAll<HTMLButtonElement>('.sign-lib-part-icon-btn')[0].click()
    modal.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
    modal.querySelectorAll<HTMLButtonElement>('.sign-lib-part-icon-btn')[1].click()
    ;(modal.querySelector('.sign-lib-id-input') as HTMLInputElement).value = 'combo-test'
    modal.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()

    const saved = listTemplates(lib).find(t => t.id === 'combo-test')
    expect(saved?.parts).toHaveLength(2)
    expect(onChange).toHaveBeenCalled()
  })

  it('editissä poisto kaikista osista tyhjentää parts-kentän tallennuksessa', () => {
    const lib = createLibrary()
    createTemplate(lib, {
      label: 'Combo', color: '#000', description: '', favorite: true,
      parts: [{ iconId: 'flag' }, { iconId: 'wrench' }],
    }, 'combo-edit')
    const container = setup()
    new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
    container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn[data-id="combo-edit"]')!.click()
    const modal = document.body.querySelector('.sign-lib-modal')!
    expect(modal.querySelectorAll('.sign-lib-part-row')).toHaveLength(2)
    modal.querySelector<HTMLButtonElement>('.sign-lib-part-remove')!.click()
    modal.querySelector<HTMLButtonElement>('.sign-lib-part-remove')!.click()
    expect(modal.querySelectorAll('.sign-lib-part-row')).toHaveLength(0)
    modal.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
    const saved = listTemplates(lib).find(t => t.id === 'combo-edit')
    expect(saved?.parts).toBeUndefined()
  })
})
