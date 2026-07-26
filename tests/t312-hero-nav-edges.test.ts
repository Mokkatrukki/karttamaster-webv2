// T312/V224: hero-alapalkin ◀▶-selailunuolet ankkuroitu palkin reunoihin — nuoli EI ole label-
// tekstin naapuri inline-rivillä vaan oma sarake, ja joustava keskiosa (.segment-view-next-body,
// flex:1;min-width:0) syö nimen pituuden vaihtelun. Rakenne todistetaan tässä (Taso 2);
// pikselisijainti (boundingBox x ±1px) Playwrightissa (e2e/segments.spec.ts).
// @vitest-environment jsdom
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

function threeUnset(): SignMarker[] {
  return [
    makeMarker({ id: 'm-1', distanceFromStart: 6000, label: 'A' }),
    makeMarker({ id: 'm-2', distanceFromStart: 7000, label: 'B' }),
    makeMarker({ id: 'm-3', distanceFromStart: 8000, label: 'C' }),
  ]
}

describe('T312 — hero ◀▶ reunoihin (V224)', () => {
  let container: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('selailurivi on 3 suoraa lasta: ◀, joustava keskiosa, ▶', () => {
    new SegmentView(container, makeSeg()).update(threeUnset())
    const row = container.querySelector('.segment-view-next-row')!
    const kids = Array.from(row.children)
    expect(kids.length).toBe(3)
    expect(kids[0].classList.contains('segment-view-next-prev')).toBe(true)
    expect(kids[1].classList.contains('segment-view-next-body')).toBe(true)
    expect(kids[2].classList.contains('segment-view-next-fwd')).toBe(true)
  })

  it('ikoni ja nimi/meta ovat keskiosan sisällä, EIVÄT rivin suoria lapsia', () => {
    new SegmentView(container, makeSeg()).update(threeUnset())
    const body = container.querySelector('.segment-view-next-body')!
    expect(body.querySelector('.marker-visual-row-sv')).not.toBeNull()
    expect(body.querySelector('.segment-view-next-name')).not.toBeNull()
    expect(body.querySelector('.segment-view-next-meta')).not.toBeNull()
  })

  it('nuolten järjestys ei muutu pitkällä merkin nimellä (label joustaa, ei nuolet)', () => {
    const long = threeUnset()
    long[1].label = 'Erittäin pitkä merkin nimi joka ellipsoituu keskellä palkkia'
    const sv = new SegmentView(container, makeSeg())
    sv.update(long)
    ;(container.querySelector('.segment-view-next-fwd') as HTMLButtonElement).click()
    const kids = Array.from(container.querySelector('.segment-view-next-row')!.children)
    expect(kids.map(k => k.className.includes('next-prev') ? 'prev' : k.className.includes('next-fwd') ? 'fwd' : 'body'))
      .toEqual(['prev', 'body', 'fwd'])
    expect(container.querySelector('.segment-view-next-name')?.textContent).toContain('Erittäin pitkä')
  })

  it('disabled-clamp päihin säilyy (V159): ensimmäisenä ◀ disabloitu, viimeisenä ▶', () => {
    new SegmentView(container, makeSeg()).update(threeUnset())
    const prev = () => container.querySelector('.segment-view-next-prev') as HTMLButtonElement
    const fwd = () => container.querySelector('.segment-view-next-fwd') as HTMLButtonElement
    expect(prev().disabled).toBe(true)
    expect(fwd().disabled).toBe(false)
    fwd().click()
    expect(prev().disabled).toBe(false)
    expect(fwd().disabled).toBe(false)
    fwd().click()
    expect(prev().disabled).toBe(false)
    expect(fwd().disabled).toBe(true)
  })

  it('aria-labelit säilyvät molemmissa nuolissa', () => {
    new SegmentView(container, makeSeg()).update(threeUnset())
    expect(container.querySelector('.segment-view-next-prev')?.getAttribute('aria-label'))
      .toBe('Edellinen asettamaton merkki')
    expect(container.querySelector('.segment-view-next-fwd')?.getAttribute('aria-label'))
      .toBe('Seuraava asettamaton merkki')
  })

  it('yksi asettamaton merkki → ei nuolia, keskiosa silti oma laatikko', () => {
    new SegmentView(container, makeSeg()).update([makeMarker({ label: 'Yksin' })])
    const row = container.querySelector('.segment-view-next-row')!
    expect(row.querySelector('.segment-view-next-nav')).toBeNull()
    expect(row.children.length).toBe(1)
    expect(row.children[0].classList.contains('segment-view-next-body')).toBe(true)
  })
})
