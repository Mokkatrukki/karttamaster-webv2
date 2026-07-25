import { getTheme, setTheme, type Theme } from '../logic/theme'

export interface AccountMenuOptions {
  displayName: string
  // Kutsutaan onnistuneen uloskirjautumisen jälkeen — avaa AuthScreenin uudelleen (V133).
  onLoggedOut: () => void
  // T274/V189 + T310/V222: rooli ohjaa hub-linkin TEKSTIÄ (ei enää näkyvyyttä).
  // Järjestäjä (⊃ talkoolainen) → "🔧 Pätkät-sivu (tee pätkä)" (crossover, sama sessio).
  // Talkoolainen → "🧭 Kaikki pätkät" (hubi on Model B:n koti, V188 — paluupolku ! olla aina).
  role?: string
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

    // T274/V189: järjestäjä-crossover — pääsy /patkat-hubiin tehdäkseen itse pätkiä.
    // T310/B122/V222: gate `role !== 'talkoolainen'` POISTETTU — se jätti talkoolaisen
    // umpikujaan (hubiin pääsi vain kirjoittamalla URL käsin), vaikka Model B:ssä (V188)
    // hubi ON talkoolaisen koti josta pätkä valitaan. Linkki on ⋯-valikossa ∴ tavoitettava
    // molemmissa view-moodeissa (koti JA kartta — mikään CSS ei piilota #btn-menu:a).
    // Sama sessio (cookie säilyy), ei uutta autentikaatiota.
    // Teksti eroaa 🏠 #btn-home-view:stä (= moodinvaihto saman pätkän sisällä) ettei
    // synny kahta "kotia": tämä on SIVUNVAIHTO kaikkien pätkien listaan.
    if (opts.role) {
      const patkat = document.createElement('a')
      patkat.className = 'account-menu-patkat'
      patkat.href = '/patkat'
      patkat.dataset.role = opts.role
      patkat.textContent =
        opts.role === 'talkoolainen' ? '🧭 Kaikki pätkät' : '🔧 Pätkät-sivu (tee pätkä)'
      container.appendChild(patkat)
    }

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
