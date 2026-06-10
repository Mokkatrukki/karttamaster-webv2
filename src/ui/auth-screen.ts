import { getRole } from '../logic/role'
import type { Role } from '../logic/role'

export type AuthResult = { role: Role; displayName: string; code?: string }

export class AuthScreen {
  private readonly overlay: HTMLElement
  private readonly errorEl: HTMLElement
  private readonly järjestäjäForm: HTMLFormElement
  private readonly talkoolainenForm: HTMLFormElement

  constructor(private readonly onAuthenticated: (result: AuthResult) => void) {
    this.overlay = this.buildOverlay()
    document.body.appendChild(this.overlay)
    this.errorEl = this.overlay.querySelector('#auth-error')!
    this.järjestäjäForm = this.overlay.querySelector('#auth-form-jarjestaja')!
    this.talkoolainenForm = this.overlay.querySelector('#auth-form-talkoolainen')!
    this.bindEvents()
  }

  async start(): Promise<void> {
    try {
      const resp = await fetch('/api/auth/me')
      if (resp.ok) {
        const data = await resp.json() as { role: Role; display_name: string }
        this.onAuthenticated({ role: data.role, displayName: data.display_name })
        return
      }
      if (resp.status === 401) {
        this.show()
        return
      }
      // Non-401 error (e.g. 404 from Vite dev server) → no backend, skip auth
      this.onAuthenticated({ role: getRole(), displayName: '' })
    } catch {
      // Network error → no backend, skip auth
      this.onAuthenticated({ role: getRole(), displayName: '' })
    }
  }

  private show(): void {
    this.overlay.classList.add('open')
  }

  private hide(): void {
    this.overlay.classList.remove('open')
  }

  private buildOverlay(): HTMLElement {
    const el = document.createElement('div')
    el.id = 'auth-screen'
    el.innerHTML = `
      <div id="auth-card">
        <h2>Karttamaster</h2>
        <div id="auth-tabs">
          <button type="button" class="auth-tab active" data-tab="järjestäjä">Järjestäjä</button>
          <button type="button" class="auth-tab" data-tab="talkoolainen">Talkoolainen</button>
        </div>
        <form id="auth-form-jarjestaja" class="auth-form active">
          <input type="text" id="auth-username" placeholder="Käyttäjätunnus" autocomplete="username" />
          <input type="password" id="auth-password" placeholder="Salasana" autocomplete="current-password" />
          <button type="submit">Kirjaudu</button>
        </form>
        <form id="auth-form-talkoolainen" class="auth-form">
          <input type="text" id="auth-code" placeholder="Talkoolaiskoodi" autocomplete="off" />
          <button type="submit">Kirjaudu</button>
        </form>
        <p id="auth-error" class="auth-error" aria-live="polite"></p>
      </div>
    `
    return el
  }

  private switchTab(tab: 'järjestäjä' | 'talkoolainen'): void {
    this.errorEl.textContent = ''
    this.overlay.querySelectorAll<HTMLElement>('.auth-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab)
    })
    this.järjestäjäForm.classList.toggle('active', tab === 'järjestäjä')
    this.talkoolainenForm.classList.toggle('active', tab === 'talkoolainen')
  }

  private showError(msg: string): void {
    this.errorEl.textContent = msg
  }

  private async loginJärjestäjä(username: string, password: string): Promise<void> {
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (resp.ok) {
        const data = await resp.json() as { role: Role; display_name: string }
        this.hide()
        this.onAuthenticated({ role: data.role, displayName: data.display_name })
      } else {
        this.showError('Väärä käyttäjätunnus tai salasana')
      }
    } catch {
      this.showError('Yhteysvirhe — yritä uudelleen')
    }
  }

  private async loginTalkoolainen(code: string): Promise<void> {
    try {
      const resp = await fetch('/api/auth/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (resp.ok) {
        const data = await resp.json() as { role: Role; display_name: string }
        this.hide()
        this.onAuthenticated({ role: data.role, displayName: data.display_name, code })
      } else {
        this.showError('Väärä koodi — tarkista koodi uudelleen')
      }
    } catch {
      this.showError('Yhteysvirhe — yritä uudelleen')
    }
  }

  private bindEvents(): void {
    this.overlay.querySelectorAll<HTMLElement>('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab as 'järjestäjä' | 'talkoolainen')
      })
    })

    this.järjestäjäForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const username = (this.overlay.querySelector('#auth-username') as HTMLInputElement).value.trim()
      const password = (this.overlay.querySelector('#auth-password') as HTMLInputElement).value
      if (!username || !password) return
      await this.loginJärjestäjä(username, password)
    })

    this.talkoolainenForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const code = (this.overlay.querySelector('#auth-code') as HTMLInputElement).value.trim()
      if (!code) return
      await this.loginTalkoolainen(code)
    })
  }
}
