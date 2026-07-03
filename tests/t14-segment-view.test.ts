import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentView } from '../src/ui/segment-view'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    routeIds: ['35km'],
    startDist: 5000,
    endDist: 12000,
    equipment: [],
    phase: 'asettaminen',
    displayName: 'Matin pätkä',
    ...overrides,
  }
}

function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm-1',
    type: 'right',
    lat: 63.0,
    lon: 27.0,
    distanceFromStart: 7000,
    routeIds: ['35km'],
    status: 'suunniteltu',
    ...overrides,
  }
}

describe('T14 — SegmentView', () => {
  let container: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('näyttää pätkän nimen', () => {
    new SegmentView(container, makeSeg())
    expect(container.querySelector('.segment-view-name')?.textContent).toBe('Matin pätkä')
  })

  it('näyttää km-välin', () => {
    new SegmentView(container, makeSeg({ startDist: 5000, endDist: 12000 }))
    const range = container.querySelector('.segment-view-range')?.textContent
    expect(range).toBe('5.0–12.0 km')
  })

  it('näyttää description jos asetettu', () => {
    new SegmentView(container, makeSeg({ description: 'Käänny Torinkallion risteyksessä' }))
    expect(container.querySelector('.segment-view-desc')?.textContent).toBe('Käänny Torinkallion risteyksessä')
  })

  it('ei näytä description-elementtiä jos ei ole kuvausta', () => {
    new SegmentView(container, makeSeg({ description: undefined }))
    expect(container.querySelector('.segment-view-desc')).toBeNull()
  })

  it('näyttää tyhjä-tilan kun ei merkkejä', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([])
    expect(container.querySelector('.segment-view-empty')).not.toBeNull()
    expect(container.querySelector('.segment-view-empty')?.textContent).toContain('Ei merkkejä')
  })

  it('näyttää merkkilistan järjestettynä distanceFromStart mukaan (V25)', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([
      makeMarker({ id: 'm-2', distanceFromStart: 9000 }),
      makeMarker({ id: 'm-1', distanceFromStart: 7000 }),
    ])
    const items = container.querySelectorAll('.segment-view-item')
    expect(items.length).toBe(2)
    expect(items[0].getAttribute('data-id')).toBe('m-1')
    expect(items[1].getAttribute('data-id')).toBe('m-2')
  })

  it('näyttää merkin tyypin suomeksi', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([makeMarker({ type: 'left' })])
    expect(container.querySelector('.segment-view-item-info')?.textContent).toContain('Vasemmalle')
  })

  it('näyttää merkin km-sijainnin', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([makeMarker({ distanceFromStart: 7500 })])
    expect(container.querySelector('.segment-view-item-info')?.textContent).toContain('7.5 km')
  })

  it('näyttää statuksen oikealla CSS-luokalla', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([makeMarker({ status: 'asetettu' })])
    const statusEl = container.querySelector('.segment-view-status')
    expect(statusEl?.classList.contains('status-asetettu')).toBe(true)
    expect(statusEl?.textContent).toContain('Asetettu')
  })

  it('update() päivittää listan uusilla merkeillä', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([makeMarker({ id: 'm-1' })])
    expect(container.querySelectorAll('.segment-view-item').length).toBe(1)

    view.update([makeMarker({ id: 'm-1' }), makeMarker({ id: 'm-2', distanceFromStart: 9000 })])
    expect(container.querySelectorAll('.segment-view-item').length).toBe(2)
  })

  // T147: tarkastus-UI — kevyt läpiajo, vapaateksti-huomio, ei per-merkki-kuittausta
  describe('tarkastus-phase', () => {
    it('piilotettu ei-tarkastus-pätkällä', () => {
      new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
      const section = container.querySelector('.segment-view-inspect') as HTMLElement
      expect(section.hidden).toBe(true)
    })

    it('näkyvissä tarkastus-pätkällä, tila "Ei vielä tarkastettu"', () => {
      new SegmentView(container, makeSeg({ phase: 'tarkastus' }))
      const section = container.querySelector('.segment-view-inspect') as HTMLElement
      expect(section.hidden).toBe(false)
      expect(container.querySelector('.segment-view-inspect-status')?.textContent).toBe('Ei vielä tarkastettu')
      expect(container.querySelector('.btn-mark-inspected')?.textContent).toBe('Merkitse tarkastetuksi')
    })

    it('inspected=true näyttää "Tarkastettu ✓" ja vaihtaa napin tekstin', () => {
      new SegmentView(container, makeSeg({ phase: 'tarkastus', inspected: true }))
      expect(container.querySelector('.segment-view-inspect-status')?.textContent).toBe('Tarkastettu ✓')
      expect(container.querySelector('.btn-mark-inspected')?.textContent).toBe('Merkitse tarkastamattomaksi')
    })

    it('klikkaus kutsuu onInspect(true, huomioteksti)', () => {
      let called: [boolean, string] | null = null
      const view = new SegmentView(container, makeSeg({ phase: 'tarkastus' }), undefined, (inspected, note) => {
        called = [inspected, note]
      })
      const noteInput = container.querySelector('.segment-view-inspect-note') as HTMLTextAreaElement
      noteInput.value = 'Puu kaatunut polulla'
      const btn = container.querySelector('.btn-mark-inspected') as HTMLButtonElement
      btn.click()
      expect(called).toEqual([true, 'Puu kaatunut polulla'])
      expect(view).toBeDefined()
    })

    it('huomioteksti esitäytetään segment.inspectionNotesta', () => {
      new SegmentView(container, makeSeg({ phase: 'tarkastus', inspectionNote: 'Vanha huomio' }))
      const noteInput = container.querySelector('.segment-view-inspect-note') as HTMLTextAreaElement
      expect(noteInput.value).toBe('Vanha huomio')
    })
  })
})
