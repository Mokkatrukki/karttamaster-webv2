import './style.css'
import { AuthScreen } from './ui/auth-screen'
import { renderAdminUsers, renderAdminSettings, renderForbidden } from './ui/admin-page'
import type { AdminUser } from './ui/admin-page'

const content = document.getElementById('admin-content')!
const settingsEl = document.getElementById('admin-settings')!
const banner = document.getElementById('admin-invite-banner')!
const logoutBtn = document.getElementById('btn-admin-logout')!

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/'
})

function showBanner(url: string): void {
  banner.hidden = false
  banner.innerHTML = ''
  const span = document.createElement('span')
  span.textContent = url
  const copyBtn = document.createElement('button')
  copyBtn.textContent = 'Kopioi'
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(url).catch(() => { /* clipboard unavailable */ })
  })
  const waLink = document.createElement('a')
  waLink.href = `https://wa.me/?text=${encodeURIComponent(url)}`
  waLink.target = '_blank'
  waLink.rel = 'noopener'
  waLink.className = 'admin-whatsapp-link'
  waLink.textContent = 'Lähetä WhatsAppilla'
  banner.append(span, copyBtn, waLink)
}

async function loadUsers(): Promise<void> {
  const res = await fetch('/api/admin/users')
  if (!res.ok) {
    renderForbidden(content)
    return
  }
  const users = await res.json() as AdminUser[]
  renderAdminUsers(content, users, {
    onToggleActive: async (user) => {
      const nextActive = user.is_active ? 0 : 1
      await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      })
      await loadUsers()
    },
    onInvite: async () => {
      const res = await fetch('/api/admin/invites', { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as { token: string }
        showBanner(`${window.location.origin}/auth/invite/${data.token}`)
      }
      await loadUsers()
    },
    onCopyInvite: async (user) => {
      if (!user.invite_token) return
      const url = `${window.location.origin}/auth/invite/${user.invite_token}`
      showBanner(url)
      try {
        await navigator.clipboard.writeText(url)
      } catch { /* clipboard unavailable */ }
    },
    onResetPassword: async (user) => {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as { inviteUrl: string }
        showBanner(`${window.location.origin}${data.inviteUrl}`)
      }
      await loadUsers()
    },
  })
}

async function loadSettings(): Promise<void> {
  const res = await fetch('/api/admin/settings')
  const talkooPasswordSet = res.ok ? ((await res.json()) as { talkooPasswordSet: boolean }).talkooPasswordSet : false
  renderAdminSettings(settingsEl, {
    talkooPasswordSet,
    onSaveTalkooPassword: async (password) => {
      const r = await fetch('/api/admin/settings/talkoo-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (r.ok) await loadSettings()
    },
  })
}

const auth = new AuthScreen((result) => {
  // AuthResult.role is typed as the client Role (järjestäjä|talkoolainen) but
  // /api/auth/me can also return 'admin' at runtime — widen for this check.
  if ((result.role as string) !== 'admin') {
    renderForbidden(content)
    return
  }
  void loadUsers()
  void loadSettings()
})
void auth.start()
