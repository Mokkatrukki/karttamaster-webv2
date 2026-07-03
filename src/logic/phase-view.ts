import type { Segment } from './segments'

const LS_KEY = 'karttamaster-active-phase'

const VALID_PHASES: Segment['phase'][] = ['asettaminen', 'tarkastus', 'purku']

// T148: globaali näkymäsuodin järjestäjälle — vapaa siirtymä mihin arvoon tahansa,
// ei rajoitettu ketju (eri asia kuin marker-status V92 transitiot).
export function getActivePhase(): Segment['phase'] {
  const stored = localStorage.getItem(LS_KEY)
  return VALID_PHASES.includes(stored as Segment['phase']) ? (stored as Segment['phase']) : 'asettaminen'
}

export function setActivePhase(phase: Segment['phase']): void {
  localStorage.setItem(LS_KEY, phase)
}
