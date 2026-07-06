import { describe, it, expect, vi } from 'vitest'
import { signVisual, compactLabel } from '../src/logic/sign-visual'
import { signImageSrc, signImageTag } from '../src/logic/sign-images'

vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts: { html: string; className: string; iconSize: number[]; iconAnchor: number[] }) => opts,
  },
}))

import { createSignIcon } from '../src/map/icons'

describe('T160/V99: compactLabel — kartta-teksti johdettu labelista', () => {
  it('3 ekaa merkkiä isolla', () => {
    expect(compactLabel('Oikealle')).toBe('OIK')
  })

  it('alle 3 merkin nimi → koko nimi isolla', () => {
    expect(compactLabel('Ei')).toBe('EI')
    expect(compactLabel('V')).toBe('V')
  })

  it('tyhjä string → tyhjä', () => {
    expect(compactLabel('')).toBe('')
  })
})

describe('T158/V99: signVisual precedence (kuva > ikoni > compactLabel(label))', () => {
  it('kuva-ämpäri: imageSrc voittaa kaiken', () => {
    const v = signVisual({ iconId: 'flag', label: 'Oikealle' }, 'blob:kuva')
    expect(v).toEqual({ kind: 'image', src: 'blob:kuva' })
  })

  it('ikoni-ämpäri: ei kuvaa mutta iconId → ikoni', () => {
    const v = signVisual({ iconId: 'flag', label: 'Oikealle' }, undefined)
    expect(v).toEqual({ kind: 'icon', id: 'flag' })
  })

  it('label-ämpäri: ei kuvaa eikä ikonia → compactLabel(label)', () => {
    const v = signVisual({ label: 'Oikealle' }, undefined)
    expect(v).toEqual({ kind: 'label', text: 'OIK' })
  })

  it('tyhjä imageSrc kohdellaan puuttuvana (fallback ikoniin)', () => {
    const v = signVisual({ iconId: 'flag', label: 'Oikealle' }, '')
    expect(v).toEqual({ kind: 'icon', id: 'flag' })
  })
})

describe('T158: signImageSrc — kuvia ei vielä ole (glob tyhjä)', () => {
  it('undefined id → undefined', () => {
    expect(signImageSrc(undefined)).toBeUndefined()
  })

  it('olematon id → undefined (fallback)', () => {
    expect(signImageSrc('right')).toBeUndefined()
    expect(signImageSrc('mikä-tahansa')).toBeUndefined()
  })

  it('signImageTag palauttaa tyhjän kun kuvaa ei ole (inertti kunnes kuvia lisätään)', () => {
    expect(signImageTag('right', 'width:100%')).toBe('')
  })
})

describe('T158/V99: circleSvg kuvan täyttö + onerror-fallback (T103-pattern)', () => {
  function html(imageSrc?: string): string {
    return (createSignIcon('my-type', 'asetettu', '#ff0000', 'X', undefined, imageSrc) as unknown as { html: string }).html
  }

  it('imageSrc annettuna → <img> onerror-fallbackilla', () => {
    const h = html('data:image/webp;base64,AA')
    expect(h).toContain('<img src="data:image/webp;base64,AA"')
    expect(h).toContain('onerror="this.remove()"')
  })

  it('fallback-sisältö (shortLabel) on aina alla → jos kuva poistuu, tyyppi näkyy silti', () => {
    const h = html('data:image/webp;base64,AA')
    expect(h).toContain('>X</text>')
  })

  it('ilman imageSrc → ei <img> (pelkkä ikoni/label)', () => {
    expect(html()).not.toContain('<img')
  })

  it('V87 säilyy: statusväri ulkoreunassa myös kuvan kanssa', () => {
    // asetettu → vihreä stroke #22c55e, kuva istuu reunan sisäpuolella
    expect(html('data:image/webp;base64,AA')).toContain('#22c55e')
  })
})

describe('T158: onerror poistaa kuvan jsdom-DOM:ssa (fallback paljastuu)', () => {
  it('img.error → element poistuu, alla oleva teksti jää', () => {
    const div = document.createElement('div')
    // Simuloi circleSvg:n rakenne: fallback-teksti + kuvakerros onerror-handlerilla
    div.innerHTML = '<span class="fallback">X</span><img alt="" onerror="this.remove()">'
    document.body.appendChild(div)
    const img = div.querySelector('img')!
    // aja onerror-handler eksplisiittisesti (jsdom ei suorita inline-attribuuttia ilman runScripts)
    new Function('event', img.getAttribute('onerror')!).call(img)
    expect(div.querySelector('img')).toBeNull()
    expect(div.querySelector('.fallback')?.textContent).toBe('X')
    document.body.removeChild(div)
  })
})
