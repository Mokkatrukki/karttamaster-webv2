import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { commentsRoutes, _resetCommentImageRateLimit } from './routes/comments'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'

// T338/V246/V247: huomion kuvaliite.
// Ydinehto: kuvan LISÄYS on ∀ autentikoidun oikeus (talkoolainen mukaan lukien) — päinvastoin
// kuin merkkikuvissa (markers.ts: järjestäjä+). Talkoolainen NÄKEE ongelman maastossa.
// Portit ovat serverissä (koko/mime/taajuus), ⊥ clientissä: API:a voi kutsua ohi clientin.

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/comments', commentsRoutes)
  return app
}

function imageForm(bytes = 10, type = 'image/jpeg', name = 'kuva.jpg'): FormData {
  const fd = new FormData()
  fd.append('image', new File([new Uint8Array(bytes)], name, { type }))
  return fd
}

// Sama IP kaikilla pyynnöillä = sama kiintiö (V247: avain on kestävin identiteetti, ⊥ sessio —
// uusi kirjautuminen ei saa nollata rajaa). authHeaders luo uuden session joka kutsulla ∴
// ilman tätä testi mittaisi vain sitä että session id vaihtuu.
const SAME_CLIENT = { 'fly-client-ip': '10.0.0.7' }

describe('T338: huomion kuvat', () => {
  let db: Database
  let commentId: string

  beforeEach(async () => {
    db = createDb(':memory:')
    seedTestUsers(db)
    _resetCommentImageRateLimit()

    const res = await makeApp(db).request('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(db, 'talkoolainen') },
      body: JSON.stringify({ targetType: 'point', lat: 65.1, lon: 27.5, text: 'Tämä voisi korjata' }),
    })
    commentId = ((await res.json()) as { id: string }).id
  })

  const upload = (role: 'järjestäjä' | 'talkoolainen', fd = imageForm()) =>
    makeApp(db).request(`/api/comments/${commentId}/images`, {
      method: 'POST',
      headers: { ...authHeaders(db, role), ...SAME_CLIENT },
      body: fd,
    })

  test('talkoolainen SAA liittää kuvan (V246 — koko taskin ydinehto)', async () => {
    const res = await upload('talkoolainen')
    expect(res.status).toBe(201)
    const body = (await res.json()) as { url: string }
    expect(body.url).toContain(`/api/comments/${commentId}/images/`)
  })

  test('GET palauttaa kuvan bytet oikealla content-typellä', async () => {
    const created = (await (await upload('talkoolainen')).json()) as { url: string }
    const res = await makeApp(db).request(created.url, { headers: authHeaders(db, 'talkoolainen') })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect((await res.arrayBuffer()).byteLength).toBe(10)
  })

  test('GET-listaus liittää images-kentän kommenttiin', async () => {
    await upload('talkoolainen')
    const res = await makeApp(db).request('/api/comments?targetType=point', {
      headers: authHeaders(db, 'talkoolainen'),
    })
    const rows = (await res.json()) as { id: string; images?: string[] }[]
    expect(rows[0].images).toHaveLength(1)
  })

  test('tuntematon kommentti → 404', async () => {
    const res = await makeApp(db).request('/api/comments/ei-ole/images', {
      method: 'POST',
      headers: authHeaders(db, 'talkoolainen'),
      body: imageForm(),
    })
    expect(res.status).toBe(404)
  })

  test('V247: väärä mime → 400', async () => {
    const res = await upload('talkoolainen', imageForm(10, 'application/pdf', 'liite.pdf'))
    expect(res.status).toBe(400)
    expect((await res.json()) as { error: string }).toEqual({ error: 'invalid_type' })
  })

  test('V247: liian iso → 413', async () => {
    const res = await upload('talkoolainen', imageForm(2 * 1024 * 1024 + 1))
    expect(res.status).toBe(413)
  })

  test('V247: kolmas kuva minuutin sisällä → 429 (max 2/min)', async () => {
    expect((await upload('talkoolainen')).status).toBe(201)
    expect((await upload('talkoolainen')).status).toBe(201)
    const third = await upload('talkoolainen')
    expect(third.status).toBe(429)
    expect((await third.json()) as { error: string }).toMatchObject({ error: 'rate_limited' })
  })

  test('V247: eri asiakas (eri IP) ei jää toisen kiintiön alle', async () => {
    await upload('talkoolainen')
    await upload('talkoolainen')
    const other = await makeApp(db).request(`/api/comments/${commentId}/images`, {
      method: 'POST',
      headers: { ...authHeaders(db, 'talkoolainen'), 'fly-client-ip': '10.0.0.99' },
      body: imageForm(),
    })
    expect(other.status).toBe(201)
  })

  test('V247: uusi kirjautuminen ⊥ nollaa kiintiötä (sama asiakas, uusi sessio)', async () => {
    await upload('talkoolainen')
    await upload('talkoolainen')
    // Uusi sessio, sama IP → yhä rajattu. Session-avain olisi tässä antanut 201:n.
    expect((await upload('talkoolainen')).status).toBe(429)
  })

  test('kommentin poisto poistaa myös kuvarivit (⊥ orpoja BLOBeja)', async () => {
    await upload('talkoolainen')
    const del = await makeApp(db).request(`/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: authHeaders(db, 'järjestäjä'),
    })
    expect(del.status).toBe(200)
    const left = db
      .query<{ n: number }, [string]>('SELECT COUNT(*) as n FROM comment_images WHERE comment_id = ?')
      .get(commentId)
    expect(left?.n).toBe(0)
  })

  test('kirjautumaton ⊥ saa ladata', async () => {
    const res = await makeApp(db).request(`/api/comments/${commentId}/images`, {
      method: 'POST',
      body: imageForm(),
    })
    expect(res.status).toBe(401)
  })
})
