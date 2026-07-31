// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { PhaseIndicator, phaseSourceFor, registerPhaseIndicator, syncPhaseIndicator } from '../src/ui/phase-indicator'
import { getActivePhase, getViewPhase } from '../src/logic/phase-view'
import { PHASE_MASTER_NAMES, PHASE_ORDER } from '../src/logic/phase-labels'
import type { Segment } from '../src/logic/segments'

// T443/V329 — vaihe on näkyvissä AINA: aksenttiväri + nimi, kaksi kantajaa.

function mount(phase: Segment['phase']) {
  const el = document.createElement('span')
  document.body.appendChild(el)
  let current = phase
  const indicator = new PhaseIndicator(el, () => current, document.body)
  return { el, indicator, set: (p: Segment['phase']) => { current = p } }
}

beforeEach(() => {
  document.body.innerHTML = ''
  delete document.body.dataset.phase
  registerPhaseIndicator(null)
})

describe('PhaseIndicator — nimi (V329: väri ei ole ainoa kantaja)', () => {
  it('purku näkyy nimenä "Purkumaster"', () => {
    expect(mount('purku').el.textContent).toBe('Purkumaster')
  })

  it('jokaisella vaiheella on oma nimi, eikä kaksi vaihetta jaa nimeä', () => {
    const names = PHASE_ORDER.map(p => mount(p).el.textContent)
    expect(new Set(names).size).toBe(PHASE_ORDER.length)
    expect(names).toEqual(PHASE_ORDER.map(p => PHASE_MASTER_NAMES[p]))
  })
})

describe('PhaseIndicator — aksenttitoken', () => {
  it('kirjoittaa vaiheen body[data-phase]-attribuutille (CSS lukee tokenin siitä)', () => {
    mount('tarkastus')
    expect(document.body.dataset.phase).toBe('tarkastus')
  })

  it('kolme vaihetta → kolme eri data-phase-arvoa', () => {
    const seen = PHASE_ORDER.map(p => { mount(p); return document.body.dataset.phase })
    expect(new Set(seen).size).toBe(3)
  })

  it('sync() päivittää sekä värikanavan että nimen', () => {
    const h = mount('asettaminen')
    expect(document.body.dataset.phase).toBe('asettaminen')
    h.set('purku')
    h.indicator.sync()
    expect(document.body.dataset.phase).toBe('purku')
    expect(h.el.textContent).toBe('Purkumaster')
  })
})

describe('phaseSourceFor — kaksi lähdettä, ei kolmatta (V318/V321)', () => {
  it('talkoolainen lukee GLOBAALIA vaihetta (ei katselusuodinta)', () => {
    expect(phaseSourceFor('talkoolainen')).toBe(getActivePhase)
  })

  it('järjestäjä lukee KATSELUvaihetta', () => {
    expect(phaseSourceFor('järjestäjä')).toBe(getViewPhase)
  })

  it('lähteet ovat eri funktiot — sama lähde molemmille olisi V321:n paluu', () => {
    expect(phaseSourceFor('talkoolainen')).not.toBe(phaseSourceFor('järjestäjä'))
  })
})

describe('rekisteri — vaihe voi vaihtua kaukana indikaattorista (PhaseSwitcher)', () => {
  it('syncPhaseIndicator() päivittää rekisteröidyn indikaattorin', () => {
    const h = mount('asettaminen')
    registerPhaseIndicator(h.indicator)
    h.set('tarkastus')
    syncPhaseIndicator()
    expect(h.el.textContent).toBe('Tarkastusmaster')
    expect(document.body.dataset.phase).toBe('tarkastus')
  })

  it('ilman rekisteröityä indikaattoria sync ei kaadu', () => {
    expect(() => syncPhaseIndicator()).not.toThrow()
  })
})
