import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignLibrary, SignLibraryPanel } from '../src/ui/sign-library-panel'
import { createTemplate, listTemplates } from '../src/logic/sign-library'
import { CURATED_ICONS } from '../src/logic/icon-set'
import { signImageIds } from '../src/logic/sign-images'

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('T178-korjaus — top-valinta ja Osat-lista synkronoituvat (B-löydös)', () => {
  it('pää-ikoni valittu ensin → "+ Lisää osa" siirtää sen listan riville 1, ei vaadi uudelleenvalintaa', () => {
    const container = setup()
    const lib = createSignLibrary()
    new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
    container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()

    // 1. Valitaan pää-ikoni (top, Ikoni-tabi)
    const firstIcon = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.sign-lib-icon-btn'))
      .find(b => b.dataset.iconId !== '')!
    firstIcon.click()

    // Ennen "Lisää osa" -klikkiä osalista on vielä tyhjä (comboActive=false, ei muutu simple-flow'ta)
    expect(document.body.querySelectorAll('.sign-lib-part-row').length).toBe(0)

    // 2. "+ Lisää osa" -klikkaus
    document.body.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()

    // Ensimmäinen valittu ikoni pitää nyt näkyä listan rivillä 1 — EI vaadi uudelleenvalintaa
    const rows = document.body.querySelectorAll('.sign-lib-part-row')
    expect(rows.length).toBe(1)
    expect(rows[0].textContent).toContain('1.')

    // 3. Valitaan toinen osa pickeristä (kakkoseksi)
    const secondIcon = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.sign-lib-part-icon-btn'))[1]
    secondIcon.click()

    const rowsAfter = document.body.querySelectorAll('.sign-lib-part-row')
    expect(rowsAfter.length).toBe(2)
    expect(rowsAfter[0].textContent).toContain(CURATED_ICONS.find(i => i.id === firstIcon.dataset.iconId)!.label)

    document.body.querySelector<HTMLInputElement>('.sign-lib-id-input')!.value = 'sync-flow-1'
    document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'SyncFlow'
    document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()

    const t = listTemplates(lib).find(t => t.label === 'SyncFlow')!
    expect(t.parts).toEqual([{ iconId: firstIcon.dataset.iconId }, { iconId: secondIcon.dataset.iconId }])
  })

  it('sama flow toimii kuvalla: pää-kuva valittu ensin päätyy riville 1', () => {
    const container = setup()
    const lib = createSignLibrary()
    new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
    container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()

    document.body.querySelectorAll<HTMLButtonElement>('.sign-visual-tab')[1].click() // top: Kuva-tabi
    const firstImg = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.sign-image-thumb'))
      .find(b => b.dataset.imageId !== '')!
    firstImg.click()

    document.body.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
    const rows = document.body.querySelectorAll('.sign-lib-part-row')
    expect(rows.length).toBe(1)
    expect(rows[0].querySelector('img')).toBeTruthy()

    document.body.querySelectorAll<HTMLButtonElement>('.sign-part-visual-tab')[1].click() // osapicker: Kuva
    const secondImg = document.body.querySelectorAll<HTMLButtonElement>('.sign-lib-part-image-btn')[1]
    secondImg.click()

    document.body.querySelector<HTMLInputElement>('.sign-lib-id-input')!.value = 'sync-flow-img-1'
    document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'SyncFlowImg'
    document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()

    const t = listTemplates(lib).find(t => t.label === 'SyncFlowImg')!
    expect(t.parts).toEqual([{ imageId: firstImg.dataset.imageId }, { imageId: secondImg.dataset.imageId }])
  })

  it('osan poisto index 0:sta synkkaa top-valitsimen uuteen ekaan osaan', () => {
    const container = setup()
    const lib = createSignLibrary()
    const ids = signImageIds()
    const t = createTemplate(lib, {
      label: 'Poisto', color: '#000', description: '', favorite: false,
      parts: [{ imageId: ids[0] }, { imageId: ids[1] }],
    }, 'poisto-1')
    new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
    container.querySelector<HTMLButtonElement>(`.sign-lib-dots-btn[data-id="${t.id}"]`)!.click()

    // Top-tabi pitäisi olla Kuva ja valittuna ids[0] (parts[0])
    const imageGrid = document.body.querySelector<HTMLElement>('.sign-image-gallery')!
    expect(imageGrid.style.display).toBe('grid')
    expect(imageGrid.querySelector(`.sign-image-thumb[data-image-id="${ids[0]}"] .sign-image-selected-badge`)).toBeTruthy()

    // Poistetaan rivi 0
    document.body.querySelector<HTMLButtonElement>('.sign-lib-part-remove[data-idx="0"]')!.click()

    // Top-valitsimen pitäisi nyt näyttää ids[1] valittuna (entinen index 1 → uusi index 0)
    expect(imageGrid.querySelector(`.sign-image-thumb[data-image-id="${ids[1]}"] .sign-image-selected-badge`)).toBeTruthy()
    expect(imageGrid.querySelector(`.sign-image-thumb[data-image-id="${ids[0]}"] .sign-image-selected-badge`)).toBeFalsy()

    document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
    expect(lib.get(t.id)?.parts).toEqual([{ imageId: ids[1] }])
  })

  it('kaikkien osien poisto tyhjentää top-valinnan ja palauttaa comboActive=false-tilan (osalista tyhjä)', () => {
    const container = setup()
    const lib = createSignLibrary()
    const ids = signImageIds()
    const t = createTemplate(lib, {
      label: 'TyhjennaKaikki', color: '#000', description: '', favorite: false,
      parts: [{ imageId: ids[0] }],
    }, 'tyhjenna-1')
    new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
    container.querySelector<HTMLButtonElement>(`.sign-lib-dots-btn[data-id="${t.id}"]`)!.click()
    document.body.querySelector<HTMLButtonElement>('.sign-lib-part-remove[data-idx="0"]')!.click()
    expect(document.body.querySelectorAll('.sign-lib-part-row').length).toBe(0)
    document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
    expect(lib.get(t.id)?.parts).toBeUndefined()
    expect(lib.get(t.id)?.imageId).toBeUndefined()
  })
})
