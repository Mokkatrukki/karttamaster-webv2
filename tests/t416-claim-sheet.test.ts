// @vitest-environment jsdom
// T416/V306: rajoitettu lehtinen. Ydinväite on NEGATIIVINEN — lehtisessä ei ole yhtään
// muokkauspintaa. Jos joku lisää tänne kolmannen toiminnon tai tekstikentän, tämä kaatuu.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMarkerClaimSheet } from '../src/ui/marker-claim-sheet'
import type { SignMarker } from '../src/logic/types'

function marker(over: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm1',
    type: 'right',
    lat: 65.0,
    lon: 27.0,
    distanceFromStart: 1000,
    routeIds: ['r1'],
    status: 'suunniteltu',
    label: 'Nuoli oikealle',
    ...over,
  } as SignMarker
}

const sheetEl = () => document.querySelector<HTMLElement>('.marker-claim-sheet')
const confirmBtn = () => document.querySelector<HTMLButtonElement>('.marker-claim-confirm')!
const closeBtn = () => document.querySelector<HTMLButtonElement>('.marker-claim-close')!

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('T416/V306 — MarkerClaimSheet', () => {
  it('avautuu merkin nimellä & nimetyllä kohteella', () => {
    const s = createMarkerClaimSheet(vi.fn())
    s.open(marker(), 'Matin pätkä')
    expect(sheetEl()).not.toBeNull()
    expect(document.querySelector('.marker-claim-name')!.textContent).toBe('Nuoli oikealle')
    expect(document.querySelector('.marker-claim-meta')!.textContent).toContain('Matin pätkä')
  })

  it('TASAN kaksi nappia — VISION "max 2 nappia" on mitattu ⊥ luvattu', () => {
    const s = createMarkerClaimSheet(vi.fn())
    s.open(marker(), 'Matin pätkä')
    expect(sheetEl()!.querySelectorAll('button')).toHaveLength(2)
  })

  it('⊥ muokkauspintoja: ei input/textarea/select (V150 — vieras merkki ⊥ ole hänen)', () => {
    const s = createMarkerClaimSheet(vi.fn())
    s.open(marker(), 'Matin pätkä')
    expect(sheetEl()!.querySelectorAll('input, textarea, select')).toHaveLength(0)
  })

  it('"Lisää tehtävääni" kutsuu callbackia merkin id:llä & sulkee lehtisen', () => {
    const onClaim = vi.fn()
    const s = createMarkerClaimSheet(onClaim)
    s.open(marker({ id: 'm-vieras' }), 'Matin pätkä')
    confirmBtn().click()
    expect(onClaim).toHaveBeenCalledWith('m-vieras')
    expect(sheetEl()).toBeNull()
    expect(s.isOpen()).toBe(false)
  })

  it('"Sulje" ⊥ mutatoi mitään', () => {
    const onClaim = vi.fn()
    const s = createMarkerClaimSheet(onClaim)
    s.open(marker(), 'Matin pätkä')
    closeBtn().click()
    expect(onClaim).not.toHaveBeenCalled()
    expect(sheetEl()).toBeNull()
  })

  it('Esc sulkee ilman mutaatiota', () => {
    const onClaim = vi.fn()
    const s = createMarkerClaimSheet(onClaim)
    s.open(marker(), 'Matin pätkä')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(sheetEl()).toBeNull()
    expect(onClaim).not.toHaveBeenCalled()
  })

  it('uudelleenavaus ⊥ kasaa kahta lehtistä DOM:iin', () => {
    const s = createMarkerClaimSheet(vi.fn())
    s.open(marker({ id: 'a' }), 'P1')
    s.open(marker({ id: 'b', label: 'Toinen' }), 'P1')
    expect(document.querySelectorAll('.marker-claim-sheet')).toHaveLength(1)
    expect(document.querySelector('.marker-claim-name')!.textContent).toBe('Toinen')
  })

  it('sulkemisen jälkeen Esc-kuuntelija ⊥ jää elämään (⊥ vuotavaa kuuntelijaa)', () => {
    const onClaim = vi.fn()
    const s = createMarkerClaimSheet(onClaim)
    s.open(marker(), 'P1')
    closeBtn().click()
    // Toinen Esc ei saa löytää mitään suljettavaa eikä heittää.
    expect(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))).not.toThrow()
    expect(sheetEl()).toBeNull()
  })
})
