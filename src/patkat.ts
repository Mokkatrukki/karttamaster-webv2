import './style.css'
import './name-prompt.css'
// UX-audit 2026-08-01: teema on KÄYTTÄJÄN valinta (V132/T202) & se persistoituu
// localStorageen — mutta vain `main.ts` sovelsi sen. Talkoolainen joka valitsi Kaamoksen
// karttanäkymässä sai tälle sivulle täyden valkoisen ∴ juuri se pinta joka avataan
// pimeässä metsässä oli ainoa joka ⊥ totellut. `initTheme` ! olla jokaisessa
// entrypointissa ENNEN ensimmäistä renderiä (välkkeen esto).
import { initTheme } from './logic/theme'
import { isValidTalkooName, readRememberedName, rememberName, NAME_MAX } from './logic/talkoo-identity'
import { renderPatkatPage } from './ui/patkat-page'
import { buildNamePrompt } from './ui/name-prompt'
import { fetchAllSegments } from './logic/segment-sync'
import { segmentsInPhase } from './logic/segments'
import { layoutRole } from './logic/role'
import { phaseSourceFor } from './ui/phase-indicator'
import { loadActivePhase, getActivePhase } from './logic/phase-view'
import { fetchMarkers } from './logic/sync'
import type { Segment } from './logic/segments'
import type { SignMarker } from './logic/types'


// Ennen ensimmäistä renderiä: <html data-theme> talteen localStoragesta (ei välkettä).
initTheme()

const content = document.getElementById('patkat-content')!

async function boot(): Promise<void> {
  // Auth-gate (Model B): ilman voimassa olevaa sessiota → yleissalasana-login INLINE (jää /patkat:iin).
  const me = await fetch('/api/auth/me')
  if (!me.ok) {
    renderLogin()
    return
  }
  const { role, display_name: displayName } = (await me.json()) as { role: string; display_name?: string }

  const [, faqRes, segRes, markerRes] = await Promise.all([
    // T426/V317: vaihe serveriltä samassa rinnakkaisessa erässä — hub suodattaa sillä (V318).
    loadActivePhase(),
    fetch('/api/faq').then(r => (r.ok ? r.json() : { markdown: '' })).catch(() => ({ markdown: '' })),
    fetchAllSegments(),
    fetchMarkers(),
  ])

  const faqMarkdown = (faqRes as { markdown?: string }).markdown ?? ''
  const segments: Segment[] = segRes.ok ? segRes.segments : []
  const markers: SignMarker[] = markerRes.ok ? markerRes.markers : []

  // T427/V318 → T470/V357: VAIHE RAJAA LISTAN ROOLISTA RIIPPUMATTA. Muut vaiheet ⊥ ole
  // piilotettuja vaan EIVÄT OLE MENOSSA — sama fyysinen osuus elää kolmena pätkänä (V26/V91)
  // ∴ suodattamaton lista näyttää saman maaston kahdesti-kolmesti & sama nimi toistuu
  // vaiheiden yli (B204: järjestäjä luki hubista 31 riviä kun talkoolainen luki 13).
  //
  // Ero ei ole suodattamisessa vaan VAIHEEN LÄHTEESSÄ (`phaseSourceFor`, sama kuin
  // vaiheindikaattorilla): talkoolaiselle globaali vaihe (tapahtuman tosiasia ⊥ valinta, V318),
  // järjestäjälle hänen oma katseluvaiheensa (V321) jota alla oleva valitsin muuttaa.
  const audience = layoutRole(role)
  const phaseSource = phaseSourceFor(audience)

  function render(): void {
    const activePhase = phaseSource()
    renderPatkatPage(content, {
      faqMarkdown,
      segments: segmentsInPhase(segments, activePhase),
      markers,
      role,
      activePhase,
      audience,
      // V332: kasakortti lukee GLOBAALIA vaihetta — järjestäjän katselu ⊥ saa loihtia
      // autoporukan pintaa kesken asetusvaiheen.
      globalPhase: getActivePhase(),
      onPhaseChange: render,
    })
  }
  render()

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
