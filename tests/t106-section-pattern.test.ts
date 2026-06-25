import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { createSignLibrary, SignLibraryPanel } from '../src/ui/sign-library-panel'
import { createTemplate, listTemplates } from '../src/logic/sign-library'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore } from '../src/logic/segments'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function bodyQuery<T extends Element>(selector: string): T | null {
  return document.body.querySelector<T>(selector)
}

describe('T106 — Yhtenäinen section-pattern (V61, V62)', () => {
  describe('SignLibraryPanel section-pattern', () => {
    it('item-rivi ei sisällä ★-nappia (V62)', () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const favBtns = container.querySelectorAll('.sign-lib-fav-btn')
      expect(favBtns.length).toBe(0)
    })

    it('item-rivi ei sisällä ×-nappia (V62)', () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const deleteBtns = container.querySelectorAll('.sign-lib-delete-btn')
      expect(deleteBtns.length).toBe(0)
    })

    it('custom-mallin modaalissa on .modal-btn-destructive (V62)', () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const lib = createSignLibrary()
      const t = createTemplate(lib, { label: 'Testi', shortLabel: 'T', color: '#f00', description: '', favorite: false })
      new SignLibraryPanel(container, lib, vi.fn())
      container.querySelector<HTMLButtonElement>(`.sign-lib-dots-btn[data-id="${t.id}"]`)!.click()
      expect(bodyQuery('.modal-btn-destructive')).toBeTruthy()
    })

    it('section-footer "Uusi merkki" löytyy (V61)', () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      const footer = container.querySelector('.sign-lib-add-btn')
      expect(footer).toBeTruthy()
    })

    it('section-header collapse piilottaa listan', () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const lib = createSignLibrary()
      new SignLibraryPanel(container, lib, vi.fn())
      // initially open — list exists
      expect(container.querySelector('.sign-lib-list')).toBeTruthy()
      // click header to collapse
      container.querySelector<HTMLElement>('.left-panel-section-header')!.click()
      expect(container.querySelector('.sign-lib-list')).toBeNull()
    })
  })

  describe('SegmentPanel section-pattern', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
      vi.stubGlobal('crypto', { randomUUID: () => 'test-' + Math.random() })
      let store: Record<string, string> = {}
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v },
        removeItem: (k: string) => { delete store[k] },
        clear: () => { store = {} },
      })
    })

    it('header ei sisällä #btn-segment-create-nappia (vain section-footerissa)', () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const store = createSegmentStore()
      new SegmentPanel(container, [], store, vi.fn())
      const header = container.querySelector('.segment-panel-header')!
      // create button must NOT be inside the header
      expect(header.querySelector('#btn-segment-create')).toBeNull()
    })

    it('section-footer "Luo uusi pätkä" löytyy (V61)', () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const store = createSegmentStore()
      new SegmentPanel(container, [], store, vi.fn())
      // panel starts collapsed — expand first
      container.querySelector<HTMLElement>('.segment-panel-header')!.click()
      const footer = container.querySelector('#btn-segment-create')
      expect(footer).toBeTruthy()
      expect(footer?.textContent).toContain('Luo uusi pätkä')
    })
  })
})
