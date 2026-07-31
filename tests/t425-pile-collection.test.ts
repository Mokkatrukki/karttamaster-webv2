// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentView, type SegmentViewActions } from '../src/ui/segment-view'
import { PILE_TEMPLATE_ID } from '../src/logic/pile'
import type { Segment } from '../src/logic/segments'
import type { MarkerStatus, SignMarker } from '../src/logic/types'

// Reititön keräystehtävä (V139) + markerTypeFilter (V143) = autoporukan kasalista.
function kasaTehtava(): Segment {
  return {
    id: 'seg-kasat', routeIds: undefined, startDist: undefined, endDist: undefined,
    equipment: [], phase: 'purku', displayName: 'Keräyskasat',
    markerTypeFilter: PILE_TEMPLATE_ID,
  } as unknown as Segment
}

function kasa(id: string, ids: string[], lat = 65, status: MarkerStatus = 'suunniteltu'): SignMarker {
  return {
    id, type: PILE_TEMPLATE_ID, lat, lon: 27, distanceFromStart: 0,
    routeIds: [], status, templateId: PILE_TEMPLATE_ID, pileMarkerIds: ids, label: `Kasa ${id}`,
  }
}

function mount(markers: SignMarker[], actions: SegmentViewActions = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const view = new SegmentView(container, kasaTehtava(), undefined, undefined, actions)
  view.update(markers)
  return { container, view }
}

describe('T425 — autoporukan kasanhaku', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('(i) kasan merkkimäärä näkyy rivillä', () => {
    const { container } = mount([kasa('p1', ['a', 'b', 'c'])])
    expect(container.querySelector('.segment-view-collect-count')?.textContent).toBe('3 merkkiä')
  })

  it('(i) tavallinen merkki ei saa merkkimäärää', () => {
    const tavallinen: SignMarker = {
      id: 'm1', type: 'right', lat: 65, lon: 27, distanceFromStart: 0,
      routeIds: [], status: 'suunniteltu',
    }
    const { container } = mount([tavallinen])
    expect(container.querySelector('.segment-view-collect-count')).toBeNull()
  })

  it('(ii) rivillä on navigointilinkki kasan koordinaatteihin (V286)', () => {
    const { container } = mount([kasa('p1', ['a'])])
    const nav = container.querySelector('.segment-view-collect-nav') as HTMLAnchorElement
    expect(nav).not.toBeNull()
    expect(nav.href).toContain('destination=65.000000,27.000000')
    expect(nav.target).toBe('_blank')
  })

  it('(ii) kelvottomat koordinaatit → ei navilinkkiä (V250: ei rikkinäistä pintaa)', () => {
    const rikki = { ...kasa('p1', ['a']), lat: Number.NaN }
    const { container } = mount([rikki])
    expect(container.querySelector('.segment-view-collect-nav')).toBeNull()
  })

  it('(iii) listan järjestys EI muutu GPS-fixin mukana (V304)', () => {
    let pos = { lat: 65.9, lon: 27 }
    const markers = [kasa('eka', ['a'], 65.0), kasa('toka', ['b'], 65.9)]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const view = new SegmentView(container, kasaTehtava(), undefined, undefined, {
      gpsPosition: () => pos,
    })
    view.update(markers)
    const order1 = [...container.querySelectorAll('.segment-view-collect-name')].map(e => e.textContent)
    pos = { lat: 65.0, lon: 27 }
    view.update(markers)
    const order2 = [...container.querySelectorAll('.segment-view-collect-name')].map(e => e.textContent)
    expect(order2).toEqual(order1)
  })

  it('(iv) lähin kasa vaihtuu fixin mukana omalla rivillään', () => {
    let pos = { lat: 65.0, lon: 27 }
    const markers = [kasa('eka', ['a'], 65.0), kasa('toka', ['b', 'c'], 65.9)]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const view = new SegmentView(container, kasaTehtava(), undefined, undefined, {
      gpsPosition: () => pos,
    })
    view.update(markers)
    expect(container.querySelector('.segment-view-collect-nearest')?.textContent).toContain('Kasa eka')
    pos = { lat: 65.9, lon: 27 }
    view.update(markers)
    const near = container.querySelector('.segment-view-collect-nearest')?.textContent
    expect(near).toContain('Kasa toka')
    expect(near).toContain('2 merkkiä')
  })

  it('ei GPS-fixiä → ei lähin-riviä (ei valheellista ohjausta)', () => {
    const { container } = mount([kasa('p1', ['a'])])
    expect(container.querySelector('.segment-view-collect-nearest')).toBeNull()
  })

  it('jo haettu kasa ei ehdota itseään lähimpänä', () => {
    const { container } = mount(
      [kasa('haettu', ['a'], 65.0, 'kerätty'), kasa('avoin', ['b'], 65.9)],
      { gpsPosition: () => ({ lat: 65.0, lon: 27 }) },
    )
    expect(container.querySelector('.segment-view-collect-nearest')?.textContent).toContain('Kasa avoin')
  })

  it('(v) "Haettu"-kuittaus ennallaan (regressio T218)', () => {
    const calls: Array<[string, boolean]> = []
    const { container } = mount([kasa('p1', ['a'])], {
      onCollectMarker: (id, c) => calls.push([id, c]),
    })
    const btn = container.querySelector('.segment-view-collect-btn') as HTMLButtonElement
    expect(btn.textContent).toContain('Haettu')
    btn.click()
    expect(calls).toEqual([['p1', true]])
  })
})
