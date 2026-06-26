import { describe, it, expect } from 'vitest'
import {
  createAreaMarker,
  addFeature,
  removeFeature,
  setAreaStatus,
  type AreaMarker,
  type AreaFeature,
} from '../src/logic/area-types'

const baseParams = {
  id: 'area-1',
  name: 'Huoltopiste 25km',
  centerLat: 63.8,
  centerLng: 28.2,
  widthM: 60,
  heightM: 40,
  rotation: 0,
  markdownDescription: '## Ruoka\nSyötävää saatavilla.',
  hashCode: 'abc123xyz',
}

const sampleFeature: AreaFeature = {
  id: 'feat-1',
  name: 'Tarjoilupöytä',
  centerLat: 63.8001,
  centerLng: 28.2001,
  widthM: 10,
  heightM: 5,
  rotation: 0,
  color: '#4ade80',
}

describe('createAreaMarker', () => {
  it('luo alueen oletusarvoilla', () => {
    const area = createAreaMarker(baseParams)
    expect(area.id).toBe('area-1')
    expect(area.name).toBe('Huoltopiste 25km')
    expect(area.status).toBe('suunniteltu')
    expect(area.features).toEqual([])
    expect(area.hashCode).toBe('abc123xyz')
    expect(area.widthM).toBe(60)
    expect(area.heightM).toBe(40)
  })

  it('roundtrip — kaikki kentät tallentuvat', () => {
    const area = createAreaMarker(baseParams)
    expect(area).toMatchObject(baseParams)
  })
})

describe('addFeature', () => {
  it('lisää featureen listaan', () => {
    const area = createAreaMarker(baseParams)
    const updated = addFeature(area, sampleFeature)
    expect(updated.features).toHaveLength(1)
    expect(updated.features[0].id).toBe('feat-1')
    expect(updated.features[0].name).toBe('Tarjoilupöytä')
  })

  it('ei mutoi alkuperäistä aluetta', () => {
    const area = createAreaMarker(baseParams)
    addFeature(area, sampleFeature)
    expect(area.features).toHaveLength(0)
  })

  it('lisää useita featuren', () => {
    const area = createAreaMarker(baseParams)
    const feat2: AreaFeature = { ...sampleFeature, id: 'feat-2', name: 'Jakaja' }
    const updated = addFeature(addFeature(area, sampleFeature), feat2)
    expect(updated.features).toHaveLength(2)
  })

  it('feature ilman nimeä on sallittu', () => {
    const noName: AreaFeature = { ...sampleFeature, id: 'feat-3', name: undefined }
    const area = createAreaMarker(baseParams)
    const updated = addFeature(area, noName)
    expect(updated.features[0].name).toBeUndefined()
  })
})

describe('removeFeature', () => {
  it('poistaa featureen id:llä', () => {
    const area = addFeature(createAreaMarker(baseParams), sampleFeature)
    const updated = removeFeature(area, 'feat-1')
    expect(updated.features).toHaveLength(0)
  })

  it('ei mutoi alkuperäistä aluetta', () => {
    const area = addFeature(createAreaMarker(baseParams), sampleFeature)
    removeFeature(area, 'feat-1')
    expect(area.features).toHaveLength(1)
  })

  it('tuntematon id ei kaada — lista pysyy ennallaan', () => {
    const area = addFeature(createAreaMarker(baseParams), sampleFeature)
    const updated = removeFeature(area, 'ei-olemassa')
    expect(updated.features).toHaveLength(1)
  })

  it('poistaa oikean featureen kun useita', () => {
    const feat2: AreaFeature = { ...sampleFeature, id: 'feat-2' }
    const area = addFeature(addFeature(createAreaMarker(baseParams), sampleFeature), feat2)
    const updated = removeFeature(area, 'feat-1')
    expect(updated.features).toHaveLength(1)
    expect(updated.features[0].id).toBe('feat-2')
  })
})

describe('setAreaStatus', () => {
  it('suunniteltu → valmis', () => {
    const area = createAreaMarker(baseParams)
    expect(area.status).toBe('suunniteltu')
    const updated = setAreaStatus(area, 'valmis')
    expect(updated.status).toBe('valmis')
  })

  it('valmis → suunniteltu (reset mahdollinen)', () => {
    const area = setAreaStatus(createAreaMarker(baseParams), 'valmis')
    const reset = setAreaStatus(area, 'suunniteltu')
    expect(reset.status).toBe('suunniteltu')
  })

  it('ei mutoi alkuperäistä aluetta', () => {
    const area = createAreaMarker(baseParams)
    setAreaStatus(area, 'valmis')
    expect(area.status).toBe('suunniteltu')
  })

  it('status on alue-tason — featuret pysyvät muuttumattomina', () => {
    const area = addFeature(createAreaMarker(baseParams), sampleFeature)
    const updated = setAreaStatus(area, 'valmis')
    expect(updated.features).toHaveLength(1)
    expect(updated.features[0].id).toBe('feat-1')
  })
})

describe('T116 — AreaFeature itsenäinen sijoitus (V68)', () => {
  it('feature voi sijoittua mihin tahansa — ei lukittu parent-alueen centeriin', () => {
    const area = createAreaMarker(baseParams)
    const feat: AreaFeature = {
      ...sampleFeature,
      centerLat: 65.0,   // kaukana parent-alueesta (63.8)
      centerLng: 29.0,
    }
    const updated = addFeature(area, feat)
    expect(updated.features[0].centerLat).toBe(65.0)
    expect(updated.features[0].centerLng).toBe(29.0)
    // Parent area ei muutu
    expect(updated.centerLat).toBe(baseParams.centerLat)
    expect(updated.centerLng).toBe(baseParams.centerLng)
  })

  it('feature geometry säilyy add-operaatiossa', () => {
    const area = createAreaMarker(baseParams)
    const feat: AreaFeature = {
      ...sampleFeature,
      centerLat: 65.1,
      centerLng: 29.5,
      widthM: 15,
      heightM: 8,
      rotation: 45,
    }
    const updated = addFeature(area, feat)
    const f = updated.features[0]
    expect(f.widthM).toBe(15)
    expect(f.heightM).toBe(8)
    expect(f.rotation).toBe(45)
  })
})
