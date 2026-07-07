import type { Role } from '../logic/role'

export type AuthResult = { role: Role; displayName: string; code?: string }

// V27: extract talkoolainen code from /s/<koodi> deep-link
export function extractSegmentCode(pathname: string): string | null {
  const m = pathname.match(/^\/s\/([a-z0-9_-]+)$/i)
  return m ? m[1].toUpperCase() : null
}

// V110: extract invite/reset token from /auth/invite/<token> deep-link
export function extractInviteToken(pathname: string): string | null {
  const m = pathname.match(/^\/auth\/invite\/([a-z0-9-]+)$/i)
  return m ? m[1] : null
}

export class AuthScreen {
  private readonly overlay: HTMLElement
  private readonly errorEl: HTMLElement
  private readonly tabsEl: HTMLElement
  private readonly järjestäjäForm: HTMLFormElement
  private readonly talkoolainenForm: HTMLFormElement
  private readonly inviteForm: HTMLFormElement
  private inviteToken: string | null = null

  constructor(private readonly onAuthenticated: (result: AuthResult) => void) {
    this.overlay = this.buildOverlay()
    document.body.appendChild(this.overlay)
    this.errorEl = this.overlay.querySelector('#auth-error')!
    this.tabsEl = this.overlay.querySelector('#auth-tabs')!
    this.järjestäjäForm = this.overlay.querySelector('#auth-form-jarjestaja')!
    this.talkoolainenForm = this.overlay.querySelector('#auth-form-talkoolainen')!
    this.inviteForm = this.overlay.querySelector('#auth-form-invite')!
    this.bindEvents()
  }

  async start(): Promise<void> {
    // V40: show overlay before any fetch — map must not be visible during auth check
    this.show()
    const inviteToken = extractInviteToken(window.location.pathname)
    if (inviteToken) {
      await this.startInviteFlow(inviteToken)
      return
    }
    const pathCode = extractSegmentCode(window.location.pathname)
    try {
      const resp = await fetch('/api/auth/me')
      if (resp.ok) {
        const data = await resp.json() as { role: Role; display_name: string }
        this.hide()
        this.onAuthenticated({ role: data.role, displayName: data.display_name, code: pathCode ?? undefined })
        return
      }
      if (resp.status === 401) {
        if (pathCode) {
          this.switchTab('talkoolainen')
          const codeInput = this.overlay.querySelector('#auth-code') as HTMLInputElement
          codeInput.value = pathCode
          this.talkoolainenForm.dispatchEvent(new Event('submit', { cancelable: true }))
          return
        }
        return
      }
      // Non-401 error (e.g. 404, 500) → keep login form visible (V29: no silent skip)
    } catch {
      // Network error → keep login form visible (V29: no silent skip)
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
        <form id="auth-form-invite" class="auth-form">
          <input type="text" id="invite-username" placeholder="Käyttäjätunnus" autocomplete="username" />
          <input type="password" id="invite-password" placeholder="Salasana" autocomplete="new-password" />
          <input type="password" id="invite-password-confirm" placeholder="Salasana uudelleen" autocomplete="new-password" />
          <button type="submit">Aseta salasana</button>
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

  private async startInviteFlow(token: string): Promise<void> {
    this.tabsEl.style.display = 'none'
    this.järjestäjäForm.classList.remove('active')
    this.talkoolainenForm.classList.remove('active')
    try {
      const resp = await fetch(`/api/auth/invite/${token}`)
      if (!resp.ok) {
        this.showError('Kutsulinkki on vanhentunut tai virheellinen')
        return
      }
      this.inviteToken = token
      this.inviteForm.classList.add('active')
    } catch {
      this.showError('Yhteysvirhe — yritä uudelleen')
    }
  }

  private async submitInvite(username: string, password: string): Promise<void> {
    if (!this.inviteToken) return
    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.inviteToken, username, password }),
      })
      if (resp.ok) {
        await this.loginJärjestäjä(username, password)
      } else {
        const data = await resp.json() as { error?: string }
        this.showError(data.error === 'username_taken' ? 'Käyttäjätunnus on jo käytössä' : 'Kutsulinkki on vanhentunut tai virheellinen')
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

    this.inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const username = (this.overlay.querySelector('#invite-username') as HTMLInputElement).value.trim()
      const password = (this.overlay.querySelector('#invite-password') as HTMLInputElement).value
      const confirm = (this.overlay.querySelector('#invite-password-confirm') as HTMLInputElement).value
      if (!username || !password) return
      if (password !== confirm) {
        this.showError('Salasanat eivät täsmää')
        return
      }
      await this.submitInvite(username, password)
    })
  }
}
