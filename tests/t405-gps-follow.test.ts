import { describe, it, expect } from 'vitest'
import {
  createGpsFollow, gpsControlState, gpsControlLabel, gpsTapAction,
  type GpsControlState,
} from '../src/logic/gps-follow'

describe('T405/V295 — seuranta purkautuu käyttäjän eleestä, ei ohjelmallisesta panista', () => {
  it('ohjelmallinen liike ei pura seurantaa', () => {
    const f = createGpsFollow(true)
    f.beginProgrammaticMove()
    expect(f.onUserGesture()).toBe(false)
    expect(f.get()).toBe(true)
  })

  it('käyttäjän ele purkaa seurannan ja raportoi purun', () => {
    const f = createGpsFollow(true)
    expect(f.onUserGesture()).toBe(true)
    expect(f.get()).toBe(false)
  })

  it('endMove nollaa lipun ∴ SEURAAVA ele purkaa (ei jää pysyvästi ohjelmalliseksi)', () => {
    const f = createGpsFollow(true)
    f.beginProgrammaticMove()
    f.onUserGesture()
    f.endMove()
    expect(f.isProgrammatic()).toBe(false)
    expect(f.onUserGesture()).toBe(true)
    expect(f.get()).toBe(false)
  })

  it('ele ilman seurantaa ei raportoi purkua (ei turhaa tilailmoitusta joka fixin panissa)', () => {
    const f = createGpsFollow(false)
    expect(f.onUserGesture()).toBe(false)
  })

  it('set(true) palauttaa seurannan purun jälkeen — "Keskitä" toimii', () => {
    const f = createGpsFollow(true)
    f.onUserGesture()
    f.set(true)
    expect(f.get()).toBe(true)
  })
})

describe('T405/V294 — GpsState × seuranta → neljä UI-tilaa', () => {
  it('paikannus voittaa seurannan: pois + following=true → pois', () => {
    expect(gpsControlState('pois', true)).toBe('pois')
  })

  it('haetaan ei ole seuraa vaikka seuranta on päällä (ei fixiä = ei mitään seurattavaa)', () => {
    expect(gpsControlState('haetaan', true)).toBe('haetaan')
  })

  it('päällä + seuranta → seuraa; päällä ilman seurantaa → vapaa', () => {
    expect(gpsControlState('päällä', true)).toBe('seuraa')
    expect(gpsControlState('päällä', false)).toBe('vapaa')
  })
})

describe('T405/V294 — labelit ja napautuksen merkitys', () => {
  const ALL: GpsControlState[] = ['pois', 'haetaan', 'seuraa', 'vapaa']

  it('neljä tilaa → neljä ERI labelia (tila erottuu sanoin, ei pelkällä värillä)', () => {
    const labels = ALL.map(gpsControlLabel)
    expect(new Set(labels).size).toBe(4)
    expect(labels.every(l => l.trim().length > 0)).toBe(true)
  })

  it('napautuskierto: pois→start, seuraa→stop, vapaa→recenter, haetaan→stop (peruminen)', () => {
    expect(gpsTapAction('pois')).toBe('start')
    expect(gpsTapAction('haetaan')).toBe('stop')
    expect(gpsTapAction('seuraa')).toBe('stop')
    expect(gpsTapAction('vapaa')).toBe('recenter')
  })

  it('jokaiselle tilalle on määritelty toiminto (ei kuollutta napautusta)', () => {
    ALL.forEach(s => expect(['start', 'stop', 'recenter']).toContain(gpsTapAction(s)))
  })
})
