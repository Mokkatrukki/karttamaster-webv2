import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { streamRoutes } from './routes/stream'
import { markersRoutes } from './routes/markers'
import { segmentRoutes } from './routes/segments'
import { publishChange, subscribeChanges, listenerCount, currentRev } from './events'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/stream', streamRoutes)
  app.route('/api/markers', markersRoutes)
  app.route('/api/segments', segmentRoutes)
  return app
}

/** Lue streamista kunnes ehto täyttyy tai aika loppuu. Palauttaa kertyneen tekstin. */
async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  predicate: (text: string) => boolean,
  timeoutMs = 2000,
): Promise<string> {
  const decoder = new TextDecoder()
  let text = ''
  const deadline = Date.now() + timeoutMs
  while (!predicate(text)) {
    if (Date.now() > deadline) throw new Error(`timeout, sain: ${JSON.stringify(text)}`)
    const chunk = await Promise.race([
      reader.read(),
      new Promise<{ done: true; value: undefined }>((r) =>
        setTimeout(() => r({ done: true, value: undefined }), Math.max(0, deadline - Date.now())),
      ),
    ])
    if (chunk.done) break
    text += decoder.decode(chunk.value as Uint8Array, { stream: true })
  }
  return text
}

describe('T446/V330: SSE-heräteväylä', () => {
  let db: Database

  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
  })

  afterEach(() => {
    db.close()
  })

  test('vaatii session — ilman cookiea 401 (⊥ vuoda muutosvirtaa ulos)', async () => {
    const res = await makeApp(db).request('/api/stream')
    expect(res.status).toBe(401)
  })

  test('avaus lähettää hello-tapahtuman lähtötasona (rev)', async () => {
    const res = await makeApp(db).request('/api/stream', { headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')

    const reader = res.body!.getReader()
    const text = await readUntil(reader, (t) => t.includes('event: hello'))
    expect(text).toContain('event: hello')
    expect(text).toMatch(/data: \{"rev":\d+\}/)
    // Reconnect on selaimen — serveri antaa vain retry-vihjeen (T446(c)).
    expect(text).toContain('retry: 5000')
    await reader.cancel()
  })

  test('publishChange työntää {type,id,rev} avoimeen streamiin', async () => {
    const res = await makeApp(db).request('/api/stream', { headers: authHeaders(db, 'talkoolainen') })
    const reader = res.body!.getReader()
    await readUntil(reader, (t) => t.includes('event: hello'))

    publishChange('pile', 'kasa-1')
    const text = await readUntil(reader, (t) => t.includes('event: change'))
    const payload = JSON.parse(/event: change\ndata: (.*)\n/.exec(text)![1]) as {
      type: string; id: string; rev: number
    }
    expect(payload.type).toBe('pile')
    expect(payload.id).toBe('kasa-1')
    expect(payload.rev).toBeGreaterThan(0)
    await reader.cancel()
  })

  test('payload ⊥ sisällä merkkidataa — vain type/id/rev (V330: ei osittaista totuutta)', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/stream', { headers: authHeaders(db, 'talkoolainen') })
    const reader = res.body!.getReader()
    await readUntil(reader, (t) => t.includes('event: hello'))

    const created = await app.request('/api/markers', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'nuoli', lat: 65.1, lon: 27.5, distance_from_start: 100,
        route_ids: ['35km'], label: 'SALAINEN-LAPPU',
      }),
    })
    expect(created.status).toBe(201)
    const { id } = await created.json() as { id: string }

    const text = await readUntil(reader, (t) => t.includes('event: change'))
    const payload = JSON.parse(/event: change\ndata: (.*)\n/.exec(text)![1]) as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(['id', 'rev', 'type'])
    expect(payload.id).toBe(id)
    expect(text).not.toContain('SALAINEN-LAPPU')
    await reader.cancel()
  })

  test('kasamerkki (kerayskasa) tulee type=pile, tavallinen merkki type=marker', async () => {
    const app = makeApp(db)
    const res = await app.request('/api/stream', { headers: authHeaders(db, 'talkoolainen') })
    const reader = res.body!.getReader()
    await readUntil(reader, (t) => t.includes('event: hello'))

    await app.request('/api/markers', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'kerayskasa', lat: 65.1, lon: 27.5, distance_from_start: 100,
        route_ids: ['35km'], template_id: 'kerayskasa', pile_marker_ids: ['a', 'b'],
      }),
    })
    const text = await readUntil(reader, (t) => t.includes('event: change'))
    expect(text).toContain('"type":"pile"')
    await reader.cancel()
  })

  test('pätkän muutos (PUT) julkaisee segment-herätteen', async () => {
    const app = makeApp(db)
    const created = await app.request('/api/segments', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeIds: ['35km'], startDist: 0, endDist: 1000 }),
    })
    expect(created.status).toBe(201)
    const seg = await created.json() as { id: string }

    const res = await app.request('/api/stream', { headers: authHeaders(db, 'talkoolainen') })
    const reader = res.body!.getReader()
    await readUntil(reader, (t) => t.includes('event: hello'))

    await app.request(`/api/segments/${seg.id}`, {
      method: 'PUT',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    const text = await readUntil(reader, (t) => t.includes('event: change'))
    expect(text).toContain('"type":"segment"')
    expect(text).toContain(`"id":"${seg.id}"`)
    await reader.cancel()
  })

  test('sulkeutuu siististi — peruttu stream ⊥ jätä tilaajaa väylälle', async () => {
    const before = listenerCount()
    const res = await makeApp(db).request('/api/stream', { headers: authHeaders(db, 'talkoolainen') })
    const reader = res.body!.getReader()
    await readUntil(reader, (t) => t.includes('event: hello'))
    expect(listenerCount()).toBe(before + 1)

    await reader.cancel()
    // Peruutus laukaisee abortin → tilaus purkautuu (⊥ vuoda mutaatiokohtaista työtä).
    const deadline = Date.now() + 1000
    while (listenerCount() > before && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10))
    }
    expect(listenerCount()).toBe(before)
  })

  test('mutaatio ilman kuuntelijoita onnistuu normaalisti (heräte ⊥ ole kirjoituksen ehto)', async () => {
    const revBefore = currentRev()
    const res = await makeApp(db).request('/api/markers', {
      method: 'POST',
      headers: { ...authHeaders(db, 'järjestäjä'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'nuoli', lat: 65.1, lon: 27.5, distance_from_start: 100, route_ids: ['35km'],
      }),
    })
    expect(res.status).toBe(201)
    expect(currentRev()).toBeGreaterThan(revBefore)
  })

  test('yhden streamin kirjoitusvirhe ⊥ kaada julkaisua muille', () => {
    const seen: string[] = []
    const unsubBroken = subscribeChanges(() => { throw new Error('kirjoitus epäonnistui') })
    const unsubOk = subscribeChanges((e) => seen.push(e.id))

    expect(() => publishChange('marker', 'm-9')).not.toThrow()
    expect(seen).toEqual(['m-9'])

    unsubBroken()
    unsubOk()
  })
})
