// T321: /loki-näkymä (Taso 2 Vitest-jsdom). Renderöinti, suodattimet, peruutus-flow ja
// virheviestit. Verkko mockataan — endpointit on katettu Bun-tasolla (server/audit-undo.test.ts).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderAuditLogPage } from '../src/ui/audit-log-page'
import type { AuditEntry } from '../src/logic/audit-sync'

function entry(over: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'a1',
    marker_id: 'm1',
    action: 'move',
    actor: 'Liisa',
    actor_role: 'talkoolainen',
    segment_code: 'SEG-A',
    created_at: '2026-07-25T07:39:33.000Z',
    payload: { lat: 65.57585, lon: 27.65917 },
    ...over,
  }
}

const MARKERS = new Map([['m1', { type: 'nuoli-vasemmalle', lat: 65.58250, lon: 27.81166 }]])

let container: HTMLElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  container.remove()
  vi.unstubAllGlobals()
})

function render(entries: AuditEntry[], opts: Partial<Parameters<typeof renderAuditLogPage>[1]> = {}) {
  renderAuditLogPage(container, {
    entries,
    markers: MARKERS,
    onReload: vi.fn(),
    confirmFn: () => true,
    ...opts,
  })
}

describe('renderAuditLogPage — rivit', () => {
  it('renderöi rivin tekijällä, teolla, pätkällä ja ajalla', () => {
    render([entry()])
    const row = container.querySelector('.audit-row')!
    expect(row.querySelector('.audit-actor')!.textContent).toContain('Liisa')
    expect(row.querySelector('.audit-what')!.textContent).toContain('siirsi merkkiä')
    expect(row.querySelector('.audit-what')!.textContent).toContain('nuoli-vasemmalle')
    expect(row.querySelector('.audit-where')!.textContent).toBe('SEG-A')
    expect(row.querySelector('.audit-when')!.textContent).toBe('25.7. 07:39')
  })

  it('näyttää poikkeaman metreinä ja korostaa ison siirron', () => {
    render([entry()])
    const dev = container.querySelector('.audit-deviation')!
    expect(dev.textContent).toMatch(/^70\d\d m$/)
    expect(dev.classList.contains('audit-deviation-warn')).toBe(true)
  })

  it('pieni siirto ei korostu', () => {
    render([entry({ payload: { lat: 65.58252, lon: 27.81170 } })])
    expect(container.querySelector('.audit-deviation')!.classList.contains('audit-deviation-warn')).toBe(false)
  })

  it('rooli-badge kertoo kuka teki', () => {
    render([entry()])
    const badge = container.querySelector('.audit-role-badge')!
    expect(badge.textContent).toBe('talkoolainen')
    expect(badge.classList.contains('audit-role-talkoolainen')).toBe(true)
  })

  it('poistetulle merkille ei kartalle-linkkiä eikä poikkeamaa', () => {
    render([entry({ marker_id: 'kadonnut' })])
    expect(container.querySelector('.audit-show')).toBeNull()
    expect(container.querySelector('.audit-deviation')!.textContent).toBe('')
  })

  it('kartalle-linkki osoittaa merkkiin', () => {
    render([entry()])
    expect(container.querySelector<HTMLAnchorElement>('.audit-show')!.getAttribute('href')).toBe('/#marker=m1')
  })

  it('tyhjä loki → selkeä tyhjätila', () => {
    render([])
    expect(container.querySelector('.audit-empty')!.textContent).toContain('Ei muutoksia')
  })

  it('B124-legacy: pätkätön rivi näkyy silti', () => {
    render([entry({ segment_code: null })])
    expect(container.querySelector('.audit-where')!.textContent).toBe('pätkä tuntematon')
  })
})

describe('suodattimet', () => {
  const rows = [
    entry({ id: '1', actor: 'Liisa', actor_role: 'talkoolainen', segment_code: 'SEG-A' }),
    entry({ id: '2', actor: 'krossikommuuni', actor_role: 'järjestäjä', segment_code: 'SEG-B' }),
  ]

  it('rooli karsii rivit', () => {
    render(rows)
    expect(container.querySelectorAll('.audit-row').length).toBe(2)
    const sel = container.querySelector<HTMLSelectElement>('#audit-filter-role')!
    sel.value = 'järjestäjä'
    sel.dispatchEvent(new Event('change'))
    const visible = container.querySelectorAll('.audit-row')
    expect(visible.length).toBe(1)
    expect(visible[0].querySelector('.audit-actor')!.textContent).toContain('krossikommuuni')
  })

  it('tekijävalikko rakentuu datasta', () => {
    render(rows)
    const opts = [...container.querySelectorAll<HTMLOptionElement>('#audit-filter-actor option')].map(o => o.value)
    expect(opts).toContain('Liisa')
    expect(opts).toContain('krossikommuuni')
  })

  it('pätkäsuodatin karsii', () => {
    render(rows)
    const sel = container.querySelector<HTMLSelectElement>('#audit-filter-segment')!
    sel.value = 'SEG-A'
    sel.dispatchEvent(new Event('change'))
    expect(container.querySelectorAll('.audit-row').length).toBe(1)
  })

  it('suodatin joka ei osu → tyhjätila, ei tyhjä sivu', () => {
    render(rows)
    const sel = container.querySelector<HTMLSelectElement>('#audit-filter-role')!
    sel.value = 'admin'
    sel.dispatchEvent(new Event('change'))
    expect(container.querySelector('.audit-empty')).not.toBeNull()
  })
})

describe('peruutus', () => {
  it('vahvistus kysytään ennen peruutusta (V102)', async () => {
    const confirmFn = vi.fn().mockReturnValue(false)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render([entry()], { confirmFn })

    container.querySelector<HTMLButtonElement>('.audit-undo')!.click()
    await Promise.resolve()

    expect(confirmFn).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled() // peruttu vahvistuksessa → ei pyyntöä
  })

  it('onnistunut peruutus lataa listan uudelleen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const onReload = vi.fn()
    render([entry()], { onReload })

    container.querySelector<HTMLButtonElement>('.audit-undo')!.click()
    await vi.waitFor(() => expect(onReload).toHaveBeenCalled())
    expect(container.querySelector('.audit-status')!.textContent).toContain('peruttu')
  })

  // T332/V241/B130: entinen testi käytti `vi.fn()`-onReloadia joka EI renderöi uudelleen ∴ se oli
  // vihreä vaikka tuotannossa `loki.ts` ajaa `renderAuditLogPage`in uusiksi (`innerHTML=''`) ja
  // pyyhkii juuri asetetun viestin. Tämä testi ajaa oikean uudelleenlatauksen.
  it('vahvistus selviää uudelleenlatauksesta jonka peruutus itse laukaisee (V241)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const reload = (msg?: string) => render([entry()], { onReload: reload, statusMessage: msg })
    render([entry()], { onReload: reload })

    container.querySelector<HTMLButtonElement>('.audit-undo')!.click()
    await vi.waitFor(() =>
      expect(container.querySelector('.audit-status')!.textContent).toContain('peruttu'))
  })

  it('409 → kerrotaan että jo peruttu, nappi jää käyttöön', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }))
    render([entry()])
    const btn = container.querySelector<HTMLButtonElement>('.audit-undo')!
    btn.click()
    await vi.waitFor(() => expect(container.querySelector('.audit-status')!.textContent).toContain('jo peruttu'))
    expect(btn.disabled).toBe(false)
  })

  it('404 → merkki kadonnut, ei hiljaista epäonnistumista', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    render([entry()])
    container.querySelector<HTMLButtonElement>('.audit-undo')!.click()
    await vi.waitFor(() => expect(container.querySelector('.audit-status')!.textContent).toContain('ei enää ole'))
  })

  it('verkkovirhe → kehotus yrittää uudelleen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render([entry()])
    container.querySelector<HTMLButtonElement>('.audit-undo')!.click()
    await vi.waitFor(() => expect(container.querySelector('.audit-status')!.textContent).toContain('yritä uudelleen'))
  })
})
