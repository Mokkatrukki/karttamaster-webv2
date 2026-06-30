import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AreaPanel } from '../src/ui/area-panel'
import type { AreaMarker } from '../src/logic/area-types'

const sampleArea: AreaMarker = {
  id: 'area-1',
  name: 'Huoltopiste',
  centerLat: 63.8,
  centerLng: 28.2,
  widthM: 60,
  heightM: 40,
  rotation: 0,
  markdownDescription: '',
  hashCode: 'abc123',
  status: 'suunniteltu',
  features: [
    {
      id: 'feat-1',
      name: 'Tarjoilupöytä',
      centerLat: 63.8001,
      centerLng: 28.2001,
      widthM: 10,
      heightM: 5,
      rotation: 0,
      color: '#4ade80',
    },
  ],
}

describe('T119 — AreaFeature inline edit', () => {
  let container: HTMLElement
  let onAreaUpdate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    onAreaUpdate = vi.fn()
  })

  function buildPanelExpanded(): AreaPanel {
    const panel = new AreaPanel(container, [sampleArea], { onAreaUpdate })
    // open section
    const header = container.querySelector('.left-panel-section-header') as HTMLElement
    header.click()
    // expand area sub-list
    const expandBtn = container.querySelector('[aria-label="Näytä komponentit"]') as HTMLElement
    expandBtn.click()
    return panel
  }

  it('✎-nappi lisätty feature-riville', () => {
    buildPanelExpanded()
    const editBtn = container.querySelector('.btn-feat-inline-edit')
    expect(editBtn).not.toBeNull()
  })

  it('✎-klikki siirtää rivin editing-tilaan ja fokusoi inputin', () => {
    buildPanelExpanded()
    const editBtn = container.querySelector('.btn-feat-inline-edit') as HTMLElement
    editBtn.click()
    const featRow = container.querySelector('.feat-row') as HTMLElement
    expect(featRow.classList.contains('editing')).toBe(true)
    const input = container.querySelector('.feat-inline-name-input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.value).toBe('Tarjoilupöytä')
  })

  it('Enter tallentaa nimen ja kutsuu onAreaUpdate', () => {
    buildPanelExpanded()
    const editBtn = container.querySelector('.btn-feat-inline-edit') as HTMLElement
    editBtn.click()
    const input = container.querySelector('.feat-inline-name-input') as HTMLInputElement
    input.value = 'Uusi nimi'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onAreaUpdate).toHaveBeenCalledOnce()
    const updated: AreaMarker = onAreaUpdate.mock.calls[0][0]
    expect(updated.features[0].name).toBe('Uusi nimi')
  })

  it('Escape peruu muutoksen ilman tallennusta', () => {
    buildPanelExpanded()
    const editBtn = container.querySelector('.btn-feat-inline-edit') as HTMLElement
    editBtn.click()
    const input = container.querySelector('.feat-inline-name-input') as HTMLInputElement
    input.value = 'Peruutettu nimi'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onAreaUpdate).not.toHaveBeenCalled()
    // rivi palautuu normaalitilaan
    const featRow = container.querySelector('.feat-row')
    expect(featRow?.classList.contains('editing')).toBeFalsy()
  })
})
