import { describe, it, expect, beforeEach } from 'vitest'
import { EquipmentModal } from '../src/ui/equipment-modal'
import type { Segment, EquipmentItem } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1', routeIds: ['35km'], startDist: 0, endDist: 10000,
    equipment: [], phase: 'asettaminen', displayName: 'Pätkä', ...overrides,
  }
}
function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm', type: 'right', lat: 63, lon: 27, distanceFromStart: 1000,
    routeIds: ['35km'], status: 'suunniteltu', ...overrides,
  }
}

describe('T224 — EquipmentModal', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('open renderöi auto-laskurin (readonly) + manuaalirivit + Tallenna', () => {
    const modal = new EquipmentModal(() => {})
    modal.open(makeSeg({ equipment: [{ name: 'Nauha', count: 5 }] }), [makeMarker({ type: 'left' })])
    expect(document.querySelector('.equipment-modal')).not.toBeNull()
    expect(document.querySelector('.equipment-modal-auto-list .equipment-auto-item')?.textContent).toContain('Vasemmalle')
    expect((document.querySelector('.equipment-modal-name') as HTMLInputElement).value).toBe('Nauha')
    expect((document.querySelector('.equipment-modal-count') as HTMLInputElement).value).toBe('5')
    expect(document.querySelector('.equipment-modal-save')).not.toBeNull()
  })

  it('Tallenna kutsuu onSave muokatuilla arvoilla + sulkee', () => {
    let saved: EquipmentItem[] | null = null
    const modal = new EquipmentModal((e) => { saved = e })
    modal.open(makeSeg({ equipment: [{ name: 'Nauha', count: 5 }] }), [])
    const nameInput = document.querySelector('.equipment-modal-name') as HTMLInputElement
    nameInput.value = 'Keppi'
    nameInput.dispatchEvent(new Event('input'))
    ;(document.querySelector('.equipment-modal-save') as HTMLButtonElement).click()
    expect(saved).toEqual([{ name: 'Keppi', count: 5 }])
    expect(document.querySelector('.equipment-modal')).toBeNull()
  })

  it('Lisää varuste + Tallenna → uusi rivi mukana', () => {
    let saved: EquipmentItem[] | null = null
    const modal = new EquipmentModal((e) => { saved = e })
    modal.open(makeSeg({ equipment: [] }), [])
    ;(document.querySelector('.equipment-modal-add') as HTMLButtonElement).click()
    const name = document.querySelector('.equipment-modal-name') as HTMLInputElement
    name.value = '3 vasaraa'; name.dispatchEvent(new Event('input'))
    const count = document.querySelector('.equipment-modal-count') as HTMLInputElement
    count.value = '3'; count.dispatchEvent(new Event('input'))
    ;(document.querySelector('.equipment-modal-save') as HTMLButtonElement).click()
    expect(saved).toEqual([{ name: '3 vasaraa', count: 3 }])
  })

  it('poisto poistaa rivin listasta', () => {
    let saved: EquipmentItem[] | null = null
    const modal = new EquipmentModal((e) => { saved = e })
    modal.open(makeSeg({ equipment: [{ name: 'Nauha', count: 5 }, { name: 'Vasara', count: 1 }] }), [])
    ;(document.querySelectorAll('.equipment-modal-remove')[0] as HTMLButtonElement).click()
    ;(document.querySelector('.equipment-modal-save') as HTMLButtonElement).click()
    expect(saved).toEqual([{ name: 'Vasara', count: 1 }])
  })

  it('tyhjänimiset rivit karsitaan tallennuksessa', () => {
    let saved: EquipmentItem[] | null = null
    const modal = new EquipmentModal((e) => { saved = e })
    modal.open(makeSeg({ equipment: [{ name: '', count: 1 }, { name: 'Nauha', count: 2 }] }), [])
    ;(document.querySelector('.equipment-modal-save') as HTMLButtonElement).click()
    expect(saved).toEqual([{ name: 'Nauha', count: 2 }])
  })

  it('Peruuta sulkee tallentamatta', () => {
    let called = false
    const modal = new EquipmentModal(() => { called = true })
    modal.open(makeSeg({ equipment: [{ name: 'Nauha', count: 5 }] }), [])
    ;(document.querySelector('.equipment-modal-cancel') as HTMLButtonElement).click()
    expect(called).toBe(false)
    expect(document.querySelector('.equipment-modal')).toBeNull()
  })

  it('✕ sulkee modaalin', () => {
    const modal = new EquipmentModal(() => {})
    modal.open(makeSeg(), [])
    expect(modal.isOpen()).toBe(true)
    ;(document.querySelector('.equipment-modal-close') as HTMLButtonElement).click()
    expect(modal.isOpen()).toBe(false)
  })
})
