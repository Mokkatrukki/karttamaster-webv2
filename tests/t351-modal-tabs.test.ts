// @vitest-environment jsdom
// T351/V254 — SegmentDetailsModalin välilehdet. Sama jaettu komponentti (SegmentKotiTabs) kuin
// talkoolaisen kotinäkymässä ∴ testi lukitsee (a) tabijaon, (b) sen ettei sisältö vuoda väärään
// paneliin, (c) tyhjätilan joka pitää tabin paikallaan datasta riippumatta.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentDetailsModal } from '../src/ui/segment-details-modal'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

function marker(id: string, dist: number): SignMarker {
  return {
    id, lat: 63.1, lon: 27.1, type: 'left', status: 'suunniteltu',
    routeIds: ['35km'], distanceFromStart: dist,
  } as SignMarker
}

function openModal(extra: Partial<Segment> = {}, markers: SignMarker[] = []) {
  const store = createSegmentStore()
  const seg = createSegment(store, {
    routeIds: ['35km'], startDist: 0, endDist: 2000, equipment: [{ name: 'nauhaa', count: 2 }],
    phase: 'asettaminen', displayName: 'Pätkä 1',
  })!
  if (Object.keys(extra).length) Object.assign(seg, extra)
  const modal = new SegmentDetailsModal(store, () => {}, () => {}, { getMarkers: () => markers })
  modal.open(seg)
  return { modal, seg, store }
}

const tabButtons = () =>
  [...document.querySelectorAll<HTMLButtonElement>('.segment-details-modal-tabs .segment-koti-tab')]
const panel = (id: string) =>
  document.querySelector<HTMLElement>(`.segment-details-modal-tabs .segment-koti-panel[data-tab="${id}"]`)!

describe('T351/V254 — pätkämodaalin välilehdet', () => {
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

  it('kolme tabia oikeassa järjestyksessä, oletus = Varustelista', () => {
    openModal()
    expect(tabButtons().map(b => b.dataset.tab)).toEqual(['varuste', 'merkit', 'asetukset'])
    expect(tabButtons()[0].textContent).toContain('Varustelista')
    expect(tabButtons()[0].getAttribute('aria-selected')).toBe('true')
    expect(panel('varuste').hidden).toBe(false)
    expect(panel('merkit').hidden).toBe(true)
    expect(panel('asetukset').hidden).toBe(true)
  })

  it('varusteet ja merkit ovat ERI paneleissa', () => {
    openModal({}, [marker('m1', 500)])
    expect(panel('varuste').querySelector('.segment-equipment-manual-list')).not.toBeNull()
    expect(panel('varuste').querySelector('.segment-equipment-add')).not.toBeNull()
    expect(panel('varuste').querySelector('.segment-details-marker-list')).toBeNull()

    expect(panel('merkit').querySelector('.segment-details-marker-list')).not.toBeNull()
    expect(panel('merkit').querySelector('.segment-equipment-chip-list')).not.toBeNull()
    expect(panel('merkit').querySelector('.segment-equipment-manual-list')).toBeNull()
  })

  it('tab-klikkaus vaihtaa näkyvän panelin', () => {
    openModal({}, [marker('m1', 500)])
    tabButtons()[1].click()
    expect(panel('varuste').hidden).toBe(true)
    expect(panel('merkit').hidden).toBe(false)
    expect(tabButtons()[1].getAttribute('aria-selected')).toBe('true')
    expect(tabButtons()[0].getAttribute('aria-selected')).toBe('false')
  })

  it('merkitön pätkä: merkit-tab näyttää tyhjätilan eikä katoa', () => {
    openModal()
    expect(tabButtons().map(b => b.dataset.tab)).toContain('merkit')
    expect(panel('merkit').querySelector('.segment-details-markers-empty')).not.toBeNull()
    expect(panel('merkit').querySelector('.segment-details-marker-list')).toBeNull()
  })

  it('Asetukset-tab sisältää neljä sisäotsikkoa oikeassa järjestyksessä', () => {
    openModal()
    const titles = [...panel('asetukset').querySelectorAll('.segment-details-group-title')].map(e => e.textContent)
    expect(titles).toEqual(['Tiedot', 'Jako', 'Kartta', 'Vaiheet'])
  })

  it('Asetukset-tab kantaa nimen, kuvauksen, jaon, rajat ja kloonauksen', () => {
    openModal()
    const p = panel('asetukset')
    expect(p.querySelector('.segment-details-name-input')).not.toBeNull()
    expect(p.querySelector('.segment-desc-input')).not.toBeNull()
    expect(p.querySelector('.segment-assign-modal-form')).not.toBeNull()
    expect(p.querySelector('.btn-segment-edit-pts-modal')).not.toBeNull()
    expect(p.querySelector('.btn-segment-clone-phase')).not.toBeNull()
  })

  it('aktiviteettiloki renderöityy Asetukset-tabiin jaetulle pätkälle', () => {
    openModal({ assignedCode: 'patka-1' })
    expect(panel('asetukset').querySelector('.segment-audit-section')).not.toBeNull()
  })

  it('tabipalkki on modaalin bodyn sisällä (⊥ #app-riippuvainen piilotus)', () => {
    openModal()
    const bar = document.querySelector('.segment-details-modal-tabs .segment-koti-tabbar')!
    expect(bar.closest('.segment-details-modal-body')).not.toBeNull()
    // Modaali on document.bodyn lapsi ∴ #app[data-view-mode="kartta"] -sääntö ei voi osua siihen.
    expect(document.querySelector('.segment-details-modal-backdrop')!.parentElement).toBe(document.body)
  })
})
