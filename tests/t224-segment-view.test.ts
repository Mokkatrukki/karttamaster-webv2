import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentView } from '../src/ui/segment-view'
import type { Segment, EquipmentItem } from '../src/logic/segments'
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

  // ---- E: välilehdet ----
  describe('välilehdet (E)', () => {
    it('kolme välilehteä: Pätkä, Kaikki merkit, Varusteet', () => {
      new SegmentView(container, makeSeg())
      const tabs = container.querySelectorAll('.segment-view-tab')
      expect(tabs.length).toBe(3)
      expect(Array.from(tabs).map(t => t.querySelector('.segment-view-tab-label')?.textContent))
        .toEqual(['Pätkä', 'Kaikki merkit', 'Varusteet'])
    })

    it('oletuksena Pätkä-välilehti aktiivinen, muut paneelit piilossa', () => {
      new SegmentView(container, makeSeg())
      const patka = container.querySelector('.segment-view-tab-panel[data-tab="patka"]') as HTMLElement
      const merkit = container.querySelector('.segment-view-tab-panel[data-tab="merkit"]') as HTMLElement
      const varusteet = container.querySelector('.segment-view-tab-panel[data-tab="varusteet"]') as HTMLElement
      expect(patka.hidden).toBe(false)
      expect(merkit.hidden).toBe(true)
      expect(varusteet.hidden).toBe(true)
      expect(container.querySelector('.segment-view-tab[data-tab="patka"]')?.classList.contains('active')).toBe(true)
    })

    it('Kaikki merkit -välilehden klikkaus näyttää merkkipaneelin, piilottaa pätkän', () => {
      new SegmentView(container, makeSeg())
      ;(container.querySelector('.segment-view-tab[data-tab="merkit"]') as HTMLButtonElement).click()
      expect((container.querySelector('.segment-view-tab-panel[data-tab="patka"]') as HTMLElement).hidden).toBe(true)
      expect((container.querySelector('.segment-view-tab-panel[data-tab="merkit"]') as HTMLElement).hidden).toBe(false)
    })

    it('merkkilista sijaitsee Kaikki merkit -paneelissa, varusteet Varusteet-paneelissa', () => {
      const view = new SegmentView(container, makeSeg())
      view.update([makeMarker()])
      expect(container.querySelector('.segment-view-tab-panel[data-tab="merkit"] .segment-view-list')).not.toBeNull()
      expect(container.querySelector('.segment-view-tab-panel[data-tab="varusteet"] .segment-view-equipment')).not.toBeNull()
      // hero + progress pätkä-paneelissa / sen ulkopuolella (progress aina näkyvissä)
      expect(container.querySelector('.segment-view-tab-panel[data-tab="patka"] .segment-view-next')).not.toBeNull()
    })

    it('välilehtilaskurit: merkit-määrä ja varuste-määrä', () => {
      const view = new SegmentView(container, makeSeg({ equipment: [{ name: 'Nauha', count: 3 }] }))
      view.update([makeMarker({ id: 'a' }), makeMarker({ id: 'b', distanceFromStart: 8000 })])
      const merkitCount = container.querySelector('.segment-view-tab[data-tab="merkit"] .segment-view-tab-count')?.textContent
      const varusteetCount = container.querySelector('.segment-view-tab[data-tab="varusteet"] .segment-view-tab-count')?.textContent
      expect(merkitCount).toBe('2')
      // auto (2 merkkiä) + manuaali (3) = 5
      expect(varusteetCount).toBe('5')
    })
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

    it('"Siirretty" disabled kun onMoveMarker puuttuu', () => {
      const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
      view.update([makeMarker({ status: 'suunniteltu' })])
      expect((container.querySelector('.segment-view-next-move') as HTMLButtonElement).disabled).toBe(true)
    })

    it('"Siirretty" kutsuu onMoveMarker kun annettu', () => {
      let movedId: string | null = null
      const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }), undefined, undefined, {
        onMoveMarker: (id) => { movedId = id },
      })
      view.update([makeMarker({ id: 'm7', status: 'suunniteltu' })])
      const moveBtn = container.querySelector('.segment-view-next-move') as HTMLButtonElement
      expect(moveBtn.disabled).toBe(false)
      moveBtn.click()
      expect(movedId).toBe('m7')
    })

    it('"Ota kuva" + "Laita kommentti" disabled (tulossa, T221)', () => {
      const view = new SegmentView(container, makeSeg({ phase: 'asettaminen' }))
      view.update([makeMarker({ status: 'suunniteltu' })])
      expect((container.querySelector('.segment-view-next-photo') as HTMLButtonElement).disabled).toBe(true)
      expect((container.querySelector('.segment-view-next-comment') as HTMLButtonElement).disabled).toBe(true)
    })
  })

  // ---- C: varustelista muokattava ----
  describe('varustelista muokattava (C)', () => {
    it('ilman onEquipmentChange: readonly (ei inputteja)', () => {
      const view = new SegmentView(container, makeSeg({ equipment: [{ name: 'Nauha', count: 5 }] }))
      view.update([])
      expect(container.querySelector('.segment-view-equipment-name')).toBeNull()
      expect(container.querySelector('.equipment-manual-item')?.textContent).toContain('5× Nauha')
    })

    it('onEquipmentChange annettu: manuaalirivit inputteina + lisää-nappi', () => {
      const view = new SegmentView(container, makeSeg({ equipment: [{ name: 'Nauha', count: 5 }] }), undefined, undefined, {
        onEquipmentChange: () => {},
      })
      view.update([])
      expect((container.querySelector('.segment-view-equipment-name') as HTMLInputElement).value).toBe('Nauha')
      expect((container.querySelector('.segment-view-equipment-count') as HTMLInputElement).value).toBe('5')
      expect(container.querySelector('.segment-view-equipment-add')).not.toBeNull()
    })

    it('"Lisää varuste" kutsuu onEquipmentChange +1 rivillä', () => {
      let latest: EquipmentItem[] | null = null
      const view = new SegmentView(container, makeSeg({ equipment: [{ name: 'Nauha', count: 5 }] }), undefined, undefined, {
        onEquipmentChange: (e) => { latest = e },
      })
      view.update([])
      ;(container.querySelector('.segment-view-equipment-add') as HTMLButtonElement).click()
      expect(latest).toHaveLength(2)
      expect(latest![1]).toEqual({ name: '', count: 1 })
    })

    it('nimen muutos päivittää oikean rivin', () => {
      let latest: EquipmentItem[] | null = null
      const view = new SegmentView(container, makeSeg({ equipment: [{ name: 'Nauha', count: 5 }] }), undefined, undefined, {
        onEquipmentChange: (e) => { latest = e },
      })
      view.update([])
      const nameInput = container.querySelector('.segment-view-equipment-name') as HTMLInputElement
      nameInput.value = 'Keppi'
      nameInput.dispatchEvent(new Event('change'))
      expect(latest).toEqual([{ name: 'Keppi', count: 5 }])
    })

    it('määrän muutos päivittää oikean rivin (min 1)', () => {
      let latest: EquipmentItem[] | null = null
      const view = new SegmentView(container, makeSeg({ equipment: [{ name: 'Nauha', count: 5 }] }), undefined, undefined, {
        onEquipmentChange: (e) => { latest = e },
      })
      view.update([])
      const countInput = container.querySelector('.segment-view-equipment-count') as HTMLInputElement
      countInput.value = '12'
      countInput.dispatchEvent(new Event('change'))
      expect(latest).toEqual([{ name: 'Nauha', count: 12 }])
    })

    it('poisto lyhentää listan', () => {
      let latest: EquipmentItem[] | null = null
      const view = new SegmentView(container, makeSeg({ equipment: [{ name: 'Nauha', count: 5 }, { name: 'Vasara', count: 1 }] }), undefined, undefined, {
        onEquipmentChange: (e) => { latest = e },
      })
      view.update([])
      ;(container.querySelectorAll('.segment-view-equipment-remove')[0] as HTMLButtonElement).click()
      expect(latest).toEqual([{ name: 'Vasara', count: 1 }])
    })
  })
})
