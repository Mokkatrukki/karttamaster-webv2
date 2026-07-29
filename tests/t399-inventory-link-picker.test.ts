// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mountInventoryLinkPicker } from '../src/ui/inventory-link-picker'
import { SignTemplateModal } from '../src/ui/sign-template-modal'
import { createLibrary } from '../src/logic/sign-library'
import type { InventoryLinkRow } from '../src/logic/inventory-link'

// T399/V288/V289/V164 — varastolinkki merkkipohjan luonnissa. Vitest-jsdom.

const ROWS: InventoryLinkRow[] = [
  { id: 'i1', name: 'Shuttle-bus aikataulu', qty: 1, locationName: 'Kelkkavarasto' },
  { id: 'i2', name: 'Shuttle-bus opaste', qty: 1, locationName: 'Kelkkavarasto' },
  { id: 'i3', name: 'Nuoli irtokyltti, valkoinen tausta', qty: 18, locationName: 'Kärry' },
  { id: 'i4', name: 'Peikko, kolmio irtokyltti', qty: 4, locationName: 'Kärry' },
]

let host: HTMLElement
let label: HTMLInputElement

/** Picker + fake nimikenttä. Odottaa rows()-lupauksen ratkeamisen. */
async function mount(rows: InventoryLinkRow[] = ROWS, initialLabel = ''): ReturnType<typeof mountInventoryLinkPicker> extends infer R ? Promise<R> : never {
  label.value = initialLabel
  const handle = mountInventoryLinkPicker(host, {
    rows: async () => rows,
    getLabel: () => label.value,
    setLabel: (v) => { label.value = v },
  })
  await vi.waitFor(() => expect(host.querySelector('.inv-link-browse')).not.toBeNull())
  return handle
}

const suggestionNames = (): string[] =>
  [...host.querySelectorAll('.inv-link-suggestion .inv-link-row-name')].map((e) => e.textContent ?? '')

beforeEach(() => {
  document.body.innerHTML = ''
  host = document.createElement('div')
  label = document.createElement('input')
  document.body.append(host, label)
})
afterEach(() => { document.body.innerHTML = '' })

describe('T399 — ehdotuskaista', () => {
  it('hakusana "bus" näyttää osumat, paras ensin', async () => {
    const h = await mount(ROWS, 'bus')
    h.refresh()
    await vi.waitFor(() => expect(suggestionNames().length).toBeGreaterThan(0))
    expect(suggestionNames()).toContain('Shuttle-bus aikataulu')
    expect(suggestionNames().length).toBeLessThanOrEqual(3)
  })

  it('ei osumia → kaista piilossa, ⊥ tyhjää laatikkoa (selauslinkki jää)', async () => {
    const h = await mount(ROWS, 'Taittopöytä')
    h.refresh()
    await new Promise((r) => setTimeout(r, 200))
    expect(host.querySelectorAll('.inv-link-suggestion').length).toBe(0)
    expect(host.querySelector('.inv-link-browse')).not.toBeNull()
  })

  it('rivin meta näyttää määrän ja paikan', async () => {
    const h = await mount(ROWS, 'Nuoli')
    h.refresh()
    await vi.waitFor(() => expect(host.querySelector('.inv-link-row-meta')).not.toBeNull())
    expect(host.querySelector('.inv-link-row-meta')?.textContent).toBe('18 kpl · Kärry')
  })
})

describe('T399 — valinta (V288: ⊥ heti-kirjoitus)', () => {
  it('valinta näyttää chipin & täyttää nimen SIIVOTTUNA', async () => {
    const h = await mount(ROWS, 'Nuoli')
    h.refresh()
    await vi.waitFor(() => expect(host.querySelector('.inv-link-suggestion')).not.toBeNull())
    host.querySelector<HTMLButtonElement>('.inv-link-suggestion')!.click()

    expect(h.selected()?.id).toBe('i3')
    expect(host.querySelector('.inv-link-chip-text')?.textContent).toBe('Linkitetään: Nuoli irtokyltti, valkoinen tausta (18 kpl)')
    expect(label.value).toBe('Nuoli, valkoinen tausta') // irtokyltti pois, pilkku säilyy
  })

  it('hakusana ylikirjoitetaan — "bus" ⊥ ole nimi', async () => {
    const h = await mount(ROWS, 'bus')
    h.refresh()
    await vi.waitFor(() => expect(host.querySelector('.inv-link-suggestion')).not.toBeNull())
    host.querySelector<HTMLButtonElement>('.inv-link-suggestion')!.click()
    expect(label.value).not.toBe('bus')
    expect(label.value).toContain('Shuttle-bus')
  })

  it('"Poista valinta" palauttaa ehdotukset', async () => {
    const h = await mount(ROWS, 'Peikko')
    h.refresh()
    await vi.waitFor(() => expect(host.querySelector('.inv-link-suggestion')).not.toBeNull())
    host.querySelector<HTMLButtonElement>('.inv-link-suggestion')!.click()
    expect(h.selected()).not.toBeNull()

    host.querySelector<HTMLButtonElement>('.inv-link-chip-clear')!.click()
    expect(h.selected()).toBeNull()
    expect(host.querySelector('.inv-link-chip-text')).toBeNull()
  })
})

describe('T399 — selauslista', () => {
  it('avaa kaikki rivit & suodattaa haulla', async () => {
    await mount()
    expect(host.querySelector('.inv-link-browse')?.textContent).toBe('Näytä kaikki varastorivit (4)')
    host.querySelector<HTMLButtonElement>('.inv-link-browse')!.click()

    const browser = document.querySelector('.inv-link-browser')!
    expect(browser.querySelectorAll('.inv-link-browser-row').length).toBe(4)

    const search = browser.querySelector<HTMLInputElement>('.inv-sign-search')!
    search.value = 'peikko'
    search.dispatchEvent(new Event('input'))
    expect(browser.querySelectorAll('.inv-link-browser-row').length).toBe(1)
  })

  it('valinta listasta sulkee listan & täyttää nimen siivottuna', async () => {
    const h = await mount()
    host.querySelector<HTMLButtonElement>('.inv-link-browse')!.click()
    const rows = document.querySelectorAll<HTMLButtonElement>('.inv-link-browser-row')
    rows[3].click() // Peikko, kolmio irtokyltti
    expect(document.querySelector('.inv-link-browser')).toBeNull()
    expect(h.selected()?.id).toBe('i4')
    expect(label.value).toBe('Peikko, kolmio')
  })
})

describe('T399 — V289: osio on valinnainen laajennus', () => {
  it('tyhjä rivilista → ⊥ osiota DOM:issa', async () => {
    mountInventoryLinkPicker(host, { rows: async () => [], getLabel: () => '', setLabel: () => {} })
    await new Promise((r) => setTimeout(r, 20))
    expect(host.querySelector('.inv-link-browse')).toBeNull()
    expect(host.querySelector('.inv-link-suggestion')).toBeNull()
  })

  it('haku hylkää (403/verkko) → ⊥ osiota & ⊥ virhettä DOM:issa', async () => {
    mountInventoryLinkPicker(host, {
      rows: () => Promise.reject(new Error('403')),
      getLabel: () => '',
      setLabel: () => {},
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(host.textContent).toBe('')
  })
})

describe('T399 — V164 XSS-vahti', () => {
  it('<script>-niminen rivi ⊥ suoriudu', async () => {
    const evil = '<script>window.__pwned2 = 1</script>'
    await mount([{ id: 'x', name: evil, qty: 1 }])
    host.querySelector<HTMLButtonElement>('.inv-link-browse')!.click()
    expect(document.querySelectorAll('script').length).toBe(0)
    expect(document.querySelector('.inv-link-browser-row .inv-link-row-name')?.textContent).toBe(evil)
    expect((window as unknown as { __pwned2?: number }).__pwned2).toBeUndefined()
  })
})

describe('T399 — SignTemplateModal-integraatio (V288/V289)', () => {
  const openModal = (over: Record<string, unknown> = {}) => {
    const lib = createLibrary()
    const onSaveTemplate = vi.fn()
    const onLinkInventory = vi.fn(async () => {})
    const modal = new SignTemplateModal(lib, {
      onChanged: () => {},
      onSaveTemplate,
      onLinkInventory,
      inventoryRows: async () => ROWS,
      ...over,
    })
    modal.open(null)
    return { modal, onSaveTemplate, onLinkInventory }
  }

  it('V289: ilman inventoryRows-callbackia ⊥ osiota DOM:issa', async () => {
    const lib = createLibrary()
    new SignTemplateModal(lib, { onChanged: () => {}, onSaveTemplate: vi.fn() }).open(null)
    await new Promise((r) => setTimeout(r, 20))
    expect(document.querySelector('.inv-link-browse')).toBeNull()
  })

  it('⊥ osiota muokkaustilassa (template ≠ null)', async () => {
    const lib = createLibrary()
    const modal = new SignTemplateModal(lib, { onChanged: () => {}, inventoryRows: async () => ROWS })
    modal.open({ id: 't1', label: 'Peikko', color: '#000', favorite: false } as never)
    await new Promise((r) => setTimeout(r, 20))
    expect(document.querySelector('.inv-link-browse')).toBeNull()
  })

  it('V288: peruutus ⊥ kutsu onLinkInventorya', async () => {
    const { onLinkInventory } = openModal()
    await vi.waitFor(() => expect(document.querySelector('.inv-link-browse')).not.toBeNull())
    document.querySelector<HTMLButtonElement>('.inv-link-browse')!.click()
    document.querySelectorAll<HTMLButtonElement>('.inv-link-browser-row')[0].click()

    document.querySelector<HTMLButtonElement>('.sign-lib-cancel-btn')!.click()
    await new Promise((r) => setTimeout(r, 20))
    expect(onLinkInventory).not.toHaveBeenCalled()
  })

  it('tallennus kutsuu onLinkInventoryn valitulla id:llä VASTA onSaveTemplaten jälkeen', async () => {
    const order: string[] = []
    const onSaveTemplate = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 30)) // hidas POST templates
      order.push('save')
    })
    const onLinkInventory = vi.fn(async () => { order.push('link') })
    const { modal } = openModal({ onSaveTemplate, onLinkInventory })
    void modal
    await vi.waitFor(() => expect(document.querySelector('.inv-link-browse')).not.toBeNull())
    document.querySelector<HTMLButtonElement>('.inv-link-browse')!.click()
    document.querySelectorAll<HTMLButtonElement>('.inv-link-browser-row')[0].click()

    // Nimi täyttyi valinnasta → slug syntyi → tallennus kelpaa
    expect(document.querySelector<HTMLInputElement>('.sign-lib-id-input')!.value.length).toBeGreaterThan(0)
    document.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()

    await vi.waitFor(() => expect(onLinkInventory).toHaveBeenCalled())
    expect(onLinkInventory.mock.calls[0][0]).toBe('i1')
    expect(order).toEqual(['save', 'link']) // ⊥ kilpa-ajoa: PUT vasta kun template on kannassa
  })

  it('ilman valintaa tallennus ⊥ kutsu onLinkInventorya', async () => {
    const { onLinkInventory } = openModal()
    await vi.waitFor(() => expect(document.querySelector('.inv-link-browse')).not.toBeNull())
    const labelInput = document.querySelector<HTMLInputElement>('.sign-lib-label-input')!
    labelInput.value = 'Käsin kirjoitettu'
    labelInput.dispatchEvent(new Event('input'))
    document.querySelector<HTMLButtonElement>('.sign-lib-save-btn')!.click()
    await new Promise((r) => setTimeout(r, 30))
    expect(onLinkInventory).not.toHaveBeenCalled()
  })
})
