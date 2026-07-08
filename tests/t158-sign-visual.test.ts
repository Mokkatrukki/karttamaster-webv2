import { describe, it, expect, vi } from 'vitest'
import { signVisual, signVisualParts, compactLabel } from '../src/logic/sign-visual'
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

describe('T171/V107: signVisualParts — yhdistelmämerkki pystypino', () => {
  const noImage = () => undefined

  it('ei parts-kenttää → 1-elementin taulukko kuten signVisual (backward-compat)', () => {
    const parts = signVisualParts({ iconId: 'flag', label: 'Oikealle' }, noImage)
    expect(parts).toEqual([{ kind: 'icon', id: 'flag' }])
  })

  it('tyhjä parts-taulukko → sama backward-compat fallback', () => {
    const parts = signVisualParts({ label: 'Oikealle', parts: [] }, noImage)
    expect(parts).toEqual([{ kind: 'label', text: 'OIK' }])
  })

  it('2 osaa → järjestys säilyy, molemmat resolvoituvat', () => {
    const parts = signVisualParts(
      { label: 'X', parts: [{ iconId: 'flag' }, { imageId: 'kapea-tie' }] },
      (id) => (id === 'kapea-tie' ? 'blob:kapea-tie' : undefined),
    )
    expect(parts).toEqual([{ kind: 'icon', id: 'flag' }, { kind: 'image', src: 'blob:kapea-tie' }])
  })

  it('per-osa kuva voittaa ikonin (kuva>ikoni)', () => {
    const parts = signVisualParts(
      { label: 'X', parts: [{ iconId: 'flag', imageId: 'flag-img' }] },
      () => 'blob:flag-img',
    )
    expect(parts).toEqual([{ kind: 'image', src: 'blob:flag-img' }])
  })

  it('yli 4 osaa typistetään 4:ään, järjestys säilyy', () => {
    const parts = signVisualParts(
      {
        label: 'X',
        parts: [
          { iconId: 'a' }, { iconId: 'b' }, { iconId: 'c' }, { iconId: 'd' }, { iconId: 'e' },
        ],
      },
      noImage,
    )
    expect(parts).toEqual([
      { kind: 'icon', id: 'a' }, { kind: 'icon', id: 'b' }, { kind: 'icon', id: 'c' }, { kind: 'icon', id: 'd' },
    ])
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

describe('T196/V123: signImageSrc — backend-URL palautetaan sellaisenaan', () => {
  it('absoluuttinen /api-polku → palautetaan sellaisenaan (ei bundle-lookuppia)', () => {
    const url = '/api/templates/wc/images/abc-123'
    expect(signImageSrc(url)).toBe(url)
  })

  it('http-URL → palautetaan sellaisenaan', () => {
    const url = 'https://esimerkki.fi/kuva.webp'
    expect(signImageSrc(url)).toBe(url)
  })

  it('signImageTag rakentaa <img>:n backend-URL:sta', () => {
    const tag = signImageTag('/api/templates/wc/images/abc-123', 'width:100%')
    expect(tag).toContain('src="/api/templates/wc/images/abc-123"')
    expect(tag).toContain('onerror="this.remove()"')
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

  it('fallback-sisältö (compact) on aina alla → jos kuva poistuu, tyyppi näkyy silti', () => {
    // T-C: kuva-kyltti on suorakaide-kortti; fallback-chip <span> img:n alla (ei <text>).
    const h = html('data:image/webp;base64,AA')
    expect(h).toContain('>X</span>')
  })

  it('ilman imageSrc → ei <img> (pelkkä ikoni/label)', () => {
    expect(html()).not.toContain('<img')
  })

  it('V87 säilyy: statusväri ulkoreunassa myös kuvan kanssa', () => {
    // asetettu → vihreä stroke #22c55e, kuva istuu reunan sisäpuolella
    expect(html('data:image/webp;base64,AA')).toContain('#22c55e')
  })
})

describe('T172/V107: createSignIcon combo-haara (pystypino)', () => {
  function icon(visualParts?: ReturnType<typeof signVisualParts>) {
    return createSignIcon('combo', 'asetettu', '#ff0000', 'X', undefined, undefined, visualParts) as unknown as {
      html: string; iconSize: number[]; iconAnchor: number[]
    }
  }

  it('0-1 osaa → ei combo-haaraa (backward-compat, tavallinen ympyrä)', () => {
    const single = signVisualParts({ label: 'X' }, () => undefined)
    const h = icon(single).html
    expect(h).not.toContain('flex-direction:column')
  })

  it('2 osaa → korkeus = 2×40+8, leveys pysyy 40', () => {
    const parts = signVisualParts({ label: 'X', parts: [{ iconId: 'flag' }, { iconId: 'wrench' }] }, () => undefined)
    const ic = icon(parts)
    expect(ic.iconSize).toEqual([40, 88])
    expect(ic.iconAnchor).toEqual([20, 88])
  })

  it('4 osaa → korkeus = 4×40+8, järjestys säilyy htmlissä (flag ennen wrench ennen car ennen bike)', () => {
    const parts = signVisualParts({
      label: 'X',
      parts: [{ iconId: 'flag' }, { iconId: 'wrench' }, { iconId: 'car' }, { iconId: 'bike' }],
    }, () => undefined)
    const ic = icon(parts)
    expect(ic.iconSize).toEqual([40, 168])
    const idxFlag = ic.html.indexOf('M4 15s1-1 4-1') // flag path fragment
    const idxWrench = ic.html.indexOf('M14.7 6.3') // wrench path fragment
    expect(idxFlag).toBeGreaterThan(-1)
    expect(idxWrench).toBeGreaterThan(idxFlag)
  })

  it('yhteinen status-reunus koko pinolle (V87) — vain yksi tip-SVG', () => {
    const parts = signVisualParts({ label: 'X', parts: [{ iconId: 'flag' }, { iconId: 'wrench' }] }, () => undefined)
    const h = icon(parts).html
    expect(h).toContain('#22c55e') // asetettu-status vihreä reunus
    expect(h.match(/viewBox="0 0 16 8"/g)).toHaveLength(1) // yksi tip, ei per-osa
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
