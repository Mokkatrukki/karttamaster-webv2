// @vitest-environment jsdom
// T344/V250 — sivupalkin rivin nimi on sisääntulo, ja modaalissa on YKSI tallennusmalli.
// Nämä testit hajoavat jos footer alkaa taas luvata tallennusta jota se ei tee, tai jos
// vaaravyöhyke palaa footerin alle.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { SegmentStore } from '../src/logic/segments'

const flush = () => new Promise(r => setTimeout(r, 0))

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const store: SegmentStore = createSegmentStore()
  createSegment(store, {
    routeIds: ['35km'], startDist: 5000, endDist: 12000, equipment: [],
    phase: 'asettaminen', displayName: 'Testipätkä', description: 'Kuvaus',
  })
  const panel = new SegmentPanel(container, [], store, vi.fn(), { getMarkers: () => [] })
  return { container, store, panel }
}

describe('T344/V250 — pätkärivin nimi avaa lisätiedot', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    let ls: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => ls[k] ?? null,
      setItem: (k: string, v: string) => { ls[k] = v },
      removeItem: (k: string) => { delete ls[k] },
      clear: () => { ls = {} },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('nimi on button eikä span — koko nimialue on klikattava', () => {
    setup()
    const info = document.querySelector('.segment-info')!
    expect(info.tagName).toBe('BUTTON')
    expect(info.getAttribute('aria-label')).toContain('Testipätkä')
  })

  it('nimen klikkaus avaa SegmentDetailsModalin', () => {
    setup()
    document.querySelector<HTMLButtonElement>('.segment-info')!.click()
    expect(document.querySelector('.segment-details-modal')).not.toBeNull()
  })

  it('modaali avautuu VAIN kerran — li:llä ei omaa kuuntelijaa (ei tuplalaukaisua)', () => {
    setup()
    document.querySelector<HTMLButtonElement>('.segment-info')!.click()
    expect(document.querySelectorAll('.segment-details-modal')).toHaveLength(1)
    expect(document.querySelectorAll('.segment-details-modal-backdrop')).toHaveLength(1)
  })

  it('··· säilyy toisena sisääntulona (T345: avaa pikavalikon, ei suoraan modaalia)', () => {
    setup()
    document.querySelector<HTMLButtonElement>('.btn-segment-details-open')!.click()
    const details = [...document.querySelectorAll<HTMLButtonElement>('.segment-row-menu-item')]
      .find(b => b.textContent?.includes('Lisätiedot'))!
    details.click()
    expect(document.querySelector('.segment-details-modal')).not.toBeNull()
  })
})

describe('T344/V250 — yksi tallennusmalli modaalissa', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    let ls: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => ls[k] ?? null,
      setItem: (k: string, v: string) => { ls[k] = v },
      removeItem: (k: string) => { delete ls[k] },
      clear: () => { ls = {} },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('nimi tallentuu blurilla ILMAN footeria', async () => {
    const { store } = setup()
    const segId = [...store.keys()][0]
    document.querySelector<HTMLButtonElement>('.segment-info')!.click()

    const input = document.querySelector<HTMLInputElement>('.segment-details-name-input')!
    input.value = 'Uusi nimi'
    input.dispatchEvent(new Event('blur'))
    await flush()

    expect(store.get(segId)!.displayName).toBe('Uusi nimi')
  })

  it('kuvaus tallentuu muutoksesta ILMAN footeria', async () => {
    const { store } = setup()
    const segId = [...store.keys()][0]
    document.querySelector<HTMLButtonElement>('.segment-info')!.click()

    const desc = document.querySelector<HTMLTextAreaElement>('.segment-desc-input')!
    desc.value = 'Uusi ohje'
    desc.dispatchEvent(new Event('change'))
    await flush()

    expect(store.get(segId)!.description).toBe('Uusi ohje')
  })

  it('footer sanoo "Valmis" — ei lupaa tallennusta jota se ei tee', () => {
    setup()
    document.querySelector<HTMLButtonElement>('.segment-info')!.click()
    const footerBtn = document.querySelector<HTMLButtonElement>('.segment-details-modal-footer button')!
    expect(footerBtn.textContent).toBe('Valmis')
  })

  it('footer sulkee modaalin', () => {
    setup()
    document.querySelector<HTMLButtonElement>('.segment-info')!.click()
    document.querySelector<HTMLButtonElement>('.segment-details-modal-footer button')!.click()
    expect(document.querySelector('.segment-details-modal')).toBeNull()
  })

  it('vaaravyöhyke on rungon SISÄLLÄ ennen footeria (⊥ footerin alla)', () => {
    setup()
    document.querySelector<HTMLButtonElement>('.segment-info')!.click()

    const body = document.querySelector('.segment-details-modal-body')!
    const danger = document.querySelector('.segment-modal-danger-zone')!
    const footer = document.querySelector('.segment-details-modal-footer')!

    expect(body.contains(danger)).toBe(true)
    // DOM-järjestys: vaaravyöhyke ennen footeria
    expect(danger.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
