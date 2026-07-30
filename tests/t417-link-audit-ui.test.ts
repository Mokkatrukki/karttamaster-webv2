// T417/V308: jäsenyysrivin (link/unlink) esitys & peruutusportti. Ydinväite: UI ⊥ tarjoa nappia
// jonka serveri torjuu — sama whitelist molemmin puolin (V250 kuollut pinta).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { describeAuditEntry, isUndoableAction, linkTargetName, ACTION_VERB } from '../src/logic/audit-log'
import { renderAuditLogPage } from '../src/ui/audit-log-page'
import type { AuditEntry, AuditAction } from '../src/logic/audit-sync'

function entry(over: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'a1',
    marker_id: 'mk-1',
    action: 'link',
    actor: 'Matti',
    actor_role: 'talkoolainen',
    segment_code: 'TEST01',
    created_at: '2026-07-30T09:15:00.000Z',
    payload: { segmentId: 'seg-1', segmentName: 'Matin pätkä' },
    ...over,
  }
}

describe('T417/V308 — jäsenyysrivin sanat', () => {
  it('verbi kertoo TEHTÄVÄN ⊥ merkin liikkeen (⊥ sekaannu "siirsi"-riviin)', () => {
    expect(ACTION_VERB.link).toBe('liitti merkin tehtävään')
    expect(ACTION_VERB.unlink).toBe('irrotti merkin tehtävästä')
    expect(ACTION_VERB.link).not.toContain('siirsi')
  })

  it('kaikki actionit saavat verbin — tuntematonta ⊥ jää raakana ruudulle', () => {
    const actions: AuditAction[] = ['add', 'move', 'remove', 'status', 'link', 'unlink']
    for (const a of actions) expect(ACTION_VERB[a]).toBeTruthy()
  })

  it('kohdetehtävä luetaan payloadista kun koodi puuttuu (assignoimaton pätkä)', () => {
    const d = describeAuditEntry(entry({ segment_code: null }))
    expect(d.segmentLabel).toBe('Matin pätkä')
  })

  it('koodi VOITTAA payloadin nimen kun molemmat on', () => {
    expect(describeAuditEntry(entry()).segmentLabel).toBe('TEST01')
  })

  it('vajaa payload → rehellinen "pätkä tuntematon" ⊥ arvaus', () => {
    expect(describeAuditEntry(entry({ segment_code: null, payload: null })).segmentLabel)
      .toBe('pätkä tuntematon')
    expect(describeAuditEntry(entry({ segment_code: null, payload: { segmentName: '  ' } })).segmentLabel)
      .toBe('pätkä tuntematon')
  })

  it('linkTargetName ⊥ palauta nimeä ei-jäsenyysriviltä', () => {
    expect(linkTargetName(entry({ action: 'move' }))).toBeNull()
    expect(linkTargetName(entry())).toBe('Matin pätkä')
  })
})

describe('T417/V308 — peruutusportti', () => {
  it('link/unlink ⊥ ole peruutettavissa, muut ovat', () => {
    expect(isUndoableAction('link')).toBe(false)
    expect(isUndoableAction('unlink')).toBe(false)
    for (const a of ['add', 'move', 'remove', 'status'] as AuditAction[]) {
      expect(isUndoableAction(a)).toBe(true)
    }
  })
})

describe('T417/V308 — lokinäkymä', () => {
  let container: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  function render(entries: AuditEntry[]): void {
    renderAuditLogPage(container, {
      entries,
      markers: new Map(),
      onReload: vi.fn(),
      confirmFn: () => true,
    })
  }

  it('jäsenyysrivillä ⊥ ole "Peru tämä" -nappia LAINKAAN (⊥ disabloitu lupaus)', () => {
    render([entry()])
    const row = container.querySelector<HTMLElement>('.audit-row[data-action="link"]')!
    expect(row).not.toBeNull()
    expect(row.querySelector('.audit-undo')).toBeNull()
  })

  it('muut rivit säilyttävät nappinsa (⊥ regressio T319)', () => {
    render([entry({ id: 'a2', action: 'move', payload: { lat: 65.6, lon: 27.5 } })])
    expect(container.querySelector('.audit-row[data-action="move"] .audit-undo')).not.toBeNull()
  })

  it('jäsenyysrivi näkyy listassa verbillään & kohteellaan', () => {
    render([entry()])
    const row = container.querySelector<HTMLElement>('.audit-row[data-action="link"]')!
    expect(row.querySelector('.audit-what')!.textContent).toContain('liitti merkin tehtävään')
    expect(row.querySelector('.audit-where')!.textContent).toBe('TEST01')
    expect(row.querySelector('.audit-actor')!.textContent).toContain('Matti')
  })

  it('sekalainen lista: vain peruutettavilla on nappi', () => {
    render([
      entry({ id: 'a1', action: 'link' }),
      entry({ id: 'a2', action: 'status', payload: { status: 'suunniteltu' } }),
      entry({ id: 'a3', action: 'unlink' }),
    ])
    expect(container.querySelectorAll('.audit-row')).toHaveLength(3)
    expect(container.querySelectorAll('.audit-undo')).toHaveLength(1)
  })
})
