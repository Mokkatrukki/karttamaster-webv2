import { describe, it, expect } from 'vitest'
import { signPreviewHtml } from '../src/ui/modal-helpers'

describe('signPreviewHtml — iso merkki-esikatselu (DESIGN.md §K SignPreview, V99)', () => {
  it('kuva-tyyppi: <img> contain-tyylillä + onerror-fallback', () => {
    // 'wc' on olemassa oleva webp (T161-pipeline)
    const h = signPreviewHtml({ id: 'wc', label: 'WC', color: '#1d4ed8' })
    expect(h).toContain('<img')
    expect(h).toContain('object-fit:contain')
    expect(h).toContain('onerror="this.remove()"')
  })

  it('kuvan alla on aina fallback-kerros (compactLabel) — paljastuu jos kuva poistuu', () => {
    const h = signPreviewHtml({ id: 'wc', label: 'WC', color: '#1d4ed8' })
    expect(h).toContain('>WC<') // compactLabel('WC') === 'WC'
  })

  it('ilman kuvaa + iconId → Lucide-<svg>, ei <img>', () => {
    const h = signPreviewHtml({ id: 'ei-kuvaa-xyz', label: 'Vasemmalle', color: '#2563eb', iconId: 'arrow-left' })
    expect(h).toContain('<svg')
    expect(h).not.toContain('<img')
  })

  it('ilman kuvaa ja ilman ikonia → compactLabel-tiili, ei <img>', () => {
    const h = signPreviewHtml({ id: 'ei-kuvaa-xyz', label: 'Oikealle', color: '#16a34a' })
    expect(h).toContain('>OIK<') // compactLabel('Oikealle')
    expect(h).not.toContain('<img')
  })

  it('escapaa värin (XSS)', () => {
    const h = signPreviewHtml({ id: 'ei-kuvaa-xyz', label: 'X', color: '#000"><script>' })
    expect(h).not.toContain('<script>')
  })
})
