// T322/V228: nimipyyntö kesken session.
//
// Kenttätyö oli jo käynnissä kun nimi tuli pakolliseksi kirjautumisessa (T317). Vanhat sessiot
// elävät 7 vrk ja niissä display_name on geneerinen 'Talkoolainen' → audit-loki ei kertoisi
// kuka teki mitä koko tapahtuman ajan. Uudelleenkirjautumista ei voi vaatia kesken maastotyön
// (talkoolainen ei tiedä yleissalasanaa ulkoa metsässä) ∴ nimi kysytään paikan päällä.
//
// Kevyt ja ohitettavissa: tämä ei saa estää kenttätyötä. Nimi on jäljitettävyysväline, ei
// pääsynvalvonta (V228).
import { isValidTalkooName, readRememberedName, rememberName } from '../logic/talkoo-identity'

// Sessiot jotka kirjautuivat ennen T317:ää kantavat tätä nimeä.
export const LEGACY_NAME = 'Talkoolainen'

const DISMISS_KEY = 'km:talkoo:nimi-ohitettu'

export function needsNamePrompt(displayName: string | null | undefined): boolean {
  if (!displayName) return true
  return displayName.trim() === LEGACY_NAME
}

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch { /* ei kriittinen */ }
}

export interface NamePromptOpts {
  onNamed: (name: string) => void
  // Injektoitavissa testejä varten.
  submitFn?: (name: string) => Promise<boolean>
}

async function postName(name: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Palauttaa null jos pyyntöä ei tarvita (nimi jo tiedossa tai käyttäjä ohitti sen aiemmin).
export function buildNamePrompt(displayName: string | null | undefined, opts: NamePromptOpts): HTMLElement | null {
  if (!needsNamePrompt(displayName) || dismissed()) return null

  const bar = document.createElement('div')
  bar.className = 'name-prompt'

  const label = document.createElement('span')
  label.className = 'name-prompt-label'
  label.textContent = 'Kuka olet? Nimi näkyy muutoshistoriassa.'

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'name-prompt-input'
  input.placeholder = 'Nimesi'
  input.autocomplete = 'name'
  input.maxLength = 40
  input.setAttribute('aria-label', 'Nimesi')
  input.value = readRememberedName()

  const save = document.createElement('button')
  save.type = 'button'
  save.className = 'name-prompt-save btn btn-primary'
  save.textContent = 'Tallenna'

  const skip = document.createElement('button')
  skip.type = 'button'
  skip.className = 'name-prompt-skip btn btn-secondary'
  skip.textContent = 'Ei nyt'

  const error = document.createElement('span')
  error.className = 'name-prompt-error'
  error.setAttribute('aria-live', 'polite')

  save.addEventListener('click', async () => {
    const name = input.value.trim()
    if (!isValidTalkooName(name)) {
      error.textContent = 'Vähintään 2 merkkiä.'
      return
    }
    save.disabled = true
    error.textContent = ''
    const ok = await (opts.submitFn ?? postName)(name)
    if (!ok) {
      save.disabled = false
      error.textContent = 'Tallennus ei onnistunut — yritä uudelleen.'
      return
    }
    rememberName(name)
    bar.remove()
    opts.onNamed(name)
  })

  skip.addEventListener('click', () => {
    // Ohitus muistetaan → palkki ei jankuta joka latauksella kesken kenttätyön.
    markDismissed()
    bar.remove()
  })

  bar.append(label, input, save, skip, error)
  return bar
}
