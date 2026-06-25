export class LeftPanel {
  private collapsed = false
  private readonly panel: HTMLElement
  private readonly content: HTMLElement
  private readonly toggleBtn: HTMLButtonElement

  constructor(panel: HTMLElement) {
    this.panel = panel
    this.content = panel.querySelector('#left-panel-content') as HTMLElement
    this.toggleBtn = panel.querySelector('#left-panel-toggle') as HTMLButtonElement
    this.toggleBtn.addEventListener('click', () => this.toggle())
    this.applyState()
  }

  toggle(): void {
    this.collapsed = !this.collapsed
    this.applyState()
  }

  open(): void {
    if (this.collapsed) {
      this.collapsed = false
      this.applyState()
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
