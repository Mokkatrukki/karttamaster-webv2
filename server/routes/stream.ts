import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth } from '../middleware/auth'
import { subscribeChanges, currentRev, type ChangeEvent } from '../events'

export const streamRoutes = new Hono<AuthEnv>()

// T446/V330: heartbeat pitää yhteyden auki välityspalvelimien läpi (fly, mobiiliverkon NAT).
// 25 s < tyypillinen 30–60 s idle-timeout. Kommenttirivi (`:`) ⊥ ole tapahtuma ∴ client ei
// näe sitä lainkaan — data-hinta on ~2 tavua / 25 s ≈ 0,3 kt/h eli mitättömä verrattuna
// yhteen /api/markers-hakuun (kymmeniä kilotavuja). Akku: yhteys on idle, ⊥ herätä radiota
// omasta aloitteestaan kuten pollaus tekee — SSE on siis akun kannalta HALVEMPI kuin
// tiheämpi pollaus, ei kalliimpi (T446(d)).
const HEARTBEAT_MS = Number(process.env.SSE_HEARTBEAT_MS ?? 25_000)

/**
 * GET /api/stream — SSE-heräteväylä (V330).
 *
 * Lähettää `event: change`, `data: {"type","id","rev"}`. **Payload ⊥ sisällä dataa** vaan
 * kehottaa clientin hakemaan REST:llä — kaksi kanavaa samasta rivistä tuottaisi osittaisen
 * totuuden. Reconnect on selaimen (`EventSource`) ∴ täällä ⊥ ole backoffia; `retry:`-vihje
 * annetaan kerran avauksessa.
 */
streamRoutes.get('/', requireAuth(), (c) =>
  streamSSE(c, async (stream) => {
    let closed = false
    let wake: (() => void) | null = null
    const queue: ChangeEvent[] = []

    const unsubscribe = subscribeChanges((e) => {
      queue.push(e)
      wake?.()
    })

    stream.onAbort(() => {
      closed = true
      unsubscribe()
      wake?.()
    })

    try {
      // Lähtötaso: client tietää mistä revistä se on ajan tasalla ilman erillistä hakua.
      // `retry` on vihje selaimen omalle reconnectille — ⊥ oma koneisto (T446(c)).
      await stream.writeSSE({
        event: 'hello',
        data: JSON.stringify({ rev: currentRev() }),
        retry: 5000,
      })

      while (!closed && !stream.aborted && !stream.closed) {
        while (queue.length > 0) {
          const e = queue.shift()!
          await stream.writeSSE({ event: 'change', data: JSON.stringify(e), id: String(e.rev) })
        }
        if (closed || stream.aborted) break

        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            wake = null
            resolve()
          }, HEARTBEAT_MS)
          wake = () => {
            wake = null
            clearTimeout(timer)
            resolve()
          }
        })

        if (!closed && !stream.aborted && queue.length === 0) {
          // Kommenttirivi = keep-alive. `writeSSE` ei osaa kommenttia ∴ raakakirjoitus.
          await stream.write(': ping\n\n')
        }
      }
    } finally {
      unsubscribe()
    }
  })
)
