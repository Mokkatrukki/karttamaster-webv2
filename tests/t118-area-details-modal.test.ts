import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AreaDetailsModal } from '../src/ui/area-details-modal'
import { createAreaMarker } from '../src/logic/area-types'
import type { AreaMarker } from '../src/logic/area-types'

const BASE_AREA: AreaMarker = createAreaMarker({
  id: 'area-1',
  name: 'Huoltopiste 25km',
  centerLat: 63.8,
  centerLng: 28.2,
  widthM: 60,
  heightM: 40,
  rotation: 0,
  markdownDescription: 'Ruoka ja juoma',
  hashCode: 'abc123',
})

function makeModal() {
  const onAreaUpdate = vi.fn()
  const onAreaDelete = vi.fn()
  const modal = new AreaDetailsModal({ onAreaUpdate, onAreaDelete })
  modal.open(BASE_AREA)
  return { modal, onAreaUpdate, onAreaDelete }
}

function fireBlur(el: Element) {
  el.dispatchEvent(new Event('blur', { bubbles: true }))
}

function fireChange(el: Element) {
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.stubGlobal('confirm', vi.fn(() => true))
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('T118 — AreaDetailsModal UX-yhtenäistys (V72, V73)', () => {
  it('ei "Tallenna"-nappeja — ei btn-area-name-save, btn-area-size-save, btn-area-desc-save', () => {
    makeModal()
    expect(document.querySelector('.btn-area-name-save')).toBeNull()
    expect(document.querySelector('.btn-area-size-save')).toBeNull()
    expect(document.querySelector('.btn-area-desc-save')).toBeNull()
  })

  it('blur nimi-inputissa → onAreaUpdate kutsutaan uudella nimellä (V72)', () => {
    const { onAreaUpdate } = makeModal()
    const nameInput = document.querySelector('.area-name-input') as HTMLInputElement
    expect(nameInput).not.toBeNull()
    nameInput.value = 'Uusi nimi'
    fireBlur(nameInput)
    expect(onAreaUpdate).toHaveBeenCalledOnce()
    expect(onAreaUpdate.mock.calls[0][0].name).toBe('Uusi nimi')
  })

  it('Enter nimi-inputissa → onAreaUpdate kutsutaan (V72)', () => {
    const { onAreaUpdate } = makeModal()
    const nameInput = document.querySelector('.area-name-input') as HTMLInputElement
    nameInput.value = 'Enter-nimi'
    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onAreaUpdate).toHaveBeenCalledOnce()
    expect(onAreaUpdate.mock.calls[0][0].name).toBe('Enter-nimi')
  })

  it('tyhjä nimi blur → onAreaUpdate ei kutsu (säilytä vanha)', () => {
    const { onAreaUpdate } = makeModal()
    const nameInput = document.querySelector('.area-name-input') as HTMLInputElement
    nameInput.value = '   '
    fireBlur(nameInput)
    expect(onAreaUpdate).not.toHaveBeenCalled()
  })

  it('blur koko-inputissa → onAreaUpdate kutsutaan (V73)', () => {
    const { onAreaUpdate } = makeModal()
    const widthInput = document.querySelector('.area-width-input') as HTMLInputElement
    widthInput.value = '120'
    fireBlur(widthInput)
    expect(onAreaUpdate).toHaveBeenCalledOnce()
    expect(onAreaUpdate.mock.calls[0][0].widthM).toBe(120)
  })

  it('blur ohjeteksti-textarea → onAreaUpdate kutsutaan (V72)', () => {
    const { onAreaUpdate } = makeModal()
    const textarea = document.querySelector('.area-desc-textarea') as HTMLTextAreaElement
    textarea.value = 'Uusi ohjeteksti\nToinen rivi'
    fireBlur(textarea)
    expect(onAreaUpdate).toHaveBeenCalledOnce()
    expect(onAreaUpdate.mock.calls[0][0].markdownDescription).toBe('Uusi ohjeteksti\nToinen rivi')
  })

  it('ohjeteksti label on "Ohjeteksti" — ei "Markdown" (V72)', () => {
    makeModal()
    const labels = Array.from(document.querySelectorAll('label'))
    const descLabel = labels.find(l => l.textContent?.toLowerCase().includes('ohjeteksti'))
    expect(descLabel).not.toBeNull()
    expect(descLabel?.textContent?.toLowerCase()).not.toContain('markdown')
  })

  it('footerissa on "Poista alue" -nappi (V73, V62)', () => {
    makeModal()
    expect(document.querySelector('.btn-area-delete')).not.toBeNull()
  })

  it('"Poista alue" + confirm → onAreaDelete kutsutaan + modaali sulkeutuu (V73)', () => {
    const { onAreaDelete } = makeModal()
    vi.stubGlobal('confirm', vi.fn(() => true))
    const deleteBtn = document.querySelector('.btn-area-delete') as HTMLButtonElement
    deleteBtn.click()
    expect(onAreaDelete).toHaveBeenCalledOnce()
    expect(onAreaDelete.mock.calls[0][0]).toBe('area-1')
    expect(document.querySelector('.area-details-modal')).toBeNull()
  })

  it('"Poista alue" + cancel → onAreaDelete ei kutsu (V73)', () => {
    const { onAreaDelete } = makeModal()
    vi.stubGlobal('confirm', vi.fn(() => false))
    const deleteBtn = document.querySelector('.btn-area-delete') as HTMLButtonElement
    deleteBtn.click()
    expect(onAreaDelete).not.toHaveBeenCalled()
    expect(document.querySelector('.area-details-modal')).not.toBeNull()
  })

  it('✕-nappi sulkee modaalin', () => {
    makeModal()
    const closeBtn = document.querySelector('.btn-area-modal-close') as HTMLButtonElement
    closeBtn.click()
    expect(document.querySelector('.area-details-modal')).toBeNull()
  })
})
