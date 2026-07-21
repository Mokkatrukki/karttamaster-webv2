import { describe, it, expect, beforeEach } from 'vitest'
import { SegmentView, type SegmentViewActions } from '../src/ui/segment-view'
import type { Segment } from '../src/logic/segments'
import type { SignMarker } from '../src/logic/types'

function makeSeg(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    routeIds: ['35km'],
    startDist: 5000,
    endDist: 12000,
    equipment: [],
    phase: 'asettaminen',
    displayName: 'Matin pätkä',
    ...overrides,
  }
}

function makeMarker(overrides: Partial<SignMarker> = {}): SignMarker {
  return {
    id: 'm-1',
    type: 'right',
    lat: 63.0,
    lon: 27.0,
    distanceFromStart: 7000,
    routeIds: ['35km'],
    status: 'suunniteltu',
    ...overrides,
  }
}

describe('T232 — kokoava hero', () => {
  let container: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  // ---- (D) Otsikko: pätkän pituus + km-väli metana ----
  describe('otsikon pituus (D)', () => {
    it('näyttää pätkän pituuden (endDist−startDist) päänäyttönä', () => {
      new SegmentView(container, makeSeg({ startDist: 5000, endDist: 12000 }))
      expect(container.querySelector('.segment-view-length')?.textContent).toContain('7.0 km')
    })

    it('km-väli säilyy pienempänä metatietona', () => {
      new SegmentView(container, makeSeg({ startDist: 5000, endDist: 12000 }))
      expect(container.querySelector('.segment-view-range')?.textContent).toBe('5.0–12.0 km')
    })

    it('pituus piilotettu jos endDist ≤ startDist (reititön/virheellinen)', () => {
      new SegmentView(container, makeSeg({ startDist: 0, endDist: 0 }))
      expect(container.querySelector('.segment-view-length')).toBeNull()
    })
  })

  // ---- (B) GPS-toggle herossa ----
  describe('GPS-toggle (B)', () => {
    it('piilossa ilman onToggleGps', () => {
      new SegmentView(container, makeSeg())
      expect((container.querySelector('.segment-view-gps-btn') as HTMLElement).hidden).toBe(true)
    })

    it('näkyy kun onToggleGps annettu', () => {
      new SegmentView(container, makeSeg(), undefined, undefined, {
        onToggleGps: () => true,
        isGpsActive: () => false,
      })
      expect((container.querySelector('.segment-view-gps-btn') as HTMLElement).hidden).toBe(false)
    })

    it('klikkaus togglaa: kutsuu onToggleGps, päivittää tekstin + gps-active-luokan', () => {
      let gpsOn = false
      new SegmentView(container, makeSeg(), undefined, undefined, {
        onToggleGps: () => { gpsOn = !gpsOn; return gpsOn },
        isGpsActive: () => gpsOn,
      })
      const btn = container.querySelector('.segment-view-gps-btn') as HTMLButtonElement
      expect(btn.classList.contains('gps-active')).toBe(false)
      btn.click()
      expect(gpsOn).toBe(true)
      expect(btn.classList.contains('gps-active')).toBe(true)
      expect(btn.textContent).toContain('päällä')
      btn.click()
      expect(gpsOn).toBe(false)
      expect(btn.classList.contains('gps-active')).toBe(false)
    })

    it('näkyy myös purku-phasessa (VISION phase 5) — ei asettaminen-only', () => {
      new SegmentView(container, makeSeg({ phase: 'purku' }), undefined, undefined, {
        onToggleGps: () => true,
        isGpsActive: () => false,
      })
      expect((container.querySelector('.segment-view-gps-btn') as HTMLElement).hidden).toBe(false)
    })
  })

  // ---- (C) ◀▶-selailu asettamattomien merkkien välillä ----
  describe('◀▶-navigointi (C)', () => {
    const m1 = makeMarker({ id: 'm1', distanceFromStart: 6000, status: 'suunniteltu' })
    const m2 = makeMarker({ id: 'm2', distanceFromStart: 8000, status: 'suunniteltu' })
    const m3 = makeMarker({ id: 'm3', distanceFromStart: 10000, status: 'suunniteltu' })

    it('nuolet piilossa kun vain 1 asettamaton', () => {
      const view = new SegmentView(container, makeSeg())
      view.update([m1, makeMarker({ id: 'x', status: 'asetettu' })])
      expect(container.querySelector('.segment-view-next-prev')).toBeNull()
      expect(container.querySelector('.segment-view-next-fwd')).toBeNull()
    })

    it('nuolet näkyvät kun >1 asettamaton; oletus = ensimmäinen (pienin dist)', () => {
      const view = new SegmentView(container, makeSeg())
      view.update([m2, m1])
      expect(container.querySelector('.segment-view-next-prev')).not.toBeNull()
      expect(container.querySelector('.segment-view-next-fwd')).not.toBeNull()
      // oletus m1 (6000) → laskuri 1/2
      expect(container.querySelector('.segment-view-next-label')?.textContent).toContain('1/2')
      expect(container.querySelector('.segment-view-next-name')?.textContent).toBe(m1.label ?? 'Oikealle')
    })

    it('prev disabled ensimmäisessä, fwd disabled viimeisessä (clamp, ei wrap)', () => {
      const view = new SegmentView(container, makeSeg())
      view.update([m1, m2])
      expect((container.querySelector('.segment-view-next-prev') as HTMLButtonElement).disabled).toBe(true)
      expect((container.querySelector('.segment-view-next-fwd') as HTMLButtonElement).disabled).toBe(false)
      // askel eteen → viimeinen
      ;(container.querySelector('.segment-view-next-fwd') as HTMLButtonElement).click()
      expect((container.querySelector('.segment-view-next-fwd') as HTMLButtonElement).disabled).toBe(true)
      expect((container.querySelector('.segment-view-next-prev') as HTMLButtonElement).disabled).toBe(false)
    })

    it('▶ vaihtaa näytettyä merkkiä ja Aseta kohdistuu näytettyyn (V159)', () => {
      const setIds: string[] = []
      const view = new SegmentView(container, makeSeg(), undefined, undefined, {
        onSetMarker: (id) => setIds.push(id),
      })
      view.update([m1, m2, m3])
      // oletus m1 → Aseta osuu m1
      ;(container.querySelector('.segment-view-next-set') as HTMLButtonElement).click()
      expect(setIds).toEqual(['m1'])
      // askel eteen → m2, Aseta osuu m2
      ;(container.querySelector('.segment-view-next-fwd') as HTMLButtonElement).click()
      expect(container.querySelector('.segment-view-next-label')?.textContent).toContain('2/3')
      ;(container.querySelector('.segment-view-next-set') as HTMLButtonElement).click()
      expect(setIds).toEqual(['m1', 'm2'])
    })

    it('onNavigate synkkaa valitun merkin (highlight) — ◀▶ ja reconcile', () => {
      const nav: (string | null)[] = []
      const view = new SegmentView(container, makeSeg(), undefined, undefined, {
        onNavigate: (id) => nav.push(id),
      })
      view.update([m1, m2])
      expect(nav.at(-1)).toBe('m1')
      ;(container.querySelector('.segment-view-next-fwd') as HTMLButtonElement).click()
      expect(nav.at(-1)).toBe('m2')
    })

    it('V159: valittu merkki asetettu → reconcile palaa firstUnsetMarkeriin, ei osoita asetettuun', () => {
      const nav: (string | null)[] = []
      const view = new SegmentView(container, makeSeg(), undefined, undefined, {
        onNavigate: (id) => nav.push(id),
      })
      view.update([m1, m2])
      ;(container.querySelector('.segment-view-next-fwd') as HTMLButtonElement).click() // valitse m2
      expect(nav.at(-1)).toBe('m2')
      // m2 asetetaan (katoaa asettamattomien listalta) → seuraava update reconciloi m1:een
      view.update([m1, makeMarker({ id: 'm2', distanceFromStart: 8000, status: 'asetettu' })])
      expect(nav.at(-1)).toBe('m1')
      expect(container.querySelector('.segment-view-next-name')?.textContent).toBe(m1.label ?? 'Oikealle')
    })

    it('done-tila (kaikki asetettu) → onNavigate(null) tyhjentää korostuksen', () => {
      const nav: (string | null)[] = []
      const view = new SegmentView(container, makeSeg(), undefined, undefined, {
        onNavigate: (id) => nav.push(id),
      })
      view.update([makeMarker({ id: 'm1', status: 'asetettu' })])
      expect(nav.at(-1)).toBeNull()
    })
  })

  // ---- (E) "+ Merkki" hero-overflowssa ----
  describe('+ Merkki overflow (E)', () => {
    it('disabled ilman onAddMarker', () => {
      const view = new SegmentView(container, makeSeg())
      view.update([makeMarker({ status: 'suunniteltu' })])
      expect((container.querySelector('.segment-view-next-add') as HTMLButtonElement).disabled).toBe(true)
    })

    it('enabloitu + kutsuu onAddMarker', () => {
      let added = false
      const view = new SegmentView(container, makeSeg(), undefined, undefined, {
        onAddMarker: () => { added = true },
      })
      view.update([makeMarker({ status: 'suunniteltu' })])
      const btn = container.querySelector('.segment-view-next-add') as HTMLButtonElement
      expect(btn.disabled).toBe(false)
      btn.click()
      expect(added).toBe(true)
    })
  })

  // ---- T264/V184: "Lisää ⋯" -accordion POISTETTU → valmis/rajat "Kaikki merkit" -tabissa,
  //      kommentit "Kommentit"-tabissa (SegmentKotiTabs). moreSection pysyy piilossa. ----
  describe('koti-välilehdet korvaavat "Lisää ⋯" -accordionin (T264/V184)', () => {
    it('"Lisää ⋯" -accordion (.segment-view-more) piilossa — ei enää haitaria', () => {
      const view = new SegmentView(container, makeSeg())
      view.update([makeMarker()])
      expect((container.querySelector('.segment-view-more') as HTMLElement).hidden).toBe(true)
    })

    it('kommentit "Kommentit"-tab-panelin sisällä (ei accordionissa)', () => {
      const view = new SegmentView(container, makeSeg())
      view.update([makeMarker()])
      const panel = container.querySelector('.segment-koti-panel[data-tab="kommentit"]')
      expect(panel).not.toBeNull()
      expect(panel?.querySelector('.segment-view-comments')).not.toBeNull()
    })

    it('complete + bounds "Kaikki merkit" -tab-panelin sisällä (ei accordionissa/hero-primaryssä)', () => {
      const view = new SegmentView(container, makeSeg(), undefined, undefined, {
        onComplete: () => {},
        onEditBounds: () => {},
      })
      view.update([makeMarker()])
      const panel = container.querySelector('.segment-koti-panel[data-tab="merkit"]')
      expect(panel?.querySelector('.segment-view-complete')).not.toBeNull()
      expect(panel?.querySelector('.segment-view-bounds')).not.toBeNull()
    })

    it('complete tavoitettavissa purku-phasessa (tab aina läsnä, ei phase-gattua accordionia)', () => {
      const view = new SegmentView(container, makeSeg({ phase: 'purku' }), undefined, undefined, {
        onComplete: () => {},
      })
      view.update([makeMarker({ status: 'kerätty' })])
      const panel = container.querySelector('.segment-koti-panel[data-tab="merkit"]')
      expect((panel?.querySelector('.segment-view-complete') as HTMLElement).hidden).toBe(false)
    })
  })
})
