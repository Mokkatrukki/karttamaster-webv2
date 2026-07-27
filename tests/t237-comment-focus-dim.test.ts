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
  handlers: Record<string, () => void>
  ll: { lat: number; lng: number }
  addTo: () => FakeMarker
  on: (ev: string, fn: () => void) => FakeMarker
  getElement: () => HTMLElement
  getLatLng: () => { lat: number; lng: number }
  setLatLng: (ll: [number, number] | { lat: number; lng: number }) => FakeMarker
  remove: () => void
  dragging: { enable: () => void; disable: () => void }
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
      handlers: {},
      ll: { lat: 65, lng: 27 },
      addTo: () => fm,
      on: (ev, fn) => { fm.handlers[ev] = fn; return fm },
      getElement: () => fm.el,
      getLatLng: () => fm.ll,
      setLatLng: (next) => {
        fm.ll = Array.isArray(next) ? { lat: next[0], lng: next[1] } : next
        return fm
      },
      remove: () => {},
      dragging: { enable: () => {}, disable: () => {} },
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

// T367/V265 — raahaus tallentaa, epäonnistuminen palauttaa pinnin.
describe('T367/V265 — huomion siirto raahaamalla', () => {
  it('raahaus kutsuu onMove uusilla koordinaateilla kun canEdit sallii', async () => {
    const onMove = vi.fn().mockResolvedValue(true)
    const layer = new CommentLayer({} as never, undefined, { canEdit: () => true, onMove })
    layer.render([comment('c1')])

    created[0].ll = { lat: 65.5, lng: 27.5 }
    created[0].handlers.dragend()

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove.mock.calls[0][1]).toBe(65.5)
    expect(onMove.mock.calls[0][2]).toBe(27.5)
  })

  it('epäonnistunut siirto palauttaa pinnin lähtöpaikkaan — hiljainen paluu olisi valhe', async () => {
    const onMove = vi.fn().mockResolvedValue(false)
    const layer = new CommentLayer({} as never, undefined, { canEdit: () => true, onMove })
    layer.render([comment('c1', 65.0, 25.0)])

    created[0].ll = { lat: 66.6, lng: 28.8 }
    created[0].handlers.dragend()

    await vi.waitFor(() => expect(created[0].ll).toEqual({ lat: 65.0, lng: 25.0 }))
  })

  it('ilman muokkausoikeutta raahauskuuntelijaa ei kytketä (vieras huomio)', () => {
    const onMove = vi.fn()
    const layer = new CommentLayer({} as never, undefined, { canEdit: () => false, onMove })
    layer.render([comment('c1')])
    expect(created[0].handlers.dragend).toBeUndefined()
  })

  it('startDraft antaa raahattavan luonnoksen jonka sijainti luetaan vasta lopuksi (V264)', () => {
    const layer = new CommentLayer({} as never)
    const draft = layer.startDraft(65.1, 27.1)
    created[0].ll = { lat: 65.9, lng: 27.9 }
    expect(draft.position()).toEqual({ lat: 65.9, lon: 27.9 })
  })
})
