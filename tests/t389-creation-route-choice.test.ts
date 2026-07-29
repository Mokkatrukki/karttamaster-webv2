// @vitest-environment jsdom
//
// T389/V281/B164: ensiklikki lukitsi reitin jota ⊥ voinut vaihtaa. Kaksi ulospääsyä samaan
// ongelmaan: reittisuodatin rajaa ehdokkaat & modaalin pillerit vaihtavat reitin kesken luonnin.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore } from '../src/logic/segments'

// Kaksi reittiä ~30 m päässä toisistaan (lat-ero 0.0003 ≈ 33 m) — sama tilanne kuin SMTB:n
// kolmella reitillä: kärkipisteiden metrien ero ratkaisisi reitin ilman tätä korjausta.
const A_POINTS = [
  { lat: 65.0, lon: 25.0, distanceFromStart: 0 },
  { lat: 65.1, lon: 25.1, distanceFromStart: 5000 },
  { lat: 65.2, lon: 25.2, distanceFromStart: 10000 },
]
const B_POINTS = A_POINTS.map(p => ({ ...p, lat: p.lat + 0.0003 }))

const ROUTES = [
  { id: 'r1', label: 'Reitti 55', routePoints: A_POINTS },
  { id: 'r2', label: 'Reitti 125', routePoints: B_POINTS },
]

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const callbacks = {
    onEnterCreationMode: vi.fn(),
    onExitCreationMode: vi.fn(),
    onShowSnapMarkers: vi.fn(),
    onHideSnapMarkers: vi.fn(),
    onAnchorsChanged: vi.fn(),
    onAnchorsClear: vi.fn(),
    onNotify: vi.fn(),
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
  vi.stubGlobal('crypto', { randomUUID: () => 'test-id-' + Math.random() })

  const panel = new SegmentPanel(container, ROUTES, createSegmentStore(), vi.fn(), callbacks)
  container.querySelector<HTMLElement>('.segment-panel-header')!.click()
  return { panel, callbacks }
}

function startCreation() {
  ;(document.querySelector('#btn-segment-create') as HTMLButtonElement).click()
}

const routeText = () => document.querySelector('[data-testid="creation-route"]')!.textContent!
const pills = () => [...document.querySelectorAll('.segment-creation-route-choice')] as HTMLButtonElement[]

describe('T389/V281 — reitin valinta luonnissa', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('B164: piilotettua reittiä ⊥ lukita ensiklikissä — suodatin ON reittivalinta', () => {
    const { panel } = setup()
    // Klikki osuu tarkalleen r1:n pisteeseen, mutta r1 on piilotettu ∴ r2 lukittuu.
    panel.setVisibleRoutes(['r2'])
    startCreation()
    panel.onMapClick(65.0, 25.0)
    expect(routeText()).toContain('Reitti 125')
  })

  it('ilman suodatinta lähin voittaa (ennallaan)', () => {
    const { panel } = setup()
    startCreation()
    panel.onMapClick(65.0, 25.0)
    expect(routeText()).toContain('Reitti 55')
  })

  it('kaikki reitit piilotettu → luonti toimii silti (⊥ umpikujaa)', () => {
    const { panel } = setup()
    panel.setVisibleRoutes([])
    startCreation()
    panel.onMapClick(65.0, 25.0)
    expect(document.querySelector('[data-testid="creation-route"]')).not.toBeNull()
  })

  it('pillerit näkyvät kun ehdokkaita ≥2, aktiivinen on lukittu reitti', () => {
    const { panel } = setup()
    startCreation()
    panel.onMapClick(65.0, 25.0)
    const ids = pills().map(p => p.dataset.routeId)
    expect(ids).toEqual(['r1', 'r2'])
    expect(pills().find(p => p.classList.contains('active'))!.dataset.routeId).toBe('r1')
  })

  it('yhdellä ehdokkaalla ⊥ pillereitä (⊥ kohinaa)', () => {
    const { panel } = setup()
    panel.setVisibleRoutes(['r1'])
    startCreation()
    panel.onMapClick(65.0, 25.0)
    expect(pills()).toHaveLength(0)
  })

  it('pillerin klikki vaihtaa reitin, nollaa ankkurit & päivittää kartan', () => {
    const { panel, callbacks } = setup()
    startCreation()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.1, 25.1)
    expect(document.querySelectorAll('.segment-creation-anchor')).toHaveLength(2)
    callbacks.onAnchorsChanged.mockClear()

    pills().find(p => p.dataset.routeId === 'r2')!.click()

    expect(routeText()).toContain('Reitti 125')
    // Nollaus ! näkyä — toisen reitin pisteindeksi ⊥ tarkoita samaa maastoa (V258/B144).
    expect(document.querySelectorAll('.segment-creation-anchor')).toHaveLength(1)
    expect(callbacks.onAnchorsChanged).toHaveBeenCalledOnce()
    expect((callbacks.onAnchorsChanged.mock.calls[0][0] as unknown[])).toHaveLength(1)
  })

  it('vaihdon jälkeen luonti jatkuu UUDELLA reitillä & tallennettu pätkä on sen jäsen', () => {
    const { panel } = setup()
    startCreation()
    panel.onMapClick(65.0, 25.0)
    pills().find(p => p.dataset.routeId === 'r2')!.click()
    panel.onMapClick(65.2, 25.2)

    expect((document.querySelector('.btn-segment-path-done') as HTMLButtonElement).disabled).toBe(false)
    ;(document.querySelector('.btn-segment-path-done') as HTMLButtonElement).click()
    ;(document.querySelector('.btn-segment-creation-save') as HTMLButtonElement).click()

    const store = [...(panel as unknown as { store: Map<string, { primaryRouteId?: string }> }).store.values()]
    expect(store).toHaveLength(1)
    expect(store[0].primaryRouteId).toBe('r2')
  })

  it('saman reitin pilleri ⊥ nollaa ankkureita', () => {
    const { panel } = setup()
    startCreation()
    panel.onMapClick(65.0, 25.0)
    panel.onMapClick(65.1, 25.1)
    pills().find(p => p.dataset.routeId === 'r1')!.click()
    expect(document.querySelectorAll('.segment-creation-anchor')).toHaveLength(2)
  })
})
