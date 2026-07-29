// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarkerDetailModal } from '../src/ui/marker-detail-modal'
import { navUrl, navTarget } from '../src/logic/nav-link'
import type { SignMarker } from '../src/logic/types'

// T396/V286 — "Navigoi tähän" -ankkuri merkkimodaalissa. Taso 2 Vitest-jsdom.

const makeMarker = (overrides: Partial<SignMarker> = {}): SignMarker => ({
  id: 'test-id',
  type: 'right',
  lat: 65.63852,
  lon: 27.90431,
  distanceFromStart: 1500,
  routeIds: ['35km'],
  status: 'suunniteltu',
  ...overrides,
})

const makeMockManager = (marker: SignMarker) => ({
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

function openModal(marker: SignMarker, role = 'järjestäjä'): void {
  const manager = makeMockManager(marker)
  const modal = new MarkerDetailModal(
    manager as never,
    () => null,
    () => role,
    vi.fn(),
  )
  modal.open(marker.id)
}

const navEl = () => document.querySelector('.marker-detail-nav') as HTMLAnchorElement | null

describe('MarkerDetailModal — "Navigoi tähän" (T396/V286)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('href tulee navUrl/navTarget-parilta — modaali ei rakenna URLia itse', () => {
    const marker = makeMarker()
    openModal(marker)
    // Kutsutaan SAMAA funktiota jota tuotantokoodi kutsuu. Jos testi kirjoittaisi
    // odotetun URLin auki, se vahtisi itseään eikä V286:n yhtä kohdetta.
    expect(navEl()?.getAttribute('href')).toBe(navUrl(navTarget(marker)))
  })

  it('avautuu uuteen välilehteen ja katkaisee opener-viittauksen', () => {
    openModal(makeMarker())
    const link = navEl()
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toContain('noopener')
  })

  it('on ankkuri, ei nappi — selain hoitaa app-handoffin', () => {
    openModal(makeMarker())
    expect(navEl()?.tagName).toBe('A')
  })

  it('kelvottomat koordinaatit → ankkuria ei ole DOM:issa lainkaan', () => {
    // Ei disabloitua nappia (V250: kuollut pinta), ei rikkinäistä linkkiä.
    openModal(makeMarker({ lat: NaN, lon: 27.9 }))
    expect(navEl()).toBeNull()
  })

  it('renderöityy molemmille rooleille — järjestäjä ajaa itse pätkänsä', () => {
    openModal(makeMarker(), 'järjestäjä')
    expect(navEl()).not.toBeNull()

    document.body.innerHTML = ''
    openModal(makeMarker(), 'talkoolainen')
    expect(navEl()).not.toBeNull()
  })

  it('on ENNEN kommenttikenttää DOM-järjestyksessä', () => {
    openModal(makeMarker())
    const link = navEl()!
    const note = document.querySelector('.marker-detail-note')!
    // DOCUMENT_POSITION_FOLLOWING = note tulee linkin jälkeen.
    expect(link.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('ei jää footeriin — footerin sisältö on lukittu per rooli (DESIGN §K)', () => {
    openModal(makeMarker(), 'talkoolainen')
    expect(document.querySelector('.modal-footer .marker-detail-nav')).toBeNull()
  })
})
