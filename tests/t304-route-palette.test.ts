import { describe, it, expect } from 'vitest'
import { ROUTE_DEFS } from '../src/logic/route-defs'
import { SEGMENT_COLORS, SEGMENT_DONE_COLOR } from '../src/logic/segments'
import { routeSwatchBackground, parseDashArray } from '../src/logic/route-swatch'
import { BASEMAP, PILL_TEXT, contrastRatio, hueOf, hueDistance } from './helpers/contrast'

// T304/V216: reittien ! erottua KAHDELLA riippumattomalla kanavalla — sävy JA viivakuvio.
// Ennen: 3 SMTB-reittiä olivat sama sininen kolmella vaaleudella ∴ katosivat auringossa &
// päällekkäisellä osuudella ylempi peitti alemman täysin (yksi kanava = yksi tieto).
// Nämä testit mittaavat sen, eivät kuvaile: värit ovat dataa, ja data on tarkistettavissa.

const byEvent = (event: string) => ROUTE_DEFS.filter(r => r.event === event)

describe('T304/V216: reittipaletti — kanava 1 (sävy)', () => {
  it('jokainen reittiväri on uniikki', () => {
    const colors = ROUTE_DEFS.map(r => r.color.toUpperCase())
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('sävyero myös TAPAHTUMAN SISÄLLÄ ≥ 20° — ⊥ pelkkä vaaleusporrastus (V216-ydin)', () => {
    for (const event of ['SyöteMTB', 'Gravel Fest']) {
      const hues = byEvent(event).map(r => hueOf(r.color)).sort((a, b) => a - b)
      expect(hues.length, `${event} puuttuu`).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < hues.length; i++) {
        expect(hueDistance(hues[i], hues[i - 1]), `${event}: sävyt ${hues.map(Math.round)}`).toBeGreaterThanOrEqual(20)
      }
    }
  })

  it('viiva erottuu vaaleasta taustakartasta (≥2.5:1)', () => {
    for (const r of ROUTE_DEFS) {
      expect(contrastRatio(r.color, BASEMAP), `${r.id} liian vaalea kartalla`).toBeGreaterThanOrEqual(2.5)
    }
  })

  it('reittipillerin tumma teksti luettavissa värin päällä (≥3:1, AA large)', () => {
    // route-bar.ts asettaa reittivärin pillerin TAUSTAKSI ∴ tämä sitoo värit vaaleaan päähän.
    for (const r of ROUTE_DEFS) {
      expect(contrastRatio(r.color, PILL_TEXT), `${r.id} pilleriteksti`).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('T304/V216: reittipaletti — kanava 2 (viivakuvio)', () => {
  it('tapahtuman sisällä jokaisella reitillä eri kuvio — jaettu osuus paljastaa alemman', () => {
    for (const event of ['SyöteMTB', 'Gravel Fest']) {
      const patterns = byEvent(event).map(r => r.dashArray ?? 'solid')
      expect(new Set(patterns).size, `${event}: ${patterns}`).toBe(patterns.length)
    }
  })

  it('kuvio on luettava: viivanpätkä ≥ 3px & ≥ 1/3 aukosta (⊥ pistesarja, B135:n oppi)', () => {
    for (const r of ROUTE_DEFS) {
      const d = parseDashArray(r.dashArray)
      if (!d) continue
      expect(d.dash, `${r.id}`).toBeGreaterThanOrEqual(3)
      expect(d.dash / d.gap, `${r.id}`).toBeGreaterThanOrEqual(0.35)
    }
  })

  it('sävy+kuvio -pari on uniikki koko reitistössä', () => {
    const pairs = ROUTE_DEFS.map(r => `${r.color}|${r.dashArray ?? 'solid'}`)
    expect(new Set(pairs).size).toBe(pairs.length)
  })
})

describe('T304/V244/V96: paletit eivät varasta toistensa kanavia', () => {
  it('SEGMENT_COLORS ∩ ROUTE-värit = ∅ (V244-ehto)', () => {
    const routes = new Set(ROUTE_DEFS.map(r => r.color.toUpperCase()))
    for (const c of SEGMENT_COLORS) expect(routes.has(c.toUpperCase()), `${c} on myös reittiväri`).toBe(false)
  })

  it('pätkäpaletti on TUMMA & reittipaletti KESKIKIRKAS — erottuvat myös akromaattisesti', () => {
    // Vaaleusero on kanava jota värisokeus & aurinko eivät vie. Pätkä piirtyy reitin päälle
    // ∴ pelkkä sävyero ei riitä erottamaan niitä toisistaan.
    const darkestRoute = Math.min(...ROUTE_DEFS.map(r => contrastRatio(r.color, BASEMAP)))
    const lightestSegment = Math.max(...SEGMENT_COLORS.map(c => contrastRatio(c, BASEMAP)))
    expect(lightestSegment).toBeGreaterThan(darkestRoute)
  })

  it('vihreä on varattu status-kanavalle — ⊥ tunnistepaletissa (V96-amend)', () => {
    const isGreen = (hex: string) => { const h = hueOf(hex); return h >= 90 && h <= 160 }
    for (const c of SEGMENT_COLORS) expect(isGreen(c), `${c} on vihreä`).toBe(false)
    for (const r of ROUTE_DEFS) expect(isGreen(r.color), `${r.id} on vihreä`).toBe(false)
    expect(isGreen(SEGMENT_DONE_COLOR)).toBe(true) // status-vihreä on ainoa vihreä kartalla
  })
})

describe('T304/V216: legenda vastaa karttaa (routeSwatchBackground)', () => {
  it('ehjä reitti → tasainen väri', () => {
    expect(routeSwatchBackground('#1D8CB4', undefined)).toBe('#1D8CB4')
  })

  it('katkoviiva → gradientti samassa dash/gap-suhteessa kuin kartalla', () => {
    // Swatchiin mahtuu 3 jaksoa (33.3 % kukin) ∴ harva kuvio lukee kuviona, ei yhtenä pisteenä.
    // '18 8' → viiva 18/26 = 69.2 % jaksosta = 23.1 % swatchista.
    expect(routeSwatchBackground('#4D6FCB', '18 8')).toContain('23.1%')
    expect(routeSwatchBackground('#4D6FCB', '18 8')).toContain('repeating-linear-gradient')
    // '6 10' → 6/16 = 37.5 % jaksosta = 12.5 %: selvästi harvempi ∴ legenda erottaa nämä kaksi
    expect(routeSwatchBackground('#8C71D6', '6 10')).toContain('12.5%')
  })

  it('rikkinäinen dashArray ⊥ kaada legendaa — fallback ehjään väriin', () => {
    for (const bad of ['', 'abc', '5', '0 0', '-3 8']) {
      expect(routeSwatchBackground('#C4384A', bad)).toBe('#C4384A')
    }
  })

  it('∀ reitillä swatch on johdettu SAMASTA dashArraysta kuin kartan viiva', () => {
    for (const r of ROUTE_DEFS) {
      const swatch = routeSwatchBackground(r.color, r.dashArray)
      if (r.dashArray) expect(swatch).toContain('repeating-linear-gradient')
      else expect(swatch).toBe(r.color)
    }
  })
})
