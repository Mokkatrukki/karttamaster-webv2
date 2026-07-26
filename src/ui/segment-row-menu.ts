import { createBackdrop, registerEscClose } from './modal-helpers'

// T345/V250: pätkärivin `···`-pikavalikko. Ennen tätä `···` avasi suoraan lisätiedot-modaalin
// ∴ jokainen kevyt katselutoiminto (zoomaa pätkään, korosta se) maksoi modaalin avaamisen,
// vierityksen ja sulkemisen. Valikko on välitila: modaali on yhä yhden klikin päässä, mutta
// katselutoiminnot eivät enää kulje sen kautta.
//
// Ei omaa tilaa: korostuksen päällä/pois LUETAAN wiringistä (`isFocused`) — sama tila kuin
// modaalin kytkimellä (T335), ⊥ omaa lippua joka ajautuisi erilleen.

export interface SegmentRowMenuActions {
  /** Rajaa kartta tähän pätkään. */
  onShowOnMap?: () => void
  /** Onko korostus päällä juuri tälle pätkälle (T335-tila). */
  isFocused?: () => boolean
  /** Kytke korostus päälle/pois. */
  onToggleFocus?: (on: boolean) => void
  /** Talkoolaislinkki (`/s/<slug>`) tai null jos pätkää ei ole jaettu. */
  shareUrl?: string | null
  /** Avaa lisätiedot & varusteet -modaali. */
  onOpenDetails: () => void
  /** Näkyvä palaute (esim. "Linkki kopioitu"). */
  onNotify?: (msg: string) => void
}

export interface SegmentRowMenuHandle {
  close(): void
}

interface MenuRow {
  label: string
  onSelect: () => void
  pressed?: boolean
}

export function segmentRowMenuRows(actions: SegmentRowMenuActions): MenuRow[] {
  const rows: MenuRow[] = []
  if (actions.onShowOnMap) {
    rows.push({ label: '🔍 Näytä kartalla', onSelect: actions.onShowOnMap })
  }
  if (actions.onToggleFocus) {
    const on = actions.isFocused?.() ?? false
    rows.push({
      label: on ? '◉ Korostus päällä' : '◎ Korosta vain tämä pätkä',
      pressed: on,
      onSelect: () => actions.onToggleFocus?.(!on),
    })
  }
  // V250-linja: rivi näkyy VAIN kun se voi tehdä jotain. Disabloitu "Kopioi linkki" jaakamattomalle
  // pätkälle olisi arvoitus ("miksi harmaa?") — assign tehdään lisätiedoissa.
  if (actions.shareUrl) {
    const url = actions.shareUrl
    rows.push({
      label: '🔗 Kopioi talkoolaislinkki',
      onSelect: () => {
        navigator.clipboard?.writeText(`${window.location.origin}${url}`)
          .then(() => actions.onNotify?.('Linkki kopioitu'))
          .catch(() => actions.onNotify?.('Kopiointi ei onnistunut'))
      },
    })
  }
  rows.push({ label: '⚙ Lisätiedot & varusteet…', onSelect: actions.onOpenDetails })
  return rows
}

export function openSegmentRowMenu(
  anchor: HTMLElement,
  actions: SegmentRowMenuActions,
): SegmentRowMenuHandle {
  // Sama sulkemiskuvio kuin modaaleilla (`modal-helpers`): läpinäkyvä backdrop nappaa ulkoklikin,
  // `registerEscClose` Escin. ⊥ omaa document-kuuntelijaa — kaksi kuviota vuotaisi eri tavoin.
  const backdrop = createBackdrop('segment-row-menu-backdrop', () => close())
  const menu = document.createElement('div')
  menu.className = 'segment-row-menu'
  menu.setAttribute('role', 'menu')

  let unregEsc: (() => void) | null = null
  const close = (): void => {
    backdrop.remove()
    unregEsc?.()
    unregEsc = null
    anchor.setAttribute('aria-expanded', 'false')
  }

  for (const row of segmentRowMenuRows(actions)) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'segment-row-menu-item'
    btn.setAttribute('role', 'menuitem')
    btn.textContent = row.label
    if (row.pressed !== undefined) btn.setAttribute('aria-pressed', String(row.pressed))
    btn.addEventListener('click', () => {
      // Sulje ENSIN: valinta voi avata modaalin, ja valikko sen päällä olisi orpo kerros.
      close()
      row.onSelect()
    })
    menu.appendChild(btn)
  }

  backdrop.appendChild(menu)
  document.body.appendChild(backdrop)

  // Ankkurointi napin alle. Kiinteä sijoitus (backdrop on `position:fixed`) ∴ viewport-koordinaatit
  // riittävät; oikea reuna clampataan ettei valikko valu ruudun ulkopuolelle kapealla ikkunalla.
  const r = anchor.getBoundingClientRect()
  menu.style.top = `${Math.round(r.bottom + 4)}px`
  menu.style.left = `${Math.round(Math.max(8, r.right - menu.offsetWidth))}px`

  anchor.setAttribute('aria-expanded', 'true')
  unregEsc = registerEscClose(() => close())
  menu.querySelector<HTMLElement>('.segment-row-menu-item')?.focus()

  return { close }
}
