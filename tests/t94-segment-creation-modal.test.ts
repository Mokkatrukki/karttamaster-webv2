// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { SegmentStore } from '../src/logic/segments'

const ROUTE_POINTS = [
  { lat: 65.0, lon: 25.0, distanceFromStart: 0 },
  { lat: 65.1, lon: 25.1, distanceFromStart: 5000 },
  { lat: 65.2, lon: 25.2, distanceFromStart: 10000 },
]

const ROUTES = [{ id: 'r1', routePoints: ROUTE_POINTS }]

function setup(store?: SegmentStore) {
  const s = store ?? createSegmentStore()
  const container = document.createElement('div')
  document.body.appendChild(container)

  const callbacks = {
    onEnterCreationMode: vi.fn(),
    onExitCreationMode: vi.fn(),
    onShowSnapMarkers: vi.fn(),
    onHideSnapMarkers: vi.fn(),
    onFirstPoint: vi.fn(),
    onFirstPointClear: vi.fn(),
    onNotify: vi.fn(),
  }

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
  vi.stubGlobal('crypto', { randomUUID: () => 'test-id-' + Math.random() })

  const panel = new SegmentPanel(container, ROUTES, s, vi.fn(), callbacks)
  // Expand panel so footer button (#btn-segment-create) is rendered
  container.querySelector<HTMLElement>('.segment-panel-header')!.click()
  return { panel, store: s, callbacks, container }
}

describe('T94 — pätkäluonti-modal tilakone', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('aluksi ei modaalia', () => {
    setup()
    expect(document.querySelector('.segment-creation-modal')).toBeNull()
  })

  it('isCreationMode() false alussa', () => {
    const { panel } = setup()
    expect(panel.isCreationMode()).toBe(false)
  })

  it('"Luo uusi pätkä" avaa modaalin ja kutsuu onEnterCreationMode', () => {
    const { callbacks } = setup()
    const createBtn = document.querySelector('#btn-segment-create') as HTMLButtonElement
    createBtn.click()
    expect(document.querySelector('[data-testid="creation-modal"]')).toBeTruthy()
    expect(callbacks.onEnterCreationMode).toHaveBeenCalledOnce()
    expect(callbacks.onShowSnapMarkers).toHaveBeenCalledOnce()
  })

  it('isCreationMode() true vaihe1:ssä', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    expect(panel.isCreationMode()).toBe(true)
  })

  it('vaihe1: näyttää ohjetekstin aloituspisteestä', () => {
    setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    const modal = document.querySelector('.segment-creation-modal')!
    expect(modal.textContent).toContain('Klikkaa kartalta pätkän aloituspiste')
  })

  it('peruuta-nappi sulkee modaalin ja palauttaa idle', () => {
    const { panel, callbacks } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    const cancelBtn = document.querySelector('.segment-creation-modal-cancel') as HTMLButtonElement
    cancelBtn.click()
    expect(document.querySelector('.segment-creation-modal')).toBeNull()
    expect(panel.isCreationMode()).toBe(false)
    expect(callbacks.onExitCreationMode).toHaveBeenCalledOnce()
    expect(callbacks.onHideSnapMarkers).toHaveBeenCalledOnce()
  })

  it('cancelCreation() sulkee modaalin ja palauttaa idle', () => {
    const { panel, callbacks } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.cancelCreation()
    expect(document.querySelector('.segment-creation-modal')).toBeNull()
    expect(panel.isCreationMode()).toBe(false)
    expect(callbacks.onExitCreationMode).toHaveBeenCalledOnce()
  })

  it('Esc sulkee modaalin', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    expect(panel.isCreationMode()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(panel.isCreationMode()).toBe(false)
  })

  // T362/B144: kahden klikin sopimus korvattiin ankkuriketjulla. Vanhat testit kuvasivat
  // flowta jossa 2. klikki päätti pätkän & km luettiin globaalista lähimmästä pisteestä —
  // juuri se arvaus jonka B144 kirjaa. Nämä testaavat uutta sopimusta.

  it('ensimmäinen mapClick lukitsee reitin ja NÄYTTÄÄ sen (B144(a))', () => {
    const { panel, callbacks } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)

    expect(callbacks.onFirstPoint).toHaveBeenCalledOnce()
    const modal = document.querySelector('.segment-creation-modal')!
    // Reitti näkyvissä — hiljainen valinta oli puolet bugista.
    expect(document.querySelector('[data-testid="creation-route"]')!.textContent).toContain('r1')
    expect(modal.textContent).toContain('Alku: 0.0 km')
    expect(modal.textContent).toContain('Klikkaa reittiä pitkin eteenpäin')
  })

  it('"Valmis" on disabloitu yhdellä ankkurilla, aukeaa toisesta (V258)', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)
    expect((document.querySelector('.btn-segment-path-done') as HTMLButtonElement).disabled).toBe(true)

    panel.onMapClick(65.2, 25.2)
    expect((document.querySelector('.btn-segment-path-done') as HTMLButtonElement).disabled).toBe(false)
  })

  it('välipisteet näkyvät listassa km:ineen', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.1, 25.1)
    panel.onMapClick(65.2, 25.2)

    const items = [...document.querySelectorAll('.segment-creation-anchor')].map(el => el.textContent)
    expect(items).toEqual(['Alku: 0.0 km', 'Välipiste 1: 5.0 km', 'Loppu: 10.0 km'])
  })

  it('"Poista viimeinen" peruu ankkurin — virhe on korjattavissa ilman uutta aloitusta', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.1, 25.1)
    expect(document.querySelectorAll('.segment-creation-anchor')).toHaveLength(2)

    ;(document.querySelector('.btn-segment-anchor-undo') as HTMLButtonElement).click()
    expect(document.querySelectorAll('.segment-creation-anchor')).toHaveLength(1)
    // Ensimmäistä ⊥ voi poistaa: ilman sitä reitti ⊥ ole lukittu (Peruuta on se ulospääsy).
    expect((document.querySelector('.btn-segment-anchor-undo') as HTMLButtonElement).disabled).toBe(true)
  })

  it('"Valmis" siirtää tiedot-vaiheeseen', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.2, 25.2)
    ;(document.querySelector('.btn-segment-path-done') as HTMLButtonElement).click()

    expect(document.querySelector('.segment-creation-modal')!.textContent).toContain('Tallenna')
  })

  it('klikki joka ei osu reitille eteenpäin näyttää virheen (B144(b))', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.2, 25.2) // viimeinen piste — eteenpäin ei ole mitään
    panel.onMapClick(65.0, 25.0) // TAAKSEPÄIN → ei osumaa

    const errorEl = document.querySelector('.segment-creation-error') as HTMLElement
    expect(errorEl.hidden).toBe(false)
    expect(errorEl.textContent).toContain('eteenpäin')
    // Tila säilyy: ankkuri ⊥ katoa virheellisestä klikistä.
    expect(document.querySelectorAll('.segment-creation-anchor')).toHaveLength(1)
  })

  it('päällekkäisyys on VAROITUS ei este (V25/V259)', () => {
    const store = createSegmentStore()
    createSegment(store, { routeIds: ['r1'], startDist: 0, endDist: 6000, equipment: [], phase: 'asettaminen' }, 'existing')
    const { panel, callbacks } = setup(store)
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.1, 25.1)
    ;(document.querySelector('.btn-segment-path-done') as HTMLButtonElement).click()

    // Luonti ETENEE — jaettu korridori on laillinen & jäsenyys ratkeaa lähimmällä jäljellä.
    expect(document.querySelector('.segment-creation-modal')!.textContent).toContain('Tallenna')
    expect(callbacks.onNotify).toHaveBeenCalledWith(expect.stringContaining('päällekkäin'))
  })

  it('tallennettu pätkä saa jäljen ankkureista (V258)', () => {
    const { panel, store } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.2, 25.2)
    ;(document.querySelector('.btn-segment-path-done') as HTMLButtonElement).click()
    ;(document.querySelector('.btn-segment-creation-save') as HTMLButtonElement).click()

    const seg = [...store.values()][0]
    expect(seg.track).toHaveLength(3)
    expect(seg.track![0].d).toBe(0)
    expect(seg.startDist).toBe(0)
    expect(seg.endDist).toBe(10000)
  })

  it('tiedot-vaiheessa mapClick ei tee mitään', () => {
    const { panel } = setup()
    ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.2, 25.2)
    ;(document.querySelector('.btn-segment-path-done') as HTMLButtonElement).click()

    expect(document.querySelector('.btn-segment-creation-save')).toBeTruthy()
    const beforeHtml = document.querySelector('.segment-creation-modal')!.innerHTML
    panel.onMapClick(65.1, 25.1) // should be ignored
    expect(document.querySelector('.segment-creation-modal')!.innerHTML).toBe(beforeHtml)
  })
})
