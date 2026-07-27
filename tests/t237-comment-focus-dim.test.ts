// @vitest-environment jsdom
// T237(d)/V243 — huomio-pinni HIMMENEE fokus-tilassa, ⊥ katoa.
//
// Fokus-tila (T335) saapui mainista sen jälkeen kun huomiot rakennettiin ∴ tämä on juuri se
// integraatio jota kumpikaan haara ⊥ voinut testata yksin. Testataan LUOKKAA elementissä, koska
// se on V243:n sopimus: kaksi kanavaa (alfa + kylläisyys) CSS:ssä, ⊥ display:none.
//
// V245: huomiolla ⊥ ole pätkäjäsenyyttä ∴ fokus on binäärinen — jäsenyyden laskeminen tekisi
// huomiosta merkin. Sitä nimenomaan ei saa tapahtua.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Comment } from '../src/logic/comments'

interface FakeMarker {
  el: HTMLElement
  addTo: () => FakeMarker
  on: (ev: string, fn: () => void) => FakeMarker
  getElement: () => HTMLElement
  setLatLng: () => FakeMarker
  remove: () => void
}

vi.mock('leaflet', async () => ({ default: (await import('./helpers/leaflet-mock')).L }))
import { installLeafletMock, setMarkerFactory } from './helpers/leaflet-mock'

const { CommentLayer } = await import('../src/map/comment-layer')

function comment(id: string, lat = 65.0, lon = 25.0): Comment {
  return { id, targetType: 'point', lat, lon, text: `huomio ${id}`, createdAt: '2026-07-27T00:00:00Z' }
}

let created: FakeMarker[] = []

beforeEach(() => {
  installLeafletMock()
  created = []
  setMarkerFactory(() => {
    const fm: FakeMarker = {
      el: document.createElement('div'),
      addTo: () => fm,
      on: () => fm,
      getElement: () => fm.el,
      setLatLng: () => fm,
      remove: () => {},
    }
    created.push(fm)
    return fm
  })
})

describe('T237(d)/V243 — huomio-pinnin fokus-himmennys', () => {
  it('fokus päälle → pinni saa .comment-pin-dimmed (ei poisteta kartalta)', () => {
    const layer = new CommentLayer({} as never)
    layer.render([comment('c1'), comment('c2', 65.1, 25.1)])
    expect(created).toHaveLength(2)

    layer.setFocusActive(true)

    expect(created.every(m => m.el.classList.contains('comment-pin-dimmed'))).toBe(true)
  })

  it('fokus pois → himmennys poistuu', () => {
    const layer = new CommentLayer({} as never)
    layer.render([comment('c1')])
    layer.setFocusActive(true)
    layer.setFocusActive(false)

    expect(created[0].el.classList.contains('comment-pin-dimmed')).toBe(false)
  })

  it('fokuksen ollessa päällä syntyvä pinni himmenee heti', () => {
    const layer = new CommentLayer({} as never)
    layer.render([comment('c1')])
    layer.setFocusActive(true)

    layer.render([comment('c1'), comment('c2', 65.2, 25.2)])

    expect(created).toHaveLength(2)
    expect(created[1].el.classList.contains('comment-pin-dimmed')).toBe(true)
  })
})
