// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderKasatPage, doneGroupCollapsed } from '../src/ui/kasat-page'
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

// ── Haetut omana RYHMÄNÄÄN (käyttäjäpäätös 2026-07-31) ────────────────────────────────────
// Hännille pudottaminen oli lajittelusääntö jonka vain koodi tiesi: pitkällä listalla haettu
// kasa katosi käytännössä näkyvistä. Ryhmä otsikon & MÄÄRÄN kanssa sanoo saman ääneen.

describe('Kasat — haetut omana ryhmänään', () => {
  const done = (id: string) => pile(id, { status: 'kerätty' })

  it('avoimet ensin omalla listallaan, haetut ryhmän sisällä', () => {
    const el = render([done('h1'), pile('a1'), pile('a2')], { onCollected: () => {} })
    const lists = el.querySelectorAll('ul.kasat-list')
    expect(lists.length).toBe(2)
    expect([...lists[0].querySelectorAll('.kasat-row')].map(r => r.getAttribute('data-id')))
      .toEqual(['a1', 'a2'])
    const group = el.querySelector('.kasat-done-group')!
    expect([...group.querySelectorAll('.kasat-row')].map(r => r.getAttribute('data-id')))
      .toEqual(['h1'])
    // Ryhmä on avoimien JÄLKEEN — työ ensin.
    expect(lists[0].compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('otsikko kertoo määrän & on 44px-kosketuskohde (jaettu section-header)', () => {
    const el = render([done('h1'), done('h2'), pile('a1')], { onCollected: () => {} })
    const head = el.querySelector('.kasat-done-header') as HTMLButtonElement
    expect(head.tagName).toBe('BUTTON')
    expect(head.textContent).toContain('Haetut')
    expect(head.querySelector('.kasat-done-count')!.textContent).toBe('(2)')
    expect(head.getAttribute('aria-expanded')).toBe('true')
  })

  it('ei haettuja → ryhmää ⊥ renderöidä lainkaan (V250)', () => {
    const el = render([pile('a1')], { onCollected: () => {} })
    expect(el.querySelector('.kasat-done-group')).toBeNull()
    expect(el.querySelectorAll('ul.kasat-list').length).toBe(1)
  })

  it('kutistettuna rivit katoavat mutta MÄÄRÄ pysyy otsikossa', () => {
    const el = render([done('h1'), done('h2'), pile('a1')], { onCollected: () => {}, doneCollapsed: true })
    const head = el.querySelector('.kasat-done-header')!
    expect(head.querySelector('.kasat-done-count')!.textContent).toBe('(2)')
    expect(head.getAttribute('aria-expanded')).toBe('false')
    expect(el.querySelector('.kasat-list--done')).toBeNull()
    // Avoin lista ⊥ kärsi kutistuksesta.
    expect(el.querySelectorAll('.kasat-row').length).toBe(1)
  })

  it('pitkä ryhmä on oletuksena kiinni, lyhyt auki — määrä näkyy molemmissa', () => {
    const pitka = render([done('h1'), done('h2'), done('h3'), done('h4'), pile('a1')], { onCollected: () => {} })
    expect(pitka.querySelector('.kasat-done-header')!.getAttribute('aria-expanded')).toBe('false')
    expect(pitka.querySelector('.kasat-done-count')!.textContent).toBe('(4)')

    const lyhyt = render([done('h1'), pile('a1')], { onCollected: () => {} })
    expect(lyhyt.querySelector('.kasat-done-header')!.getAttribute('aria-expanded')).toBe('true')
  })

  it('otsikon napautus kutsuu onToggleDonea — kutistus on käyttäjän valinta', () => {
    const onToggleDone = vi.fn()
    const el = render([done('h1'), pile('a1')], { onCollected: () => {}, onToggleDone })
    ;(el.querySelector('.kasat-done-header') as HTMLButtonElement).click()
    expect(onToggleDone).toHaveBeenCalled()
  })

  it('nimenomainen valinta voittaa automaatin (doneGroupCollapsed)', () => {
    expect(doneGroupCollapsed(0)).toBe(false)
    expect(doneGroupCollapsed(3)).toBe(false)
    expect(doneGroupCollapsed(4)).toBe(true)
    expect(doneGroupCollapsed(9, false)).toBe(false)
    expect(doneGroupCollapsed(1, true)).toBe(true)
  })

  it('kaikki haettu → "kaikki haettu" -viesti JA ryhmä (⊥ tyhjä ruutu)', () => {
    const el = render([done('h1'), done('h2')], { onCollected: () => {} })
    expect(el.querySelector('.kasat-empty.kasat-done')).not.toBeNull()
    expect(el.querySelector('.kasat-done-count')!.textContent).toBe('(2)')
  })
})
