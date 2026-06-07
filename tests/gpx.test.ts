import { describe, it, expect } from 'vitest'
import { parseGpx } from '../src/logic/gpx'
import { readFileSync } from 'fs'
import { join } from 'path'

const FIXTURE_GPX = `<?xml version="1.0" encoding="utf-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
<trk><trkseg>
  <trkpt lat="65.627707" lon="27.627554"><ele>227</ele></trkpt>
  <trkpt lat="65.627850" lon="27.627421"><ele>227</ele></trkpt>
  <trkpt lat="65.627910" lon="27.627844"><ele>226</ele></trkpt>
</trkseg></trk>
</gpx>`

describe('parseGpx', () => {
  it('parses trackpoints', () => {
    const coords = parseGpx(FIXTURE_GPX)
    expect(coords).toHaveLength(3)
    expect(coords[0]).toEqual({ lat: 65.627707, lon: 27.627554 })
  })

  it('skips invalid coordinates', () => {
    const bad = FIXTURE_GPX.replace('lat="65.627707"', 'lat="bad"')
    const coords = parseGpx(bad)
    expect(coords).toHaveLength(2)
  })

  it('returns empty array for empty gpx', () => {
    const empty = `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg></trkseg></trk></gpx>`
    expect(parseGpx(empty)).toHaveLength(0)
  })
})

describe('parseGpx with real file', () => {
  it('parses 1553 points from Syöte MTB 34km', () => {
    const xml = readFileSync(join(__dirname, '../public/route-35km.gpx'), 'utf-8')
    const coords = parseGpx(xml)
    expect(coords.length).toBe(1553)
    expect(coords[0].lat).toBeCloseTo(65.627707, 4)
  })
})
