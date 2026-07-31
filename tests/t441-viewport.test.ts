import { describe, it, expect } from 'vitest'
import { paddingFromRects, zoomForShow, ZOOM_SHOW } from '../src/map/viewport'
import type { RectLike } from '../src/map/viewport'

// T441/V327 — näkyvän ikkunan padding + "näytä kartalla" -zoomsääntö.
// Puhdas taso: mitat sisään, offset ulos. Ei Leafletia, ei DOM:ia.

const CONTAINER: RectLike = { top: 0, right: 400, bottom: 800, left: 0 }

function rect(top: number, right: number, bottom: number, left: number): RectLike {
  return { top, right, bottom, left }
}

describe('paddingFromRects', () => {
  it('ei peittäjiä → nolla joka reunalle', () => {
    expect(paddingFromRects(CONTAINER, [])).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })

  it('alalaidan hero (mobiili) syö bottom-paddingin — V327:n ydin', () => {
    const hero = rect(620, 400, 800, 0)
    expect(paddingFromRects(CONTAINER, [hero]).bottom).toBe(180)
  })

  it('oikean reunan telakka syö right-paddingin', () => {
    const dock = rect(0, 400, 800, 260)
    expect(paddingFromRects(CONTAINER, [dock]).right).toBe(140)
  })

  it('vasen sivupaneeli syö vain left-paddingin, ei ylä/alareunaa', () => {
    const panel = rect(0, 120, 800, 0)
    expect(paddingFromRects(CONTAINER, [panel])).toEqual({ top: 0, right: 0, bottom: 0, left: 120 })
  })

  it('yläreunan suodatinbar syö top-paddingin', () => {
    const bar = rect(0, 400, 48, 0)
    expect(paddingFromRects(CONTAINER, [bar]).top).toBe(48)
  })

  it('useampi peittäjä samalla reunalla → suurin voittaa', () => {
    const small = rect(700, 400, 800, 0)
    const big = rect(600, 400, 800, 0)
    expect(paddingFromRects(CONTAINER, [small, big]).bottom).toBe(200)
  })

  it('hero + telakka yhtä aikaa → molemmat reunat', () => {
    const pad = paddingFromRects(CONTAINER, [rect(620, 400, 800, 0), rect(0, 400, 800, 260)])
    expect(pad.bottom).toBe(180)
    expect(pad.right).toBe(140)
  })

  it('kartan ulkopuolinen (piilotettu, ruudun takana) peittäjä ohitetaan', () => {
    expect(paddingFromRects(CONTAINER, [rect(900, 400, 1000, 0)]).bottom).toBe(0)
  })

  it('koko näkymän peittävä paneeli ohitetaan — padding ei pelastaisi sitä', () => {
    expect(paddingFromRects(CONTAINER, [rect(0, 400, 800, 0)])).toEqual({
      top: 0, right: 0, bottom: 0, left: 0,
    })
  })

  it('safe-area-inset-bottom lisätään pohjaksi vaikka peittäjiä ei ole', () => {
    expect(paddingFromRects(CONTAINER, [], 34).bottom).toBe(34)
  })

  it('hero voittaa safe-arean (hero-rect sisältää sen jo)', () => {
    expect(paddingFromRects(CONTAINER, [rect(620, 400, 800, 0)], 34).bottom).toBe(180)
  })

  it('nollakokoinen kartta ei kaadu', () => {
    expect(paddingFromRects(rect(0, 0, 0, 0), [rect(0, 100, 100, 0)])).toEqual({
      top: 0, right: 0, bottom: 0, left: 0,
    })
  })
})

describe('zoomForShow', () => {
  it('kaukaa → lähelle (15 → 18)', () => {
    expect(zoomForShow(15)).toBe(ZOOM_SHOW)
  })

  it('jo lähempänä → EI loitonneta käyttäjän alta (19 → 19)', () => {
    expect(zoomForShow(19)).toBe(19)
  })

  it('tasan kohdezoomissa → ennallaan', () => {
    expect(zoomForShow(18)).toBe(18)
  })

  it('kohdezoom on parametroitavissa', () => {
    expect(zoomForShow(12, 16)).toBe(16)
    expect(zoomForShow(17, 16)).toBe(17)
  })
})
