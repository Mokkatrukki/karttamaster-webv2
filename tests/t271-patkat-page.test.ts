import { describe, it, expect, beforeEach } from 'vitest'
import { renderPatkatPage, sanitizeHtml } from '../src/ui/patkat-page'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

function seg(partial: Partial<Segment>): Segment {
  return {
    id: partial.id ?? 's1',
    routeIds: partial.routeIds ?? ['35km'],
    startDist: partial.startDist ?? 0,
    endDist: partial.endDist ?? 10000,
    equipment: [],
    phase: partial.phase ?? 'asettaminen',
    ...partial,
  }
}

function marker(p: Partial<SignMarker>): SignMarker {
  return {
    id: p.id ?? 'm1',
    type: 'right',
    status: p.status ?? 'asetettu',
    lat: 0,
    lon: 0,
    routeIds: p.routeIds ?? ['35km'],
    distanceFromStart: p.distanceFromStart ?? 5000,
  } as unknown as SignMarker
}

describe('T271 — /patkat-hub renderöinti', () => {
  let c: HTMLElement
  beforeEach(() => {
    c = document.createElement('div')
    document.body.appendChild(c)
  })

  it('renderöi hero + Kartalle-napin', () => {
    renderPatkatPage(c, { faqMarkdown: '', segments: [], markers: [], role: 'talkoolainen' })
    expect(c.querySelector('.patkat-hero h1')?.textContent).toContain('Tervetuloa')
    expect(c.querySelector('.patkat-to-map')).not.toBeNull()
  })

  it('tyhjä lista → "Ei pätkiä vielä"', () => {
    renderPatkatPage(c, { faqMarkdown: '', segments: [], markers: [], role: 'talkoolainen' })
    expect(c.querySelector('.patkat-empty')?.textContent).toContain('Ei pätkiä')
  })

  it('pätkärivi: nimi + /s/<slug>-linkki + status', () => {
    const s = seg({ displayName: 'Pätkä 1 — Varikko', assignedCode: 'patka-1-varikko' })
    renderPatkatPage(c, { faqMarkdown: '', segments: [s], markers: [marker({ status: 'asetettu' })], role: 'talkoolainen' })
    const row = c.querySelector('.patkat-row')!
    expect(row.querySelector('.patkat-row-name')?.textContent).toBe('Pätkä 1 — Varikko')
    const link = row.querySelector('.patkat-row-open') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/s/patka-1-varikko')
    expect(row.querySelector('.patkat-row-meta')?.textContent).toContain('asetettu')
  })

  it('jakamaton pätkä → "Ei vielä jaettu", ei linkkiä', () => {
    const s = seg({ displayName: 'Pätkä 2' })
    renderPatkatPage(c, { faqMarkdown: '', segments: [s], markers: [], role: 'talkoolainen' })
    expect(c.querySelector('.patkat-row-open')).toBeNull()
    expect(c.querySelector('.patkat-row-nolink')?.textContent).toContain('Ei vielä jaettu')
  })

  it('FAQ-markdown renderöityy HTML:ksi', () => {
    renderPatkatPage(c, {
      faqMarkdown: '# Aikataulu\n\n- Aamupala **9–10** hotellilla',
      segments: [], markers: [], role: 'talkoolainen',
    })
    const faq = c.querySelector('.patkat-faq-body')!
    expect(faq.querySelector('h1')?.textContent).toContain('Aikataulu')
    expect(faq.querySelector('strong')?.textContent).toContain('9')
  })

  it('tyhjä FAQ → ei FAQ-osiota', () => {
    renderPatkatPage(c, { faqMarkdown: '   ', segments: [], markers: [], role: 'talkoolainen' })
    expect(c.querySelector('.patkat-faq')).toBeNull()
  })

  it('V190: sanitizeHtml poistaa scriptin ja on*-attribuutit', () => {
    const dirty = '<p onclick="alert(1)">hei</p><script>alert(2)</script><a href="javascript:alert(3)">x</a>'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toContain('<script')
    expect(clean.toLowerCase()).not.toContain('onclick')
    expect(clean.toLowerCase()).not.toContain('javascript:')
    expect(clean).toContain('hei')
  })

  it('V190: FAQ-render ei suorita injektoitua scriptiä', () => {
    renderPatkatPage(c, {
      faqMarkdown: 'Turvaa <script>window.__xss=1</script> testi',
      segments: [], markers: [], role: 'talkoolainen',
    })
    expect(c.querySelector('.patkat-faq-body script')).toBeNull()
  })
})
