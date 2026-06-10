import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { SegmentStore } from '../src/logic/segments'

function setup() {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const store: SegmentStore = createSegmentStore()
  createSegment(store, {
    routeIds: ['35km'],
    startDist: 5000,
    endDist: 12000,
    equipment: [],
    phase: 'asettaminen',
    displayName: 'Pätkä 1',
  })

  const panel = new SegmentPanel(container, [], store, vi.fn())
  return { container, store, panel }
}

describe('T26 — Segment assign flow', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('näyttää assign-lomake kun pätkä ei ole jaettu', () => {
    const { container } = setup()
    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    expect(codeInput).not.toBeNull()
    expect(codeInput.placeholder).toBe('Koodi')
  })

  it('tallentaa assignedCode + displayName kun Tallenna klikataan', () => {
    const { container, store } = setup()
    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const nameInput = container.querySelector('.input-assign-name') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement

    codeInput.value = 'matti123'
    nameInput.value = 'Matin pätkä'
    saveBtn.click()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBe('matti123')
    expect(seg.displayName).toBe('Matin pätkä')
  })

  it('ei tallenna kun koodi on tyhjä', () => {
    const { container, store } = setup()
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement
    saveBtn.click()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
  })

  it('näyttää URL ja kopiointinappi kun assignedCode on asetettu', () => {
    const { container, store } = setup()
    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement

    codeInput.value = 'matti123'
    saveBtn.click()

    const urlSpan = container.querySelector('.segment-url')
    const copyBtn = container.querySelector('.btn-copy-url')
    expect(urlSpan?.textContent).toBe('/s/matti123')
    expect(copyBtn).not.toBeNull()
  })

  it('URL muotoa /s/<koodi> (V27)', () => {
    const { container } = setup()
    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement

    codeInput.value = 'pekkanen'
    saveBtn.click()

    const urlSpan = container.querySelector('.segment-url')
    expect(urlSpan?.textContent).toMatch(/^\/s\/[a-z0-9]+$/)
    expect(urlSpan?.textContent).toBe('/s/pekkanen')
  })

  it('Muuta-nappi poistaa assignedCode ja näyttää lomakkeen uudelleen', () => {
    const { container, store } = setup()
    const codeInput = container.querySelector('.input-assign-code') as HTMLInputElement
    const saveBtn = container.querySelector('.btn-assign-save') as HTMLButtonElement

    codeInput.value = 'matti123'
    saveBtn.click()

    const editBtn = container.querySelector('.btn-assign-edit') as HTMLButtonElement
    editBtn.click()

    const seg = Array.from(store.values())[0]
    expect(seg.assignedCode).toBeUndefined()
    const newCodeInput = container.querySelector('.input-assign-code')
    expect(newCodeInput).not.toBeNull()
  })

  it('käyttää segment displayName kenttäarvona nimen inputissa', () => {
    const { container } = setup()
    const nameInput = container.querySelector('.input-assign-name') as HTMLInputElement
    expect(nameInput.value).toBe('Pätkä 1')
  })
})
