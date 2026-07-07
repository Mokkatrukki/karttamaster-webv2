import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSignLibrary, SignLibraryPanel } from '../src/ui/sign-library-panel'
import { createTemplate, listTemplates } from '../src/logic/sign-library'
import { signImageIds } from '../src/logic/sign-images'
import { signPreviewHtml } from '../src/ui/modal-helpers'

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('T178 — yhdistelmämerkin osat tukevat kuvaa (V107/V99)', () => {
  describe('osan lisäys-UI: Ikoni/Kuva-tabit', () => {
    it('"+ Lisää osa" avaa osapickerin jossa on Ikoni/Kuva-tabit (eri luokka kuin päävisualin tabit)', () => {
      const container = setup()
      new SignLibraryPanel(container, createSignLibrary(), vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
      const partTabs = document.body.querySelectorAll('.sign-part-visual-tab')
      expect(partTabs.length).toBe(2)
      expect(Array.from(partTabs).map(t => t.textContent)).toEqual(['Ikoni', 'Kuva'])
      // Ei saa törmätä päävisualin tab-laskentaan (T176-testi vaatii tasan 2)
      expect(document.body.querySelectorAll('.sign-visual-tab').length).toBe(2)
    })

    it('osan Kuva-tabissa on kaikki signImageIds()-kuvat', () => {
      const container = setup()
      new SignLibraryPanel(container, createSignLibrary(), vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-part-visual-tab')[1].click()
      const btns = document.body.querySelectorAll('.sign-lib-part-image-btn')
      expect(btns.length).toBe(signImageIds().length)
    })

    it('kuvan klikkaus osapickerissä lisää osan imageId:llä (ei iconId:tä)', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()
      document.body.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-part-visual-tab')[1].click()
      const firstImgBtn = document.body.querySelector<HTMLButtonElement>('.sign-lib-part-image-btn')!
      const imageId = firstImgBtn.dataset.imageId!
      firstImgBtn.click()
      document.body.querySelector<HTMLInputElement>('.sign-lib-id-input')!.value = 'combo-part-img-1'
      document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'ComboKuvaOsa'
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const t = listTemplates(lib).find(t => t.label === 'ComboKuvaOsa')!
      expect(t.parts).toEqual([{ imageId }])
    })
  })

  describe('kuva+kuva, kuva+ikoni, ikoni+kuva -yhdistelmät', () => {
    it('kaksi kuva-osaa tallentuu järjestyksessä (kuva+kuva)', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()

      document.body.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-part-visual-tab')[1].click()
      const imgBtns1 = document.body.querySelectorAll<HTMLButtonElement>('.sign-lib-part-image-btn')
      const firstId = imgBtns1[0].dataset.imageId!
      imgBtns1[0].click()

      document.body.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-part-visual-tab')[1].click()
      const imgBtns2 = document.body.querySelectorAll<HTMLButtonElement>('.sign-lib-part-image-btn')
      const secondId = imgBtns2[1].dataset.imageId!
      imgBtns2[1].click()

      document.body.querySelector<HTMLInputElement>('.sign-lib-id-input')!.value = 'combo-2img-2'
      document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'KaksiKuvaa'
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const t = listTemplates(lib).find(t => t.label === 'KaksiKuvaa')!
      expect(t.parts).toEqual([{ imageId: firstId }, { imageId: secondId }])
    })

    it('kuva+ikoni -yhdistelmä tallentuu järjestyksessä', () => {
      const container = setup()
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')!.click()

      document.body.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-part-visual-tab')[1].click()
      const imgBtn = document.body.querySelector<HTMLButtonElement>('.sign-lib-part-image-btn')!
      const imageId = imgBtn.dataset.imageId!
      imgBtn.click()

      document.body.querySelector<HTMLButtonElement>('.sign-lib-part-add-toggle')!.click()
      document.body.querySelectorAll<HTMLButtonElement>('.sign-part-visual-tab')[0].click()
      const iconBtn = document.body.querySelector<HTMLButtonElement>('.sign-lib-part-icon-btn')!
      const iconId = iconBtn.dataset.iconId!
      iconBtn.click()

      document.body.querySelector<HTMLInputElement>('.sign-lib-id-input')!.value = 'combo-mix-1'
      document.body.querySelector<HTMLInputElement>('.sign-lib-label-input')!.value = 'KuvaJaIkoni'
      document.body.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
      const t = listTemplates(lib).find(t => t.label === 'KuvaJaIkoni')!
      expect(t.parts).toEqual([{ imageId }, { iconId }])
    })
  })

  describe('osalistan rivi näyttää kuvan', () => {
    it('kuva-osan rivillä on <img>, ei "?"-fallback', () => {
      const container = setup()
      const lib = createSignLibrary()
      const imgId = signImageIds()[0]
      const t = createTemplate(lib, { label: 'Esikatselu', color: '#000', description: '', favorite: false, parts: [{ imageId: imgId }] }, 'esikatselu-1')
      new SignLibraryPanel(container, lib, vi.fn(), vi.fn())
      container.querySelector<HTMLButtonElement>(`.sign-lib-dots-btn[data-id="${t.id}"]`)!.click()
      const row = document.body.querySelector('.sign-lib-part-row')!
      expect(row.querySelector('img')).toBeTruthy()
      expect(row.textContent).not.toContain('?')
    })
  })

  describe('signPreviewHtml — iso esikatselu näyttää molemmat kuvat pinossa', () => {
    it('2 kuva-osaa → 2 <img>-elementtiä pinossa, jakoviiva välissä', () => {
      const ids = signImageIds()
      const html = signPreviewHtml({
        id: 'x', label: 'X', color: '#000',
        parts: [{ imageId: ids[0] }, { imageId: ids[1] }],
      })
      const div = document.createElement('div')
      div.innerHTML = html
      const imgs = div.querySelectorAll('img')
      expect(imgs.length).toBe(2)
      expect(imgs[0].getAttribute('src')).toContain(ids[0])
      expect(imgs[1].getAttribute('src')).toContain(ids[1])
      expect(html).toContain('border-top:1px solid var(--border-default)')
    })
  })
})
