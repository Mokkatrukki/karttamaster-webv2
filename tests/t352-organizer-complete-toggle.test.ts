// @vitest-environment jsdom
// T352/V255 (B141): järjestäjän valmis-toggle pätkän modaalissa. Ennen tätä järjestäjällä ⊥ ollut
// yhtään reittiä kuitata pätkää valmiiksi: ⋯-valikko on data-role-hide="järjestäjä" & SegmentView
// (jossa toggle asui) kytketään vain talkoolaispolussa.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SegmentPanel } from '../src/ui/segment-panel'
import { createSegmentStore, createSegment } from '../src/logic/segments'
import type { Segment, SegmentStore } from '../src/logic/segments'

const flush = () => new Promise(r => setTimeout(r, 0))

function setup(phase: Segment['phase'] = 'asettaminen', completed?: boolean) {
  const container = document.createElement('div')
  document.body.appendChild(container)

  const store: SegmentStore = createSegmentStore()
  const seg = createSegment(store, {
    routeIds: ['35km'],
    startDist: 5000,
    endDist: 12000,
    equipment: [],
    phase,
    displayName: 'Testipätkä',
    ...(completed === undefined ? {} : { completed }),
  })

  const onUpdate = vi.fn()
  const panel = new SegmentPanel(container, [], store, onUpdate, { getMarkers: () => [] })
  ;(container.querySelector('.segment-info') as HTMLButtonElement).click()
  return { container, store, seg, onUpdate, panel }
}

const toggle = () => document.querySelector('.btn-segment-complete-toggle') as HTMLButtonElement | null
const status = () => document.querySelector('.segment-details-complete-status') as HTMLElement | null

describe('T352 — järjestäjän valmis-toggle pätkämodaalissa', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    let ls: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => ls[k] ?? null,
      setItem: (k: string, v: string) => { ls[k] = v },
      removeItem: (k: string) => { delete ls[k] },
      clear: () => { ls = {} },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response))
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('asettaminen-phase → toggle näkyy, label "Merkitse pätkä valmiiksi"', () => {
    setup('asettaminen')
    expect(toggle()).not.toBeNull()
    expect(toggle()?.textContent).toBe('✓ Merkitse pätkä valmiiksi')
  })

  it('purku-phase → toggle näkyy', () => {
    setup('purku')
    expect(toggle()).not.toBeNull()
  })

  it('tarkastus-phase → ⊥ togglea (inspect-osio hoitaa, T147)', () => {
    setup('tarkastus')
    expect(toggle()).toBeNull()
  })

  it('klikki → segment.completed = true storessa + onUpdate (karttaviiva vihertyy)', () => {
    const { store, seg, onUpdate } = setup('asettaminen')
    toggle()?.click()
    expect(store.get(seg.id)?.completed).toBe(true)
    expect(onUpdate).toHaveBeenCalled()
  })

  it('klikki → label kääntyy & status kertoo nykytilan sanoin (V197)', () => {
    setup('asettaminen')
    toggle()?.click()
    expect(toggle()?.textContent).toBe('↩ Merkitse keskeneräiseksi')
    expect(status()?.textContent).toBe('Pätkä merkitty valmiiksi ✓')
  })

  it('jo valmis pätkä → klikki peruu kuittauksen (completed=false)', () => {
    const { store, seg } = setup('asettaminen', true)
    expect(toggle()?.textContent).toBe('↩ Merkitse keskeneräiseksi')
    toggle()?.click()
    expect(store.get(seg.id)?.completed).toBe(false)
  })

  it('klikki lähettää PUT:n backendille (sama kirjoituspolku kuin talkoolaisella)', async () => {
    const { seg } = setup('asettaminen')
    toggle()?.click()
    await flush()
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const put = calls.find(c => String(c[0]).includes(seg.id) && (c[1] as RequestInit)?.method === 'PUT')
    expect(put).toBeDefined()
    expect(JSON.parse(String((put?.[1] as RequestInit).body))).toMatchObject({ completed: true })
  })

  it('PUT epäonnistuu → ⊥ hiljaista epäonnistumista, status kertoo virheestä', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response))
    setup('asettaminen')
    toggle()?.click()
    await flush()
    await flush()
    expect(status()?.textContent).toContain('Tallennus epäonnistui')
  })
})
