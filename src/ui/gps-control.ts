import {
  gpsControlLabel, gpsTapAction,
  type GpsControlState, type GpsTapAction,
} from '../logic/gps-follow'

// T407/V294 — paikannuksen laukaisin KARTALLA, ei ⋯-valikon takana.
//
// Miksi kartalle: ⋯-valikossa GPS on kolmen napautuksen päässä (⋯ → GPS → sulje valikko) ∴ se
// rikkoo VISION §Talkoolainen "kriittiset toiminnot max 2 napin päässä". Metsässä GPS on
// kriittisin toiminto — se on koko kartan käytön edellytys.
//
// Miksi laukaisin ON tilanäyttö: erillinen indikaattori olisi toinen totuus samasta tilasta
// (B133: label valehteli päällä-tilaa). Yksi elementti ⇒ tila ja toiminto ⊥ voi ajautua erilleen.

export interface GpsControl {
  el: HTMLButtonElement
  setState(state: GpsControlState): void
  /** Talkoolaisen hero omistaa alalaidan — kontrolli väistää sen. Palauttaa siivousfunktion. */
  observeHero(hero: Element | null): () => void
  destroy(): void
}

export interface GpsControlOptions {
  onTap: (action: GpsTapAction) => void
}

// V294: neljä tilaa, neljä luokkaa. Tilaluokat vaihdetaan yhtenä joukkona ∴ setState on
// idempotentti eikä luokkalista kasva toistokutsuilla.
const STATE_CLASSES: Record<GpsControlState, string> = {
  pois: 'gps-control--pois',
  haetaan: 'gps-control--haetaan',
  seuraa: 'gps-control--seuraa',
  vapaa: 'gps-control--vapaa',
}

// Lisäselite napin oman tekstin päälle. Näkyvä teksti on saavutettava nimi (V197) ∴ tämä on
// `title`, EI `aria-label` — ristiriitainen aria-label peittäisi näkyvän tekstin ruudunlukijalta.
const STATE_TITLE: Record<GpsControlState, string> = {
  pois: 'Näytä sijaintini kartalla',
  haetaan: 'Haetaan sijaintia — napauta peruuttaaksesi',
  seuraa: 'Kartta seuraa sijaintiasi — napauta sammuttaaksesi',
  vapaa: 'Sijainti näkyy — napauta keskittääksesi kartan siihen',
}

export function createGpsControl(opts: GpsControlOptions): GpsControl {
  const el = document.createElement('button')
  el.type = 'button'
  el.id = 'gps-control'
  el.className = 'gps-control'

  let state: GpsControlState = 'pois'

  const setState = (next: GpsControlState): void => {
    state = next
    el.textContent = gpsControlLabel(next)
    el.title = STATE_TITLE[next]
    // V294: `aria-pressed` = seuraako kartta. 'vapaa' = paikannus päällä mutta ei seurantaa
    // ∴ ei-painettu — muuten ruudunlukija kertoisi kartan seuraavan kun se ei seuraa.
    el.setAttribute('aria-pressed', String(next === 'seuraa'))
    Object.entries(STATE_CLASSES).forEach(([s, cls]) => el.classList.toggle(cls, s === next))
  }

  el.addEventListener('click', () => opts.onTap(gpsTapAction(state)))
  setState('pois')

  // Talkoolaisen karttamoodissa hero (`#segment-view`) kelluu alalaidassa. Kiinteä `46vh`-arvaus
  // jättäisi napin leijumaan keskelle ruutua kun hero on pieni ∴ mitataan todellinen korkeus.
  let ro: ResizeObserver | null = null
  const observeHero = (hero: Element | null): (() => void) => {
    ro?.disconnect()
    ro = null
    if (!hero || typeof ResizeObserver === 'undefined') {
      el.style.removeProperty('--gps-control-bottom')
      return () => {}
    }
    const apply = (): void => {
      const h = (hero as HTMLElement).offsetHeight
      // Hero voi olla piilotettu (koti-moodi) → 0 ⇒ oletusetäisyys alalaidasta.
      el.style.setProperty('--gps-control-bottom', h > 0 ? `${h + 16}px` : '')
    }
    ro = new ResizeObserver(apply)
    ro.observe(hero)
    apply()
    return () => { ro?.disconnect(); ro = null }
  }

  return {
    el,
    setState,
    observeHero,
    destroy: () => { ro?.disconnect(); ro = null; el.remove() },
  }
}
