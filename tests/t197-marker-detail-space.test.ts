import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LeftPanel } from '../src/ui/left-panel'
import { MarkerDetailModal } from '../src/ui/marker-detail-modal'
import { renderMarkerList } from '../src/ui/marker-list'
import type { SignMarker } from '../src/logic/types'

// localStorage-mock (Node v26 konflikti — CLAUDE.md)
const lsStore: Record<string, string> = {}
beforeEach(() => {
  for (const k in lsStore) delete lsStore[k]
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => lsStore[k] ?? null,
    setItem: (k: string, v: string) => { lsStore[k] = v },
    removeItem: (k: string) => { delete lsStore[k] },
    clear: () => { for (const k in lsStore) delete lsStore[k] },
  })
})
afterEach(() => vi.unstubAllGlobals())

function setWidth(w: number): void {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true })
}

const makeMarker = (o: Partial<SignMarker> = {}): SignMarker => ({
  id: 'm1',
  type: 'right',
  lat: 63.0,
  lon: 27.0,
  distanceFromStart: 1500,
  routeIds: ['35km'],
  status: 'suunniteltu',
  ...o,
})

const makeManager = (marker: SignMarker) => ({
  getAll: vi.fn(() => [marker]),
  updateNote: vi.fn(),
  updateStatus: vi.fn(),
  bulkSetStatus: vi.fn(),
  updateType: vi.fn(),
  remove: vi.fn(),
  panTo: vi.fn(),
  updateDescription: vi.fn(),
  addImage: vi.fn().mockResolvedValue(undefined),
})

// ── V128: MarkerDetailModal ei auto-focusoi kenttää ──
describe('T197 / V128 — MarkerDetailModal ei auto-focusoi', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('open() ei siirrä fokusta note-textareaan (näppis ei aukea auto)', () => {
    const marker = makeMarker()
    const manager = makeManager(marker)
    const modal = new MarkerDetailModal(manager as any, () => null, () => 'järjestäjä', vi.fn())
    modal.open('m1')

    // textarea on olemassa mutta ei fokusoituna
    expect(document.querySelector('.marker-detail-note')).not.toBeNull()
    const active = document.activeElement
    expect(active?.tagName).not.toBe('TEXTAREA')
    expect((active as HTMLElement | null)?.classList.contains('marker-detail-note')).not.toBe(true)
  })
})

// ── V127: LeftPanel.collapse — vain mobiili ──
describe('T197 / V127 — LeftPanel.collapse mobiilissa', () => {
  let panel: HTMLElement
  let content: HTMLElement
  let toggleBtn: HTMLButtonElement

  beforeEach(() => {
    panel = document.createElement('div')
    panel.id = 'left-panel'
    content = document.createElement('div')
    content.id = 'left-panel-content'
    toggleBtn = document.createElement('button')
    toggleBtn.id = 'left-panel-toggle'
    panel.appendChild(content)
    panel.appendChild(toggleBtn)
    document.body.appendChild(panel)
  })
  afterEach(() => { panel.remove(); setWidth(1024) })

  it('collapse() sulkee kun mobiili (≤480px) ja auki', () => {
    setWidth(1024)
    const lp = new LeftPanel(panel) // auki desktopilla
    expect(lp.isCollapsed()).toBe(false)
    setWidth(400)
    lp.collapse()
    expect(lp.isCollapsed()).toBe(true)
    expect(panel.classList.contains('collapsed')).toBe(true)
    expect(content.hidden).toBe(true)
  })

  it('collapse() no-op desktopilla (>480px — tilaa riittää)', () => {
    setWidth(1024)
    const lp = new LeftPanel(panel)
    lp.collapse()
    expect(lp.isCollapsed()).toBe(false)
    expect(panel.classList.contains('collapsed')).toBe(false)
  })

  it('marker-detail-opened -event → collapse mobiilissa', () => {
    setWidth(1024)
    const lp = new LeftPanel(panel)
    setWidth(400)
    document.dispatchEvent(new CustomEvent('marker-detail-opened'))
    expect(lp.isCollapsed()).toBe(true)
  })
})

// ── V127: merkin valinta dispatchaa eventin vain detail-polussa ──
describe('T197 / V127 — marker-list select dispatchaa marker-detail-opened', () => {
  const setupDom = () => {
    document.body.innerHTML =
      '<div id="marker-count"></div>' +
      '<div id="marker-modal" class="modal--järjestäjä"><div id="marker-modal-items"></div></div>'
  }

  it('detail-polku (onOpenDetail annettu) → dispatchaa eventin', () => {
    setupDom()
    const marker = makeMarker()
    const manager = makeManager(marker)
    const onOpenDetail = vi.fn()
    renderMarkerList(manager as any, undefined, undefined, null, onOpenDetail, undefined)

    const spy = vi.fn()
    document.addEventListener('marker-detail-opened', spy)
    const item = document.querySelector('.marker-item') as HTMLElement
    item.click()

    expect(onOpenDetail).toHaveBeenCalledWith('m1')
    expect(spy).toHaveBeenCalledTimes(1)
    document.removeEventListener('marker-detail-opened', spy)
  })

  it('panTo-only-polku (ei onOpenDetail) → EI dispatchaa (V127)', () => {
    setupDom()
    const marker = makeMarker()
    const manager = makeManager(marker)
    renderMarkerList(manager as any, undefined, undefined, null, undefined, undefined)

    const spy = vi.fn()
    document.addEventListener('marker-detail-opened', spy)
    const item = document.querySelector('.marker-item') as HTMLElement
    item.click()

    expect(manager.panTo).toHaveBeenCalledWith('m1')
    expect(spy).not.toHaveBeenCalled()
    document.removeEventListener('marker-detail-opened', spy)
  })
})
