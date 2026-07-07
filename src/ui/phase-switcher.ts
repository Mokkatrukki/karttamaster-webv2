import { getActivePhase, setActivePhase } from '../logic/phase-view'
import type { Segment } from '../logic/segments'

const PHASE_LABELS: Record<Segment['phase'], string> = {
  asettaminen: 'Asetus',
  tarkastus: 'Tarkastus',
  purku: 'Purku',
}

const PHASE_ORDER: Segment['phase'][] = ['asettaminen', 'tarkastus', 'purku']

// T148: globaali phase-näkymän vaihdin — vain järjestäjälle. Vapaa siirtymä mihin
// arvoon tahansa (ei rajoitettu ketju, eri asia kuin marker-status V92 transitiot).
export class PhaseSwitcher {
  private readonly select: HTMLSelectElement

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
    select.setAttribute('aria-label', 'Vaihda aktiivinen vaihe')
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
    select.value = getActivePhase()
    select.addEventListener('change', () => {
      const phase = select.value as Segment['phase']
      setActivePhase(phase)
      this.onChange(phase)
    })
    wrapper.appendChild(select)

    this.select = select
    container.appendChild(wrapper)
  }

  getValue(): Segment['phase'] {
    return this.select.value as Segment['phase']
  }
}
