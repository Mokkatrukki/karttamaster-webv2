// T371/V267: left-panelin section-headerin AINOA toteutus.
//
// V61 kirjasi patternin (`[▼/▶] [Nimi] [(count)]`) mutta ei kapseloinut sitä ∴ se rapautui
// kolmeksi eri toteutukseksi: sign-library-panel innerHTML-templatella, segment-panel
// createElementillä, area-panel createElementillä + inline `style.cssText`illä. Neljäs osio
// (Huomiot) jäi kokonaan ilman haitaria. Kapseloimaton pattern maksoi kahdesti: area-panel
// keksi oman `.section-toggle-icon`-luokan jota ei ole style.css:ssä ⇒ tyylit oli pakko
// upottaa elementtiin (teemanvaihto ei tavoita `style`-attribuuttia), ja `role="button"`
// jäi ilman näppäimistökuuntelijaa kolmesti.
//
// Tuottaa täsmälleen sen DOM:n jolle CSS jo on (`style.css` .left-panel-section-header).
// Puhdas DOM — ei Leafletia, ei moduulitilaa → Vitest-jsdom.

export interface SectionHeaderOptions {
  /** Osion nimi, esim. `Alueet`. Kuluttaja voi upottaa laskurin nimeen (`setName`). */
  name: string
  /** Alkutila. `true` → ▶ ja `aria-expanded="false"`. */
  collapsed: boolean
  /** Laskurin alkuteksti, esim. `(0)`. Pois jätettynä count-spania ei renderöidä. */
  count?: string
  /** Lisäluokka count-spanille — kuluttajan testit/CSS nojaavat omiin luokkiinsa. */
  countClass?: string
  /** Lisäluokka toggle-spanille, samasta syystä. */
  toggleClass?: string
  onToggle: () => void
}

export interface SectionHeader {
  el: HTMLElement
  /** Päivittää toggle-ikonin JA `aria-expanded`in — kaksi ilmaisua, yksi kutsu. */
  setCollapsed(collapsed: boolean): void
  setName(text: string): void
  /** Luo count-spanin tarvittaessa (paneeli voi aloittaa ilman lukua). */
  setCount(text: string): void
}

export function createSectionHeader(opts: SectionHeaderOptions): SectionHeader {
  const el = document.createElement('div')
  el.className = 'left-panel-section-header'
  el.setAttribute('role', 'button')
  el.setAttribute('tabindex', '0')

  const toggleEl = document.createElement('span')
  toggleEl.className = 'section-header-toggle'
  if (opts.toggleClass) toggleEl.classList.add(opts.toggleClass)

  const nameEl = document.createElement('span')
  nameEl.className = 'section-header-name'
  nameEl.textContent = opts.name

  el.append(toggleEl, nameEl)

  let countEl: HTMLElement | null = null
  const ensureCount = (): HTMLElement => {
    if (!countEl) {
      countEl = document.createElement('span')
      countEl.className = 'section-header-count'
      if (opts.countClass) countEl.classList.add(opts.countClass)
      el.appendChild(countEl)
    }
    return countEl
  }
  if (opts.count !== undefined) ensureCount().textContent = opts.count

  const applyCollapsed = (collapsed: boolean): void => {
    toggleEl.textContent = collapsed ? '▶' : '▼'
    el.setAttribute('aria-expanded', String(!collapsed))
  }
  applyCollapsed(opts.collapsed)

  el.addEventListener('click', () => opts.onToggle())
  // `role="button"` lupaa näppäimistökäytön — ilman tätä lupaus on valhe kaikissa osioissa.
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault() // Space scrollaisi sivupalkin alta
    opts.onToggle()
  })

  return {
    el,
    setCollapsed: applyCollapsed,
    setName: (text) => { nameEl.textContent = text },
    setCount: (text) => { ensureCount().textContent = text },
  }
}
