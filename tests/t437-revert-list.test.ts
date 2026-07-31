// T437/V323(b) — peruutus MERKKILISTAN riviltä. Spec: "peruutus näkyy siellä missä merkki on jo
// päätetilassa: merkkirivin toiminto (`segment-marker-list.ts`) + `MarkerDetailModal`". Modaali
// sai sen T437:ssä, lista jäi ilman ∴ paluu vaati modaalin avaamisen — kaksi askelta enemmän kuin
// virhe jonka se korjaa. Nämä testit todistavat että rivi käyttää SAMAA lookupia & SAMAA
// mutaatiopolkua kuin modaali, ⊥ omaa koneistoa.
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SegmentMarkerList } from '../src/ui/segment-marker-list'
import type { MarkerStatus } from '../src/logic/marker-status'
import type { SignMarker } from '../src/logic/types'
import type { Segment } from '../src/logic/segments'

const seg = (phase: Segment['phase']): Segment => ({
  id: 'seg-test', routeIds: ['35km'], primaryRouteId: '35km',
  startDist: 0, endDist: 100000, equipment: [], phase,
})

const makeMarker = (o: Partial<SignMarker> = {}): SignMarker => ({
  id: 'm1', type: 'right', lat: 63, lon: 27, distanceFromStart: 1000,
  routeIds: ['35km'], status: 'suunniteltu', ...o,
})

function mount(
  markers: SignMarker[],
  segment: Segment,
  onBulkStatus?: (ids: string[], s: MarkerStatus) => void,
) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  new SegmentMarkerList(el, {
    getMarkers: () => markers,
    getSegment: () => segment,
    onOpenDetail: () => {},
    onBulkStatus,
  }).render()
  return el
}

const revertBtn = (el: HTMLElement, id: string) =>
  el.querySelector<HTMLButtonElement>(
    `.segment-view-markers-item[data-id="${id}"] .segment-view-markers-revert`,
  )

describe('T437/V323(b) — peruutus merkkilistan riviltä', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('purussa kerätty rivi tarjoaa "Palauta keräämättömäksi" → asetettu samaa bulk-polkua', () => {
    const onBulk = vi.fn()
    const el = mount([makeMarker({ status: 'kerätty' })], seg('purku'), onBulk)
    const btn = revertBtn(el, 'm1')
    expect(btn).not.toBeNull()
    expect(btn!.textContent).toContain('Palauta keräämättömäksi')
    btn!.click()
    expect(onBulk).toHaveBeenCalledWith(['m1'], 'asetettu')
  })

  it('asetusvaiheessa asetettu rivi palautuu suunnitelluksi', () => {
    const onBulk = vi.fn()
    const el = mount([makeMarker({ status: 'asetettu' })], seg('asettaminen'), onBulk)
    const btn = revertBtn(el, 'm1')
    expect(btn!.textContent).toContain('Palauta asettamattomaksi')
    btn!.click()
    expect(onBulk).toHaveBeenCalledWith(['m1'], 'suunniteltu')
  })

  it('ei_tarpeen palautuu vaiheen avoimeen statukseen (⊥ arvaa alkuperää)', () => {
    const onBulk = vi.fn()
    const el = mount([makeMarker({ status: 'ei_tarpeen' })], seg('purku'), onBulk)
    revertBtn(el, 'm1')!.click()
    expect(onBulk).toHaveBeenCalledWith(['m1'], 'asetettu')
  })

  it('avoin rivi EI tarjoa peruutusta — ⊥ ole mitä perua', () => {
    const el = mount([makeMarker({ status: 'suunniteltu' })], seg('asettaminen'), vi.fn())
    expect(revertBtn(el, 'm1')).toBeNull()
  })

  it('ilman onBulkStatus-kytkentää lista pysyy lukulistana', () => {
    const el = mount([makeMarker({ status: 'kerätty' })], seg('purku'))
    expect(revertBtn(el, 'm1')).toBeNull()
  })

  it('peruutus ⊥ avaa merkin modaalia (rivipainike ⊥ laukea)', () => {
    const onOpenDetail = vi.fn()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const markers = [makeMarker({ status: 'kerätty' })]
    new SegmentMarkerList(el, {
      getMarkers: () => markers,
      getSegment: () => seg('purku'),
      onOpenDetail,
      onBulkStatus: () => {},
    }).render()
    revertBtn(el, 'm1')!.click()
    expect(onOpenDetail).not.toHaveBeenCalled()
  })

  it('rivin nappi käyttää samaa tekstiä kuin phase-target-lookup antaa', async () => {
    const { revertLabel } = await import('../src/logic/phase-target')
    const el = mount([makeMarker({ status: 'kerätty' })], seg('purku'), vi.fn())
    expect(revertBtn(el, 'm1')!.textContent).toBe(revertLabel(seg('purku')))
  })
})
