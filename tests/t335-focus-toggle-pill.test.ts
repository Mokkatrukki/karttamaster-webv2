// @vitest-environment jsdom
// T335/V243 — järjestäjän korostuskytkin (modaali) + poistumis-pilleri (kartta).
// Ydin: tila EI asu modaalissa. Modaali sulkeutuu, korostus jää päälle ∴ pillerin on
// oltava ainoa ulospääsy — juuri se puuttui B131:ssä.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initMarkerFocusPill, pillText } from '../src/ui/marker-focus-pill'
import { focusToggleLabel } from '../src/ui/segment-details-modal'

function pillDom(): HTMLElement {
  document.body.innerHTML = `
    <div id="marker-focus-pill" class="map-mode-pill marker-focus-pill" role="status" hidden>
      <span id="marker-focus-pill-label">Korostus</span>
      <button id="btn-marker-focus-clear" class="marker-focus-pill__clear" type="button" aria-label="Poista korostus">✕</button>
    </div>`
  return document.getElementById('marker-focus-pill')!
}

describe('korostuskytkimen label (T335/V243/V197)', () => {
  it('kertoo tilan sanoin, ei pelkällä ikonilla', () => {
    expect(focusToggleLabel(false)).toBe('◎ Korosta vain tämä pätkä')
    expect(focusToggleLabel(true)).toBe('◉ Korostus päällä')
  })
})

describe('poistumis-pilleri (T335/V243)', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('piilossa kunnes tila kytketään, sitten näkyy pätkän nimellä', () => {
    const pill = pillDom()
    const handle = initMarkerFocusPill({ onClear: () => {} })
    expect(handle.isVisible()).toBe(false)

    handle.show('Pätkä 3')
    expect(handle.isVisible()).toBe(true)
    expect(pill.hasAttribute('hidden')).toBe(false)
    expect(document.getElementById('marker-focus-pill-label')!.textContent).toBe(pillText('Pätkä 3'))
  })

  it('✕ kutsuu nollauksen', () => {
    pillDom()
    const onClear = vi.fn()
    const handle = initMarkerFocusPill({ onClear })
    handle.show('Pätkä 3')
    document.getElementById('btn-marker-focus-clear')!.click()
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('hide piilottaa (hidden on totuus, ei luokka)', () => {
    const pill = pillDom()
    const handle = initMarkerFocusPill({ onClear: () => {} })
    handle.show('Pätkä 3')
    handle.hide()
    expect(pill.hasAttribute('hidden')).toBe(true)
    expect(handle.isVisible()).toBe(false)
  })

  it('destroy irrottaa kuuntelijan (re-init ⊥ kasaa kutsuja)', () => {
    pillDom()
    const onClear = vi.fn()
    const handle = initMarkerFocusPill({ onClear })
    handle.destroy()
    document.getElementById('btn-marker-focus-clear')!.click()
    expect(onClear).not.toHaveBeenCalled()
  })
})

// Modaali+pilleri yhdessä: sama tilamalli kuin wiringissä (segments-wiring.ts), pienoiskoossa.
describe('kytkin + pilleri yhdessä (T335/V243)', () => {
  it('kytkin päälle → pilleri näkyy; ✕ → kytkin palaa pois-tilaan modaalin auetessa uudelleen', async () => {
    pillDom()
    const { SegmentDetailsModal } = await import('../src/ui/segment-details-modal')
    const { createSegmentStore, createSegment } = await import('../src/logic/segments')

    const store = createSegmentStore()
    const seg = createSegment(store, {
      routeIds: ['r1'], startDist: 0, endDist: 1000, equipment: [], phase: 'asettaminen',
      displayName: 'Pätkä 3',
    })!

    let focusId: string | null = null
    const pill = initMarkerFocusPill({ onClear: () => { focusId = null; pill.hide() } })
    const modal = new SegmentDetailsModal(store, () => {}, () => {}, {
      getMarkers: () => [],
      isFocusSegment: s => focusId === s.id,
      onToggleFocusSegment: (s, on) => {
        focusId = on ? s.id : null
        if (on) pill.show(s.displayName ?? 'pätkä')
        else pill.hide()
      },
    })

    modal.open(seg)
    const btn = document.querySelector<HTMLButtonElement>('.btn-segment-focus-toggle')!
    expect(btn.getAttribute('aria-pressed')).toBe('false')

    btn.click()
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    expect(btn.textContent).toBe(focusToggleLabel(true))
    expect(focusId).toBe(seg.id)
    expect(pill.isVisible()).toBe(true)

    // V243: modaalin sulkeminen ⊥ nollaa tilaa — pilleri jää ainoaksi ulospääsyksi
    modal.close()
    expect(pill.isVisible()).toBe(true)
    expect(focusId).toBe(seg.id)

    document.getElementById('btn-marker-focus-clear')!.click()
    expect(focusId).toBe(null)
    expect(pill.isVisible()).toBe(false)

    // uudelleen auetessa kytkin lukee tilan wiringistä → pois
    modal.open(seg)
    expect(document.querySelector('.btn-segment-focus-toggle')!.getAttribute('aria-pressed')).toBe('false')
  })
})
