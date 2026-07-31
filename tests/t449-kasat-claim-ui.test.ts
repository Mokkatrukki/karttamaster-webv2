// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderKasatPage } from '../src/ui/kasat-page'
import { listPiles } from '../src/logic/pile-list'
import { PILE_TEMPLATE_ID } from '../src/logic/pile'
import type { SignMarker } from '../src/logic/types'

function pile(id: string, over: Partial<SignMarker> = {}): SignMarker {
  return {
    id,
    type: PILE_TEMPLATE_ID,
    lat: 65.6,
    lon: 27.5,
    distanceFromStart: 0,
    routeIds: [],
    status: 'suunniteltu',
    templateId: PILE_TEMPLATE_ID,
    pileMarkerIds: ['a'],
    ...over,
  } as SignMarker
}

function render(markers: SignMarker[], opts: Partial<Parameters<typeof renderKasatPage>[1]> = {}) {
  const el = document.createElement('div')
  renderKasatPage(el, { piles: listPiles(markers), phase: 'purku', ...opts })
  return el
}

describe('T449a/V333 — oletusnäkymä ⊥ näytä varauskoneistoa', () => {
  it('ilman kytkintä ⊥ ole ruutuja, ⊥ Otan valitut -nappia', () => {
    const el = render([pile('a'), pile('b')], { onCollected: () => {} })
    expect(el.querySelector('.kasat-row-check')).toBeNull()
    expect(el.querySelector('.kasat-claim-btn')).toBeNull()
    expect(el.querySelector('.kasat-select-toggle')).toBeNull()
    // Rivi on TOIMINTO: navigoi / haettu.
    expect(el.querySelector('.kasat-row-nav')).not.toBeNull()
    expect(el.querySelector('.kasat-row-done')).not.toBeNull()
  })

  it('kytkin näkyy mutta ruutuja ⊥ ennen kuin se painetaan', () => {
    const el = render([pile('a')], { onToggleSelectMode: () => {}, onToggleSelect: () => {} })
    expect(el.querySelector('.kasat-select-toggle')!.textContent).toBe('Valitse useita')
    expect(el.querySelector('.kasat-row-check')).toBeNull()
  })
})

describe('T449b — "Valitse useita" tuo ruudut ja napin', () => {
  it('valintatilassa jokainen rivi saa ruudun', () => {
    const el = render([pile('a'), pile('b')], {
      selectMode: true, onToggleSelectMode: () => {}, onToggleSelect: () => {},
    })
    expect(el.querySelectorAll('.kasat-row-check').length).toBe(2)
    expect(el.querySelector('.kasat-select-toggle')!.textContent).toBe('Valmis')
  })

  it('"Otan valitut (N)" ilmestyy vasta kun jotain on valittu', () => {
    const base = { selectMode: true, onToggleSelectMode: () => {}, onToggleSelect: () => {}, onClaimSelected: () => {} }
    expect(render([pile('a')], base).querySelector('.kasat-claim-btn')).toBeNull()
    const el = render([pile('a')], { ...base, selected: new Set(['a']) })
    expect(el.querySelector('.kasat-claim-btn')!.textContent).toBe('Otan valitut (1)')
  })

  it('nappi antaa valitut id:t', () => {
    const onClaimSelected = vi.fn()
    const el = render([pile('a'), pile('b')], {
      selectMode: true, selected: new Set(['a', 'b']),
      onToggleSelectMode: () => {}, onToggleSelect: () => {}, onClaimSelected,
    })
    ;(el.querySelector('.kasat-claim-btn') as HTMLButtonElement).click()
    expect(onClaimSelected).toHaveBeenCalledWith(['a', 'b'])
  })

  it('ruudun vaihto kutsuu käsittelijää id:llä', () => {
    const onToggleSelect = vi.fn()
    const el = render([pile('a')], { selectMode: true, onToggleSelectMode: () => {}, onToggleSelect })
    const cb = el.querySelector('.kasat-row-check') as HTMLInputElement
    cb.checked = true
    cb.dispatchEvent(new Event('change'))
    expect(onToggleSelect).toHaveBeenCalledWith('a')
  })
})

describe('T449c/V333 — varattu kasa näkyy KAIKILLE nimellä & iällä', () => {
  const claimed = pile('a', { claimedBy: 'Mikko', claimedAt: new Date(Date.now() - 45 * 60_000).toISOString() })

  it('varaus näkyy rivillä eikä rivi katoa listalta', () => {
    const el = render([claimed], { onCollected: () => {} })
    expect(el.querySelectorAll('.kasat-row').length).toBe(1)
    expect(el.querySelector('.kasat-row-claim')!.textContent).toContain('Mikko, 45 min sitten')
  })

  it('"Vapauta" on kenen tahansa käytettävissä', () => {
    const onRelease = vi.fn()
    const el = render([claimed], { onCollected: () => {}, onRelease })
    ;(el.querySelector('.kasat-row-release') as HTMLButtonElement).click()
    expect(onRelease).toHaveBeenCalledWith('a')
  })

  it('varaamattomalla rivillä ⊥ ole Vapauta-nappia', () => {
    const el = render([pile('b')], { onCollected: () => {}, onRelease: () => {} })
    expect(el.querySelector('.kasat-row-release')).toBeNull()
  })
})

describe('V333 — epäonnistunut varaus on BANNERI ⊥ hiljaisuus', () => {
  it('virheviesti renderöityy listan ensimmäisenä elementtinä & on role=alert', () => {
    const el = render([pile('a')], { onCollected: () => {}, error: 'Varaus ei mennyt läpi — ei yhteyttä.' })
    const banner = el.querySelector('.kasat-error')!
    expect(banner).not.toBeNull()
    expect(el.firstElementChild).toBe(banner)
    expect(banner.getAttribute('role')).toBe('alert')
    expect(banner.textContent).toContain('ei yhteyttä')
  })

  it('ilman virhettä banneria ⊥ ole', () => {
    const el = render([pile('a')], { onCollected: () => {} })
    expect(el.querySelector('.kasat-error')).toBeNull()
  })

  it('epäonnistuneen varauksen jälkeen rivi ⊥ näytä varattua (⊥ optimistista valhetta)', () => {
    const el = render([pile('a')], { onCollected: () => {}, error: 'Varaus ei mennyt läpi.' })
    expect(el.querySelector('.kasat-row-claim')).toBeNull()
    expect(el.querySelector('.kasat-row--claimed')).toBeNull()
  })

  it('kuittaus on käyttäjän ⊥ ajastimen — ✕ kutsuu onDismissError', () => {
    const onDismissError = vi.fn()
    const el = render([pile('a')], { onCollected: () => {}, error: 'Varaus ei mennyt läpi.', onDismissError })
    ;(el.querySelector('.kasat-error-close') as HTMLButtonElement).click()
    expect(onDismissError).toHaveBeenCalled()
  })
})
