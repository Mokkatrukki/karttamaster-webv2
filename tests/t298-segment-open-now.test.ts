import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSegmentStore, createSegment, type Segment } from '../src/logic/segments'
import { renderPatkatPage } from '../src/ui/patkat-page'
import { SegmentPanel } from '../src/ui/segment-panel'
import { SegmentDetailsModal } from '../src/ui/segment-details-modal'

// T298/V209/B113: pätkä avattavissa ja linkitettävissä heti luonnista — ei "jaa linkki" -porttia.
function seg(partial: Partial<Segment> & { id: string }): Segment {
  return { equipment: [], phase: 'asettaminen', ...partial } as Segment
}

function renderList(segments: Segment[], role: 'talkoolainen' | 'järjestäjä'): HTMLElement {
  const c = document.createElement('div')
  renderPatkatPage(c, { faqMarkdown: '', segments, markers: [], role })
  return c
}

describe('T298 — avaa pätkä heti (V209)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('patkat-lista', () => {
    it('slug ilman assignia → Avaa-linkki (ei "Ei jaettu")', () => {
      const list = renderList([seg({ id: 'a', slug: 'patka-1', displayName: 'Pätkä 1' })], 'talkoolainen')
      const open = list.querySelector('.patkat-row-open') as HTMLAnchorElement
      expect(open?.getAttribute('href')).toBe('/s/patka-1')
      expect(list.querySelector('.patkat-row-nolink')).toBeNull()
    })

    it('legacy assignedCode ilman slugia → Avaa-linkki säilyy', () => {
      const list = renderList([seg({ id: 'a', assignedCode: 'VANHA', displayName: 'Vanha' })], 'talkoolainen')
      expect((list.querySelector('.patkat-row-open') as HTMLAnchorElement).getAttribute('href')).toBe('/s/VANHA')
    })

    it('järjestäjä saa Kopioi-napin jokaiselle riville (T275)', () => {
      const list = renderList([seg({ id: 'a', slug: 'patka-1' }), seg({ id: 'b', slug: 'patka-2' })], 'järjestäjä')
      expect(list.querySelectorAll('.patkat-row-copy').length).toBe(2)
    })
  })

  describe('luonti → lisätiedot-modaali', () => {
    it('tallennus sulkee luontimodaalin ja avaa pätkän lisätiedot-modaalin linkkeineen', () => {
      const store = createSegmentStore()
      const container = document.createElement('div')
      document.body.appendChild(container)
      const panel = new SegmentPanel(container, [], store, vi.fn())
      void panel

      // Avaa paneeli (footer-napit näkyvät vasta auki) → reititön luonti (ei kartta-klikkejä).
      ;(container.querySelector('.btn-segment-toggle') as HTMLElement | null)?.click()
      const routelessBtn = document.getElementById('btn-segment-create-routeless') as HTMLButtonElement
      expect(routelessBtn).not.toBeNull()
      routelessBtn.click()

      const nameInput = document.querySelector('.segment-creation-name-input') as HTMLInputElement
      nameInput.value = 'Varikon silmukka'
      ;(document.querySelector('.btn-segment-creation-save') as HTMLButtonElement).click()

      // Luontimodaali kiinni, lisätiedot-modaali auki ja näyttää pätkän linkin.
      expect(document.querySelector('[data-testid="creation-modal"]')).toBeNull()
      const link = document.querySelector('.segment-details-link') as HTMLAnchorElement
      expect(link?.getAttribute('href')).toBe('/s/varikon-silmukka')
    })
  })

  describe('lisätiedot-modaali', () => {
    it('näyttää linkin ilman assignia ja päivittää sen nimenmuutoksessa', () => {
      const store = createSegmentStore()
      const created = createSegment(store, {
        routeIds: ['35km'], startDist: 0, endDist: 1000,
        equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1',
      })
      const modal = new SegmentDetailsModal(store, vi.fn(), vi.fn())
      modal.open(created)

      const link = document.querySelector('.segment-details-link') as HTMLAnchorElement
      expect(link.getAttribute('href')).toBe('/s/patka-1')

      const nameInput = document.querySelector('.segment-details-name-input') as HTMLInputElement
      nameInput.value = 'Varikon silmukka'
      nameInput.dispatchEvent(new Event('blur'))

      expect((document.querySelector('.segment-details-link') as HTMLAnchorElement).getAttribute('href'))
        .toBe('/s/varikon-silmukka')
      expect(store.get(created.id)?.slug).toBe('varikon-silmukka')
    })

    it('varoittaa että vanha linkki kuolee nimenmuutoksessa', () => {
      const store = createSegmentStore()
      const created = createSegment(store, { equipment: [], phase: 'asettaminen', displayName: 'Pätkä 1' })
      new SegmentDetailsModal(store, vi.fn(), vi.fn()).open(created)
      expect(document.querySelector('.segment-details-link-hint')?.textContent)
        .toContain('vanha linkki lakkaa toimimasta')
    })
  })
})
