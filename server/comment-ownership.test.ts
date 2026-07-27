import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { commentsRoutes, _resetCommentImageRateLimit } from './routes/comments'
import { seedTestUsers, authHeaders, cookieHeader } from './test-fixtures'
import type { Database } from 'bun:sqlite'

// T367/T368/V265: huomion omistajuus.
//
// Ydinehto: TEKIJÄ saa korjata omansa. Sijaintivirhe syntyy kiireessä maastossa ja korjaaja on
// sama ihminen joka seisoo paikalla — jos hän ei voi siirtää, väärä sijainti jää kantaan ja
// järjestäjä ajaa väärään kohtaan (B151).
//
// Gate on SERVERISSÄ ja omistajuus luetaan rivin `created_by`sta, ei bodystä: client ei saa
// nimetä itseään omistajaksi.

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/comments', commentsRoutes)
  return app
}

/** Talkoolais-sessio pätkäkoodilla — fixture-sessioilla koodi on NULL, tässä se on koko juju. */
function codeSession(db: Database, code: string): { Cookie: string } {
  const id = randomUUID()
  db.run(
    'INSERT OR IGNORE INTO talkoolainen_codes (code, display_name, created_at) VALUES (?, ?, ?)',
    [code, `Talkoo ${code}`, new Date().toISOString()],
  )
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, code, 'talkoolainen', `Talkoo ${code}`, new Date(Date.now() + 3600_000).toISOString()],
  )
  return cookieHeader(id)
}

const POINT = { targetType: 'point', lat: 65.1, lon: 27.5, text: 'Tämä voisi korjata' }

describe('T367: huomion siirto ja poisto', () => {
  let db: Database
  let owner: { Cookie: string }
  let commentId: string

  beforeEach(async () => {
    db = createDb(':memory:')
    seedTestUsers(db)
    _resetCommentImageRateLimit()
    owner = codeSession(db, 'PATKA1')
    const res = await makeApp(db).request('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...owner },
      body: JSON.stringify(POINT),
    })
    commentId = ((await res.json()) as { id: string }).id
  })

  const move = (headers: { Cookie: string }, lat = 65.2, lon = 27.6) =>
    makeApp(db).request(`/api/comments/${commentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ lat, lon }),
    })

  test('tekijä siirtää omansa → 200 ja koordinaatit muuttuvat', async () => {
    const res = await move(owner)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { lat: number; lon: number }
    expect(body.lat).toBeCloseTo(65.2)
    expect(body.lon).toBeCloseTo(27.6)
  })

  test('vieras talkoolainen (eri pätkäkoodi) → 403, sijainti ei muutu', async () => {
    const res = await move(codeSession(db, 'PATKA2'))
    expect(res.status).toBe(403)
    const row = db.query<{ lat: number }, [string]>('SELECT lat FROM comments WHERE id = ?').get(commentId)!
    expect(row.lat).toBeCloseTo(65.1)
  })

  test('järjestäjä siirtää kenen tahansa → 200', async () => {
    expect((await move(authHeaders(db, 'järjestäjä'))).status).toBe(200)
  })

  test('created_by NULL (ennen omistajuutta kirjattu) → talkoolainen 403, järjestäjä 200', async () => {
    db.run('UPDATE comments SET created_by = NULL WHERE id = ?', [commentId])
    expect((await move(owner)).status).toBe(403)
    expect((await move(authHeaders(db, 'järjestäjä'))).status).toBe(200)
  })

  test('yleissalasana-sessio (ei user_id, ei koodia, B124) omistaa oman huomionsa sessiolla', async () => {
    const id = randomUUID()
    db.run(
      'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, null, null, 'talkoolainen', null, new Date(Date.now() + 3600_000).toISOString()],
    )
    const hub = cookieHeader(id)
    const created = await makeApp(db).request('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...hub },
      body: JSON.stringify(POINT),
    })
    const hubComment = ((await created.json()) as { id: string }).id

    const res = await makeApp(db).request(`/api/comments/${hubComment}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...hub },
      body: JSON.stringify({ lat: 65.3, lon: 27.7 }),
    })
    expect(res.status).toBe(200)
  })

  test('tekijä poistaa omansa → 200 (ennen: vain järjestäjä)', async () => {
    const res = await makeApp(db).request(`/api/comments/${commentId}`, { method: 'DELETE', headers: owner })
    expect(res.status).toBe(200)
    expect(db.query('SELECT id FROM comments WHERE id = ?').get(commentId)).toBeNull()
  })

  test('vieras ei poista → 403', async () => {
    const res = await makeApp(db).request(`/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: codeSession(db, 'PATKA2'),
    })
    expect(res.status).toBe(403)
  })

  test('merkkiin kiinnitettyä huomiota ei voi siirtää — sen paikka on kohteen paikka', async () => {
    const created = await makeApp(db).request('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...owner },
      body: JSON.stringify({ targetType: 'marker', targetId: 'm1', text: 'kiinni merkissä' }),
    })
    const attached = ((await created.json()) as { id: string }).id
    const res = await makeApp(db).request(`/api/comments/${attached}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...owner },
      body: JSON.stringify({ lat: 65.9, lon: 27.9 }),
    })
    expect(res.status).toBe(400)
  })
})

describe('T368: kuvan poisto', () => {
  let db: Database
  let owner: { Cookie: string }
  let commentId: string
  let imageUrl: string

  beforeEach(async () => {
    db = createDb(':memory:')
    seedTestUsers(db)
    _resetCommentImageRateLimit()
    owner = codeSession(db, 'PATKA1')
    const created = await makeApp(db).request('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...owner },
      body: JSON.stringify(POINT),
    })
    commentId = ((await created.json()) as { id: string }).id

    const fd = new FormData()
    fd.append('image', new File([new Uint8Array(10)], 'kuva.jpg', { type: 'image/jpeg' }))
    const up = await makeApp(db).request(`/api/comments/${commentId}/images`, {
      method: 'POST',
      headers: { ...owner, 'fly-client-ip': '10.0.0.9' },
      body: fd,
    })
    imageUrl = ((await up.json()) as { url: string }).url
  })

  test('omistaja poistaa kuvan → 200 ja rivi katoaa kannasta', async () => {
    const res = await makeApp(db).request(imageUrl, { method: 'DELETE', headers: owner })
    expect(res.status).toBe(200)
    const left = db
      .query<{ n: number }, [string]>('SELECT COUNT(*) AS n FROM comment_images WHERE comment_id = ?')
      .get(commentId)!
    expect(left.n).toBe(0)
  })

  test('vieras ei poista kuvaa → 403, kuva jää', async () => {
    const res = await makeApp(db).request(imageUrl, { method: 'DELETE', headers: codeSession(db, 'PATKA2') })
    expect(res.status).toBe(403)
    const left = db
      .query<{ n: number }, [string]>('SELECT COUNT(*) AS n FROM comment_images WHERE comment_id = ?')
      .get(commentId)!
    expect(left.n).toBe(1)
  })

  test('tuntematon imageId → 404', async () => {
    const res = await makeApp(db).request(`/api/comments/${commentId}/images/${randomUUID()}`, {
      method: 'DELETE',
      headers: owner,
    })
    expect(res.status).toBe(404)
  })
})
