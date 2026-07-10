import { describe, test, expect, beforeEach } from 'bun:test'
import { Hono } from 'hono'
import { createDb } from './db'
import { dbMiddleware } from './middleware/auth'
import { commentsRoutes } from './routes/comments'
import { seedTestUsers, authHeaders } from './test-fixtures'
import type { Database } from 'bun:sqlite'

function makeApp(db: Database) {
  const app = new Hono()
  app.use('*', dbMiddleware(db))
  app.route('/api/comments', commentsRoutes)
  return app
}

interface CommentJson {
  id: string
  targetType: string
  targetId?: string
  lat?: number
  lon?: number
  text: string
  iconId?: string
  authorName?: string
}

describe('T221: Comments API', () => {
  let db: Database
  beforeEach(() => {
    db = createDb(':memory:')
    seedTestUsers(db)
  })

  async function post(role: 'järjestäjä' | 'talkoolainen', body: unknown) {
    return makeApp(db).request('/api/comments', {
      method: 'POST',
      headers: { ...authHeaders(db, role), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  test('POST merkki-kommentti → 201 + kentät', async () => {
    const res = await post('järjestäjä', { targetType: 'marker', targetId: 'm-1', text: 'Puu kaatunut', authorName: 'Leo' })
    expect(res.status).toBe(201)
    const c = await res.json() as CommentJson
    expect(c.targetType).toBe('marker')
    expect(c.targetId).toBe('m-1')
    expect(c.text).toBe('Puu kaatunut')
    expect(c.authorName).toBe('Leo')
  })

  test('talkoolainen voi lisätä kommentin (kuka tahansa autentikoitu)', async () => {
    const res = await post('talkoolainen', { targetType: 'segment', targetId: 'seg-1', text: 'Blokattu polku' })
    expect(res.status).toBe(201)
  })

  test('POST vapaa piste (point) vaatii lat/lon → 201 kun annettu', async () => {
    const res = await post('järjestäjä', { targetType: 'point', lat: 65.1, lon: 27.5, text: 'Hyvä parkki', iconId: 'warning' })
    expect(res.status).toBe(201)
    const c = await res.json() as CommentJson
    expect(c.lat).toBe(65.1)
    expect(c.iconId).toBe('warning')
    expect(c.targetId).toBeUndefined()
  })

  test('POST point ilman koordinaatteja → 400', async () => {
    const res = await post('järjestäjä', { targetType: 'point', text: 'x' })
    expect(res.status).toBe(400)
  })

  test('POST marker ilman targetId → 400', async () => {
    const res = await post('järjestäjä', { targetType: 'marker', text: 'x' })
    expect(res.status).toBe(400)
  })

  test('POST tyhjä teksti → 400', async () => {
    const res = await post('järjestäjä', { targetType: 'marker', targetId: 'm-1', text: '   ' })
    expect(res.status).toBe(400)
  })

  test('POST tuntematon targetType → 400', async () => {
    const res = await post('järjestäjä', { targetType: 'galaxy', targetId: 'x', text: 'y' })
    expect(res.status).toBe(400)
  })

  test('GET suodattaa targetType+targetId mukaan', async () => {
    await post('järjestäjä', { targetType: 'marker', targetId: 'm-1', text: 'a' })
    await post('järjestäjä', { targetType: 'marker', targetId: 'm-2', text: 'b' })
    await post('järjestäjä', { targetType: 'segment', targetId: 'seg-1', text: 'c' })

    const res = await makeApp(db).request('/api/comments?targetType=marker&targetId=m-1', {
      headers: authHeaders(db, 'talkoolainen'),
    })
    expect(res.status).toBe(200)
    const list = await res.json() as CommentJson[]
    expect(list.length).toBe(1)
    expect(list[0].text).toBe('a')
  })

  test('DELETE järjestäjä → ok; talkoolainen → 403', async () => {
    const created = await (await post('järjestäjä', { targetType: 'marker', targetId: 'm-1', text: 'poistettava' })).json() as CommentJson

    const forbidden = await makeApp(db).request(`/api/comments/${created.id}`, {
      method: 'DELETE', headers: authHeaders(db, 'talkoolainen'),
    })
    expect(forbidden.status).toBe(403)

    const ok = await makeApp(db).request(`/api/comments/${created.id}`, {
      method: 'DELETE', headers: authHeaders(db, 'järjestäjä'),
    })
    expect(ok.status).toBe(200)

    const list = await (await makeApp(db).request('/api/comments', { headers: authHeaders(db, 'järjestäjä') })).json() as CommentJson[]
    expect(list.length).toBe(0)
  })
})
