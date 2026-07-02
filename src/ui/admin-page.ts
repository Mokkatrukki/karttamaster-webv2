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

  tr.append(nameTd, usernameTd, roleTd, createdTd, statusTd, actionsTd)
  return tr
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
