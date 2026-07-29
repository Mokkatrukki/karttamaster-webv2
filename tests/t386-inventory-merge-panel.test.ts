// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderMergePanel, unlinkedItems, unlinkedCount, type MergeActionResult } from '../src/ui/inventory-merge-panel'
import { renderInventory } from '../src/ui/inventory-page'
import { dismissToast } from '../src/ui/toast'
import type { InventoryItem, InventoryLocation } from '../src/logic/inventory'
import type { SignTemplate } from '../src/logic/sign-library'

// T386/V277/V279/V276/V164/V21 — järjestäjän "Yhdistä"-työkalu. Vitest-jsdom.

const OK: MergeActionResult = { ok: true }

function item(over: Partial<InventoryItem> & { id: string; name: string }): InventoryItem {
  return { qty: 1, unit: null, location: null, note: null, locationId: null, templateId: null, notSign: false, ...over }
}

function tpl(id: string, label: string): SignTemplate {
  return { id, label, color: '#10b981', favorite: false } as SignTemplate
}

const LOCATIONS: InventoryLocation[] = [
  { id: 'karry', name: 'Kärry', sortOrder: 0 },
  { id: 'varasto', name: 'Kelkkavarasto', sortOrder: 1 },
]

function templateMap(...list: SignTemplate[]): Map<string, SignTemplate> {
  return new Map(list.map((t) => [t.id, t]))
}

function noopCallbacks(over: Partial<Parameters<typeof renderMergePanel>[2]> = {}): Parameters<typeof renderMergePanel>[2] {
  return {
    onLink: async () => OK,
    onNotSign: async () => OK,
    onUndo: async () => OK,
    onMerge: async () => OK,
    onCreateTemplate: () => {},
    onClose: () => {},
    ...over,
  }
}

const rowNames = (): string[] =>
  [...document.querySelectorAll('.inv-merge-row-name')].map((e) => e.textContent ?? '')

const countText = (): string => document.querySelector('.inv-merge-count')?.textContent ?? ''

beforeEach(() => {
  document.body.innerHTML = ''
})
afterEach(() => {
  dismissToast() // toast on moduulitason tila — ⊥ vuoda seuraavaan testiin
  document.body.innerHTML = ''
})

describe('T386 — lista näyttää vain linkittämättömät (V276/V279)', () => {
  const items = [
    item({ id: 'a', name: 'Kapeneva tie, kolmio' }),
    item({ id: 'b', name: 'Peikko', templateId: 'peikko-1' }), // jo linkattu
    item({ id: 'c', name: 'Taittopöytä', notSign: true }), // tarvike, LOPULLINEN tila
  ]

  it('unlinkedItems/unlinkedCount suodattaa linkatut & tarvikkeet', () => {
    expect(unlinkedItems(items).map((i) => i.id)).toEqual(['a'])
    expect(unlinkedCount(items)).toBe(1)
  })

  it('paneeli renderöi vain linkittämättömän rivin + laskurin', () => {
    renderMergePanel(document.body, { items, templates: templateMap(), locations: LOCATIONS }, noopCallbacks())
    expect(rowNames()).toEqual(['Kapeneva tie, kolmio'])
    expect(countText()).toBe('1 riviä')
  })

  it('tyhjätila kun kaikki kuitattu', () => {
    renderMergePanel(document.body, { items: items.slice(1), templates: templateMap(), locations: LOCATIONS }, noopCallbacks())
    expect(document.querySelector('.inv-merge-empty')?.textContent).toBe('Kaikki rivit yhdistetty ✓')
  })
})

describe('T386 — ehdotukset (T384-reuse)', () => {
  it('top-3 oikeassa järjestyksessä, paras ensin', () => {
    const templates = templateMap(
      tpl('t-muu', 'Pumppaamo'),
      tpl('t-exact', 'Ennakko oikea, 90'),
      tpl('t-lahi', 'Ennakko oikea, 135'),
      tpl('t-kolmas', 'Ennakko vasen, 90'),
      tpl('t-nelja', 'Ennakko vasen, 135'),
    )
    renderMergePanel(
      document.body,
      { items: [item({ id: 'a', name: 'Ennakko oikea, 90 irtokyltti' })], templates, locations: LOCATIONS },
      noopCallbacks(),
    )
    const sug = [...document.querySelectorAll<HTMLButtonElement>('.inv-merge-suggestion')]
    expect(sug.length).toBeLessThanOrEqual(3)
    expect(sug[0].dataset.templateId).toBe('t-exact') // V278: irtokyltti-suffiksi ei estä täsmäystä
  })

  it('ei osumia → "Ei ehdotuksia", ⊥ arvausta', () => {
    renderMergePanel(
      document.body,
      { items: [item({ id: 'a', name: 'Shuttle-bus aikataulu' })], templates: templateMap(tpl('t', 'Peikko')), locations: LOCATIONS },
      noopCallbacks(),
    )
    expect(document.querySelectorAll('.inv-merge-suggestion').length).toBe(0)
    expect(document.querySelector('.inv-merge-nosug')?.textContent).toBe('Ei ehdotuksia')
  })

  it('"Linkitä"-klikki kutsuu onLinkin oikealla template-id:llä & rivi katoaa listalta', async () => {
    const onLink = vi.fn(async (): Promise<MergeActionResult> => OK)
    renderMergePanel(
      document.body,
      { items: [item({ id: 'a', name: 'Peikko' })], templates: templateMap(tpl('peikko-1', 'Peikko')), locations: LOCATIONS },
      noopCallbacks({ onLink }),
    )
    document.querySelector<HTMLButtonElement>('.inv-merge-suggestion')!.click()
    await vi.waitFor(() => expect(rowNames()).toEqual([]))
    expect(onLink).toHaveBeenCalledTimes(1)
    expect(onLink.mock.calls[0][1]).toBe('peikko-1')
    expect(countText()).toBe('0 riviä')
  })
})

describe('T386 — "Ei merkki" (V279)', () => {
  it('poistaa rivin listalta & laskuri päivittyy', async () => {
    const onNotSign = vi.fn(async (): Promise<MergeActionResult> => OK)
    renderMergePanel(
      document.body,
      {
        items: [item({ id: 'a', name: 'Taittopöytä' }), item({ id: 'b', name: 'Peikko' })],
        templates: templateMap(),
        locations: LOCATIONS,
      },
      noopCallbacks({ onNotSign }),
    )
    expect(countText()).toBe('2 riviä')
    document.querySelector<HTMLButtonElement>('.inv-merge-notsign')!.click()
    await vi.waitFor(() => expect(rowNames()).toEqual(['Peikko']))
    expect(onNotSign).toHaveBeenCalledTimes(1)
    expect(countText()).toBe('1 riviä')
  })
})

describe('T386 — epäonnistunut pyyntö (V21)', () => {
  it('rivi JÄÄ listalle & virheteksti kertoo miksi', async () => {
    renderMergePanel(
      document.body,
      { items: [item({ id: 'a', name: 'Peikko' })], templates: templateMap(tpl('peikko-1', 'Peikko')), locations: LOCATIONS },
      noopCallbacks({ onLink: async () => ({ ok: false, error: 'Ei yhteyttä palvelimeen — rivi jäi listalle.' }) }),
    )
    document.querySelector<HTMLButtonElement>('.inv-merge-suggestion')!.click()
    await vi.waitFor(() => expect(document.querySelector('.inv-merge-error')).not.toBeNull())
    expect(rowNames()).toEqual(['Peikko']) // työ ⊥ katoa hiljaa
    expect(document.querySelector('.inv-merge-error')?.textContent).toContain('Ei yhteyttä')
  })
})

describe('T386 — duplikaattirivi → merge (T385)', () => {
  it('saman paikan sama nimi → "Yhdistä riviin X (N+M)"', () => {
    renderMergePanel(
      document.body,
      {
        items: [
          item({ id: 'a', name: 'Kapeneva tie, kolmio', qty: 4, locationId: 'karry' }),
          item({ id: 'b', name: 'Kapeneva tie kolmio', qty: 5, locationId: 'karry' }),
        ],
        templates: templateMap(),
        locations: LOCATIONS,
      },
      noopCallbacks(),
    )
    const dup = document.querySelector<HTMLButtonElement>('.inv-merge-dup')
    expect(dup?.textContent).toBe('Yhdistä riviin Kapeneva tie kolmio (4+5)')
  })

  it('ERI paikka ⊥ tarjoa mergeä (paikka on MERKITSEVÄ)', () => {
    renderMergePanel(
      document.body,
      {
        items: [
          item({ id: 'a', name: '26 asteen nousu', qty: 2, locationId: 'karry' }),
          item({ id: 'b', name: '26 asteen nousu', qty: 3, locationId: 'varasto' }),
        ],
        templates: templateMap(),
        locations: LOCATIONS,
      },
      noopCallbacks(),
    )
    expect(document.querySelector('.inv-merge-dup')).toBeNull()
  })

  it('merge-klikki kutsuu onMergen (source, target) & poistaa lähderivin', async () => {
    const onMerge = vi.fn(async (): Promise<MergeActionResult> => OK)
    renderMergePanel(
      document.body,
      {
        items: [
          item({ id: 'a', name: 'Huolto, service, 200m', qty: 5, locationId: 'karry' }),
          item({ id: 'b', name: 'Huolto service 200m', qty: 4, locationId: 'karry' }),
        ],
        templates: templateMap(),
        locations: LOCATIONS,
      },
      noopCallbacks({ onMerge }),
    )
    document.querySelector<HTMLButtonElement>('.inv-merge-dup')!.click()
    await vi.waitFor(() => expect(rowNames()).toEqual(['Huolto service 200m']))
    expect(onMerge.mock.calls[0][0].id).toBe('a')
    expect(onMerge.mock.calls[0][1].id).toBe('b')
  })
})

describe('T386 — V277-regressiovahti: ⊥ massanappia', () => {
  it('DOM:issa ⊥ ole "linkitä kaikki" -tyyppistä nappia eikä esivalintaa', () => {
    renderMergePanel(
      document.body,
      {
        items: [item({ id: 'a', name: 'Peikko' }), item({ id: 'b', name: 'Pumppaamo' })],
        templates: templateMap(tpl('t1', 'Peikko'), tpl('t2', 'Pumppaamo')),
        locations: LOCATIONS,
      },
      noopCallbacks(),
    )
    const texts = [...document.querySelectorAll('button')].map((b) => (b.textContent ?? '').toLowerCase())
    for (const t of texts) {
      expect(t).not.toContain('kaikki varmat')
      expect(t.startsWith('linkitä kaikki')).toBe(false)
    }
    // ⊥ esivalintaa: yksikään ehdotus ⊥ ole valmiiksi valittu / checkedina.
    expect(document.querySelectorAll('input[type=checkbox]').length).toBe(0)
    expect(document.querySelectorAll('.inv-merge-suggestion[aria-pressed=true]').length).toBe(0)
  })
})

describe('T386 — V164 XSS-vahti', () => {
  it('<script>-niminen rivi ⊥ suoriudu — nimi on tekstiä', () => {
    const evil = '<script>window.__pwned = 1</script>'
    renderMergePanel(
      document.body,
      { items: [item({ id: 'a', name: evil })], templates: templateMap(), locations: LOCATIONS },
      noopCallbacks(),
    )
    expect(document.querySelectorAll('script').length).toBe(0)
    expect(document.querySelector('.inv-merge-row-name')?.textContent).toBe(evil)
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
  })
})

describe('T386 — headerin "🔗 Yhdistä (N)" -nappi', () => {
  const view = (mode: 'read' | 'edit', unlinked: number) => ({
    locations: LOCATIONS,
    items: [] as InventoryItem[],
    selectedLocationId: 'karry',
    templates: templateMap(),
    viewMode: mode,
    unlinkedCount: unlinked,
  })
  const cb = { onSelectLocation: () => {}, onAddLocation: () => true, onAddItem: () => true, onEditItem: () => true, onDeleteItem: () => {} }

  it('näkyy edit-modessa laskurin kanssa', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    renderInventory(host, view('edit', 12), { ...cb, onOpenMerge: () => {} })
    const btn = document.querySelector<HTMLButtonElement>('.inv-merge-open')
    expect(btn?.textContent).toBe('🔗 Yhdistä (12)')
    expect(btn?.disabled).toBe(false)
  })

  it('⊥ näy read-modessa (V169)', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    renderInventory(host, view('read', 12), { ...cb, onOpenMerge: () => {} })
    expect(document.querySelector('.inv-merge-open')).toBeNull()
  })

  it('N=0 → nappi disabloitu (työ on valmis)', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    renderInventory(host, view('edit', 0), { ...cb, onOpenMerge: () => {} })
    expect(document.querySelector<HTMLButtonElement>('.inv-merge-open')?.disabled).toBe(true)
  })
})
