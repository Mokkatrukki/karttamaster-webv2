// T321/V231: /loki-sivun init + wiring. Oma entry, EI osa admin.html:ää — audit-API sallii
// järjestäjän, mutta admin-sivu gettaa koko sivun adminiin (src/admin.ts:99) ja järjestäjä on
// tämän näkymän pääkäyttäjä.
import './style.css'
import './audit-log.css'
// UX-audit 2026-08-01: teema on KÄYTTÄJÄN valinta (V132/T202) & se persistoituu
// localStorageen — mutta vain `main.ts` sovelsi sen. Talkoolainen joka valitsi Kaamoksen
// karttanäkymässä sai tälle sivulle täyden valkoisen ∴ juuri se pinta joka avataan
// pimeässä metsässä oli ainoa joka ⊥ totellut. `initTheme` ! olla jokaisessa
// entrypointissa ENNEN ensimmäistä renderiä (välkkeen esto).
import { initTheme } from './logic/theme'
import { AuthScreen } from './ui/auth-screen'
import { renderAuditLogPage } from './ui/audit-log-page'
import { renderForbidden } from './ui/admin-page'
import { fetchAuditLog } from './logic/audit-sync'


// Ennen ensimmäistä renderiä: <html data-theme> talteen localStoragesta (ei välkettä).
initTheme()

const content = document.getElementById('loki-content')!
const logoutBtn = document.getElementById('btn-loki-logout')!

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/'
})

interface MarkerApiRow { id: string; type: string; lat: number; lon: number }

async function load(statusMessage?: string): Promise<void> {
  const [entries, markers] = await Promise.all([
    fetchAuditLog({ limit: 500 }),
    fetchMarkers(),
  ])

  if (entries === null) {
    content.innerHTML = ''
    const err = document.createElement('p')
    err.className = 'audit-empty'
    err.textContent = '⚠ Lokin lataus epäonnistui — päivitä sivu.'
    content.appendChild(err)
    return
  }

  // T332/V241: peruutuksen vahvistus kulkee latauksen mukana ∴ se selviää uudelleenrenderöinnistä
  // jonka peruutus itse laukaisee (B130).
  renderAuditLogPage(content, {
    entries,
    markers,
    statusMessage,
    onReload: (msg) => void load(msg),
  })
}

// Merkkien nykytila: poikkeaman laskentaan (T320) ja tyyppisarakkeeseen. Puuttuva merkki =
// poistettu → rivi näkyy silti, mutta ilman poikkeamaa ja kartalle-linkkiä.
async function fetchMarkers(): Promise<Map<string, { type: string; lat: number; lon: number }>> {
  try {
    const res = await fetch('/api/markers')
    if (!res.ok) return new Map()
    const rows = await res.json() as MarkerApiRow[]
    return new Map(rows.map(m => [m.id, { type: m.type, lat: m.lat, lon: m.lon }]))
  } catch {
    return new Map()
  }
}

const auth = new AuthScreen((result) => {
  // AuthResult.role kattaa client-roolit; /api/auth/me palauttaa myös 'admin' → laajennetaan.
  const role = result.role as string
  if (role !== 'admin' && role !== 'järjestäjä') {
    renderForbidden(content, 'Aktiviteettiloki on vain järjestäjille ja admineille — sinulla ei ole oikeutta tähän näkymään.')
    return
  }
  void load()
})

void auth.start()
