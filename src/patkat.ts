import './style.css'
import './name-prompt.css'
import { isValidTalkooName, readRememberedName, rememberName, NAME_MAX } from './logic/talkoo-identity'
import { renderPatkatPage } from './ui/patkat-page'
import { buildNamePrompt } from './ui/name-prompt'
import { fetchAllSegments } from './logic/segment-sync'
import { fetchMarkers } from './logic/sync'
import type { Segment } from './logic/segments'
import type { SignMarker } from './logic/types'

const content = document.getElementById('patkat-content')!

async function boot(): Promise<void> {
  // Auth-gate (Model B): ilman voimassa olevaa sessiota → yleissalasana-login INLINE (jää /patkat:iin).
  const me = await fetch('/api/auth/me')
  if (!me.ok) {
    renderLogin()
    return
  }
  const { role, display_name: displayName } = (await me.json()) as { role: string; display_name?: string }

  const [faqRes, segRes, markerRes] = await Promise.all([
    fetch('/api/faq').then(r => (r.ok ? r.json() : { markdown: '' })).catch(() => ({ markdown: '' })),
    fetchAllSegments(),
    fetchMarkers(),
  ])

  const faqMarkdown = (faqRes as { markdown?: string }).markdown ?? ''
  const segments: Segment[] = segRes.ok ? segRes.segments : []
  const markers: SignMarker[] = markerRes.ok ? markerRes.markers : []

  renderPatkatPage(content, { faqMarkdown, segments, markers, role })

  // T322/V228: ennen T317:ää kirjautuneet sessiot ovat nimettömiä 7 vrk ajan — kysytään nimi
  // hubissa, ei pakoteta uudelleenkirjautumista kesken kenttätyön. Ohitettavissa.
  if (role === 'talkoolainen') {
    const prompt = buildNamePrompt(displayName, { onNamed: () => { /* nimi on sessiossa, ei uudelleenrenderiä */ } })
    if (prompt) content.prepend(prompt)
  }
}

function renderLogin(): void {
  content.innerHTML = ''
  content.classList.add('patkat-page')

  const card = document.createElement('div')
  card.className = 'patkat-login-card'

  const h1 = document.createElement('h1')
  h1.textContent = 'Tervetuloa talkoilemaan!'
  const lead = document.createElement('p')
  lead.className = 'patkat-lead'
  lead.textContent = 'Kirjaudu talkoolaisten yleissalasanalla.'

  const form = document.createElement('form')
  form.className = 'patkat-login-form'
  // T317/V228: nimi salasanan VIERELLE — yksi lomake, yksi lähetys (ei erillistä vaihetta).
  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  // Sama tyyli kuin salasanakentällä (jaettu luokka) + oma luokka valintaa varten — style.css
  // pysyy koskemattomana (rinnakkainen työ T307-T315).
  nameInput.className = 'patkat-login-input patkat-login-name'
  nameInput.placeholder = 'Nimesi'
  nameInput.autocomplete = 'name'
  nameInput.maxLength = NAME_MAX
  nameInput.setAttribute('aria-label', 'Nimesi')
  nameInput.value = readRememberedName()
  const input = document.createElement('input')
  input.type = 'password'
  input.className = 'patkat-login-input'
  input.placeholder = 'Yleissalasana'
  input.setAttribute('aria-label', 'Talkoolaisten yleissalasana')
  const btn = document.createElement('button')
  btn.type = 'submit'
  btn.className = 'patkat-login-btn btn btn-primary'
  btn.textContent = 'Kirjaudu'
  const error = document.createElement('p')
  error.className = 'patkat-login-error'
  error.setAttribute('aria-live', 'polite')

  form.append(nameInput, input, btn)
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const password = input.value
    if (!password) return
    error.textContent = ''
    const name = nameInput.value
    if (!isValidTalkooName(name)) {
      error.textContent = 'Kirjoita nimesi (vähintään 2 merkkiä).'
      return
    }
    try {
      const resp = await fetch('/api/auth/talkoo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, name: name.trim() }),
      })
      if (resp.ok) {
        rememberName(name)
        void boot() // sessio luotu → näytä hub
      } else if (resp.status === 429) {
        error.textContent = 'Liikaa yrityksiä — odota hetki.'
      } else {
        error.textContent = 'Väärä salasana.'
      }
    } catch {
      error.textContent = 'Yhteysvirhe — yritä uudelleen.'
    }
  })

  card.append(h1, lead, form, error)
  content.appendChild(card)
}

void boot()
