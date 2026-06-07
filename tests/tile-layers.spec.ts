import { describe, it, expect } from 'vitest'
import { buildMmlTileUrl, TILE_LAYERS } from '../src/logic/tile-layers'

describe('MML tile URL', () => {
  it('URL contains y before x (WMTS TileRow/TileCol order)', () => {
    const url = buildMmlTileUrl('taustakartta', 14, 9218, 9350, 'testkey')
    expect(url).toMatch(/\/14\/9218\/9350\.png/)
    expect(url).not.toMatch(/\/14\/9350\/9218\.png/)
  })

  it('URL contains api-key param', () => {
    const url = buildMmlTileUrl('taustakartta', 10, 1, 2, 'mykey')
    expect(url).toContain('api-key=mykey')
  })

  it('URL contains correct layer name', () => {
    expect(buildMmlTileUrl('maastokartta', 10, 1, 2, 'k')).toContain('/maastokartta/')
    expect(buildMmlTileUrl('taustakartta', 10, 1, 2, 'k')).toContain('/taustakartta/')
  })
})

describe('TILE_LAYERS config', () => {
  it('has 3 layers: mml-tausta, mml-maasto, osm', () => {
    expect(TILE_LAYERS.map(l => l.id)).toEqual(['mml-tausta', 'mml-maasto', 'osm'])
  })

  it('first layer (default) is MML taustakartta', () => {
    expect(TILE_LAYERS[0].id).toBe('mml-tausta')
  })

  it('MML layers have maxZoom 16', () => {
    TILE_LAYERS.filter(l => l.id.startsWith('mml')).forEach(l => {
      expect(l.maxZoom).toBe(16)
    })
  })

  it('OSM layer has maxZoom 19', () => {
    const osm = TILE_LAYERS.find(l => l.id === 'osm')!
    expect(osm.maxZoom).toBe(19)
  })

  it('MML layers attribution contains Maanmittauslaitos', () => {
    TILE_LAYERS.filter(l => l.id.startsWith('mml')).forEach(l => {
      expect(l.attribution).toContain('Maanmittauslaitos')
    })
  })
})

describe('Layer UI — toolbar', () => {
  it.todo('default layer on page load is MML Taustakartta (not OSM)')
  it.todo('toolbar button shows active layer name')
  it.todo('clicking button cycles to next layer')
  it.todo('clicking button 3 times returns to first layer')
  it.todo('selected layer persists in localStorage across reload')
  it.todo('attribution updates when layer switches')
})
