// T183/V116: Jaettu WriteOutbox-singleton. MarkerManager ja segment-sync reitittävät
// kaikki mutatoivat kirjoitukset tämän kautta → yksi durable jono, yksi retry-silmukka.
import { WriteOutbox, type OutboxEntry } from './write-outbox'

let saveErrorHandler: ((msg: string) => void) | null = null
let changeHandler: ((keys: Set<string>) => void) | null = null

// UI (main.ts) rekisteröi käsittelijän näkyvälle virheelle (V115) ja pending-tilalle (V117/T185).
export function setOutboxSaveErrorHandler(h: (msg: string) => void): void {
  saveErrorHandler = h
}
export function setOutboxChangeHandler(h: (keys: Set<string>) => void): void {
  changeHandler = h
}

function failureMessage(status: number | null): string {
  const suffix = status ? ` (${status})` : ''
  return `⚠ Tallennus epäonnistui${suffix} — yritetään automaattisesti uudelleen`
}

export const outbox = new WriteOutbox({
  onFailure: (_entry: OutboxEntry, status: number | null) => {
    saveErrorHandler?.(failureMessage(status))
  },
  onChange: () => {
    changeHandler?.(outbox.pendingResourceKeys())
  },
})

// Retry-triggerit: käynnistys, verkko takaisin, periodinen backoff.
// Kutsutaan kerran main.ts:n init-vaiheessa.
let started = false
export function startOutboxRetry(): void {
  if (started) return
  started = true
  // Käynnistyksessä: yritä toimittaa edellisen session vahvistamattomat kirjoitukset.
  void outbox.flush()
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void outbox.flush())
    // Periodinen retry (esim. 30s) — kattaa tapaukset joissa 'online' ei laukea
    // (sessio palautui, palvelin heräsi fly auto-startilla).
    setInterval(() => {
      if (outbox.pending() > 0) void outbox.flush()
    }, 30_000)
  }
}
