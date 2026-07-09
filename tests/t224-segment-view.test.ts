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

describe('T224 — pätkäkeskeinen näkymä', () => {
  let container: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  // ---- Ei välilehtiä (palaute: "Kaikki merkit" tupla → yläpalkki riittää) ----
  it('EI välilehtiä — yksi sarake', () => {
    new SegmentView(container, makeSeg())
    expect(container.querySelector('.segment-view-tabs')).toBeNull()
    expect(container.querySelector('.segment-view-tab')).toBeNull()
  })

  // ---- T228: inline-merkkilista poistettu (duplikoi "Kaikki merkit" -modaalin) ----
  it('EI inline-merkkilistaa — .segment-view-list ei renderöidy', () => {
    const view = new SegmentView(container, makeSeg())
    view.update([makeMarker(), makeMarker({ id: 'm-2', distanceFromStart: 8000 })])
    expect(container.querySelector('.segment-view-list')).toBeNull()
    expect(container.querySelector('.segment-view-item')).toBeNull()
  })

  it('T228: hero + varustelista-nappi säilyvät ilman listaa', () => {
    const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
    view.update([makeMarker({ status: 'suunniteltu' })])
    // Seuraava-merkki-hero (kartta=päänavigointi, VISION)
    expect(container.querySelector('.segment-view-next-set')).not.toBeNull()
    expect(container.querySelector('.segment-view-varuste-btn')).not.toBeNull()
  })

  it('T228: done-tila = matala rivi, .segment-view-next--done -luokka (⊥ accent-kortti)', () => {
    const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
    view.update([makeMarker({ status: 'asetettu' })])
    const next = container.querySelector('.segment-view-next') as HTMLElement
    expect(next.classList.contains('segment-view-next--done')).toBe(true)
    expect(container.querySelector('.segment-view-next-done-title')?.textContent).toContain('Kaikki asetettu')
  })

  // ---- B: hero overflow ----
  describe('hero overflow-valikko (B)', () => {
    it('primary napit Aseta + Näytä kartalla + ⋯-nappi', () => {
      const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
      view.update([makeMarker({ status: 'suunniteltu' })])
      expect(container.querySelector('.segment-view-next-set')).not.toBeNull()
      expect(container.querySelector('.segment-view-next-show')).not.toBeNull()
      expect(container.querySelector('.segment-view-next-more')).not.toBeNull()
    })

    it('valikko piilossa oletuksena, ⋯ avaa sen', () => {
      const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
      view.update([makeMarker({ status: 'suunniteltu' })])
      const menu = container.querySelector('.segment-view-next-menu') as HTMLElement
      expect(menu.hidden).toBe(true)
      ;(container.querySelector('.segment-view-next-more') as HTMLButtonElement).click()
      expect(menu.hidden).toBe(false)
    })

    it('"Ei tarpeen" valikossa kutsuu onSkipMarker', () => {
      let skipId: string | null = null
      const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }), undefined, undefined, {
        onSkipMarker: (id) => { skipId = id },
      })
      view.update([makeMarker({ id: 'm1', status: 'suunniteltu' })])
      ;(container.querySelector('.segment-view-next-skip') as HTMLButtonElement).click()
      expect(skipId).toBe('m1')
    })

    it('"Siirretty" disabled kun onMoveMarker puuttuu, kutsuu callbackia kun annettu', () => {
      let movedId: string | null = null
      const disabled = new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
      disabled.update([makeMarker({ status: 'suunniteltu' })])
      expect((container.querySelector('.segment-view-next-move') as HTMLButtonElement).disabled).toBe(true)

      document.body.innerHTML = ''
      const c2 = document.createElement('div'); document.body.appendChild(c2)
      const view = new SegmentView(c2, makeSeg({ phase: 'asettaminen' }), undefined, undefined, {
        onMoveMarker: (id) => { movedId = id },
      })
      view.update([makeMarker({ id: 'm7', status: 'suunniteltu' })])
      const moveBtn = c2.querySelector('.segment-view-next-move') as HTMLButtonElement
      expect(moveBtn.disabled).toBe(false)
      moveBtn.click()
      expect(movedId).toBe('m7')
    })

    it('"Ota kuva" disabled (tulossa); "Laita kommentti" disabled ilman onComment', () => {
      const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
      view.update([makeMarker({ status: 'suunniteltu' })])
      expect((container.querySelector('.segment-view-next-photo') as HTMLButtonElement).disabled).toBe(true)
      expect((container.querySelector('.segment-view-next-comment') as HTMLButtonElement).disabled).toBe(true)
    })

    it('T228: "Laita kommentti" enabloitu + kutsuu onComment kun annettu', () => {
      let commentId: string | null = null
      const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }), undefined, undefined, {
        onComment: (id) => { commentId = id },
      })
      view.update([makeMarker({ id: 'm9', status: 'suunniteltu' })])
      const btn = container.querySelector('.segment-view-next-comment') as HTMLButtonElement
      expect(btn.disabled).toBe(false)
      btn.click()
      expect(commentId).toBe('m9')
    })
  })

  // ---- T230: "Merkitse pätkä valmiiksi" (asettaminen/purku) ----
  describe('T230 — pätkä valmiiksi', () => {
    it('nappi näkyy asettaminen-vaiheessa kun onComplete annettu', () => {
      const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }), undefined, undefined, {
        onComplete: () => {},
      })
      view.update([makeMarker({ status: 'asetettu' })])
      const sec = container.querySelector('.segment-view-complete') as HTMLElement
      expect(sec.hidden).toBe(false)
      expect(container.querySelector('.segment-view-complete-btn')?.textContent).toContain('Merkitse pätkä valmiiksi')
    })

    it('piilossa ilman onComplete-callbackia', () => {
      const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
      view.update([makeMarker()])
      expect((container.querySelector('.segment-view-complete') as HTMLElement).hidden).toBe(true)
    })

    it('piilossa tarkastus-vaiheessa (käyttää inspect-osiota)', () => {
      const view = new SegmentView(container, makeSeg({ phase: 'tarkastus' }), undefined, undefined, {
        onComplete: () => {},
      })
      view.update([makeMarker()])
      expect((container.querySelector('.segment-view-complete') as HTMLElement).hidden).toBe(true)
    })

    it('klikkaus kutsuu onComplete(true), completed=true vaihtaa tekstin + näyttää statuksen', () => {
      let called: boolean | null = null
      const view = new SegmentView(container, makeSeg({ phase: 'purku' }), undefined, undefined, {
        onComplete: (c) => { called = c },
      })
      view.update([makeMarker({ status: 'kerätty' })])
      ;(container.querySelector('.segment-view-complete-btn') as HTMLButtonElement).click()
      expect(called).toBe(true)

      view.update([makeMarker({ status: 'kerätty' })], makeSeg({ phase: 'purku', completed: true }))
      expect(container.querySelector('.segment-view-complete-btn')?.textContent).toContain('keskeneräiseksi')
      const status = container.querySelector('.segment-view-complete-status') as HTMLElement
      expect(status.hidden).toBe(false)
      expect(status.textContent).toContain('valmiiksi ✓')
    })
  })

  // ---- C: Varustelista-nappi → modaali ----
  describe('Varustelista-nappi (C)', () => {
    it('nappi näkyy ja näyttää määrän (auto + manuaali)', () => {
      const view = new SegmentView(container, makeSeg({ equipment: [{ name: 'Nauha', count: 3 }] }))
      view.update([makeMarker({ id: 'a' }), makeMarker({ id: 'b', distanceFromStart: 8000 })])
      const btn = container.querySelector('.segment-view-varuste-btn') as HTMLButtonElement
      expect(btn).not.toBeNull()
      expect(btn.textContent).toContain('🎒 Varustelista')
      // 2 merkkiä (auto) + 3 (manuaali) = 5
      expect(btn.textContent).toContain('(5)')
    })

    it('klikkaus avaa EquipmentModalin (kuten "Kaikki merkit")', () => {
      const view = new SegmentView(container, makeSeg({ equipment: [{ name: 'Nauha', count: 3 }] }), undefined, undefined, {
        onEquipmentChange: () => {},
      })
      view.update([makeMarker()])
      expect(document.querySelector('.equipment-modal')).toBeNull()
      ;(container.querySelector('.segment-view-varuste-btn') as HTMLButtonElement).click()
      expect(document.querySelector('.equipment-modal')).not.toBeNull()
      expect(document.querySelector('.equipment-modal-save')).not.toBeNull()
    })
  })
})
