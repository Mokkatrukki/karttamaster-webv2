import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAreaMarker, addFeature } from '../src/logic/area-types'
import type { AreaMarker, AreaFeature } from '../src/logic/area-types'

// AreaPanel importataan dynaamisesti koska se mutoi DOM:ia
async function importAreaPanel() {
  return import('../src/ui/area-panel')
}

const BASE_AREA: AreaMarker = createAreaMarker({
  id: 'area-1',
  name: 'Huoltopiste 25km',
  centerLat: 63.8,
  centerLng: 28.2,
  widthM: 60,
  heightM: 40,
  rotation: 0,
  markdownDescription: '## Ruoka',
  hashCode: 'abc123',
})

const SAMPLE_FEATURE: AreaFeature = {
  id: 'feat-1',
  name: 'Tarjoilupöytä',
  centerLat: 63.8001,
  centerLng: 28.2001,
  widthM: 10,
  heightM: 5,
  rotation: 0,
  color: '#4ade80',
}

beforeEach(() => {
  document.body.innerHTML = '<div id="area-panel-container"></div>'
  // Mock window.prompt and window.confirm
  vi.stubGlobal('prompt', vi.fn(() => 'Testi'))
  vi.stubGlobal('confirm', vi.fn(() => true))
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('AreaPanel — section-pattern (V61)', () => {
  it('renderöi section-headerin otsikolla "Alueet"', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    new AreaPanel(container, [])
    const header = container.querySelector('.left-panel-section-header')
    expect(header).not.toBeNull()
    expect(header!.textContent).toContain('Alueet')
  })

  it('count päivittyy alueiden mukaan', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    new AreaPanel(container, [BASE_AREA])
    const count = container.querySelector('.area-section-count')
    expect(count?.textContent).toContain('1')
  })

  it('section-footer add-nappi löytyy', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    new AreaPanel(container, [])
    const addBtn = container.querySelector('.btn-area-add')
    expect(addBtn).not.toBeNull()
    expect(addBtn!.textContent).toContain('Lisää alue')
  })

  it('alue-item renderöityy nimellä ja ··· -napilla', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    new AreaPanel(container, [BASE_AREA])
    // Avaa collapse
    const header = container.querySelector('.left-panel-section-header') as HTMLElement
    header.click()
    const item = container.querySelector('.area-item')
    expect(item).not.toBeNull()
    expect(item!.textContent).toContain('Huoltopiste 25km')
    const dotsBtn = container.querySelector('.btn-area-dots')
    expect(dotsBtn).not.toBeNull()
  })
})

describe('AreaPanel — details-modaali (V62)', () => {
  it('modaali avautuu ··· -napista', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    new AreaPanel(container, [BASE_AREA])
    const header = container.querySelector('.left-panel-section-header') as HTMLElement
    header.click()
    const dotsBtn = container.querySelector('.btn-area-dots') as HTMLButtonElement
    dotsBtn.click()
    const modal = document.querySelector('.area-details-modal')
    expect(modal).not.toBeNull()
  })

  it('modaali sulkeutuu ✕-napista', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    const panel = new AreaPanel(container, [BASE_AREA])
    panel.openDetailsModal(BASE_AREA)
    expect(document.querySelector('.area-details-modal')).not.toBeNull()
    const closeBtn = document.querySelector('.btn-area-modal-close') as HTMLButtonElement
    closeBtn.click()
    expect(document.querySelector('.area-details-modal')).toBeNull()
  })

  it('modaali sulkeutuu Escape-näppäimellä', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    const panel = new AreaPanel(container, [BASE_AREA])
    panel.openDetailsModal(BASE_AREA)
    expect(document.querySelector('.area-details-modal')).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.querySelector('.area-details-modal')).toBeNull()
  })

  it('modaali sulkeutuu backdrop-klikistä', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    const panel = new AreaPanel(container, [BASE_AREA])
    panel.openDetailsModal(BASE_AREA)
    expect(document.querySelector('.area-details-modal')).not.toBeNull()
    const backdrop = document.querySelector('.area-modal-backdrop') as HTMLElement
    backdrop.click()
    expect(document.querySelector('.area-details-modal')).toBeNull()
  })

  it('modaali sisältää nimi-inputin alueen nimellä', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    const panel = new AreaPanel(container, [BASE_AREA])
    panel.openDetailsModal(BASE_AREA)
    const nameInput = document.querySelector('.area-name-input') as HTMLInputElement
    expect(nameInput).not.toBeNull()
    expect(nameInput.value).toBe('Huoltopiste 25km')
  })

  it('modaali sisältää markdown-kuvaus-textarean', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    const panel = new AreaPanel(container, [BASE_AREA])
    panel.openDetailsModal(BASE_AREA)
    const textarea = document.querySelector('.area-desc-textarea') as HTMLTextAreaElement
    expect(textarea).not.toBeNull()
    expect(textarea.value).toBe('## Ruoka')
  })
})

describe('AreaPanel — feature-lisäys', () => {
  it('feature-lisäys-nappi löytyy modaalista', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    const panel = new AreaPanel(container, [BASE_AREA])
    panel.openDetailsModal(BASE_AREA)
    const addFeatBtn = document.querySelector('.btn-area-add-feature')
    expect(addFeatBtn).not.toBeNull()
    expect(addFeatBtn!.textContent).toContain('Lisää sisäinen alue')
  })

  it('olemassa oleva feature näkyy listassa', async () => {
    const { AreaPanel } = await importAreaPanel()
    const areaWithFeat = addFeature(BASE_AREA, SAMPLE_FEATURE)
    const container = document.getElementById('area-panel-container')!
    const panel = new AreaPanel(container, [areaWithFeat])
    panel.openDetailsModal(areaWithFeat)
    const featureItem = document.querySelector('.area-feature-item')
    expect(featureItem).not.toBeNull()
  })

  it('feature-poistonappi löytyy feature-riviltä', async () => {
    const { AreaPanel } = await importAreaPanel()
    const areaWithFeat = addFeature(BASE_AREA, SAMPLE_FEATURE)
    const container = document.getElementById('area-panel-container')!
    const panel = new AreaPanel(container, [areaWithFeat])
    panel.openDetailsModal(areaWithFeat)
    const deleteBtn = document.querySelector('.btn-feat-delete')
    expect(deleteBtn).not.toBeNull()
  })

  it('onAreaAdd kutsutaan kun feature lisätään', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    const onAreaUpdate = vi.fn()
    const panel = new AreaPanel(container, [BASE_AREA], { onAreaUpdate })
    panel.openDetailsModal(BASE_AREA)
    const addFeatBtn = document.querySelector('.btn-area-add-feature') as HTMLButtonElement
    addFeatBtn.click()
    expect(onAreaUpdate).toHaveBeenCalledOnce()
    const updatedArea = onAreaUpdate.mock.calls[0][0]
    expect(updatedArea.features).toHaveLength(1)
  })
})

describe('AreaPanel — status-vaihto', () => {
  it('"Merkitse valmiiksi" -nappi löytyy modaalista', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    const panel = new AreaPanel(container, [BASE_AREA])
    panel.openDetailsModal(BASE_AREA)
    const valmisBtn = document.querySelector('.btn-area-set-valmis')
    expect(valmisBtn).not.toBeNull()
    expect(valmisBtn!.textContent).toContain('Merkitse valmiiksi')
  })

  it('status-vaihto kutsuu onAreaUpdate', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    const onAreaUpdate = vi.fn()
    const panel = new AreaPanel(container, [BASE_AREA], { onAreaUpdate })
    panel.openDetailsModal(BASE_AREA)
    const valmisBtn = document.querySelector('.btn-area-set-valmis') as HTMLButtonElement
    valmisBtn.click()
    expect(onAreaUpdate).toHaveBeenCalledOnce()
    const updatedArea = onAreaUpdate.mock.calls[0][0]
    expect(updatedArea.status).toBe('valmis')
  })

  it('window.confirm kutsutaan ennen valmis-tilansiirtoa', async () => {
    const { AreaPanel } = await importAreaPanel()
    const container = document.getElementById('area-panel-container')!
    const panel = new AreaPanel(container, [BASE_AREA], {})
    panel.openDetailsModal(BASE_AREA)
    const valmisBtn = document.querySelector('.btn-area-set-valmis') as HTMLButtonElement
    valmisBtn.click()
    expect(window.confirm).toHaveBeenCalled()
  })
})
