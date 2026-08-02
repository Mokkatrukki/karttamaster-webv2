// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { segmentsInPhase, getSegmentsForPhase, createSegmentStore, createSegment } from '../src/logic/segments'
import { layoutRole } from '../src/logic/role'
import type { Segment } from '../src/logic/segments'

// T470/V357/B204 — VAIHE RAJAA LISTAN ROOLISTA RIIPPUMATTA.
//
// `patkat.ts:50-52` suodatti vaiheella VAIN talkoolaiselta ∴ järjestäjä luki hubista 31 riviä
// (18 asetus + 13 purku) kun talkoolainen luki samalla hetkellä 13. Sivupalkki oli tehnyt saman
// asian oikein T434:stä asti — kaksi pintaa, kaksi sääntöä.
//
// Todistettava on KOLME asiaa, ⊥ yksi:
//   (1) suodatus tapahtuu samalla säännöllä molemmissa säilöissä (`segmentsInPhase`),
//   (2) VAIHEEN LÄHDE eroaa rooleittain (`phaseSourceFor ∘ layoutRole`) — juuri tämä sommitelma
//       oli väärin & juuri se on ainoa sallittu ero,
//   (3) hub kertoo rajauksen (otsikko) & antaa järjestäjälle keinon vaihtaa sitä (valitsin),
//       ilman että kasakortti karkaa katseluvaiheen mukana (V332).
//
// Tiedosto on `vite.config.ts`:n ISOLATED-listalla: `phase-view.ts` pitää vaihetta MODUULITASON
// muuttujassa & tämä mutatoi sitä `vi.resetModules`illa.

function seg(phase: Segment['phase'], name: string): Segment {
  const store = createSegmentStore()
  return createSegment(store, {
    routeIds: ['35km'], startDist: 0, endDist: 5000,
    equipment: [], phase, displayName: name,
  })
}

/**
 * Lataa vaihemoduulit puhtaalta pöydältä: serverin globaali vaihe = `active`, järjestäjän
 * katseluvalinta = `view` (⊥ ole = ⊥ valintaa). Palauttaa juuri ne kaksi funktiota joiden
 * SOMMITELMA on tämän taskin sisältö.
 */
async function loadPhaseModules(active: Segment['phase'], view?: Segment['phase']) {
  vi.resetModules()
  const cell: Record<string, string> = {}
  if (view) cell['karttamaster-view-phase'] = view
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => cell[k] ?? null,
    setItem: (k: string, v: string) => { cell[k] = String(v) },
    removeItem: (k: string) => { delete cell[k] },
    clear: () => { for (const k of Object.keys(cell)) delete cell[k] },
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ phase: active }),
  } as Response))

  const phaseView = await import('../src/logic/phase-view')
  await phaseView.loadActivePhase()
  const { phaseSourceFor } = await import('../src/ui/phase-indicator')
  const { renderPatkatPage } = await import('../src/ui/patkat-page')
  return { phaseSourceFor, renderPatkatPage, phaseView }
}

describe('T470 — /patkat suodattaa vaiheen ∀ roolilta (V357, B204)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('sama sääntö molemmissa säilöissä — taulukko ja store antavat saman tuloksen', () => {
    const store = createSegmentStore()
    const a = createSegment(store, { routeIds: ['35km'], startDist: 0, endDist: 1000, equipment: [], phase: 'asettaminen' })
    const p = createSegment(store, { routeIds: ['35km'], startDist: 0, endDist: 1000, equipment: [], phase: 'purku' })

    expect(segmentsInPhase([a, p], 'purku')).toEqual([p])
    expect(getSegmentsForPhase(store, 'purku').map(s => s.id)).toEqual([p.id])
    expect(segmentsInPhase([a, p], 'purku').map(s => s.id))
      .toEqual(getSegmentsForPhase(store, 'purku').map(s => s.id))
  })

  it('B204: järjestäjä ilman katseluvalintaa saa SAMAN rajauksen kuin talkoolainen', async () => {
    const { phaseSourceFor } = await loadPhaseModules('purku')
    const all = [seg('asettaminen', 'Pätkä 2'), seg('purku', 'Pätkä 2'), seg('purku', 'Pätkä 1 - 14.30')]

    const asJarjestaja = segmentsInPhase(all, phaseSourceFor(layoutRole('admin'))())
    const asTalkoolainen = segmentsInPhase(all, phaseSourceFor(layoutRole('talkoolainen'))())

    expect(asJarjestaja).toHaveLength(2)
    expect(asJarjestaja.map(s => s.id)).toEqual(asTalkoolainen.map(s => s.id))
  })

  it('ainoa sallittu ero on VAIHEEN LÄHDE: katseluvalinta koskee järjestäjää, ⊥ talkoolaista (V318)', async () => {
    const { phaseSourceFor } = await loadPhaseModules('purku', 'asettaminen')

    expect(phaseSourceFor(layoutRole('admin'))()).toBe('asettaminen')
    expect(phaseSourceFor(layoutRole('järjestäjä'))()).toBe('asettaminen')
    // Talkoolaiselle vaihe on tapahtuman tosiasia — järjestäjän selaimen valinta ⊥ näy hänelle.
    expect(phaseSourceFor(layoutRole('talkoolainen'))()).toBe('purku')
  })

  it('otsikko kertoo rajauksen MOLEMMILLE rooleille — rajattu lista ilman perustetta on vika', async () => {
    const { renderPatkatPage } = await loadPhaseModules('purku')
    for (const role of ['talkoolainen', 'admin']) {
      const el = document.createElement('div')
      renderPatkatPage(el, {
        faqMarkdown: '', segments: [seg('purku', 'Purkupätkä 3')], markers: [],
        role, activePhase: 'purku', audience: layoutRole(role),
      })
      expect(el.querySelector('.patkat-list-section h2')?.textContent).toBe('Pätkät · Purku')
    }
  })

  it('järjestäjä saa vaiheenvaihtajan, talkoolainen ⊥ saa (V318)', async () => {
    const { renderPatkatPage } = await loadPhaseModules('purku')
    const base = { faqMarkdown: '', segments: [], markers: [], activePhase: 'purku' as const, onPhaseChange: vi.fn() }

    const org = document.createElement('div')
    renderPatkatPage(org, { ...base, role: 'admin', audience: 'järjestäjä' })
    expect(org.querySelector('.patkat-phase-switcher .phase-switcher-select')).toBeTruthy()

    const tk = document.createElement('div')
    renderPatkatPage(tk, { ...base, role: 'talkoolainen', audience: 'talkoolainen' })
    expect(tk.querySelector('.patkat-phase-switcher')).toBeNull()
  })

  it('vaiheen vaihto kutsuu uudelleenrenderiä eikä koske serveriin (V321)', async () => {
    const { renderPatkatPage, phaseView } = await loadPhaseModules('purku')
    const onPhaseChange = vi.fn()
    const el = document.createElement('div')
    renderPatkatPage(el, {
      faqMarkdown: '', segments: [], markers: [], role: 'admin', audience: 'järjestäjä',
      activePhase: 'purku', onPhaseChange,
    })

    const select = el.querySelector('.phase-switcher-select') as HTMLSelectElement
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockClear()
    select.value = 'asettaminen'
    select.dispatchEvent(new Event('change'))

    expect(onPhaseChange).toHaveBeenCalled()
    expect(phaseView.getViewPhase()).toBe('asettaminen')
    // Katselu on paikallinen: globaali vaihe ⊥ liiku & serveriin ⊥ mene mitään.
    expect(phaseView.getActivePhase()).toBe('purku')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('V332: kasakortti seuraa GLOBAALIA vaihetta — järjestäjän purku-katselu ⊥ loihdi sitä esiin', async () => {
    const { renderPatkatPage } = await loadPhaseModules('asettaminen', 'purku')
    const el = document.createElement('div')
    renderPatkatPage(el, {
      faqMarkdown: '', segments: [], markers: [], role: 'admin', audience: 'järjestäjä',
      activePhase: 'purku', globalPhase: 'asettaminen', onPhaseChange: vi.fn(),
    })
    expect(el.querySelector('.patkat-kasat-card')).toBeNull()
  })

  it('tyhjä lista kertoo järjestäjälle että vaihetta voi vaihtaa (V21)', async () => {
    const { renderPatkatPage } = await loadPhaseModules('purku')
    const el = document.createElement('div')
    renderPatkatPage(el, {
      faqMarkdown: '', segments: [], markers: [], role: 'admin', audience: 'järjestäjä',
      activePhase: 'tarkastus', onPhaseChange: vi.fn(),
    })
    expect(el.querySelector('.patkat-empty')?.textContent).toContain('Vaihda vaihetta')
  })
})
