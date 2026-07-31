// T450/V320 + T452/V335,V336 + T454/V338: KASAN JÄTTÖ — ohjerivi + vahvistus.
//
// (a) OHJERIVI place-modessa, heron sisällä. Pysyvä rivi ⊥ toast: talkoolaisella on hanskat,
//     aurinko ruudulla & kiire ∴ kolmen sekunnin toast on ohje jota ⊥ ehdi lukea. "Peruuta" on
//     SAMASSA paikassa koko tilan ajan — peruutusta ⊥ pidä etsiä kun kartalla on jo väärä tila.
//     Autolla-saavutettavuus on OHJAUS ⊥ portti (§C): GPX-reitit ovat MTB-uria & ajokelpoisuudesta
//     ⊥ ole dataa ∴ sovellus ⊥ VOI tietää mikä piste on auton saavutettavissa. Ihminen tietää.
//
// (b) VAHVISTUS on PALKKI SAMASSA PAIKASSA KUIN OHJE ⊥ modaali (T454/V338, B187). Modaali peitti
//     kartan täsmälleen sillä hetkellä kun käyttäjän piti tarkistaa SIJAINTI — ainoa asia jota
//     vahvistus oli olemassa tarkistamaan. Palkki elää heron ylälaidassa & kartta pisteineen jää
//     näkyviin ∴ "tähän" on katsottavissa koko ajan. Kaksi ulospääsyä riittää: sijainnin siirto
//     ⊥ ole nappi vaan kartan napautus/raahaus (piste on jo ruudulla), ∴ "Siirrä sijaintia"
//     poistui — nappi joka toistaa sen mitä kartta jo tekee on kolmas asia opeteltavaksi.
//
// DOM ilman Leafletia → Vitest-jsdom.

import { buildPileContentsList } from './pile-contents'
import { formatPileDistance, formatPileSummary } from '../logic/pile-list'
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
  /** Kasa syntyy siihen mihin piste jäi. */
  onConfirm(): void
  /** Merkit jäävät keräyslistalle & kasaa ⊥ synny. */
  onCancel(): void
}

export interface PileConfirmBarHandle {
  /** Etäisyyslukema seuraa pistettä — napautus & raahaus siirtävät sitä vahvistuksen aikana. */
  setDistance(distanceM: number | null): void
  remove(): void
}

/**
 * "Jätetäänkö kasa tähän?" heron ylälaidassa, kartta näkyvissä. Palauttaa ohjaimen: kutsuja
 * päivittää etäisyyden kun piste liikkuu & purkaa palkin kun tila päättyy.
 *
 * ⊥ Esc-kuuntelijaa & ⊥ taustaa: palkki ⊥ ole modaali eikä se vangitse mitään ∴ ainoa tapa
 * poistua on nappi jonka käyttäjä näkee (V334-henki: vahinkoklikki ⊥ saa hävittää työtä —
 * tässä työ on kerätyt merkit joita kasa on kirjaamassa).
 */
export function openPileConfirmBar(
  host: HTMLElement,
  contents: SignMarker[],
  actions: PileConfirmActions,
  distanceM: number | null = null,
): PileConfirmBarHandle {
  removePileConfirmBar(host)

  let settled = false
  // Portti on `settled` ⊥ elementin olemassaolo: irrotettu nappi kantaa yhä kuuntelijansa
  // ∴ tuplanapautus (hanskat!) loisi kaksi kasaa jos vain DOM ratkaisisi.
  const finish = (fn: () => void): void => {
    if (settled) return
    settled = true
    bar.remove()
    fn()
  }

  const bar = document.createElement('div')
  bar.className = 'pile-confirm-bar'

  const lead = document.createElement('p')
  lead.className = 'pile-confirm-bar-lead'
  lead.textContent = 'Jätetäänkö kasa tähän? Siirrä napauttamalla karttaa tai raahaamalla pistettä.'

  const meta = document.createElement('p')
  meta.className = 'pile-confirm-bar-meta'

  const renderMeta = (m: number | null): void => {
    const dist = formatPileDistance(m)
    // Etäisyys ⊥ arvata: ilman fixiä lukemaa ⊥ ole & tyhjä on rehellisempi kuin "0 m".
    meta.textContent = dist
      ? `${formatPileSummary(contents.length)} · ${dist} sinusta`
      : formatPileSummary(contents.length)
  }
  renderMeta(distanceM)

  // Sisältö on kasan LUPAUS toiselle porukalle ∴ se ! olla tarkistettavissa — mutta kartta on
  // se pinta jota napautetaan (B184) ∴ lista aukeaa pyydettäessä, ⊥ työnnä karttaa pois.
  const details = document.createElement('details')
  details.className = 'pile-confirm-bar-contents'
  const summary = document.createElement('summary')
  summary.textContent = 'Näytä sisältö'
  details.append(summary, buildPileContentsList(contents))

  const actionRow = document.createElement('div')
  actionRow.className = 'pile-confirm-bar-actions'

  const confirm = document.createElement('button')
  confirm.type = 'button'
  confirm.className = 'btn btn--confirm pile-confirm-ok'
  confirm.textContent = 'Vahvista'
  confirm.addEventListener('click', () => finish(actions.onConfirm))

  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'btn btn--ghost pile-confirm-cancel'
  cancel.textContent = 'Peruuta'
  cancel.addEventListener('click', () => finish(actions.onCancel))

  actionRow.append(confirm, cancel)
  bar.append(lead, meta, details, actionRow)
  host.prepend(bar)
  panelEl()?.classList.add(PLACING_CLASS)

  return {
    setDistance: renderMeta,
    remove: () => {
      settled = true
      bar.remove()
    },
  }
}

export function removePileConfirmBar(host: HTMLElement): void {
  host.querySelector('.pile-confirm-bar')?.remove()
}
