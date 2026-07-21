// T183/V116: Durable write-outbox. Jokainen mutatoiva kirjoitus (POST/PUT/DELETE)
// merkeille ja pätkille reititetään tämän kautta: enqueue → yritä heti → 2xx poistaa,
// muu/verkkovirhe jättää jonoon localStorageen. Sivun päivitys EI kadota vahvistamatonta
// kirjoitusta — jono ladataan käynnistyksessä ja retrytään (startup / 'online' / backoff).
// Ei koskaan hiljainen kato (V115/V116, B82).

import { genId } from './uid'

export type OutboxMethod = 'POST' | 'PUT' | 'DELETE'

export interface OutboxEntry {
  id: string
  // Resurssin identiteetti (esim. 'marker:abc', 'segment:xyz'). Saman resurssin
  // kirjoitukset pidetään FIFO-järjestyksessä: jos aiempi epäonnistuu, myöhempiä
  // saman resurssin kirjoituksia ei yritetä ennen kuin edeltävä menee läpi.
  resourceKey: string
  method: OutboxMethod
  url: string
  body: string | null
  attempts: number
  createdAt: number
  // T187: valinnainen 2xx-vastauskuittaus (esim. POST reconcile). Ei persistoidu
  // (funktio katoaa JSON.stringifyssä) → toimii vain live-yrityksellä, ei reload-retryssä.
  onDelivered?: (responseText: string) => void
}

export interface EnqueueInput {
  resourceKey: string
  method: OutboxMethod
  url: string
  body?: string | null
  onDelivered?: (responseText: string) => void
}

interface Storageish {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface WriteOutboxOptions {
  storageKey?: string
  fetchFn?: typeof fetch
  storage?: Storageish
  // Kutsutaan kun yksittäinen kirjoitus ei saa 2xx-vastausta (näkyvä virhe UI:lle, V115).
  // `permanent`=true → pysyvä 4xx-virhe (esim. 403/400/404): entry on POISTETTU jonosta
  // (dead-letter), retryä ei tule. `permanent`=false → ohimenevä (verkko/5xx/401): jää jonoon.
  onFailure?: (entry: OutboxEntry, status: number | null, permanent: boolean) => void
  // Kutsutaan kun jonon koko muuttuu (pending-visuaali T185 voi kuunnella).
  onChange?: (pending: number) => void
}

const DEFAULT_KEY = 'karttamaster-outbox'

function makeId(): string {
  // T238/B103: yhteinen turva-apuri (guard + insecure-fallback). Ks. src/logic/uid.ts.
  return genId()
}

export class WriteOutbox {
  private queue: OutboxEntry[] = []
  private storageKey: string
  private fetchFn: typeof fetch
  private storage?: Storageish
  private onFailure?: (entry: OutboxEntry, status: number | null, permanent: boolean) => void
  private onChange?: (pending: number) => void
  private flushing = false

  constructor(opts: WriteOutboxOptions = {}) {
    this.storageKey = opts.storageKey ?? DEFAULT_KEY
    this.fetchFn = opts.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
    this.storage = opts.storage ?? safeLocalStorage()
    this.onFailure = opts.onFailure
    this.onChange = opts.onChange
    this.load()
  }

  // V14-pattern: korruptoitunut jono → varoitus + reset, ei kaadu.
  private load(): void {
    const raw = this.storage?.getItem(this.storageKey)
    if (!raw) {
      this.queue = []
      return
    }
    try {
      const parsed = JSON.parse(raw) as unknown
      this.queue = Array.isArray(parsed) ? (parsed as OutboxEntry[]).filter(isValidEntry) : []
      if (!Array.isArray(parsed)) throw new Error('not an array')
    } catch {
      console.warn('[write-outbox] korruptoitunut jono — nollataan')
      this.queue = []
      this.storage?.removeItem(this.storageKey)
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(this.queue))
    } catch {
      /* localStorage täynnä / ei saatavilla — jono pysyy muistissa */
    }
    this.onChange?.(this.queue.length)
  }

  pending(): number {
    return this.queue.length
  }

  // Tyhjennä jono (lähinnä testeille — singleton-tilan eristys testien välillä).
  clear(): void {
    this.queue = []
    this.persist()
  }

  // Resurssiavaimet joilla on vahvistamaton kirjoitus (pending-visuaalille, T185).
  pendingResourceKeys(): Set<string> {
    return new Set(this.queue.map((e) => e.resourceKey))
  }

  // Lisää kirjoitus jonoon, persistoi, ja yritä heti toimittaa TÄMÄ entry.
  // Palauttaa välittömän yrityksen tuloksen: kutsuja (esim. segment-sync) voi
  // näyttää heti virheen (V35/V93-banneri), mutta epäonnistunut kirjoitus jää
  // silti jonoon retryä varten (durability). 2xx → poistettu; muu → jonossa.
  async enqueue(input: EnqueueInput): Promise<{ delivered: boolean; status: number | null }> {
    const entry: OutboxEntry = {
      id: makeId(),
      resourceKey: input.resourceKey,
      method: input.method,
      url: input.url,
      body: input.body ?? null,
      attempts: 0,
      createdAt: Date.now(),
      ...(input.onDelivered ? { onDelivered: input.onDelivered } : {}),
    }
    this.queue.push(entry)
    this.persist()

    // Saman resurssin FIFO: jos edeltävä toimittamaton kirjoitus on jonossa,
    // älä hyppää sen ohi — tämä toimitetaan järjestyksessä flush():ssä.
    const older = this.queue.find((e) => e !== entry && e.resourceKey === entry.resourceKey)
    if (older) return { delivered: false, status: null }

    const status = await this.attemptEntry(entry)
    this.persist()
    return { delivered: isOk(status), status }
  }

  // Yritä toimittaa jonon kirjoitukset. FIFO; saman resurssin järjestys säilyy
  // (epäonnistunut resurssi blokkaa vain omat myöhemmät kirjoituksensa, ei muita).
  // 2xx poistaa entryn; muu/verkkovirhe säilyttää + kasvattaa attempts.
  async flush(): Promise<void> {
    if (this.flushing) return
    this.flushing = true
    try {
      const blocked = new Set<string>()
      // Iteroi kopio — käsittely muokkaa this.queueta.
      for (const entry of [...this.queue]) {
        if (!this.queue.includes(entry)) continue
        if (blocked.has(entry.resourceKey)) continue
        const status = await this.attemptEntry(entry)
        if (!isOk(status)) blocked.add(entry.resourceKey)
      }
      this.persist()
    } finally {
      this.flushing = false
    }
  }

  // Yksi toimitusyritys:
  //  - 2xx → poista jonosta.
  //  - pysyvä 4xx (403/400/404…) → POISTA jonosta (dead-letter) + onFailure(permanent=true).
  //    Retry ei koskaan korjaisi näitä → muuten jono "myrkyttyy" ja virhebanneri toistuu joka
  //    retry-kierroksella (B-lista3b). 401 EI ole pysyvä (uudelleenautentikointi voi korjata).
  //  - muu (verkko/5xx/401) → jää jonoon, kasvata attempts + onFailure(permanent=false).
  private async attemptEntry(entry: OutboxEntry): Promise<number | null> {
    const status = await this.tryDeliver(entry)
    if (isOk(status)) {
      this.remove(entry.id)
    } else if (isPermanent(status)) {
      this.remove(entry.id)
      entry.attempts += 1
      this.onFailure?.(entry, status, true)
    } else {
      entry.attempts += 1
      this.onFailure?.(entry, status, false)
    }
    return status
  }

  // Palauttaa HTTP-statuksen, tai null verkkovirheellä.
  private async tryDeliver(entry: OutboxEntry): Promise<number | null> {
    try {
      const init: RequestInit = { method: entry.method }
      if (entry.body !== null) {
        init.headers = { 'Content-Type': 'application/json' }
        init.body = entry.body
      }
      const res = await this.fetchFn(entry.url, init)
      // T187: reconcile 2xx-vastauksesta (esim. POST → palvelimen kanoniset kentät).
      if (res.ok && entry.onDelivered) {
        try { entry.onDelivered(await res.text()) } catch { /* reconcile ei saa kaataa toimitusta */ }
      }
      return res.status
    } catch {
      return null
    }
  }

  private remove(id: string): void {
    const i = this.queue.findIndex((e) => e.id === id)
    if (i >= 0) this.queue.splice(i, 1)
  }
}

function isOk(status: number | null): boolean {
  return status !== null && status >= 200 && status < 300
}

// Pysyvä client-virhe: retry ei koskaan onnistuisi → dead-letter. 401 (uudelleenauth) ja
// 408/425/429 (ohimenevä rate-limit/timeout) EIVÄT ole pysyviä; ne jäävät jonoon.
function isPermanent(status: number | null): boolean {
  if (status === null) return false
  if (status === 401 || status === 408 || status === 425 || status === 429) return false
  return status >= 400 && status < 500
}

function isValidEntry(e: unknown): e is OutboxEntry {
  if (!e || typeof e !== 'object') return false
  const o = e as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.resourceKey === 'string' &&
    (o.method === 'POST' || o.method === 'PUT' || o.method === 'DELETE') &&
    typeof o.url === 'string' &&
    (o.body === null || typeof o.body === 'string') &&
    typeof o.attempts === 'number'
  )
}

function safeLocalStorage(): Storageish | undefined {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* localStorage ei saatavilla (esim. SSR/test ilman jsdomia) */
  }
  return undefined
}
