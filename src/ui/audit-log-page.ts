// T321/V231: globaali aktiviteettiloki + per-rivi undo. Järjestäjän ja adminin näkymä.
// DOM ilman Leafletia → Vitest-jsdom. Verkko ja laskenta ovat logiikkakerroksessa
// (audit-sync.ts, audit-log.ts) — tämä tiedosto vain renderöi ja kutsuu.
//
// Vastaa 2026-07-25 tapaukseen: merkkien palautus ei saa vaatia SSH-yhteyttä tuotantopalvelimelle
// (docs/RUNBOOK-merkkien-palautus.md jää hätävaraksi, ei työkaluksi).
import type { AuditEntry } from '../logic/audit-sync'
import { undoAuditEntry } from '../logic/audit-sync'
import {
  describeAuditEntry,
  moveDeviationM,
  filterEntries,
  distinctActors,
  distinctSegments,
  type AuditFilters,
  type MarkerPosition,
} from '../logic/audit-log'

export interface AuditLogPageOpts {
  entries: AuditEntry[]
  // Merkin nykytila poikkeaman laskentaan + tyyppisarakkeeseen. Puuttuva = merkki poistettu.
  markers: Map<string, { type: string; lat: number; lon: number }>
  onReload: () => void
  // Injektoitavissa testejä varten — window.confirm ei ole jsdomissa käytettävissä sellaisenaan.
  confirmFn?: (msg: string) => boolean
}

// Poikkeama jota isompi siirto on todennäköisesti vahinko eikä tarkennus. 2026-07-25 sotkussa
// pienin väärä siirto oli ~1272 m ja suurin laillinen tarkennus ~15 m.
const DEVIATION_WARN_M = 100

const ROLE_LABEL: Record<string, string> = {
  talkoolainen: 'talkoolainen',
  järjestäjä: 'järjestäjä',
  admin: 'admin',
}

const UNDO_ERROR: Record<string, string> = {
  already_undone: '⚠ Tämä muutos on jo peruttu.',
  not_found: '⚠ Merkkiä ei enää ole — muutosta ei voi perua.',
  not_undoable: '⚠ Tätä riviä ei voi perua (vanha kirjaus ilman palautustietoa).',
  forbidden: '⚠ Ei oikeutta perua muutoksia.',
  network: '⚠ Peruutus ei onnistunut — yritä uudelleen.',
}

export function renderAuditLogPage(container: HTMLElement, opts: AuditLogPageOpts): void {
  container.innerHTML = ''
  const filters: AuditFilters = {}

  const status = document.createElement('p')
  status.className = 'audit-status'
  status.setAttribute('aria-live', 'polite')

  const table = document.createElement('div')
  table.className = 'audit-table'

  const bar = buildFilterBar(opts.entries, filters, () => {
    renderRows(table, filterEntries(opts.entries, filters), opts, status)
  })

  container.append(bar, status, table)
  renderRows(table, filterEntries(opts.entries, filters), opts, status)
}

function buildFilterBar(entries: AuditEntry[], filters: AuditFilters, onChange: () => void): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'audit-filters'

  const roleSel = select('audit-filter-role', 'Rooli', [
    { value: '', label: 'Kaikki roolit' },
    { value: 'talkoolainen', label: 'Talkoolaiset' },
    { value: 'järjestäjä', label: 'Järjestäjät' },
    { value: 'admin', label: 'Adminit' },
  ])
  roleSel.addEventListener('change', () => { filters.role = roleSel.value || undefined; onChange() })

  // Tekijä- ja pätkävalikot luetaan datasta (T320) — kiinteä lista vanhenisi heti.
  const actorSel = select('audit-filter-actor', 'Tekijä', [
    { value: '', label: 'Kaikki tekijät' },
    ...distinctActors(entries).map(a => ({ value: a, label: a })),
  ])
  actorSel.addEventListener('change', () => { filters.actor = actorSel.value || undefined; onChange() })

  const segSel = select('audit-filter-segment', 'Pätkä', [
    { value: '', label: 'Kaikki pätkät' },
    ...distinctSegments(entries).map(s => ({ value: s, label: s })),
  ])
  segSel.addEventListener('change', () => { filters.segmentCode = segSel.value || undefined; onChange() })

  const since = document.createElement('input')
  since.type = 'date'
  since.id = 'audit-filter-since'
  since.className = 'audit-filter-date'
  since.setAttribute('aria-label', 'Alkaen')
  since.addEventListener('change', () => {
    filters.since = since.value ? `${since.value}T00:00:00.000Z` : undefined
    onChange()
  })

  const until = document.createElement('input')
  until.type = 'date'
  until.id = 'audit-filter-until'
  until.className = 'audit-filter-date'
  until.setAttribute('aria-label', 'Päättyen')
  until.addEventListener('change', () => {
    filters.until = until.value ? `${until.value}T23:59:59.999Z` : undefined
    onChange()
  })

  bar.append(roleSel, actorSel, segSel, since, until)
  return bar
}

function select(id: string, ariaLabel: string, options: Array<{ value: string; label: string }>): HTMLSelectElement {
  const sel = document.createElement('select')
  sel.id = id
  sel.className = 'audit-filter-select'
  sel.setAttribute('aria-label', ariaLabel)
  for (const o of options) {
    const opt = document.createElement('option')
    opt.value = o.value
    opt.textContent = o.label
    sel.appendChild(opt)
  }
  return sel
}

function renderRows(table: HTMLElement, entries: AuditEntry[], opts: AuditLogPageOpts, status: HTMLElement): void {
  table.innerHTML = ''

  if (entries.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'audit-empty'
    empty.textContent = 'Ei muutoksia näillä ehdoilla.'
    table.appendChild(empty)
    return
  }

  for (const entry of entries) {
    table.appendChild(buildRow(entry, opts, status))
  }
}

function buildRow(entry: AuditEntry, opts: AuditLogPageOpts, status: HTMLElement): HTMLElement {
  const d = describeAuditEntry(entry)
  const marker = opts.markers.get(entry.marker_id)
  const row = document.createElement('div')
  row.className = 'audit-row'
  row.dataset.auditId = entry.id
  row.dataset.action = entry.action

  const actor = document.createElement('span')
  actor.className = 'audit-actor'
  const badge = document.createElement('span')
  badge.className = `audit-role-badge audit-role-${entry.actor_role}`
  badge.textContent = ROLE_LABEL[entry.actor_role] ?? entry.actor_role
  actor.append(d.actorLabel, ' ', badge)

  const what = document.createElement('span')
  what.className = 'audit-what'
  what.textContent = marker ? `${d.verb} — ${marker.type}` : d.verb

  const where = document.createElement('span')
  where.className = 'audit-where'
  where.textContent = d.segmentLabel

  const when = document.createElement('span')
  when.className = 'audit-when'
  when.textContent = d.timeLabel

  const deviation = document.createElement('span')
  deviation.className = 'audit-deviation'
  const dev = moveDeviationM(entry, marker as MarkerPosition | undefined)
  if (dev != null) {
    deviation.textContent = `${dev} m`
    // Iso poikkeama on se signaali jonka takia listaa selataan → korostuu ilman että
    // käyttäjän tarvitsee lukea lukuja rivi riviltä.
    if (dev > DEVIATION_WARN_M) deviation.classList.add('audit-deviation-warn')
  }

  const actions = document.createElement('span')
  actions.className = 'audit-actions'

  if (marker) {
    const showLink = document.createElement('a')
    showLink.className = 'audit-show btn btn-secondary'
    showLink.href = `/#marker=${entry.marker_id}`
    showLink.textContent = 'Kartalle'
    actions.appendChild(showLink)
  }

  const undoBtn = document.createElement('button')
  undoBtn.type = 'button'
  undoBtn.className = 'audit-undo btn btn-secondary'
  undoBtn.textContent = 'Peru tämä'
  undoBtn.addEventListener('click', async () => {
    const confirmFn = opts.confirmFn ?? window.confirm.bind(window)
    // V102: tuhoava toiminto → vahvistus ensin.
    if (!confirmFn(`Perutaanko: ${d.actorLabel} ${d.verb} (${d.timeLabel})?`)) return
    undoBtn.disabled = true
    const res = await undoAuditEntry(entry.id)
    if (res.ok) {
      status.textContent = '✓ Muutos peruttu.'
      opts.onReload()
      return
    }
    // V21: kerrotaan MIKSI, ei pelkkää "ei onnistunut".
    undoBtn.disabled = false
    status.textContent = UNDO_ERROR[res.error] ?? UNDO_ERROR.network
  })
  actions.appendChild(undoBtn)

  row.append(actor, what, where, when, deviation, actions)
  return row
}
