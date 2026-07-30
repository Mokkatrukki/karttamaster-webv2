import { createBackdrop, registerEscClose } from './modal-helpers'
import { buildMarkerVisual } from './marker-visual-row'
import { markerLabel } from './segment-hero'
import type { SignMarker } from '../logic/types'

// T416/V306: RAJOITETTU lehtinen himmennetylle merkille. Tämä EI ole MarkerDetailModal karsittuna
// — se on eri pinta eri oikeuksilla: detail-modaalissa on ohjekenttä, siirto & statuskuittaus,
// joita talkoolainen ⊥ omista vieraalla merkillä (V150/V93). Lehtinen sisältää TASAN kaksi
// nappia (VISION §Talkoolainen "max 2 nappia") ∴ mitään muokkauspintaa ⊥ voi vahingossa vuotaa
// tänne: jos tähän lisätään kolmas toiminto, V306 on rikottu.

export interface MarkerClaimSheet {
  open(marker: SignMarker, segmentName: string): void
  close(): void
  isOpen(): boolean
}

export function createMarkerClaimSheet(onClaim: (markerId: string) => void): MarkerClaimSheet {
  let current: SignMarker | null = null
  let unbindEsc: (() => void) | null = null

  const backdrop = createBackdrop('marker-claim-backdrop', () => close())
  const sheet = document.createElement('div')
  sheet.className = 'marker-claim-sheet'
  sheet.setAttribute('role', 'dialog')
  sheet.setAttribute('aria-modal', 'true')
  backdrop.appendChild(sheet)

  function close(): void {
    current = null
    backdrop.remove()
    unbindEsc?.()
    unbindEsc = null
  }

  function open(marker: SignMarker, segmentName: string): void {
    current = marker
    sheet.innerHTML = ''

    const head = document.createElement('div')
    head.className = 'marker-claim-head'
    head.appendChild(buildMarkerVisual(marker, { size: 40, zoomable: false }))
    const titles = document.createElement('div')
    titles.className = 'marker-claim-titles'
    const name = document.createElement('p')
    name.className = 'marker-claim-name'
    name.textContent = markerLabel(marker)
    const meta = document.createElement('p')
    meta.className = 'marker-claim-meta'
    // Vieras merkki ⊥ ole "sinun" ∴ lehtinen kertoo mihin se on menossa — nimetty kohde estää
    // "lisäsin jonnekin" -tunteen kentällä.
    meta.textContent = `Ei kuulu tehtävääsi — lisätään tehtävään "${segmentName}"`
    titles.append(name, meta)
    head.appendChild(titles)

    const actions = document.createElement('div')
    actions.className = 'marker-claim-actions'
    const claim = document.createElement('button')
    claim.type = 'button'
    claim.className = 'btn btn--confirm marker-claim-confirm'
    claim.textContent = '➕ Lisää tehtävääni'
    claim.addEventListener('click', () => {
      const id = current?.id
      close()
      if (id) onClaim(id)
    })
    const dismiss = document.createElement('button')
    dismiss.type = 'button'
    dismiss.className = 'btn btn--secondary marker-claim-close'
    dismiss.textContent = 'Sulje'
    dismiss.addEventListener('click', () => close())
    actions.append(claim, dismiss)

    sheet.append(head, actions)
    document.body.appendChild(backdrop)
    // Esc-sulkeminen omana kuuntelijana (⊥ main.ts:n ketjussa): lehtinen on hetkellinen &
    // päällimmäinen pinta ∴ sillä ⊥ ole kilpailijaa samasta näppäimestä.
    unbindEsc = registerEscClose(() => close())
    claim.focus()
  }

  return { open, close, isOpen: () => current !== null }
}
