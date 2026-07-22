export interface AdminUser {
  id: string
  username: string
  role: string
  display_name: string | null
  created_at: string
  is_active: number
  invite_token: string | null
}

export interface AdminPageCallbacks {
  onToggleActive: (user: AdminUser) => void
  onInvite: () => void
  onCopyInvite: (user: AdminUser) => void
  onResetPassword: (user: AdminUser) => void
}

export function renderAdminUsers(container: HTMLElement, users: AdminUser[], callbacks: AdminPageCallbacks): void {
  container.innerHTML = ''

  const inviteBtn = document.createElement('button')
  inviteBtn.id = 'btn-admin-invite'
  inviteBtn.className = 'admin-invite-btn'
  inviteBtn.textContent = '+ Kutsu uusi järjestäjä'
  inviteBtn.addEventListener('click', () => callbacks.onInvite())
  container.appendChild(inviteBtn)

  const table = document.createElement('table')
  table.className = 'admin-users-table'
  const thead = document.createElement('thead')
  thead.innerHTML = `
    <tr>
      <th>Nimi</th>
      <th>Käyttäjätunnus</th>
      <th>Rooli</th>
      <th>Luotu</th>
      <th>Tila</th>
      <th>Toiminnot</th>
    </tr>
  `
  table.appendChild(thead)

  const tbody = document.createElement('tbody')

  if (users.length === 0) {
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    td.colSpan = 6
    td.className = 'admin-users-empty'
    td.textContent = 'Ei käyttäjiä'
    tr.appendChild(td)
    tbody.appendChild(tr)
  }

  for (const user of users) {
    tbody.appendChild(buildUserRow(user, callbacks))
  }

  table.appendChild(tbody)
  container.appendChild(table)
}

function buildUserRow(user: AdminUser, callbacks: AdminPageCallbacks): HTMLTableRowElement {
  const active = user.is_active !== 0
  const tr = document.createElement('tr')
  tr.className = 'admin-user-row'
  tr.dataset.userId = user.id

  const nameTd = document.createElement('td')
  nameTd.textContent = user.display_name ?? '—'
  const usernameTd = document.createElement('td')
  usernameTd.textContent = user.username
  const roleTd = document.createElement('td')
  roleTd.textContent = user.role
  const createdTd = document.createElement('td')
  createdTd.textContent = user.created_at.slice(0, 10)

  const statusTd = document.createElement('td')
  const statusSpan = document.createElement('span')
  statusSpan.className = `admin-user-status ${active ? 'active' : 'inactive'}`
  statusSpan.textContent = active ? 'Aktiivinen' : 'Deaktivoitu'
  statusTd.appendChild(statusSpan)

  const actionsTd = document.createElement('td')
  actionsTd.className = 'admin-user-actions'

  const toggleBtn = document.createElement('button')
  toggleBtn.className = 'admin-toggle-active-btn'
  toggleBtn.textContent = active ? 'Deaktivoi' : 'Aktivoi'
  toggleBtn.addEventListener('click', () => callbacks.onToggleActive(user))
  actionsTd.appendChild(toggleBtn)

  if (user.invite_token) {
    const copyBtn = document.createElement('button')
    copyBtn.className = 'admin-copy-invite-btn'
    copyBtn.textContent = 'Kopioi kutsulinkki'
    copyBtn.addEventListener('click', () => callbacks.onCopyInvite(user))
    actionsTd.appendChild(copyBtn)
  }

  if (active) {
    const resetBtn = document.createElement('button')
    resetBtn.className = 'admin-reset-password-btn'
    resetBtn.textContent = 'Resetoi salasana'
    resetBtn.addEventListener('click', () => callbacks.onResetPassword(user))
    actionsTd.appendChild(resetBtn)
  }

  tr.append(nameTd, usernameTd, roleTd, createdTd, statusTd, actionsTd)
  return tr
}

// T268/V188: talkoolaisten yleissalasanan asetus admin-sivulla.
export interface AdminSettingsOpts {
  talkooPasswordSet: boolean
  onSaveTalkooPassword: (password: string) => void
}

export function renderAdminSettings(container: HTMLElement, opts: AdminSettingsOpts): void {
  container.innerHTML = ''

  const section = document.createElement('section')
  section.className = 'admin-settings-section'

  const title = document.createElement('h2')
  title.className = 'admin-settings-title'
  title.textContent = 'Talkoolaisten salasana'
  section.appendChild(title)

  const status = document.createElement('p')
  status.className = 'admin-settings-status'
  status.textContent = opts.talkooPasswordSet ? '✓ Salasana asetettu' : 'Ei asetettu — talkoolaiset eivät pääse sisään'
  section.appendChild(status)

  const row = document.createElement('div')
  row.className = 'admin-settings-row'

  const input = document.createElement('input')
  input.type = 'password'
  input.className = 'admin-talkoo-password-input'
  input.placeholder = 'Uusi yleissalasana'
  input.setAttribute('aria-label', 'Talkoolaisten yleissalasana')

  const toggleBtn = document.createElement('button')
  toggleBtn.type = 'button'
  toggleBtn.className = 'admin-password-toggle'
  toggleBtn.textContent = 'Näytä'
  toggleBtn.addEventListener('click', () => {
    const show = input.type === 'password'
    input.type = show ? 'text' : 'password'
    toggleBtn.textContent = show ? 'Piilota' : 'Näytä'
  })

  const saveBtn = document.createElement('button')
  saveBtn.className = 'admin-talkoo-password-save'
  saveBtn.textContent = 'Tallenna'
  saveBtn.addEventListener('click', () => {
    const pw = input.value.trim()
    if (pw.length < 4) {
      status.textContent = 'Salasanan pitää olla vähintään 4 merkkiä'
      return
    }
    opts.onSaveTalkooPassword(pw)
    input.value = ''
  })

  row.append(input, toggleBtn, saveBtn)
  section.appendChild(row)
  container.appendChild(section)
}

export function renderForbidden(container: HTMLElement): void {
  container.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.className = 'admin-forbidden'
  const p = document.createElement('p')
  p.textContent = 'Tämä sivu on vain admin-käyttäjille.'
  wrap.appendChild(p)
  container.appendChild(wrap)
}
