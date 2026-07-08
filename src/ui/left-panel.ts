const MOBILE_BREAKPOINT = 480

export class LeftPanel {
  private collapsed = false
  private readonly panel: HTMLElement
  private readonly content: HTMLElement
  private readonly toggleBtn: HTMLButtonElement
  private readonly onToggle?: () => void

  constructor(panel: HTMLElement, onToggle?: () => void) {
    this.panel = panel
    this.content = panel.querySelector('#left-panel-content') as HTMLElement
    this.toggleBtn = panel.querySelector('#left-panel-toggle') as HTMLButtonElement
    this.onToggle = onToggle
    this.collapsed = window.innerWidth <= MOBILE_BREAKPOINT
    this.toggleBtn.addEventListener('click', () => this.toggle())
    // V127: mobiilissa merkin valinta sivupalkin listasta sulkee paneelin,
    // koska paneeli overlayaa kartan (V114) — valitun merkin on jäätävä näkyviin.
    document.addEventListener('marker-detail-opened', () => this.collapse())
    this.applyState()
  }

  // V127: sulje paneeli vain mobiilissa (overlay); desktopilla tilaa riittää.
  collapse(): void {
    if (window.innerWidth > MOBILE_BREAKPOINT) return
    if (this.collapsed) return
    this.collapsed = true
    this.applyState()
    this.onToggle?.()
  }

  toggle(): void {
    this.collapsed = !this.collapsed
    this.applyState()
    this.onToggle?.()
  }

  open(): void {
    if (this.collapsed) {
      this.collapsed = false
      this.applyState()
      this.onToggle?.()
    }
  }

  isCollapsed(): boolean { return this.collapsed }

  private applyState(): void {
    this.content.hidden = this.collapsed
    this.panel.classList.toggle('collapsed', this.collapsed)
    this.toggleBtn.textContent = this.collapsed ? '▶' : '◀'
    this.toggleBtn.setAttribute('aria-label', this.collapsed ? 'Avaa paneeli' : 'Sulje paneeli')
  }
}
