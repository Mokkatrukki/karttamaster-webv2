// T450/V320: KASAN JÄTTÖ — ohjelaatikko + vahvistus.
//
// (a) OHJELAATIKKO place-modessa. Iso laatikko, ⊥ pieni toast: talkoolaisella on hanskat,
//     aurinko ruudulla & kiire ∴ kolmen sekunnin toast on ohje jota ⊥ ehdi lukea. "Peruuta" on
//     SAMASSA paikassa koko tilan ajan — peruutusta ⊥ pidä etsiä kun kartalla on jo väärä tila.
//     Autolla-saavutettavuus on OHJAUS ⊥ portti (§C): GPX-reitit ovat MTB-uria & ajokelpoisuudesta
//     ⊥ ole dataa ∴ sovellus ⊥ VOI tietää mikä piste on auton saavutettavissa. Ihminen tietää.
//
// (b) VAHVISTUS sijainnin valinnan jälkeen. Kasa on lupaus toiselle porukalle ("tule tänne,
//     täällä on nämä") ∴ se ! olla tarkistettavissa ennen kuin se lähtee. Kolme ulospääsyä:
//     Vahvista (kasa syntyy), Siirrä sijaintia (takaisin karttaan), Peruuta (merkit jäävät
//     keräyslistalle & kasaa ⊥ synny — ⊥ tyhjää kasaa jäljelle).
//
// DOM ilman Leafletia → Vitest-jsdom.

import { buildPileContentsList } from './pile-contents'
import { createBackdrop, registerEscClose } from './modal-helpers'
import type { SignMarker } from '../logic/types'

const HINT_TEXT = 'Valitse paikka josta kasan voi hakea autolla — tienvarsi, risteys tai muu ajettava kohta.'

/**
 * Ohjelaatikko place-modeen. Palauttaa poistofunktion — kutsuja purkaa sen kun tila päättyy
 * (⊥ oma document-kuuntelija: laatikon elinkaari on sijoitustilan elinkaari, ⊥ oma).
 */
export function showPilePlaceHint(host: HTMLElement, onCancel: () => void): () => void {
  removePilePlaceHint(host)

  const box = document.createElement('div')
  box.className = 'pile-place-hint'

  const title = document.createElement('p')
  title.className = 'pile-place-hint-title'
  title.textContent = '📦 Mihin kasa jää?'

  const text = document.createElement('p')
  text.className = 'pile-place-hint-text'
  text.textContent = HINT_TEXT

  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'btn pile-place-hint-cancel'
  cancel.textContent = 'Peruuta'
  cancel.addEventListener('click', () => {
    remove()
    onCancel()
  })

  box.append(title, text, cancel)
  host.prepend(box)

  const remove = (): void => box.remove()
  return remove
}

export function removePilePlaceHint(host: HTMLElement): void {
  host.querySelector('.pile-place-hint')?.remove()
}

export interface PileConfirmActions {
  /** Kasa syntyy tähän sijaintiin. */
  onConfirm(): void
  /** Takaisin place-modeen — kasaa ⊥ vielä ole. */
  onRelocate(): void
  /** Merkit jäävät keräyslistalle & kasaa ⊥ synny. */
  onCancel(): void
}

/**
 * "Jätetäänkö kasa tähän?" — sisältölista + kolme ulospääsyä. Sulkeminen taustasta/Esc:llä on
 * PERUUTUS: puoliksi tehty kasa olisi tila jota kukaan ⊥ ole valinnut.
 */
export function openPileConfirm(contents: SignMarker[], actions: PileConfirmActions): () => void {
  let settled = false
  const close = (): void => {
    if (settled) return
    settled = true
    unregEsc()
    backdrop.remove()
  }
  // Portti on `settled` ⊥ elementin olemassaolo: irrotettu nappi kantaa yhä kuuntelijansa
  // ∴ tuplanapautus (hanskat!) loisi kaksi kasaa jos vain DOM ratkaisisi.
  const finish = (fn: () => void): void => {
    if (settled) return
    close()
    fn()
  }

  const backdrop = createBackdrop('modal-backdrop pile-confirm-backdrop', () => finish(actions.onCancel))
  const unregEsc = registerEscClose(() => finish(actions.onCancel))

  const modal = document.createElement('div')
  modal.className = 'modal pile-confirm'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')

  const title = document.createElement('h2')
  title.className = 'pile-confirm-title'
  title.textContent = 'Jätetäänkö kasa tähän?'
  modal.appendChild(title)

  modal.appendChild(buildPileContentsList(contents))

  const actionRow = document.createElement('div')
  actionRow.className = 'pile-confirm-actions'

  const confirm = document.createElement('button')
  confirm.type = 'button'
  confirm.className = 'btn btn--confirm pile-confirm-ok'
  confirm.textContent = 'Vahvista'
  confirm.addEventListener('click', () => finish(actions.onConfirm))

  const relocate = document.createElement('button')
  relocate.type = 'button'
  relocate.className = 'btn pile-confirm-relocate'
  relocate.textContent = 'Siirrä sijaintia'
  relocate.addEventListener('click', () => finish(actions.onRelocate))

  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'btn btn--ghost pile-confirm-cancel'
  cancel.textContent = 'Peruuta'
  cancel.addEventListener('click', () => finish(actions.onCancel))

  actionRow.append(confirm, relocate, cancel)
  modal.appendChild(actionRow)

  backdrop.appendChild(modal)
  document.body.appendChild(backdrop)
  return close
}
