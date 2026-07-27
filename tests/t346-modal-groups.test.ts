// @vitest-environment jsdom
// T346/V250 — SegmentDetailsModalin osioryhmittely. Ryhmäjako on myös tuleva moduuliraja
// (moduuli on ⚠️ pilkkolistalla) ∴ tämä testi lukitsee rajat ennen pilkkomista.
// T354/V257 PÄIVITYS: Sisältö-ryhmä avautui kahdeksi välilehdeksi (Varustelista · Kaikki merkit,
// katettu tests/t351-modal-tabs.test.ts:ssä) ja loput neljä ryhmää elävät Asetukset-tabin
// sisäotsikkoina. Ryhmärajat itsessään EIVÄT muuttuneet — vain niiden kuori.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentDetailsModal } from '../src/ui/segment-details-modal'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { Segment } from '../src/logic/segments'

function openModal(extra: Partial<Segment> = {}) {
  const store = createSegmentStore()
  const seg = createSegment(store, {
    routeIds: ['35km'], startDist: 0, endDist: 2000, equipment: [],
    phase: 'asettaminen', displayName: 'Pätkä 1',
  })!
  if (Object.keys(extra).length) Object.assign(seg, extra)
  const modal = new SegmentDetailsModal(store, () => {}, () => {}, { getMarkers: () => [] })
  modal.open(seg)
  return { modal, seg, store }
}

const groupTitles = () =>
  [...document.querySelectorAll('.segment-details-group-title')].map(el => el.textContent)

/** Minkä ryhmän alle elementti kuuluu = lähin edeltävä ryhmäotsikko. */
function groupOf(el: Element): string | null {
  let node: Element | null = el
  while (node) {
    if (node.classList?.contains('segment-details-group-title')) return node.textContent
    node = node.previousElementSibling
  }
  return null
}

describe('T346/V250+T354 — modaalin ryhmärajat', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    let ls: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => ls[k] ?? null,
      setItem: (k: string, v: string) => { ls[k] = v },
      removeItem: (k: string) => { delete ls[k] },
      clear: () => { ls = {} },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] } as unknown as Response))
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('ryhmäotsikot oikeassa järjestyksessä (Sisältö = omat tabinsa, T354)', () => {
    openModal()
    expect(groupTitles()).toEqual(['Tiedot', 'Jako', 'Kartta', 'Vaiheet'])
  })

  it('nimi ja kuvaus kuuluvat Tiedot-ryhmään', () => {
    openModal()
    expect(groupOf(document.querySelector('.segment-details-name-input')!.closest('.segment-details-modal-section')!)).toBe('Tiedot')
    expect(groupOf(document.querySelector('.segment-desc-input')!.closest('.segment-details-modal-section')!)).toBe('Tiedot')
  })

  // T356: korostuskytkin siirtyi headeriin (tilakytkin, ⊥ ryhmän asetusrivi) → Kartta-ryhmään
  // jää rajojen muokkaus. Kytkimen sijainti on t335:n vastuulla.
  it('rajojen muokkaus kuuluu Kartta-ryhmään', () => {
    openModal()
    expect(groupOf(document.querySelector('.btn-segment-edit-pts-modal')!.closest('.segment-details-modal-section')!)).toBe('Kartta')
    expect(document.querySelector('.segment-details-modal-body .btn-segment-focus-toggle')).toBeNull()
  })

  it('kloonaus kuuluu Vaiheet-ryhmään', () => {
    openModal()
    expect(groupOf(document.querySelector('.btn-segment-clone-phase')!.closest('.segment-details-modal-section')!)).toBe('Vaiheet')
  })

  it('aktiviteettiloki elää Jako-ryhmässä (⊥ bodyn loppuun liimattuna)', () => {
    openModal({ assignedCode: 'patka-1' })
    const audit = document.querySelector('.segment-audit-section')!
    expect(audit).not.toBeNull()
    expect(groupOf(audit)).toBe('Jako')
  })

  it('jakamaton pätkä: ei lokia, mutta Jako-ryhmä on silti olemassa (assign-lomake)', () => {
    openModal()
    expect(document.querySelector('.segment-audit-section')).toBeNull()
    expect(groupTitles()).toContain('Jako')
  })

  it('vaaravyöhyke ja footer pysyvät ryhmien ULKOpuolella (T355: poisto footerin sisällä)', () => {
    openModal()
    const danger = document.querySelector('.segment-modal-danger-zone')!
    const footer = document.querySelector('.modal-footer')!
    expect(danger.classList.contains('segment-details-modal-section')).toBe(false)
    expect(footer.contains(danger)).toBe(true)
  })
})
