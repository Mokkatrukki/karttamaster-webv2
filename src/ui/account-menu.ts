import { getTheme, setTheme, type Theme } from '../logic/theme'

export interface AccountMenuOptions {
  displayName: string
  // Kutsutaan onnistuneen uloskirjautumisen jälkeen — avaa AuthScreenin uudelleen (V133).
  onLoggedOut: () => void
}

// T203/V133: tilivalikko toolbar-menun yläosassa — käyttäjänimi + teemavalitsin (V132) +
// "Kirjaudu ulos". Teemavalinta koskee kaikkia rooleja, uloskirjautuminen tyhjentää session.
export class AccountMenu {
  constructor(container: HTMLElement, private readonly opts: AccountMenuOptions) {
    container.innerHTML = ''
    container.classList.add('account-menu')

    const name = document.createElement('div')
    name.className = 'account-menu-name'
    name.textContent = opts.displayName || 'Käyttäjä'
    container.appendChild(name)

    container.appendChild(this.buildThemeSelector())

    const logout = document.createElement('button')
    logout.id = 'btn-logout'
    logout.type = 'button'
    logout.className = 'account-menu-logout'
    logout.textContent = 'Kirjaudu ulos'
    logout.addEventListener('click', (e) => {
      e.stopPropagation()
      void this.logout()
    })
    container.appendChild(logout)
  }

  private buildThemeSelector(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'account-menu-theme'

    const label = document.createElement('span')
    label.className = 'account-menu-theme-label'
    label.textContent = 'Teema'
    wrap.appendChild(label)

    // T259/R9: lyhyet + ikonilliset nimet (käyttäjäpalaute: pitkät nimet + himmeä inaktiivi
    // luki "rikkinäiseltä"). Aktiivinen selvästi merkitty (CSS ✓ + accent-reuna).
    const options: { theme: Theme; label: string }[] = [
      { theme: 'light', label: '☀️ Vaalea' },
      { theme: 'dark', label: '🌙 Tumma' },
    ]
    const current = getTheme()
    const btns: HTMLButtonElement[] = []
    for (const o of options) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'account-menu-theme-opt'
      b.dataset.theme = o.theme
      b.textContent = o.label
      b.setAttribute('aria-pressed', String(o.theme === current))
      b.classList.toggle('active', o.theme === current)
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        setTheme(o.theme)
        for (const x of btns) {
          const on = x.dataset.theme === o.theme
          x.classList.toggle('active', on)
          x.setAttribute('aria-pressed', String(on))
        }
      })
      btns.push(b)
      wrap.appendChild(b)
    }
    return wrap
  }

  private async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* verkkovirhe — näytä silti kirjautumisruutu (V115-henki: älä jää haamutilaan) */
    }
    this.opts.onLoggedOut()
  }
}
