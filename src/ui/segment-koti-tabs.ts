// T264/V184 (talkoolais-KOTI, R10): koti-näkymän välilehtikuori. Varustelista · Kaikki merkit ·
// Kommentit. Poistaa "Lisää ⋯" -accordionin — valmis/rajat/kommentit tabeissa, ei haitarin alla
// (käyttäjäpalaute 2026-07-21). Pure-DOM (Vitest-jsdom). REPARENTOI annetut elementit paneleihin
// (appendChild siirtää) → SegmentView pysyy koordinaattorina, ei rakenteellista kasvua (pilkkohälytys).
// Vain koti-moodissa (kartta-moodi: CSS piilottaa .segment-koti-tabs, hero näkyy).
// T354/V257: JAETTU komponentti — palvelee myös järjestäjän SegmentDetailsModalia. Toinen
// tabitoteutus on rikkomus (V257): kaksi kopiota ajautuu erilleen aria-selectedissä ja
// scroll-nollauksessa. Erot hoidetaan parametrilla (scrollerSelector), ei roolihaaralla.

export interface KotiTabDef {
  id: string
  label: string
  els: HTMLElement[]
}

export interface KotiTabOptions {
  /** Aloitustabi. Oletus: ensimmäinen. */
  initial?: string
  // T354/V257: sama komponentti palvelee myös järjestäjän pätkämodaalia, jonka scrolleri on eri
  // elementti. Yleistys on PARAMETRI, ei roolihaara sisällä — muuten kaksi tabitoteutusta ajautuu
  // erilleen (V257). Oletus pitää talkoolaispolun ennallaan.
  scrollerSelector?: string
}

const DEFAULT_SCROLLER = '#segment-view'

export class SegmentKotiTabs {
  readonly root: HTMLElement
  private active = ''
  private readonly panels = new Map<string, HTMLElement>()
  private readonly buttons = new Map<string, HTMLButtonElement>()
  private readonly scrollerSelector: string

  constructor(tabs: KotiTabDef[], opts?: string | KotiTabOptions) {
    const o: KotiTabOptions = typeof opts === 'string' ? { initial: opts } : (opts ?? {})
    this.scrollerSelector = o.scrollerSelector ?? DEFAULT_SCROLLER
    const initial = o.initial
    this.root = document.createElement('div')
    this.root.className = 'segment-koti-tabs'

    const bar = document.createElement('div')
    bar.className = 'segment-koti-tabbar'
    bar.setAttribute('role', 'tablist')
    this.root.appendChild(bar)

    for (const t of tabs) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'segment-koti-tab'
      btn.textContent = t.label
      btn.setAttribute('role', 'tab')
      btn.dataset.tab = t.id
      btn.addEventListener('click', () => this.setActive(t.id))
      bar.appendChild(btn)
      this.buttons.set(t.id, btn)

      const panel = document.createElement('div')
      panel.className = 'segment-koti-panel'
      panel.dataset.tab = t.id
      // Reparentointi: siirrä olemassa olevat elementit tähän paneliin.
      for (const el of t.els) panel.appendChild(el)
      this.root.appendChild(panel)
      this.panels.set(t.id, panel)
    }

    this.setActive(initial ?? tabs[0]?.id ?? '')
  }

  setActive(id: string): void {
    this.active = id
    for (const [k, p] of this.panels) p.hidden = k !== id
    // T315/V226: kaikki tabit jakavat SAMAN scrollerin (#segment-view, koti-moodi) ∴ tab-vaihto
    // nollaa scroll-position — muuten uusi tabi avautuu keskeltä (edellisen tabin scrollTop jää).
    const sc = this.scroller()
    if (sc) sc.scrollTop = 0
    for (const [k, b] of this.buttons) {
      const on = k === id
      b.classList.toggle('is-active', on)
      b.setAttribute('aria-selected', String(on))
    }
  }

  getActive(): string {
    return this.active
  }

  /**
   * T428: piilota/näytä yksi välilehti ajossa (esim. varustelista purkuvaiheessa — purussa ei
   * pakata mitään). Piilotettu = nappi JA paneeli pois; jos aktiivinen tabi piilotetaan,
   * aktiivisuus siirtyy ensimmäiseen näkyvään ∴ näkymä ⊥ jää tyhjäksi ilman valittua tabia.
   */
  setTabHidden(id: string, hidden: boolean): void {
    const btn = this.buttons.get(id)
    const panel = this.panels.get(id)
    if (!btn || !panel) return
    btn.hidden = hidden
    if (hidden) panel.hidden = true
    if (hidden && this.active === id) {
      const next = [...this.buttons].find(([k, b]) => k !== id && !b.hidden)
      if (next) this.setActive(next[0])
    }
  }

  /** Lähin scrollaava esivanhempi (koti-moodissa `#segment-view`). null ennen DOM-kiinnitystä. */
  private scroller(): HTMLElement | null {
    return this.root.closest<HTMLElement>(this.scrollerSelector)
  }
}
