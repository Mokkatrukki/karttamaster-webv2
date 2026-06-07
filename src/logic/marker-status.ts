import type { MarkerStatus } from './types'

export type { MarkerStatus }

export type StatusAction = 'aseta' | 'ohita' | 'tarkista' | 'kerää' | 'peru'

const TRANSITIONS: Record<MarkerStatus, Partial<Record<StatusAction, MarkerStatus>>> = {
  suunniteltu: {
    aseta: 'asetettu',
    ohita: 'ei_tarpeen',
  },
  asetettu: {
    tarkista: 'tarkistettu',
    peru: 'suunniteltu',
  },
  tarkistettu: {
    kerää: 'kerätty',
    peru: 'asetettu',
  },
  kerätty: {},
  ei_tarpeen: {
    peru: 'suunniteltu',
  },
}

export function canTransition(status: MarkerStatus, action: StatusAction): boolean {
  return action in TRANSITIONS[status]
}

export function transitionStatus(status: MarkerStatus, action: StatusAction): MarkerStatus {
  const next = TRANSITIONS[status][action]
  if (next === undefined) throw new Error(`Virheellinen siirtymä: ${status} + ${action}`)
  return next
}

export function validActions(status: MarkerStatus): StatusAction[] {
  return Object.keys(TRANSITIONS[status]) as StatusAction[]
}

export function isTerminal(status: MarkerStatus): boolean {
  return Object.keys(TRANSITIONS[status]).length === 0
}

export const DEFAULT_STATUS: MarkerStatus = 'suunniteltu'
