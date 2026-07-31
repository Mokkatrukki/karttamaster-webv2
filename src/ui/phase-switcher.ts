import { getActivePhase, getViewPhase, setViewPhase, isViewingOtherPhase } from '../logic/phase-view'
import { PHASE_ORDER, PHASE_LABELS } from '../logic/phase-labels'
import type { Segment } from '../logic/segments'
import { syncPhaseIndicator } from './phase-indicator'

// T148 → T434/V321: tämä on KATSELUSUODIN, ⊥ komento.
//
// Ennen: jokainen valinta kirjoitti `PUT /api/phase` ∴ järjestäjä ⊥ voinut katsoa purkupätkiä
// siirtämättä koko talkooporukkaa purkuun — & sitä ⊥ voinut perua katsomatta. Nyt valinta elää
// järjestäjän omassa `localStorage`ssa: ⊥ verkkokutsua ∴ ⊥ epäonnistumispolkua & ⊥ bannerin
// tarvetta (vanha peruutus+virheilmoitus siirtyi admin-paneeliin, T433).
//
// PILLERI ON SÄÄNNÖN AINOA AISTI: ilman näkyvää "katselet X · käynnissä Y" järjestäjä luulee
// vaihtaneensa vaiheen kaikille — juuri se väärinkäsitys josta V321 syntyi. Klikkaus palauttaa
// katselun käynnissä olevaan vaiheeseen.
export class PhaseSwitcher {
  private readonly select: HTMLSelectElement
  private readonly pill: HTMLButtonElement

  constructor(
    container: HTMLElement,
    private readonly onChange: (phase: Segment['phase']) => void,
  ) {
    const wrapper = document.createElement('div')
    wrapper.className = 'phase-switcher'

    const label = document.createElement('span')
    label.className = 'phase-switcher-label'
    label.textContent = 'Vaihe:'
    wrapper.appendChild(label)

    const select = document.createElement('select')
    select.className = 'phase-switcher-select'
    select.setAttribute('aria-label', 'Vaihda katseltava vaihe')
    // T180/B80: dokumentti-tason ulkoklikki-sulkija (map-init.ts) ei saa
    // katkaista natiivin pudotusvalikon avausta/valintaa kesken.
    select.addEventListener('mousedown', e => e.stopPropagation())
    select.addEventListener('click', e => e.stopPropagation())
    for (const phase of PHASE_ORDER) {
      const option = document.createElement('option')
      option.value = phase
      option.textContent = PHASE_LABELS[phase]
      select.appendChild(option)
    }
    select.value = getViewPhase()
    select.addEventListener('change', () => {
      setViewPhase(select.value as Segment['phase'])
      // T443/V329: katseluvaihe on järjestäjän vaihelähde ∴ aksentti & nimi seuraavat sitä.
      syncPhaseIndicator()
      this.syncPill()
      this.onChange(getViewPhase())
    })
    wrapper.appendChild(select)

    const pill = document.createElement('button')
    pill.type = 'button'
    pill.className = 'phase-switcher-pill'
    pill.hidden = true
    pill.addEventListener('mousedown', e => e.stopPropagation())
    pill.addEventListener('click', e => {
      e.stopPropagation()
      setViewPhase(getActivePhase())
      select.value = getViewPhase()
      syncPhaseIndicator()
      this.syncPill()
      this.onChange(getViewPhase())
    })
    wrapper.appendChild(pill)

    this.select = select
    this.pill = pill
    this.syncPill()
    container.appendChild(wrapper)
  }

  private syncPill(): void {
    if (!isViewingOtherPhase()) {
      this.pill.hidden = true
      return
    }
    this.pill.hidden = false
    this.pill.textContent = `Katselet: ${PHASE_LABELS[getViewPhase()]} · käynnissä: ${PHASE_LABELS[getActivePhase()]} — palaa`
    this.pill.title = 'Katselet muuta kuin käynnissä olevaa vaihetta. Tämä näkyy vain sinulle. Klikkaa palataksesi.'
  }

  getValue(): Segment['phase'] {
    return this.select.value as Segment['phase']
  }
}
