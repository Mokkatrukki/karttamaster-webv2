// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderKasatPage } from '../src/ui/kasat-page'
import { renderPatkatPage } from '../src/ui/patkat-page'
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
    pileMarkerIds: ['a', 'b', 'c'],
    ...over,
  } as SignMarker
}

function render(markers: SignMarker[], opts: Partial<Parameters<typeof renderKasatPage>[1]> = {}) {
  const el = document.createElement('div')
  renderKasatPage(el, {
    piles: listPiles(markers, opts.hasFix ? { lat: 65.6, lon: 27.5 } : null),
    phase: 'purku',
    ...opts,
  })
  return el
}

describe('T448/V332 — kasarivi on toiminto', () => {
  it('rivi näyttää sisältömäärän & tarjoaa Navigoi + Haettu', () => {
    const el = render([pile('k1')], { onCollected: () => {} })
    const row = el.querySelector('.kasat-row')!
    expect(row.getAttribute('data-id')).toBe('k1')
    expect(row.querySelector('.kasat-row-meta')!.textContent).toContain('3 merkkiä')
    const nav = row.querySelector('a.kasat-row-nav') as HTMLAnchorElement
    expect(nav.textContent).toContain('Navigoi')
    // V286: yksi ankkuri yhteen kohteeseen — Google Maps driving.
    expect(nav.href).toContain('destination=65.600000,27.500000')
    expect(nav.href).toContain('travelmode=driving')
    expect(row.querySelector('.kasat-row-done')!.textContent).toBe('✓ Haettu')
  })

  it('Haettu kutsuu käsittelijää kasan id:llä', () => {
    const onCollected = vi.fn()
    const el = render([pile('k1')], { onCollected })
    ;(el.querySelector('.kasat-row-done') as HTMLButtonElement).click()
    expect(onCollected).toHaveBeenCalledWith('k1')
  })

  it('jo haettu kasa ⊥ saa Haettu-nappia (toiminto joka ⊥ tee mitään on rikkinäinen nappi)', () => {
    const el = render([pile('k1', { status: 'kerätty' })], { onCollected: () => {} })
    expect(el.querySelector('.kasat-row-done')).toBeNull()
    expect(el.querySelector('.kasat-row--done')).not.toBeNull()
    expect(el.querySelector('.kasat-row-meta')!.textContent).toContain('haettu')
  })

  it('otsikko laskee AVOIMET kasat, ⊥ kaikkia', () => {
    const el = render([pile('a'), pile('b', { status: 'kerätty' })], { onCollected: () => {} })
    expect(el.querySelector('.kasat-header h2')!.textContent).toBe('Kasat (1)')
  })

  it('tyhjä lista kertoo MIKSI se on tyhjä (V21)', () => {
    const el = render([])
    const empty = el.querySelector('.kasat-empty')!
    expect(empty.textContent).toContain('Ei kasoja vielä')
  })

  it('kaikki haettu sanotaan ääneen', () => {
    const el = render([pile('a', { status: 'kerätty' })], { onCollected: () => {} })
    expect(el.querySelector('.kasat-done')!.textContent).toContain('Kaikki haettu')
  })

  it('ilman GPS-fixiä lista sanoo ettei se ole etäisyysjärjestyksessä', () => {
    const el = render([pile('a')])
    expect(el.querySelector('.kasat-fix-note')).not.toBeNull()
  })

  it('§C: kasapinta ⊥ ole olemassa muussa kuin purkuvaiheessa', () => {
    const el = document.createElement('div')
    renderKasatPage(el, { piles: listPiles([pile('a')]), phase: 'asettaminen' })
    expect(el.querySelector('.kasat-list')).toBeNull()
    expect(el.querySelector('.kasat-notice')!.textContent).toContain('purkuvaiheessa')
  })
})

describe('T448e — hubin kasakortti elää globaalin purkuvaiheen mukana', () => {
  function hub(activePhase: 'asettaminen' | 'tarkastus' | 'purku') {
    const el = document.createElement('div')
    renderPatkatPage(el, { faqMarkdown: '', segments: [], markers: [], role: 'talkoolainen', activePhase })
    return el
  }

  it('purussa kortti on olemassa & osoittaa /kasat:iin', () => {
    const card = hub('purku').querySelector('a.patkat-kasat-card') as HTMLAnchorElement
    expect(card).not.toBeNull()
    expect(card.getAttribute('href')).toBe('/kasat')
  })

  it('muissa vaiheissa korttia ⊥ ole (⊥ disabloituna — kuollut pinta lupaa jotain)', () => {
    expect(hub('asettaminen').querySelector('.patkat-kasat-card')).toBeNull()
    expect(hub('tarkastus').querySelector('.patkat-kasat-card')).toBeNull()
  })
})
