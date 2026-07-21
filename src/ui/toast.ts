/**
 * Jaettu toast-komponentti (T253). Kelluva ilmoitus alareunaan, valinnainen action-nappi
 * ("Kumoa") + auto-dismiss. Yksi toast kerrallaan: uusi korvaa edellisen ja resetoi timerin (V172).
 * Puhdas DOM, ei Leafletia. User-teksti textContent (V164).
 */

export interface ToastOptions {
  /** Action-napin teksti (esim. "Kumoa"). Jätä pois → pelkkä viesti. */
  actionLabel?: string
  /** Klikki action-nappiin → tämä + sulje toast. */
  onAction?: () => void
  /** Auto-dismiss ms. Oletus 5000. */
  duration?: number
}

let current: HTMLElement | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function dismiss(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  if (current) {
    current.remove()
    current = null
  }
}

/** Näytä toast. Korvaa mahdollisen edellisen (V172: yksi undo-slotti). */
export function showToast(message: string, opts: ToastOptions = {}): void {
  dismiss() // yksi kerrallaan — uusi korvaa vanhan + clearTimeout

  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')

  const msg = document.createElement('span')
  msg.className = 'toast-msg'
  msg.textContent = message // V164
  toast.appendChild(msg)

  if (opts.actionLabel && opts.onAction) {
    const action = document.createElement('button')
    action.type = 'button'
    action.className = 'toast-action'
    action.textContent = opts.actionLabel
    action.addEventListener('click', () => {
      const cb = opts.onAction
      dismiss()
      cb?.()
    })
    toast.appendChild(action)
  }

  document.body.appendChild(toast)
  current = toast

  const duration = opts.duration ?? 5000
  timer = setTimeout(dismiss, duration)
}

/** Sulje näkyvä toast heti (esim. sivulta poistuttaessa). */
export function dismissToast(): void {
  dismiss()
}
