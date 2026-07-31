// T438/V323: kasan poisto merkin modaalista — vahvistus listaa mitä palautuu, poisto tekee
// KAKSI tekoa (palautus + poisto). Pelkkä poisto jättäisi merkit `kerätty`-tilaan jota mikään
// lista ⊥ näytä (V323-korollaari).
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarkerDetailModal } from '../src/ui/marker-detail-modal'
import { PILE_TEMPLATE_ID } from '../src/logic/pile'
import type { MarkerStatus, SignMarker } from '../src/logic/types'

function marker(id: string, status: MarkerStatus, extra: Partial<SignMarker> = {}): SignMarker {
  return {
    id, type: 'right', lat: 63, lon: 27, distanceFromStart: 1500,
    routeIds: ['35km'], status, ...extra,
  }
}

const PILE = marker('kasa-1', 'suunniteltu', {
  templateId: PILE_TEMPLATE_ID, pileMarkerIds: ['m1', 'm2'], createdBy: 'P1',
})

function makeManager(all: SignMarker[]) {
  return {
    getAll: vi.fn(() => all),
    updateNote: vi.fn(), updateStatus: vi.fn(), bulkSetStatus: vi.fn(), updateType: vi.fn(),
    remove: vi.fn(), panTo: vi.fn(), updateDescription: vi.fn(),
    addImage: vi.fn().mockResolvedValue(undefined),
  }
}

function open(all: SignMarker[], role: string) {
  const manager = makeManager(all)
  const modal = new MarkerDetailModal(
    manager as any, () => null, () => role, vi.fn(), () => 'P1',
    () => ({ markerTypeFilter: PILE_TEMPLATE_ID }),
  )
  modal.open('kasa-1')
  return manager
}

describe('T438/V323 — kasan poisto palauttaa merkit', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('vahvistus kertoo montako merkkiä palaa', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    open([PILE, marker('m1', 'kerätty'), marker('m2', 'kerätty')], 'järjestäjä')
    ;(document.querySelector('.modal-btn-destructive') as HTMLButtonElement).click()
    expect(confirmSpy).toHaveBeenCalledWith('Poistetaanko kasa? 2 merkkiä palaa keräyslistalle.')
    confirmSpy.mockRestore()
  })

  it('peruttu vahvistus ⊥ poista eikä palauta mitään', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const manager = open([PILE, marker('m1', 'kerätty'), marker('m2', 'kerätty')], 'järjestäjä')
    ;(document.querySelector('.modal-btn-destructive') as HTMLButtonElement).click()
    expect(manager.remove).not.toHaveBeenCalled()
    expect(manager.bulkSetStatus).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('hyväksytty poisto palauttaa merkit avoimiksi JA poistaa kasan', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const manager = open([PILE, marker('m1', 'kerätty'), marker('m2', 'kerätty')], 'järjestäjä')
    ;(document.querySelector('.modal-btn-destructive') as HTMLButtonElement).click()
    expect(manager.bulkSetStatus).toHaveBeenCalledWith(['m1', 'm2'], 'asetettu')
    expect(manager.remove).toHaveBeenCalledWith('kasa-1')
    confirmSpy.mockRestore()
  })

  it('talkoolainen poistaa oman kasansa samoin ehdoin', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const manager = open([PILE, marker('m1', 'kerätty'), marker('m2', 'kerätty')], 'talkoolainen')
    const btn = document.querySelector('.modal-btn-destructive') as HTMLButtonElement
    expect(btn.textContent).toBe('Poista kasa')
    btn.click()
    expect(manager.bulkSetStatus).toHaveBeenCalledWith(['m1', 'm2'], 'asetettu')
    expect(manager.remove).toHaveBeenCalledWith('kasa-1')
    confirmSpy.mockRestore()
  })

  it('tavallinen merkki säilyttää entisen poistokysymyksen (⊥ palautuslogiikkaa)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const plain = marker('kasa-1', 'kerätty', { createdBy: 'P1' })
    const manager = open([plain, marker('m1', 'kerätty')], 'järjestäjä')
    ;(document.querySelector('.modal-btn-destructive') as HTMLButtonElement).click()
    expect(confirmSpy).toHaveBeenCalledWith('Poistetaanko merkki?')
    expect(manager.bulkSetStatus).not.toHaveBeenCalled()
    expect(manager.remove).toHaveBeenCalledWith('kasa-1')
    confirmSpy.mockRestore()
  })
})
