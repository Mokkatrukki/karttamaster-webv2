import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { navUrl, navTarget } from '../src/logic/nav-link'

// T395/V286 — ulkoinen navigointi-handoff. Taso 1 Vitest-pure: moduuli ei koske
// DOM:iin ∴ ei jsdom-docblockia (CLAUDE.md/V248).

describe('navUrl — Google Maps universal URL (V286)', () => {
  it('tunnettu koordinaatti → tarkka odotettu URL', () => {
    // Regressiovahti Googlen parametrinimille: api=1, destination, travelmode
    // ovat Googlen sopimus ei meidän — jos ne muuttuvat vahingossa, linkki
    // avautuu Mapsiin ilman määränpäätä eikä kukaan huomaa ennen metsää.
    expect(navUrl({ lat: 65.63852, lon: 27.90431 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=65.638520,27.904310&travelmode=driving'
    )
  })

  it('pyöristää 6 desimaaliin', () => {
    const url = navUrl({ lat: 65.6385212345, lon: 27.9043187654 })
    expect(url).toContain('destination=65.638521,27.904319')
  })

  it('täydentää lyhyet desimaalit — muoto pysyy samana', () => {
    expect(navUrl({ lat: 65, lon: 27.5 })).toContain('destination=65.000000,27.500000')
  })

  it('negatiivinen lat/lon säilyttää etumerkin', () => {
    const url = navUrl({ lat: -33.856784, lon: -70.123456 })
    expect(url).toContain('destination=-33.856784,-70.123456')
  })

  it('hyväksyy rajat (±90 / ±180)', () => {
    expect(navUrl({ lat: 90, lon: 180 })).not.toBeNull()
    expect(navUrl({ lat: -90, lon: -180 })).not.toBeNull()
  })

  it('rajojen ulkopuoliset → null', () => {
    expect(navUrl({ lat: 90.1, lon: 27 })).toBeNull()
    expect(navUrl({ lat: -90.1, lon: 27 })).toBeNull()
    expect(navUrl({ lat: 65, lon: 180.1 })).toBeNull()
    expect(navUrl({ lat: 65, lon: -180.1 })).toBeNull()
  })

  it('NaN / Infinity / puuttuva luku → null', () => {
    expect(navUrl({ lat: NaN, lon: 27 })).toBeNull()
    expect(navUrl({ lat: 65, lon: NaN })).toBeNull()
    expect(navUrl({ lat: Infinity, lon: 27 })).toBeNull()
    expect(navUrl({ lat: 65, lon: -Infinity })).toBeNull()
    expect(navUrl({ lat: undefined as unknown as number, lon: 27 })).toBeNull()
  })
})

describe('navTarget — kohteen ainoa laajennuskohta (V286)', () => {
  it('palauttaa merkin koordinaatit muuttumattomina', () => {
    expect(navTarget({ lat: 65.63852, lon: 27.90431 })).toEqual({
      lat: 65.63852,
      lon: 27.90431,
    })
  })

  it('kohde kelpaa suoraan navUrl:lle — kutsupaikka ei rakenna URLia itse', () => {
    const marker = { lat: 65.63852, lon: 27.90431 }
    expect(navUrl(navTarget(marker))).toBe(navUrl(marker))
  })

  it('yksikään muu src/-moduuli ei rakenna Maps-URLia itse (V286)', () => {
    // V286:n koko arvo on siinä että kohde vaihtuu YHDESSÄ paikassa kun
    // pysäköintipiste-POI tulee (VISION §Avoimet 8). Toinen kutsupaikka joka
    // kokoaa URLin itse jäisi vanhaan kohteeseen — hiljaa, koska molemmat
    // linkit näyttäisivät toimivilta. Tämä vahti hajoaa ennen kuin niin käy.
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) { walk(path); continue }
        if (!path.endsWith('.ts')) continue
        if (path.endsWith('logic/nav-link.ts')) continue
        if (/google\.com\/maps|maps\/dir|waze:\/\//.test(readFileSync(path, 'utf8'))) {
          offenders.push(path)
        }
      }
    }
    walk('src')
    expect(offenders, 'käytä navUrl()/navTarget() — älä rakenna nav-URLia paikallisesti').toEqual([])
  })
})
