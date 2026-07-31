// T450/V320 + T452/V335,V336: KASAN JÄTTÖ — ohjerivi + vahvistus.
//
// (a) OHJERIVI place-modessa, heron sisällä. Pysyvä rivi ⊥ toast: talkoolaisella on hanskat,
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

// T452/B184: YKSI rivi ⊥ kolmirivinen laatikko. T450 mitoitti ohjeen LUKEMISEN ehdoilla; mitta
// ! tulla siitä mitä ohje ohjeistaa — kartta on se pinta jota napautetaan ∴ ohje joka työntää
// kartan ruudun ulkopuolelle kumoaa itsensä (390×844: hero 46vh + laatikko = kartta pois).
const HINT_TEXT = '📦 Napauta kohta josta kasan voi hakea autolla'

// Sijoitustilan ajan kasanappi piiloon (T452c): tila on jo päällä ∴ toinen painallus olisi
// uusi kasa. Luokka elää heron kortilla, ⊥ napissa — napin oma `hidden` kuuluu renderPileBtn:lle
// & kaksi kirjoittajaa samaan lippuun on se kohta jossa nappi jää piiloon tilan jälkeen.
const PLACING_CLASS = 'is-placing-pile'

function panelEl(): HTMLElement | null {
  return document.getElementById('segment-view')
}

/**
 * Ohjerivi place-modeen. Palauttaa poistofunktion — kutsuja purkaa sen kun tila päättyy
 * (⊥ oma document-kuuntelija: rivin elinkaari on sijoitustilan elinkaari, ⊥ oma).
 *
 * V336: `host` ! olla `pointer-events:auto`-kerroksessa. Karttamoodissa `#segment-view-container`
 * on `pointer-events:none` & vain `#segment-view` palauttaa syötteen ∴ kutsuja antaa panelin
 * (B183: nappi näkyi & oli kuollut — pahempi kuin puuttuva nappi, koska se ohjaa yrittämään
 * uudelleen). Rivi asettuu heron NAVIGAATIO-osan yläreunaan, ⊥ kartan päälle.
 */
export function showPilePlaceHint(host: HTMLElement, onCancel: () => void): () => void {
  removePilePlaceHint(host)

  const box = document.createElement('div')
  box.className = 'pile-place-hint'

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

  box.append(text, cancel)
  host.prepend(box)
  panelEl()?.classList.add(PLACING_CLASS)

  const remove = (): void => {
    box.remove()
    panelEl()?.classList.remove(PLACING_CLASS)
  }
  return remove
}

export function removePilePlaceHint(host: HTMLElement): void {
  host.querySelector('.pile-place-hint')?.remove()
  panelEl()?.classList.remove(PLACING_CLASS)
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
