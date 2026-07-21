// T264/V184 (talkoolais-KOTI, R10): koti-näkymän välilehtikuori. Varustelista · Kaikki merkit ·
// Kommentit. Poistaa "Lisää ⋯" -accordionin — valmis/rajat/kommentit tabeissa, ei haitarin alla
// (käyttäjäpalaute 2026-07-21). Pure-DOM (Vitest-jsdom). REPARENTOI annetut elementit paneleihin
// (appendChild siirtää) → SegmentView pysyy koordinaattorina, ei rakenteellista kasvua (pilkkohälytys).
// Vain koti-moodissa (kartta-moodi: CSS piilottaa .segment-koti-tabs, hero näkyy).

export interface KotiTabDef {
  id: string
  label: string
  els: HTMLElement[]
}

export class SegmentKotiTabs {
  readonly root: HTMLElement
  private active = ''
  private readonly panels = new Map<string, HTMLElement>()
  private readonly buttons = new Map<string, HTMLButtonElement>()

  constructor(tabs: KotiTabDef[], initial?: string) {
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
    for (const [k, b] of this.buttons) {
      const on = k === id
      b.classList.toggle('is-active', on)
      b.setAttribute('aria-selected', String(on))
    }
  }

  getActive(): string {
    return this.active
  }
}
