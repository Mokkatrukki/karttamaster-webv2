import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'

// V53: context-menu ei sisällä delete-nappia

describe('T98 — V53: context-menu ei sisällä delete-nappia', () => {
  let dom: JSDOM
  let document: Document
  let window: Window & typeof globalThis

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' })
    document = dom.window.document as unknown as Document
    window = dom.window as unknown as Window & typeof globalThis
    vi.stubGlobal('document', document)
  })

  it('MarkerInteraction.injectStyles ei sisällä marker-ctx-delete sääntöä', async () => {
    const mockMap = {
      getContainer: () => document.createElement('div'),
      dragging: { enable: vi.fn(), disable: vi.fn() },
      latLngToContainerPoint: () => ({ x: 0, y: 0 }),
    }
    const mockLeafletMarkers = new Map()

    // Dynamic import so vi.stubGlobal takes effect
    const { MarkerInteraction } = await import('../src/map/marker-interaction')
    MarkerInteraction.injectStyles()

    const styleEl = document.getElementById('marker-ctx-styles')
    expect(styleEl).not.toBeNull()
    expect(styleEl!.textContent).not.toContain('marker-ctx-delete')
  })

  it('showContextMenu rakentaa menun ilman delete-nappia', async () => {
    const mockMap = {
      getContainer: () => document.createElement('div'),
      dragging: { enable: vi.fn(), disable: vi.fn() },
      latLngToContainerPoint: () => ({ x: 0, y: 0 }),
    } as unknown as import('leaflet').Map

    const mockLeafletMarkers = new Map<string, import('leaflet').Marker>()
    const marker = {
      id: 'test-id',
      type: 'right',
      lat: 60,
      lon: 25,
      bearing: 0,
      distanceFromStart: 0,
      routeIds: ['35km'],
      status: 'suunniteltu' as const,
    }

    const { MarkerInteraction } = await import('../src/map/marker-interaction')
    const interaction = new MarkerInteraction(
      mockMap,
      mockLeafletMarkers,
      () => marker,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )

    const anchor = document.createElement('div')
    anchor.getBoundingClientRect = () => ({ top: 100, left: 100, width: 32, height: 52 } as DOMRect)
    document.body.appendChild(anchor)

    interaction.showContextMenu(marker, anchor)

    const menu = document.querySelector('.marker-ctx-menu')
    expect(menu).not.toBeNull()
    expect(menu!.querySelector('.marker-ctx-delete')).toBeNull()
    expect(menu!.querySelector('.marker-ctx-rotate')).not.toBeNull()
  })
})
