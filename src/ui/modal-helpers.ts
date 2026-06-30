/**
 * Shared modal utilities — käytä kaikissa modaaleissa.
 *
 * registerEscClose: rekisteröi Esc-näppäin sulkemaan modaali.
 * Palauttaa cleanup-funktion jota kutsutaan close():ssa.
 *
 * Esimerkki:
 *   private unregEsc: (() => void) | null = null
 *   // open():
 *   this.unregEsc = registerEscClose(() => this.close())
 *   // close():
 *   this.unregEsc?.(); this.unregEsc = null
 */
export function registerEscClose(onClose: () => void): () => void {
  const fn = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }
  document.addEventListener('keydown', fn)
  return () => document.removeEventListener('keydown', fn)
}

/**
 * createBackdrop: luo modal-backdrop-elementin joka sulkee modaalin
 * klikattaessa taustan ulkopuolelta.
 */
export function createBackdrop(className: string, onClose: () => void): HTMLDivElement {
  const backdrop = document.createElement('div')
  backdrop.className = className
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) onClose()
  })
  return backdrop
}
