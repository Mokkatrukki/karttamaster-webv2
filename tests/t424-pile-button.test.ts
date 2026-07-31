// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentView, type SegmentViewActions } from '../src/ui/segment-view'
import { PILE_TEMPLATE_ID } from '../src/logic/pile'
import type { Segment } from '../src/logic/segments'
import type { MarkerStatus, SignMarker } from '../src/logic/types'

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1', routeIds: ['35km'], startDist: 0, endDist: 12000,
    equipment: [], phase: 'purku', displayName: 'Matin pätkä',
    ...overrides,
  }
}

function marker(id: string, status: MarkerStatus = 'kerätty'): SignMarker {
  return {
    id, type: 'right', lat: 63, lon: 27, distanceFromStart: 5000,
    routeIds: ['35km'], status,
  }
}

function mount(actions: SegmentViewActions, seg = makeSeg(), markers = [marker('a')]) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const view = new SegmentView(container, seg, undefined, undefined, actions)
  view.update(markers)
  return { container, view, btn: container.querySelector('.segment-view-pile-btn') as HTMLButtonElement }
}

describe('T424/V314 — "Jätä kasa tähän"', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('(i) nappi näkyy purussa kun ehdokkaita on', () => {
    const { btn } = mount({ pileCandidates: () => [marker('a')], onLeavePile: () => {} })
    expect(btn.hidden).toBe(false)
  })

  it('(i) 0 ehdokasta → nappia ei renderöidä (V250: ei kuollutta pintaa)', () => {
    const { btn } = mount({ pileCandidates: () => [], onLeavePile: () => {} })
    expect(btn.hidden).toBe(true)
  })

  it('(ii) teksti näyttää ehdokasmäärän', () => {
    const { btn } = mount({
      pileCandidates: () => [marker('a'), marker('b'), marker('c')],
      onLeavePile: () => {},
    })
    expect(btn.textContent).toContain('3 merkkiä')
    expect(btn.textContent).toContain('Jätä kasa tähän')
  })

  it('(iii) klikkaus kutsuu onLeavePile', () => {
    let calls = 0
    const { btn } = mount({ pileCandidates: () => [marker('a')], onLeavePile: () => { calls++ } })
    btn.click()
    expect(calls).toBe(1)
  })

  it('(v) asettaminen-vaihe ei näytä nappia', () => {
    const { btn } = mount(
      { pileCandidates: () => [marker('a')], onLeavePile: () => {} },
      makeSeg({ phase: 'asettaminen' }),
    )
    expect(btn.hidden).toBe(true)
  })

  it('tarkastus-vaihe ei näytä nappia', () => {
    const { btn } = mount(
      { pileCandidates: () => [marker('a')], onLeavePile: () => {} },
      makeSeg({ phase: 'tarkastus' }),
    )
    expect(btn.hidden).toBe(true)
  })

  it('kytkemättä (ei onLeavePile) nappi pysyy piilossa — kyky on opt-in', () => {
    const { btn } = mount({ pileCandidates: () => [marker('a')] })
    expect(btn.hidden).toBe(true)
  })

  it('(vi) määrä päivittyy update():ssa — kasan jälkeen ehdokkaita ei ole', () => {
    let claimed = false
    const container = document.createElement('div')
    document.body.appendChild(container)
    const view = new SegmentView(container, makeSeg(), undefined, undefined, {
      pileCandidates: () => (claimed ? [] : [marker('a'), marker('b')]),
      onLeavePile: () => { claimed = true },
    })
    view.update([marker('a'), marker('b')])
    const btn = container.querySelector('.segment-view-pile-btn') as HTMLButtonElement
    expect(btn.textContent).toContain('2 merkkiä')
    btn.click()
    view.update([marker('a'), marker('b')])
    expect(btn.hidden).toBe(true)
  })

  it('kasa-merkki ei ole nappi vaan merkki — templateId on vakio', () => {
    expect(PILE_TEMPLATE_ID).toBe('kerayskasa')
  })
})
