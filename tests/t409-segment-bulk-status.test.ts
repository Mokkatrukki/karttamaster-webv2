// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SegmentMarkerList } from '../src/ui/segment-marker-list'
import type { MarkerStatus } from '../src/logic/marker-status'
import type { SignMarker } from '../src/logic/types'
import type { Segment } from '../src/logic/segments'

// T409/V292 — talkoolaisen VALIKOIVA bulk-kuittaus koti-tabin listassa (VISION §Kenttätyö).
// Verification contract: nämä testit todistavat että (a) valinta → `onBulkStatus` OIKEILLA
// id:illä olemassa olevaa reittiä, (b) terminaali rivi ⊥ saa checkboxia, (c) 0 valittua →
// napit disabloitu. Kyky oli poissa T264:stä asti (V292) ∴ regressio olisi hiljainen ilman näitä.

const SEG: Segment = {
  id: 'seg-test', routeIds: ['35km'], primaryRouteId: '35km',
  startDist: 0, endDist: 100000, equipment: [], phase: 'asettaminen',
}

function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm', type: 'right', lat: 63, lon: 27, distanceFromStart: 1000,
    routeIds: ['35km'], status: 'suunniteltu', ...overrides,
  }
}

function mount(markers: SignMarker[], onBulkStatus?: (ids: string[], s: MarkerStatus) => void) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const list = new SegmentMarkerList(el, {
    getMarkers: () => markers,
    getSegment: () => SEG,
    onOpenDetail: () => {},
    onBulkStatus,
  })
  list.render()
  return { el, list }
}

const checkbox = (el: HTMLElement, id: string) =>
  el.querySelector<HTMLInputElement>(`.segment-view-markers-item[data-id="${id}"] .marker-item-checkbox`)

const aseta = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.btn-bulk-checkin-aseta')!
const ohita = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.btn-bulk-checkin-ohita')!

describe('T409 — valikoiva bulk-kuittaus (talkoolaisen koti-tab)', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('ilman onBulkStatus-kytkentää lista on entisellään: ei checkboxeja eikä baria', () => {
    const { el } = mount([makeMarker({ id: 'a' }), makeMarker({ id: 'b', distanceFromStart: 2000 })])
    expect(el.querySelectorAll('.marker-item-checkbox').length).toBe(0)
    expect(el.querySelector('.bulk-action-bar')).toBeNull()
  })

  it('kytkettynä jokainen ei-terminaali rivi saa checkboxin', () => {
    const { el } = mount([
      makeMarker({ id: 'a' }),
      makeMarker({ id: 'b', status: 'asetettu', distanceFromStart: 2000 }),
      makeMarker({ id: 'c', status: 'ei_tarpeen', distanceFromStart: 3000 }),
    ], vi.fn())
    expect(el.querySelectorAll('.marker-item-checkbox').length).toBe(3)
  })

  it('terminaali rivi (kerätty) EI saa checkboxia — sille ei ole siirtymää', () => {
    const { el } = mount([
      makeMarker({ id: 'kerätty-1', status: 'kerätty' }),
      makeMarker({ id: 'auki', distanceFromStart: 2000 }),
    ], vi.fn())
    expect(checkbox(el, 'kerätty-1')).toBeNull()
    expect(checkbox(el, 'auki')).not.toBeNull()
  })

  it('0 valittua → molemmat napit disabloitu', () => {
    const { el } = mount([makeMarker({ id: 'a' })], vi.fn())
    expect(aseta(el).disabled).toBe(true)
    expect(ohita(el).disabled).toBe(true)
  })

  it('valinta → "Aseta valituille" kutsuu onBulkStatus VAIN valituilla id:illä', () => {
    const onBulkStatus = vi.fn()
    const { el } = mount([
      makeMarker({ id: 'a' }),
      makeMarker({ id: 'b', distanceFromStart: 2000 }),
      makeMarker({ id: 'c', distanceFromStart: 3000 }),
    ], onBulkStatus)
    checkbox(el, 'a')!.click()
    checkbox(el, 'c')!.click()
    expect(aseta(el).textContent).toBe('✓ Aseta valituille (2)')
    aseta(el).click()
    expect(onBulkStatus).toHaveBeenCalledTimes(1)
    expect(onBulkStatus).toHaveBeenCalledWith(['a', 'c'], 'asetettu')
  })

  it('"Ei tarpeen" asettaa ei_tarpeen-statuksen valituille', () => {
    const onBulkStatus = vi.fn()
    const { el } = mount([makeMarker({ id: 'a' }), makeMarker({ id: 'b', distanceFromStart: 2000 })], onBulkStatus)
    checkbox(el, 'b')!.click()
    ohita(el).click()
    expect(onBulkStatus).toHaveBeenCalledWith(['b'], 'ei_tarpeen')
  })

  it('mutaation jälkeen valinta nollautuu → napit takaisin disabloiduiksi', () => {
    const { el } = mount([makeMarker({ id: 'a' })], vi.fn())
    checkbox(el, 'a')!.click()
    expect(aseta(el).disabled).toBe(false)
    aseta(el).click()
    expect(aseta(el).disabled).toBe(true)
    expect(checkbox(el, 'a')!.checked).toBe(false)
  })

  it('"Valitse kaikki" valitsee vain valittavissa olevat — terminaali jää pois', () => {
    const onBulkStatus = vi.fn()
    const { el } = mount([
      makeMarker({ id: 'a' }),
      makeMarker({ id: 'b', distanceFromStart: 2000 }),
      makeMarker({ id: 'kerätty-1', status: 'kerätty', distanceFromStart: 3000 }),
    ], onBulkStatus)
    el.querySelector<HTMLInputElement>('.bulk-select-all')!.click()
    expect(aseta(el).textContent).toBe('✓ Aseta valituille (2)')
    aseta(el).click()
    expect(onBulkStatus).toHaveBeenCalledWith(['a', 'b'], 'asetettu')
  })

  it('"Valitse kaikki" uudelleen → tyhjentää valinnan', () => {
    const { el } = mount([makeMarker({ id: 'a' }), makeMarker({ id: 'b', distanceFromStart: 2000 })], vi.fn())
    el.querySelector<HTMLInputElement>('.bulk-select-all')!.click()
    expect(el.querySelector<HTMLInputElement>('.bulk-select-all')!.checked).toBe(true)
    el.querySelector<HTMLInputElement>('.bulk-select-all')!.click()
    expect(aseta(el).disabled).toBe(true)
    expect(checkbox(el, 'a')!.checked).toBe(false)
  })

  it('valinta säilyy ulkopuolisen re-renderin yli (update ei pyyhi kesken tehtyä valintaa)', () => {
    const { el, list } = mount([makeMarker({ id: 'a' }), makeMarker({ id: 'b', distanceFromStart: 2000 })], vi.fn())
    checkbox(el, 'a')!.click()
    list.render()
    expect(checkbox(el, 'a')!.checked).toBe(true)
    expect(aseta(el).textContent).toBe('✓ Aseta valituille (1)')
  })

  it('valittu merkki joka katoaa listalta karsiutuu valinnasta — laskuri ei valehtele', () => {
    const markers = [makeMarker({ id: 'a' }), makeMarker({ id: 'b', distanceFromStart: 2000 })]
    const onBulkStatus = vi.fn()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const list = new SegmentMarkerList(el, {
      getMarkers: () => markers,
      getSegment: () => SEG,
      onOpenDetail: () => {},
      onBulkStatus,
    })
    list.render()
    checkbox(el, 'a')!.click()
    checkbox(el, 'b')!.click()
    markers.splice(0, 1) // 'a' poistui pätkältä
    list.render()
    expect(aseta(el).textContent).toBe('✓ Aseta valituille (1)')
    aseta(el).click()
    expect(onBulkStatus).toHaveBeenCalledWith(['b'], 'asetettu')
  })

  it('checkbox ei ole rivipainikkeen sisällä — klikki ei avaa detaljia', () => {
    const opened: string[] = []
    const el = document.createElement('div')
    document.body.appendChild(el)
    new SegmentMarkerList(el, {
      getMarkers: () => [makeMarker({ id: 'a' })],
      getSegment: () => SEG,
      onOpenDetail: (id) => opened.push(id),
      onBulkStatus: vi.fn(),
    }).render()
    expect(el.querySelector('.segment-view-markers-row .marker-item-checkbox')).toBeNull()
    checkbox(el, 'a')!.click()
    expect(opened).toEqual([])
  })

  it('kaikki merkit terminaaleja → ei baria (pysyvästi disabloitu pinta ei vie tilaa)', () => {
    const { el } = mount([makeMarker({ id: 'a', status: 'kerätty' })], vi.fn())
    expect(el.querySelector('.bulk-action-bar')).toBeNull()
  })
})
