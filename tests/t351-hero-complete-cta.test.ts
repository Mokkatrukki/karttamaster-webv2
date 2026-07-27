// @vitest-environment jsdom
// T351/V254 (B140): valmis-toggle hero:n done-rivillä. Ennen tätä valmiussignaali ("✓ Kaikki
// asetettu") ja sen kuittaus olivat eri näkymissä (Kaikki merkit -tabin pohja + yläpalkin ⋯)
// ∴ talkoolaisen viimeinen askel metsässä vaati tabinvaihdon tai valikon.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SegmentView, type SegmentViewActions } from '../src/ui/segment-view'
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
    status: 'asetettu',
    ...overrides,
  }
}

// Hero:n done-rivin nappi = .segment-view-next--done sisällä oleva .segment-view-complete-btn
// (sama luokka kuin Kaikki merkit -tabin osiossa ∴ ei uusia design-tokeneita).
function heroCompleteBtn(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector('.segment-view-next--done .segment-view-complete-btn')
}

describe('T351 — valmis-toggle hero:n done-rivillä', () => {
  let container: HTMLElement
  let onComplete: ReturnType<typeof vi.fn>
  let actions: SegmentViewActions

  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
    onComplete = vi.fn()
    actions = { onComplete }
  })

  it('kaikki merkit asetettu → nappi näkyy done-rivillä', () => {
    const view = new SegmentView(container, makeSeg(), undefined, undefined, actions)
    view.update([makeMarker({ status: 'asetettu' })])
    const btn = heroCompleteBtn(container)
    expect(btn).not.toBeNull()
    expect(btn?.textContent).toBe('✓ Merkitse pätkä valmiiksi')
  })

  it('klikki → onComplete(!completed)', () => {
    const view = new SegmentView(container, makeSeg({ completed: false }), undefined, undefined, actions)
    view.update([makeMarker({ status: 'asetettu' })])
    heroCompleteBtn(container)?.click()
    expect(onComplete).toHaveBeenCalledWith(true)
  })

  it('jo valmis → label kääntyy ja klikki peruu (onComplete(false))', () => {
    const view = new SegmentView(container, makeSeg({ completed: true }), undefined, undefined, actions)
    view.update([makeMarker({ status: 'asetettu' })])
    const btn = heroCompleteBtn(container)
    expect(btn?.textContent).toBe('↩ Merkitse keskeneräiseksi')
    btn?.click()
    expect(onComplete).toHaveBeenCalledWith(false)
  })

  it('asettamattomia jäljellä → ⊥ nappia (done-riviä ei ole)', () => {
    const view = new SegmentView(container, makeSeg(), undefined, undefined, actions)
    view.update([makeMarker({ status: 'suunniteltu' })])
    expect(heroCompleteBtn(container)).toBeNull()
  })

  it('tyhjä pätkä (0 merkkiä) → ⊥ nappia — "Ei merkkejä" ⊥ ole valmiussignaali', () => {
    const view = new SegmentView(container, makeSeg(), undefined, undefined, actions)
    view.update([])
    expect(container.querySelector('.segment-view-next-done-title')?.textContent).toContain('Ei merkkejä')
    expect(heroCompleteBtn(container)).toBeNull()
  })

  it('onComplete puuttuu (⊥ talkoolainen) → ⊥ nappia', () => {
    const view = new SegmentView(container, makeSeg(), undefined, undefined, {})
    view.update([makeMarker({ status: 'asetettu' })])
    expect(heroCompleteBtn(container)).toBeNull()
  })

  it('T228 säilyy: done-rivi pysyy matalana (⊥ accent-kortti) napista huolimatta', () => {
    const view = new SegmentView(container, makeSeg(), undefined, undefined, actions)
    view.update([makeMarker({ status: 'asetettu' })])
    const next = container.querySelector('.segment-view-next') as HTMLElement
    expect(next.classList.contains('segment-view-next--done')).toBe(true)
    expect(container.querySelector('.segment-view-next-done-title')?.textContent).toContain('Kaikki asetettu')
  })
})
