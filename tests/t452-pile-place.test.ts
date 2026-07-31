// @vitest-environment jsdom
//
// T452/V335,V336 — kasan sijoitustila: kartta näkyviin, ohje syötekerrokseen, peruutus eläväksi.
// B182 (kotimoodissa kasaa ⊥ voinut luoda), B183 (Peruuta näkyi & oli kuollut), B184 (tilaa vie).
//
// HUOM V336: `pointer-events` ⊥ ole jsdomissa olemassa ∴ "nappi on klikattava" todistetaan
// VAIN Playwrightissa (`e2e/pile-place.spec.ts`). Täällä todistetaan se mikä on todistettavissa:
// ohjerivi menee PANELIIN (`#segment-view` = ainoa `pointer-events:auto` -kerros), ⊥ konttiin.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startPilePlacement, runPileAction } from '../src/app/pile-placement'
import { showPilePlaceHint, removePilePlaceHint } from '../src/ui/pile-drop'
import { setViewMode, getViewMode } from '../src/app/talkoolainen-mode'

function layout(viewMode: string | null): { host: HTMLElement; app: HTMLElement } {
  document.body.innerHTML = ''
  const app = document.createElement('div')
  app.id = 'app'
  if (viewMode !== null) app.setAttribute('data-view-mode', viewMode)
  const container = document.createElement('div')
  container.id = 'segment-view-container'
  const panel = document.createElement('div')
  panel.id = 'segment-view'
  container.appendChild(panel)
  app.appendChild(container)
  document.body.appendChild(app)
  return { host: panel, app }
}

function deps(host: HTMLElement, over: Partial<Parameters<typeof startPilePlacement>[0]> = {}) {
  return {
    host,
    armPlacer: vi.fn(),
    disarm: vi.fn(),
    onPlace: vi.fn(),
    ...over,
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
  window.sessionStorage.clear()
})

describe('T452/V335 — sijoitustila tuo kartan näkyviin itse (B182)', () => {
  it('kotimoodista armaus vaihtaa näkymän kartaksi — muuten napautettavaa pintaa ⊥ ole', () => {
    const { host, app } = layout('koti')
    setViewMode('koti')
    const onEnterKartta = vi.fn()
    startPilePlacement(deps(host, { onEnterKartta }))
    expect(app.getAttribute('data-view-mode')).toBe('kartta')
    expect(getViewMode()).toBe('kartta')
    // V176: kartta oli `display:none` ∴ Leaflet ! laskea konttikoko uudelleen.
    expect(onEnterKartta).toHaveBeenCalledOnce()
  })

  it('purku palauttaa edellisen moodin — myös Esc:llä & sijoituksella (yksi suppilo)', () => {
    const { host, app } = layout('koti')
    setViewMode('koti')
    let onDisarm = (): void => {}
    startPilePlacement(deps(host, { armPlacer: (_fn, cb) => { onDisarm = cb } }))
    expect(app.getAttribute('data-view-mode')).toBe('kartta')
    onDisarm()
    expect(app.getAttribute('data-view-mode')).toBe('koti')
    expect(host.querySelector('.pile-place-hint')).toBeNull()
  })

  it('karttamoodissa ⊥ turhaa moodinvaihtoa & purku ⊥ heitä käyttäjää kotiin', () => {
    const { host, app } = layout('kartta')
    setViewMode('kartta')
    let onDisarm = (): void => {}
    startPilePlacement(deps(host, { armPlacer: (_fn, cb) => { onDisarm = cb } }))
    expect(app.getAttribute('data-view-mode')).toBe('kartta')
    onDisarm()
    expect(app.getAttribute('data-view-mode')).toBe('kartta')
  })

  it('järjestäjällä ⊥ ole `data-view-mode` (V174) ∴ moodiin ⊥ kosketa', () => {
    const { host, app } = layout(null)
    let onDisarm = (): void => {}
    startPilePlacement(deps(host, { armPlacer: (_fn, cb) => { onDisarm = cb } }))
    expect(app.hasAttribute('data-view-mode')).toBe(false)
    onDisarm()
    expect(app.hasAttribute('data-view-mode')).toBe(false)
  })

  it('viritys saa sijoitus-callbackin & Peruuta purkaa virityksen', () => {
    const { host } = layout('kartta')
    const d = deps(host)
    startPilePlacement(d)
    expect(d.armPlacer).toHaveBeenCalledOnce()
    ;(host.querySelector('.pile-place-hint-cancel') as HTMLButtonElement).click()
    expect(d.disarm).toHaveBeenCalledOnce()
  })
})

describe('T452/V336 — ohje asuu syötekerroksessa (B183)', () => {
  it('ohjerivi menee paneliin (#segment-view), ⊥ pointer-events:none -konttiin', () => {
    const { host } = layout('kartta')
    startPilePlacement(deps(host))
    const hint = document.querySelector('.pile-place-hint')!
    expect(hint.parentElement!.id).toBe('segment-view')
    expect(document.getElementById('segment-view-container')!.children.length).toBe(1)
  })
})

describe('T453/V337 — kasan jättö ⊥ epäonnistu hiljaa', () => {
  it('poikkeus kääntyy viestiksi — metsässä ⊥ ole konsolia', () => {
    const toast = vi.fn()
    expect(() => runPileAction(() => { throw new Error('ei oikeutta') }, toast)).not.toThrow()
    expect(toast).toHaveBeenCalledOnce()
    expect(toast.mock.calls[0][0]).toContain('ei oikeutta')
  })

  it('⊥ virhettä → ⊥ viestiä (toiminto puhuu vain kun on asiaa)', () => {
    const toast = vi.fn()
    const fn = vi.fn()
    runPileAction(fn, toast)
    expect(fn).toHaveBeenCalledOnce()
    expect(toast).not.toHaveBeenCalled()
  })

  it('ei-Error-heitto kelpaa myös (⊥ toista poikkeusta käsittelijässä)', () => {
    const toast = vi.fn()
    expect(() => runPileAction(() => { throw 'raaka' }, toast)).not.toThrow()
    expect(toast.mock.calls[0][0]).toContain('raaka')
  })
})

describe('T452/B184 — ohje on rivi ⊥ laatikko', () => {
  it('yksi tekstirivi + Peruuta, ⊥ erillistä otsikkoa (pystytila on kartan)', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    showPilePlaceHint(host, () => {})
    const box = host.querySelector('.pile-place-hint')!
    expect(box.querySelector('.pile-place-hint-title')).toBeNull()
    expect(box.querySelector('.pile-place-hint-text')!.textContent).toContain('hakea autolla')
    expect(box.querySelector('.pile-place-hint-cancel')!.textContent).toBe('Peruuta')
  })

  it('sijoitustilassa kasanappi piiloon & takaisin kun tila purkautuu', () => {
    const { host } = layout('kartta')
    startPilePlacement(deps(host))
    expect(host.classList.contains('is-placing-pile')).toBe(true)
    removePilePlaceHint(host)
    expect(host.classList.contains('is-placing-pile')).toBe(false)
  })
})
