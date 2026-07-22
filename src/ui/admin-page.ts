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

// T268/V188: talkoolaisten yleissalasanan asetus admin-sivulla. Näyttää NYKYISEN salasanan
// (esitäytetty, katsottavissa toggle-napista) jotta admin voi tarkistaa "mikäs se salasana oli".
export interface AdminSettingsOpts {
  talkooPassword: string
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
  status.textContent = opts.talkooPassword
    ? '✓ Salasana asetettu — jaa tämä talkoolaisille'
    : 'Ei asetettu — talkoolaiset eivät pääse sisään'
  section.appendChild(status)

  const row = document.createElement('div')
  row.className = 'admin-settings-row'

  const input = document.createElement('input')
  input.type = 'password'
  input.className = 'admin-talkoo-password-input'
  input.placeholder = 'Yleissalasana'
  input.value = opts.talkooPassword // esitäytetty → admin näkee nykyisen (toggle paljastaa)
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

// T270/V190/§R: FAQ-editori adminissa. Baseline = textarea (toimii + testattava jsdomissa).
// Selaimessa progressiivinen enhancement Milkdown Crepe -WYSIWYG:llä (§R: aito inline-formatointi,
// "niinkun Word"). Lazy dynaaminen import → oma chunk, ei kuormita talkoolaisen bundlea. Epäonnistuu
// turvallisesti textareaan. Testissä (MODE=test) Crepeä ei ladata → deterministinen textarea-polku.
export interface AdminFaqOpts {
  markdown: string
  onSave: (markdown: string) => void
}

export function renderAdminFaq(container: HTMLElement, opts: AdminFaqOpts): void {
  container.innerHTML = ''
  const section = document.createElement('section')
  section.className = 'admin-settings-section admin-faq-section'

  const title = document.createElement('h2')
  title.className = 'admin-settings-title'
  title.textContent = 'FAQ — talkoolaisten info'
  section.appendChild(title)

  const hint = document.createElement('p')
  hint.className = 'admin-settings-status'
  hint.textContent = 'Aikataulut, ruokailut, sijainnit. Näkyy talkoolaisille /patkat-sivulla.'
  section.appendChild(hint)

  const mount = document.createElement('div')
  mount.className = 'admin-faq-editor-mount'
  const textarea = document.createElement('textarea')
  textarea.className = 'admin-faq-textarea'
  textarea.rows = 10
  textarea.value = opts.markdown
  mount.appendChild(textarea)
  section.appendChild(mount)

  let getValue = (): string => textarea.value

  const saveBtn = document.createElement('button')
  saveBtn.className = 'admin-faq-save'
  saveBtn.textContent = 'Tallenna FAQ'
  saveBtn.addEventListener('click', () => opts.onSave(getValue()))
  section.appendChild(saveBtn)

  container.appendChild(section)

  const mode = (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE
  if (mode !== 'test') {
    void enhanceFaqWithCrepe(mount, textarea, opts.markdown).then(fn => {
      if (fn) getValue = fn
    })
  }
}

async function enhanceFaqWithCrepe(
  mount: HTMLElement,
  textarea: HTMLTextAreaElement,
  markdown: string,
): Promise<(() => string) | null> {
  try {
    // Literaali dynaaminen import → Vite code-splittaa Crepen omaan lazy-chunkkiin (ei osu
    // talkoolaisen/pääbundleen). MODE-gate (kutsupaikka) estää lataamisen jsdom-testissä.
    const { Crepe } = await import('@milkdown/crepe')
    await import('@milkdown/crepe/theme/common/style.css')
    await import('@milkdown/crepe/theme/frame.css')
    const editorEl = document.createElement('div')
    editorEl.className = 'admin-faq-crepe'
    mount.insertBefore(editorEl, textarea)
    textarea.style.display = 'none'
    const crepe = new Crepe({ root: editorEl, defaultValue: markdown })
    await crepe.create()
    return () => crepe.getMarkdown()
  } catch {
    return null // WYSIWYG ei latautunut → textarea jää käyttöön
  }
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
