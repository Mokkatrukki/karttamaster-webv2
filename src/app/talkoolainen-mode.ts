// T254/V174–176 (R1 keystone): talkoolaisen kaksi-moodi-kehys (koti↔kartta).
// KOTI = pätkänäkymä ILMAN karttaa (landing, V174). KARTTA = kartta näkyvä.
// Moodi = #app[data-view-mode]; CSS ohjaa näkyvyyttä (V175). Vaihto = pelkkä
// näkyvyyskytkin — EI nollaa segment-/marker-tilaa, EI verkkokutsuja (V176).
// Precedentti: src/app/role-view.ts (data-role). PUHDAS DOM → Vitest-jsdom-testattava
// (kartan invalidateSize injektoidaan onEnterKartta-callbackina, ei suoraa Leaflet-riippuvuutta).

export type ViewMode = 'koti' | 'kartta'

let currentMode: ViewMode = 'koti'

export function getViewMode(): ViewMode {
  return currentMode
}

// Asettaa moodin: #app data-view-mode + onEnterKartta (Leaflet invalidateSize, V176).
// Karttamoodiin siirtyessä kartta oli piilossa (display:none) → Leaflet tarvitsee
// invalidateSizen laskeakseen konttikoon uudelleen. Kotimoodissa ei tarvita.
export function setViewMode(mode: ViewMode, onEnterKartta?: () => void): void {
  currentMode = mode
  document.getElementById('app')?.setAttribute('data-view-mode', mode)
  if (mode === 'kartta') onEnterKartta?.()
}

// Wiraa talkoolaisen moodinapit + asettaa oletusmoodin (koti, V174).
// btnToMap = "Kartalle →" (koti→kartta); btnHome = "🏠 koti" (kartta→koti).
// Kutsutaan VAIN talkoolaiselle (main.ts guard talkoolainenCode) — järjestäjän
// layout ei saa data-view-modea (V174).
export function initTalkoolainenMode(opts: {
  btnToMap: HTMLElement | null
  btnHome: HTMLElement | null
  onEnterKartta?: () => void
}): void {
  const { btnToMap, btnHome, onEnterKartta } = opts
  setViewMode('koti') // V174: oletus koti (kartta piilossa kunnes "Kartalle →")
  btnToMap?.addEventListener('click', () => setViewMode('kartta', onEnterKartta))
  btnHome?.addEventListener('click', () => setViewMode('koti'))
}
