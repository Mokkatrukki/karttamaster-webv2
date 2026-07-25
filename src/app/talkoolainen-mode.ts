// T254/V174–176 (R1 keystone): talkoolaisen kaksi-moodi-kehys (koti↔kartta).
// KOTI = pätkänäkymä ILMAN karttaa (landing, V174). KARTTA = kartta näkyvä.
// Moodi = #app[data-view-mode]; CSS ohjaa näkyvyyttä (V175). Vaihto = pelkkä
// näkyvyyskytkin — EI nollaa segment-/marker-tilaa, EI verkkokutsuja (V176).
// Precedentti: src/app/role-view.ts (data-role). PUHDAS DOM → Vitest-jsdom-testattava
// (kartan invalidateSize injektoidaan onEnterKartta-callbackina, ei suoraa Leaflet-riippuvuutta).
//
// T313/V225: moodi säilyy saman session refreshissä (sessionStorage per pätkä-slug).

export type ViewMode = 'koti' | 'kartta'

let currentMode: ViewMode = 'koti'

const VIEWMODE_KEY_PREFIX = 'km:viewmode:'

// Slug luetaan URL:sta (`/s/<slug>`) — moodimuisti on pätkäkohtainen (V225) ∴ toisen
// pätkän avaus alkaa aina kodista. Ei slugia (esim. juuri/järjestäjä) → ei muistia.
function viewModeKey(): string | null {
  const m = /^\/s\/([^/?#]+)/.exec(window.location.pathname)
  return m ? VIEWMODE_KEY_PREFIX + decodeURIComponent(m[1]) : null
}

// V225: sessionStorage, EI localStorage — uusi päivä/uusi välilehti alkaa kodista.
// try/catch: privaattitila voi heittää → muisti on mukavuus, ei saa kaataa initiä.
function readSavedMode(): ViewMode | null {
  const key = viewModeKey()
  if (!key) return null
  try {
    const v = window.sessionStorage.getItem(key)
    return v === 'kartta' || v === 'koti' ? v : null
  } catch {
    return null
  }
}

function saveMode(mode: ViewMode): void {
  const key = viewModeKey()
  if (!key) return
  try {
    window.sessionStorage.setItem(key, mode)
  } catch {
    /* muisti on mukavuus — quota/privaattitila ei saa estää moodivaihtoa */
  }
}

export function getViewMode(): ViewMode {
  return currentMode
}

// Asettaa moodin: #app data-view-mode + onEnterKartta (Leaflet invalidateSize, V176).
// Karttamoodiin siirtyessä kartta oli piilossa (display:none) → Leaflet tarvitsee
// invalidateSizen laskeakseen konttikoon uudelleen. Kotimoodissa ei tarvita.
// T313/V225: jokainen vaihto tallentaa moodin sessionStorageen (slug-kohtaisesti).
export function setViewMode(mode: ViewMode, onEnterKartta?: () => void): void {
  currentMode = mode
  document.getElementById('app')?.setAttribute('data-view-mode', mode)
  saveMode(mode)
  if (mode === 'kartta') onEnterKartta?.()
}

// Wiraa talkoolaisen moodinapit + asettaa aloitusmoodin.
// btnToMap = "Kartalle →" (koti→kartta); btnHome = "🏠 koti" (kartta→koti).
// Kutsutaan VAIN talkoolaiselle (main.ts guard talkoolainenCode) — järjestäjän
// layout ei saa data-view-modea (V174).
export function initTalkoolainenMode(opts: {
  btnToMap: HTMLElement | null
  btnHome: HTMLElement | null
  onEnterKartta?: () => void
}): void {
  const { btnToMap, btnHome, onEnterKartta } = opts
  // T313/V225: tuore avaus → koti (V174 ennallaan). Saman session refresh palauttaa
  // viimeisen moodin — vahinkorefresh metsässä ei heitä karttatyöstä varustelistalle.
  // Palautus kulkee setViewModen kautta ∴ karttamoodiin ajetaan sama onEnterKartta
  // (invalidateSize, V176) kuin nappipolussa — muuten kartta renderöityy väärän kokoisena.
  setViewMode(readSavedMode() ?? 'koti', onEnterKartta)
  btnToMap?.addEventListener('click', () => setViewMode('kartta', onEnterKartta))
  btnHome?.addEventListener('click', () => setViewMode('koti'))
}
