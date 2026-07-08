import { describe, it, expect, afterEach } from 'vitest'
import { buildMarkerVisual } from '../src/ui/marker-visual-row'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('T198 — MarkerVisualRow / buildMarkerVisual', () => {
  it('ikoni-precedence: iconId ilman kuvaa renderöi SVG:n', () => {
    const el = buildMarkerVisual({ type: 'left', iconId: 'arrow-left', label: 'Vasemmalle' }, { size: 34, zoomable: false })
    expect(el.querySelector('.marker-visual-row-single svg')).toBeTruthy()
  })

  it('label-fallback: ei iconId, ei kuvaa → compactLabel-teksti', () => {
    const el = buildMarkerVisual({ type: 'custom-xyz', label: 'Muurahaispesä' }, { size: 34, zoomable: false })
    const box = el.querySelector('.marker-visual-row-single')!
    expect(box.textContent).toBe('MUU')
  })

  it('tuplamerkki (parts.length=2): kaksi lohkoa pystypinossa, ei kulmabadgea', () => {
    const el = buildMarkerVisual(
      { type: 'combo', label: 'Risteys', parts: [{ iconId: 'arrow-left' }, { iconId: 'arrow-right' }] },
      { size: 34, zoomable: false },
    )
    const slots = el.querySelectorAll('.marker-visual-row-combo-slot')
    expect(slots).toHaveLength(2)
    expect(el.querySelector('.badge-combo')).toBeFalsy()
    expect(el.textContent).not.toContain('2')
  })

  it('UX-korjaus: oletustyypin väri tulee SIGN_TYPES:sta (left=sininen), ei kiinteä accent', () => {
    const el = buildMarkerVisual({ type: 'left', iconId: 'arrow-left', label: 'Vasemmalle' }, { size: 34, zoomable: false })
    const box = el.querySelector<HTMLElement>('.marker-visual-row-single')!
    expect(box.style.background).toBe('rgb(37, 99, 235)') // #2563eb
  })

  it('UX-korjaus: custom template-väri (marker.color) voittaa oletustyypin värin', () => {
    const el = buildMarkerVisual({ type: 'left', iconId: 'arrow-left', label: 'Custom', color: '#ff00ff' }, { size: 34, zoomable: false })
    const box = el.querySelector<HTMLElement>('.marker-visual-row-single')!
    expect(box.style.background).toBe('rgb(255, 0, 255)')
  })

  it('tuntematon tyyppi ilman väriä → neutraali #94a3b8', () => {
    const el = buildMarkerVisual({ type: 'custom-xyz', label: 'X', iconId: 'wrench' }, { size: 34, zoomable: false })
    const box = el.querySelector<HTMLElement>('.marker-visual-row-single')!
    expect(box.style.background).toBe('rgb(148, 163, 184)') // #94a3b8
  })

  it('tuplamerkki typistyy max 4 osaan', () => {
    const el = buildMarkerVisual(
      {
        type: 'combo',
        label: 'Iso',
        parts: [{ iconId: 'arrow-left' }, { iconId: 'arrow-right' }, { iconId: 'arrow-left' }, { iconId: 'arrow-right' }, { iconId: 'arrow-left' }],
      },
      { size: 40, zoomable: false },
    )
    expect(el.querySelectorAll('.marker-visual-row-combo-slot')).toHaveLength(4)
  })

  it('zoomable=true lisää 44x44 hit-arean zoom-napin', () => {
    const el = buildMarkerVisual({ type: 'left', iconId: 'arrow-left', label: 'Vasemmalle' }, { size: 34, zoomable: true })
    const btn = el.querySelector<HTMLButtonElement>('.marker-visual-row-zoom')
    expect(btn).toBeTruthy()
    expect(btn!.getAttribute('aria-label')).toContain('Vasemmalle')
  })

  it('B89/V129: zoom-napin klikattava hit-area on 44x44px riippumatta näkyvästä glyfistä', () => {
    const el = buildMarkerVisual({ type: 'left', iconId: 'arrow-left', label: 'Vasemmalle' }, { size: 34, zoomable: true })
    const btn = el.querySelector<HTMLButtonElement>('.marker-visual-row-zoom')!
    expect(btn.style.width).toBe('44px')
    expect(btn.style.height).toBe('44px')
  })

  it('zoomable=false ei lisää zoom-nappia', () => {
    const el = buildMarkerVisual({ type: 'left', iconId: 'arrow-left', label: 'Vasemmalle' }, { size: 34, zoomable: false })
    expect(el.querySelector('.marker-visual-row-zoom')).toBeFalsy()
  })

  it('zoom-napin klikkaus avaa lightboxin, stopPropagation ei kupli riville', () => {
    const el = buildMarkerVisual({ type: 'left', iconId: 'arrow-left', label: 'Vasemmalle' }, { size: 34, zoomable: true })
    document.body.appendChild(el)
    let rowClicked = false
    el.addEventListener('click', () => { rowClicked = true })
    el.querySelector<HTMLButtonElement>('.marker-visual-row-zoom')!.click()
    expect(document.body.querySelector('.marker-visual-lightbox')).toBeTruthy()
    expect(rowClicked).toBe(false)
  })

  it('lightbox sulkeutuu Escillä', () => {
    const el = buildMarkerVisual({ type: 'left', iconId: 'arrow-left', label: 'Vasemmalle' }, { size: 34, zoomable: true })
    document.body.appendChild(el)
    el.querySelector<HTMLButtonElement>('.marker-visual-row-zoom')!.click()
    expect(document.body.querySelector('.marker-visual-lightbox-backdrop')).toBeTruthy()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.body.querySelector('.marker-visual-lightbox-backdrop')).toBeFalsy()
  })

  it('lightbox sulkeutuu ✕-napista', () => {
    const el = buildMarkerVisual({ type: 'left', iconId: 'arrow-left', label: 'Vasemmalle' }, { size: 34, zoomable: true })
    document.body.appendChild(el)
    el.querySelector<HTMLButtonElement>('.marker-visual-row-zoom')!.click()
    document.body.querySelector<HTMLButtonElement>('.marker-visual-lightbox-close')!.click()
    expect(document.body.querySelector('.marker-visual-lightbox-backdrop')).toBeFalsy()
  })
})
