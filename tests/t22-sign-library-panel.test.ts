import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSignLibrary, SignLibraryPanel } from '../src/ui/sign-library-panel'
import { createLibrary, createTemplate, listTemplates, type SignLibrary } from '../src/logic/sign-library'
import { compactLabel } from '../src/logic/sign-visual'

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

// T195/V125: kirjasto seedaa tyhjänä. Panelin käyttäytymistestit (render/edit/suosikki)
// tarvitsevat sisältöä → seedataan tässä kiinteä joukko (ei enää tuotannon oletusmalleja).
function seededLib(): SignLibrary {
  const lib = createLibrary()
  createTemplate(lib, { label: 'Vasemmalle', color: '#2563eb', description: 'Käänny vasemmalle', favorite: true }, 'left')
  createTemplate(lib, { label: 'Oikealle', color: '#16a34a', description: 'Käänny oikealle', favorite: true }, 'right')
  createTemplate(lib, { label: 'WC', color: '#1d4ed8', description: '', favorite: false }, 'wc')
  return lib
}
const seedCount = () => 3

afterEach(() => {
  document.body.innerHTML = ''
})

// T93: edit/create form now opens in modal (document.body), not inline in container
function bodyQuery<T extends Element>(selector: string): T | null {
  return document.body.querySelector<T>(selector)
}

describe('T22 SignLibraryPanel — V10', () => {
  describe('T195/V125: tyhjä seed', () => {
    it('createSignLibrary palauttaa tyhjän kirjaston (ei oletusmalleja)', () => {
      const lib = createSignLibrary()
      expect(listTemplates(lib)).toHaveLength(0)
    })
  })

  describe('render', () => {
    it('renderöi sign-type-btn jokaiselle mallille', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const btns = container.querySelectorAll('.sign-type-btn')
      expect(btns.length).toBe(seedCount())
    })

    it('place-napilla on data-id joka vastaa mallin id:tä (T136)', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const types = Array.from(container.querySelectorAll<HTMLElement>('.sign-type-btn'))
        .map(b => b.dataset.id)
      expect(types).toContain('right')
      expect(types).toContain('left')
      expect(types).toContain('wc')
    })

    it('jokainen rivi sisältää dots-napin (···)', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const dotsBtns = container.querySelectorAll('.sign-lib-dots-btn')
      expect(dotsBtns.length).toBe(seedCount())
    })

    // V62: no inline delete in item rows
    it('item-riveillä ei ole inline ★- tai ×-nappia (V62)', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const favBtns = container.querySelectorAll('.sign-lib-fav-btn')
      const deleteBtns = container.querySelectorAll('.sign-lib-delete-btn')
      expect(favBtns.length).toBe(0)
      expect(deleteBtns.length).toBe(0)
    })

    it('sisältää "Uusi merkki" -napin', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const addBtn = container.querySelector('.sign-lib-add-btn')
      expect(addBtn).toBeTruthy()
    })

    it('section-header löytyy ja sisältää Merkkikirjasto-tekstin', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const header = container.querySelector('.left-panel-section-header')
      expect(header).toBeTruthy()
      expect(header?.textContent).toContain('Merkkikirjasto')
    })
  })

  // T200: sivupalkin swatch käyttää T198:n buildMarkerVisual-helperiä (samat visuaalit kuin
  // SegmentDetailsModal/T199) — yksi lista/tupla, ei kulmabadgea, väri täsmää template.color:iin.
  describe('T200: buildMarkerVisual-uudelleenkäyttö riveillä', () => {
    it('jokainen rivi sisältää tasan yhden merkkivisuaalin (.marker-visual-row-sv)', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const visuals = container.querySelectorAll('.sign-lib-row .marker-visual-row-sv')
      expect(visuals.length).toBe(seedCount())
    })

    it('tuplamerkki (parts.length>1) renderöi comboa (.marker-visual-row-combo) sivupalkissa', () => {
      const container = setup()
      const lib = seededLib()
      createTemplate(lib, {
        label: 'Tupla',
        color: '#7c3aed',
        description: '',
        favorite: true,
        parts: [
          { iconId: 'arrow-left' },
          { iconId: 'arrow-right' },
        ],
      }, 'tupla')
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const row = Array.from(container.querySelectorAll<HTMLElement>('.sign-lib-row'))
        .find(r => r.querySelector('[data-id="tupla"]'))
      expect(row?.querySelector('.marker-visual-row-combo')).toBeTruthy()
      expect(row?.querySelectorAll('.marker-visual-row-combo-slot').length).toBe(2)
    })

    it('yksittäinen merkki (ei parts) EI renderöi comboa', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const row = Array.from(container.querySelectorAll<HTMLElement>('.sign-lib-row'))
        .find(r => r.querySelector('[data-id="left"]'))
      expect(row?.querySelector('.marker-visual-row-combo')).toBeFalsy()
      expect(row?.querySelector('.marker-visual-row-single')).toBeTruthy()
    })

    it('sivupalkin rivillä ei ole zoom-nappia (zoomable:false)', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const zoomBtns = container.querySelectorAll('.sign-lib-row .marker-visual-row-zoom')
      expect(zoomBtns.length).toBe(0)
    })

    it('väri täsmää template.color:iin (ei kiinteä accent-oranssi, V87)', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const row = Array.from(container.querySelectorAll<HTMLElement>('.sign-lib-row'))
        .find(r => r.querySelector('[data-id="right"]'))
      const box = row?.querySelector<HTMLElement>('.marker-visual-row-single')
      expect(box?.style.background).toBe('rgb(22, 163, 74)') // #16a34a
    })
  })

  describe('muokkaa default-mallia', () => {
    it('dots-nappi avaa modaalin', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      const modal = bodyQuery('.sign-lib-modal')
      expect(modal).toBeTruthy()
    })

    it('modaalissa on label-input esitäytettynä', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      const input = bodyQuery<HTMLInputElement>('.sign-lib-label-input')!
      expect(input.value).not.toBe('')
    })

    it('tallenna päivittää mallin kirjastossa', () => {
      const container = setup()
      const lib = seededLib()
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange, vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      const labelInput = bodyQuery<HTMLInputElement>('.sign-lib-label-input')!
      labelInput.value = 'Muutettu nimi'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const templates = listTemplates(lib)
      const updated = templates.find(t => t.label === 'Muutettu nimi')
      expect(updated).toBeTruthy()
    })

    it('tallenna kutsuu onChange', () => {
      const container = setup()
      const lib = seededLib()
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange, vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'X'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(onChange).toHaveBeenCalledOnce()
    })

    it('peruuta sulkee modaalin ilman muutoksia', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      bodyQuery<HTMLButtonElement>('.sign-lib-cancel-btn')!.click()
      expect(bodyQuery('.sign-lib-modal')).toBeNull()
      expect(listTemplates(lib)).toHaveLength(seedCount())
    })

    // T195/V125: DEFAULT_IDS tyhjä → kaikki mallit poistettavissa, ei suojattuja oletusmalleja.
    it('jokaisen mallin modaalissa on poisto-nappi (ei suojattuja defaulteja)', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn[data-id="left"]')!
      dotsBtn.click()
      expect(bodyQuery('.modal-btn-destructive')).toBeTruthy()
    })
  })

  describe('uusi malli', () => {
    it('"Uusi merkki" -klikki avaa modaalin tyhjällä lomakkeella', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      const modal = bodyQuery('.sign-lib-modal')
      expect(modal).toBeTruthy()
      const labelInput = bodyQuery<HTMLInputElement>('.sign-lib-label-input')!
      expect(labelInput.value).toBe('')
    })

    it('tallenna luo uuden mallin kirjastoon', () => {
      const container = setup()
      const lib = seededLib()
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-id-input')!.value = 'huolto-25'
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Huolto 25km'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const templates = listTemplates(lib)
      expect(templates).toHaveLength(seedCount() + 1)
      const newT = templates.find(t => t.label === 'Huolto 25km')
      expect(newT).toBeTruthy()
      expect(compactLabel(newT!.label)).toBe('HUO')
    })

    it('T156/V97: duplikaatti-id näyttää virheviestin eikä luo mallia', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-id-input')!.value = 'left' // seed-default id
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Klooni'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const err = bodyQuery<HTMLElement>('.sign-lib-id-error')!
      expect(err.style.display).toBe('block')
      expect(err.textContent).toBeTruthy()
      expect(listTemplates(lib)).toHaveLength(seedCount()) // ei uutta
      expect(bodyQuery('.sign-lib-modal')).toBeTruthy() // modaali pysyy auki
    })

    it('T156/V97: kelvoton id-formaatti näyttää virheviestin eikä luo mallia', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-id-input')!.value = 'ei kelpaa!'
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'X'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(bodyQuery<HTMLElement>('.sign-lib-id-error')!.style.display).toBe('block')
      expect(listTemplates(lib)).toHaveLength(seedCount())
    })

    it('T156: edit-modaalissa ei ole id-inputtia (id lukittu)', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!.click()
      expect(bodyQuery('.sign-lib-id-input')).toBeNull()
    })

    it('tyhjä label: tallenna ei luo mallia', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(listTemplates(lib)).toHaveLength(seedCount())
    })

    it('uudella custom-mallin modaalissa on poisto-nappi (V62)', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-id-input')!.value = 'kasa'
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Kasa'
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
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!.click()
      expect(bodyQuery('.sign-lib-fav-checkbox')).toBeTruthy()
    })

    it('checkbox tallentuu favorite:ksi', () => {
      const container = setup()
      const lib = seededLib()
      const t = createTemplate(lib, { label: 'Testi', color: '#000', description: '', favorite: false }, 'testi')
      const onChange = vi.fn()
      new SignLibraryPanel(container, lib, onChange, vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>(`.sign-lib-dots-btn[data-id="${t.id}"]`)!
      expect(dotsBtn).toBeTruthy()
      dotsBtn.click()
      const checkbox = bodyQuery<HTMLInputElement>('.sign-lib-fav-checkbox')!
      checkbox.checked = true
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Testi'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      expect(lib.get(t.id)?.favorite).toBe(true)
      expect(onChange).toHaveBeenCalled()
    })

    it('favorite-lippu säilyy mallikohtaisesti', () => {
      const lib = seededLib()
      const favs = listTemplates(lib).filter(t => t.favorite)
      expect(favs.map(t => t.id).sort()).toEqual(['left', 'right'])
    })

    it('uusi custom-malli on automaattisesti suosikki (T91)', () => {
      const container = setup()
      const lib = seededLib()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-id-input')!.value = 'uusi'
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Uusi'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const templates = listTemplates(lib)
      const custom = templates.find(t => t.label === 'Uusi')!
      expect(custom.favorite).toBe(true)
    })
  })

  describe('XSS-suojaus (B19/V44)', () => {
    it('label jossa HTML-tagi ei luo DOM-elementtiä', () => {
      const container = setup()
      const lib = seededLib()
      createTemplate(lib, { label: '<img src=x id="xss-label">', color: '#000', description: '', favorite: false }, 'xss-a')
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      expect(document.getElementById('xss-label')).toBeNull()
    })

    it('description jossa HTML-tagi ei luo DOM-elementtiä lomakkeessa', () => {
      const container = setup()
      const lib = seededLib()
      createTemplate(lib, { label: 'Ok', color: '#000', description: '<img src=x id="xss-desc">', favorite: false }, 'xss-c')
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      const dotsBtn = container.querySelector<HTMLButtonElement>('.sign-lib-dots-btn')!
      dotsBtn.click()
      expect(document.getElementById('xss-desc')).toBeNull()
    })
  })

  describe('poista custom-malli — via modal destructive (V62)', () => {
    function addCustom(container: HTMLElement, lib: ReturnType<typeof createSignLibrary>, onChange = vi.fn()) {
      new SignLibraryPanel(container, lib, onChange, vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      bodyQuery<HTMLInputElement>('.sign-lib-id-input')!.value = 'poistettava'
      bodyQuery<HTMLInputElement>('.sign-lib-label-input')!.value = 'Poistettava'
      bodyQuery<HTMLButtonElement>('.sign-lib-save-btn')!.click()
    }

    function openCustomDotsModal(container: HTMLElement) {
      const dotsBtns = container.querySelectorAll<HTMLButtonElement>('.sign-lib-dots-btn')
      dotsBtns[dotsBtns.length - 1].click()
    }

    it('poisto-nappi poistaa mallin kirjastosta (window.confirm = true)', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
      const container = setup()
      const lib = seededLib()
      addCustom(container, lib)
      openCustomDotsModal(container)
      bodyQuery<HTMLButtonElement>('.modal-btn-destructive')!.click()
      expect(listTemplates(lib)).toHaveLength(seedCount())
    })

    it('poisto kutsuu onChange', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
      const container = setup()
      const lib = seededLib()
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
      const lib = seededLib()
      addCustom(container, lib)
      openCustomDotsModal(container)
      bodyQuery<HTMLButtonElement>('.modal-btn-destructive')!.click()
      expect(listTemplates(lib)).toHaveLength(seedCount() + 1)
    })

    it('poistettu malli ei näy listassa', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
      const container = setup()
      const lib = seededLib()
      addCustom(container, lib)
      openCustomDotsModal(container)
      bodyQuery<HTMLButtonElement>('.modal-btn-destructive')!.click()
      const rows = container.querySelectorAll('.sign-lib-row')
      expect(rows.length).toBe(seedCount())
    })
  })
})
