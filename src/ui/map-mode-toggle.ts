// T308/V219: muokkaustilan UI — toggle-nappi + pysyvä tilapilleri.
//
// Tila asuu `src/logic/map-mode.ts`:ssä (T307/V218). Tämä komponentti EI pidä omaa
// tilamuuttujaa eikä kirjoita `document.body.dataset.mapMode`:a (sen tekee
// `syncMapModeToBody` markers-wiringissä ∴ yksi totuus) — se vain
//   (a) kutsuu `state.toggle()` klikkauksesta ja
//   (b) heijastaa tilan nappien labeliin/aria-pressediin + pillerin näkyvyyteen.
//
// Molempien roolien napit ohjaavat SAMAA tilaa (V218: ei rooli-eriytettyä logiikkaa):
//   järjestäjä  → yläpalkin karttatyökalurivi (`#btn-map-mode`)
//   talkoolainen → yläpalkin ⋯-valikko (`#btn-tk-map-mode`, V179-linja: pätkän core ⋯:ssä)
// Roolinäkyvyys on CSS/`data-role-hide`-asia, ei logiikkaa.
//
// V219: label kertoo KOHDETILAN (katselu → "✎ Muokkaa", muokkaus → "✓ Valmis") ja pilleri
// kertoo tilan SANOIN ("Muokkaustila") — ei pelkkä ikoni, ei pelkkä väri (V197-linja).
// Talkoolainen metsässä (aurinko, hanskat) ei saa arvata onko kartta "liukas".

import { mapMode, type MapMode, type MapModeState } from '../logic/map-mode'

/** Napin label = KOHDETILA (mitä klikki tekee), ei nykytila. */
export function mapModeToggleLabel(mode: MapMode): string {
  return mode === 'muokkaus' ? '✓ Valmis' : '✎ Muokkaa'
}

/** Pillerin teksti — sanoin, ei pelkkä ikoni/väri (V219/V197). */
export const MAP_MODE_PILL_TEXT = '✎ Muokkaustila'

const DEFAULT_BUTTON_SELECTORS = ['#btn-map-mode', '#btn-tk-map-mode']
const DEFAULT_PILL_SELECTOR = '#map-mode-pill'

export interface MapModeToggleOptions {
  /** Napit. Oletus: `#btn-map-mode` + `#btn-tk-map-mode` (ne jotka löytyvät). */
  buttons?: (HTMLElement | null | undefined)[]
  /** Tilapilleri. Oletus: `#map-mode-pill`. `null` = ei pilleriä. */
  pill?: HTMLElement | null
  /** Tila. Oletus: jaettu `mapMode`-singleton. Testit injektoivat oman. */
  state?: MapModeState
  /** Juuri josta oletusselektorit haetaan (testit voivat antaa fragmentin). */
  root?: ParentNode
}

export interface MapModeToggleHandle {
  /** Napit joita tämä handle ohjaa (löydetyt). */
  readonly buttons: HTMLElement[]
  /** Pakota UI vastaamaan tilaa (esim. DOM:n uudelleenrenderöinnin jälkeen). */
  sync(): void
  /** Irrota kuuntelijat (kuuntelijavuoto pois testeissä ja re-initissä). */
  destroy(): void
}

export function initMapModeToggle(opts: MapModeToggleOptions = {}): MapModeToggleHandle {
  const state = opts.state ?? mapMode
  const root: ParentNode = opts.root ?? document
  const buttons = (
    opts.buttons ?? DEFAULT_BUTTON_SELECTORS.map(sel => root.querySelector<HTMLElement>(sel))
  ).filter((b): b is HTMLElement => !!b)
  const pill = opts.pill !== undefined ? opts.pill : root.querySelector<HTMLElement>(DEFAULT_PILL_SELECTOR)

  const onClick = (e: Event): void => {
    e.preventDefault()
    state.toggle()
  }
  buttons.forEach(b => b.addEventListener('click', onClick))

  const apply = (mode: MapMode): void => {
    const editing = mode === 'muokkaus'
    buttons.forEach(b => {
      b.textContent = mapModeToggleLabel(mode)
      // aria-pressed = KYTKIMEN tila (muokkaus päällä?) — label kertoo kohdetilan.
      b.setAttribute('aria-pressed', String(editing))
      b.classList.add('map-mode-toggle')
      b.classList.toggle('active', editing)
      // Näkyvä teksti on saavutettava nimi (V197: ei aria-labelia joka poikkeaisi siitä).
      b.title = editing
        ? 'Poistu muokkaustilasta — kartta lukittuu katseluun'
        : 'Avaa muokkaustila — merkkien siirto ja lisääminen sallitaan'
    })
    if (pill) {
      pill.textContent = MAP_MODE_PILL_TEXT
      // Pilleri on PYSYVÄ muokkaustilan ajan (ei ajastettua toastia) ja poissa katselussa.
      // `hidden` on totuus (testattava ilman CSS:ää); CSS-korostus hookkaa body[data-map-mode].
      pill.hidden = !editing
    }
  }

  apply(state.get())
  const off = state.onChange(apply)

  return {
    buttons,
    sync: () => apply(state.get()),
    destroy() {
      off()
      buttons.forEach(b => b.removeEventListener('click', onClick))
    },
  }
}
