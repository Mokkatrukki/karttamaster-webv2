// @vitest-environment jsdom
//
// T456/V341 (B189) — pätkäpinnan merkkimodaali ⊥ tarjoa kasalle statusnappeja.
// Kartan merkkiklikki oli se vahinkoklikki jolla kasa siirtyi "haetuksi" ilman että kukaan
// hakenut sitä — & `/kasat` näytti sen sen jälkeen Haetuissa (V332: haettu ⊥ katoa listalta).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarkerDetailModal } from '../src/ui/marker-detail-modal'
import { PILE_TEMPLATE_ID } from '../src/logic/pile'
import type { SignMarker } from '../src/logic/types'

const makeMarker = (over: Partial<SignMarker> = {}): SignMarker => ({
  id: 'm1',
  type: 'right',
  lat: 63,
  lon: 27,
  distanceFromStart: 1500,
  routeIds: ['35km'],
  status: 'suunniteltu',
  ...over,
})

const manager = (marker: SignMarker) => ({
  getAll: vi.fn(() => [marker]),
  updateNote: vi.fn(),
  updateStatus: vi.fn(),
  bulkSetStatus: vi.fn(),
  updateType: vi.fn(),
  remove: vi.fn(),
  panTo: vi.fn(),
  updateDescription: vi.fn(),
  addImage: vi.fn().mockResolvedValue(undefined),
})

function open(marker: SignMarker, role: string, code?: string): void {
  const modal = new MarkerDetailModal(
    manager(marker) as never,
    () => null,
    () => role,
    vi.fn(),
    () => code,
    () => ({ phase: 'purku' as const }),
  )
  modal.open(marker.id)
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('T456/V341 — kasan status ⊥ ole pätkäpinnan toiminto', () => {
  it('talkoolainen: kasalla ⊥ kuittaus- eikä peruutusnappia, syy näkyy', () => {
    open(makeMarker({ templateId: PILE_TEMPLATE_ID, status: 'suunniteltu' }), 'talkoolainen')
    expect(document.querySelector('.modal-footer-actions')!.children.length).toBe(0)
    expect(document.querySelector('.marker-detail-revert')).toBeNull()
    // Kuollut pinta olisi pahempi kuin puuttuva (V250) ∴ tilalla on syy & osoite.
    expect(document.querySelector('.marker-detail-status-note')!.textContent).toContain('/kasat')
  })

  it('talkoolainen: KYLTTI saa yhä kuittausnappinsa (rajaus koskee vain kasaa)', () => {
    open(makeMarker({ templateId: 'nuoli-vasen', status: 'asetettu' }), 'talkoolainen')
    expect(document.querySelector('.modal-footer-actions')!.children.length).toBeGreaterThan(0)
    expect(document.querySelector('.marker-detail-status-note')).toBeNull()
  })

  it('järjestäjä: kasalla ⊥ statusriviä — sama pinta toisella roolilla', () => {
    open(makeMarker({ templateId: PILE_TEMPLATE_ID }), 'järjestäjä')
    expect(document.querySelector('.marker-detail-status-row')).toBeNull()
    expect(document.querySelector('.marker-detail-status-note')).not.toBeNull()
  })

  it('järjestäjä: kyltillä statusrivi on ennallaan', () => {
    open(makeMarker({ templateId: 'nuoli-vasen' }), 'järjestäjä')
    expect(document.querySelector('.marker-detail-status-row')!.children.length).toBeGreaterThan(0)
  })

  it('kasan poisto (T438) säilyy — rajaus koskee statusta ⊥ elinkaarta', () => {
    open(makeMarker({ templateId: PILE_TEMPLATE_ID, createdBy: 'OMA1' }), 'talkoolainen', 'OMA1')
    expect(document.querySelector('.modal-btn-destructive')!.textContent).toBe('Poista kasa')
  })
})
