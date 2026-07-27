import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'

// T221/T75: yleiskäyttöinen kommentti. Kiinnitys merkkiin/pätkään/vapaaseen karttapisteeseen.
// Kuka tahansa autentikoitu voi kommentoida (VISION §Talkoolainen: "kuka tahansa voi lisätä
// kommentin mihin tahansa karttakohteeseen"). Poisto = järjestäjä+ (voi yliajaa kaiken).

interface CommentRow {
  id: string
  target_type: string
  target_id: string | null
  lat: number | null
  lon: number | null
  text: string
  icon_id: string | null
  author_name: string | null
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

// T338: huomion kuva-URL:t. Sama muoto kuin markers.ts:n imageUrls (yksi kuvio, ei kahta).
function commentImageUrls(db: Database, commentId: string): string[] {
  return db
    .query<{ id: string }, [string]>(
      'SELECT id FROM comment_images WHERE comment_id = ? ORDER BY created_at ASC',
    )
    .all(commentId)
    .map(r => `/api/comments/${commentId}/images/${r.id}`)
}

function rowToComment(row: CommentRow, db?: Database) {
  return {
    images: db ? commentImageUrls(db, row.id) : undefined,
    id: row.id,
    targetType: row.target_type as 'marker' | 'segment' | 'point',
    targetId: row.target_id ?? undefined,
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
    text: row.text,
    iconId: row.icon_id ?? undefined,
    authorName: row.author_name ?? undefined,
    createdAt: row.created_at,
    // T341/V248: huomio = työtilaus. resolvedAt puuttuu ⇒ avoin.
    resolvedAt: row.resolved_at ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
  }
}

export const commentsRoutes = new Hono<AuthEnv>()

// GET /api/comments?targetType=&targetId= — kaikille autentikoiduille. Suodatus valinnainen.
commentsRoutes.get('/', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const targetType = c.req.query('targetType')
  const targetId = c.req.query('targetId')

  let rows: CommentRow[]
  if (targetType && targetId) {
    rows = db.query<CommentRow, [string, string]>(
      'SELECT * FROM comments WHERE target_type = ? AND target_id = ? ORDER BY created_at ASC',
    ).all(targetType, targetId)
  } else if (targetType) {
    rows = db.query<CommentRow, [string]>(
      'SELECT * FROM comments WHERE target_type = ? ORDER BY created_at ASC',
    ).all(targetType)
  } else {
    rows = db.query<CommentRow, []>('SELECT * FROM comments ORDER BY created_at ASC').all()
  }
  return c.json(rows.map(r => rowToComment(r, db)))
})

// POST /api/comments — kaikille autentikoiduille (talkoolainen mukaan lukien, VISION).
commentsRoutes.post('/', requireAuth(), async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{
    targetType?: string
    targetId?: string
    lat?: number
    lon?: number
    text?: string
    iconId?: string
    authorName?: string
  }>()

  const validTypes = ['marker', 'segment', 'point']
  if (!body.targetType || !validTypes.includes(body.targetType)) {
    return c.json({ error: 'invalid_target_type' }, 400)
  }
  if (!body.text || body.text.trim() === '') {
    return c.json({ error: 'missing_text' }, 400)
  }
  // 'point' = vapaa karttapiste → koordinaatit pakolliset; 'marker'/'segment' → targetId pakollinen.
  if (body.targetType === 'point') {
    if (typeof body.lat !== 'number' || typeof body.lon !== 'number') {
      return c.json({ error: 'missing_coordinates' }, 400)
    }
  } else if (!body.targetId) {
    return c.json({ error: 'missing_target_id' }, 400)
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO comments (id, target_type, target_id, lat, lon, text, icon_id, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      body.targetType,
      body.targetType === 'point' ? null : (body.targetId ?? null),
      body.lat ?? null,
      body.lon ?? null,
      body.text.trim(),
      body.iconId ?? null,
      body.authorName?.trim() || null,
      now,
    ],
  )

  const row = db.query<CommentRow, [string]>('SELECT * FROM comments WHERE id = ?').get(id)!
  return c.json(rowToComment(row, db), 201)
})

// ---- T338/V262: kuvaliite ----
//
// Portit ovat SERVERISSÄ, ⊥ clientissä. Client pienentää kuvan ennen lähetystä (nopeus +
// kaista), mutta se on mukavuus — API:a voi kutsua suoraan curlilla ∴ jokainen raja
// tarkistetaan tässä. Kolme rajaa: koko, mime, taajuus.

const MAX_COMMENT_IMAGE_BYTES = 2 * 1024 * 1024 // client pienentää ~<500 kB; 2 MB on katto ⊥ tavoite
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const RATE_WINDOW_MS = 60_000
const RATE_MAX_UPLOADS = 2 // 2 kuvaa / min / sessio (käyttäjäpäätös 2026-07-25)

// Muistissa elävä ikkuna per sessio. Prosessin uudelleenkäynnistys nollaa — hyväksytty:
// tämä on väärinkäytön hidaste, ⊥ kirjanpito. Kanta-taulu maksaisi kirjoituksen per pyyntö.
const uploadTimes = new Map<string, number[]>()

function rateLimited(key: string, now: number): boolean {
  const recent = (uploadTimes.get(key) ?? []).filter(t => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX_UPLOADS) {
    uploadTimes.set(key, recent)
    return true
  }
  recent.push(now)
  uploadTimes.set(key, recent)
  return false
}

/** Testiapuri — ikkuna elää prosessissa ∴ testit ⊥ saa vuotaa toisilleen. */
export function _resetCommentImageRateLimit(): void {
  uploadTimes.clear()
}

// POST /api/comments/:id/images — ∀ AUTENTIKOITU ml. talkoolainen (V13/V246).
// TÄSMÄLLINEN ERO merkkikuviin (markers.ts: järjestäjä+): huomion arvo on siinä että kentällä
// oleva liittää todisteen. Jos tämä olisi järjestäjä+, huomio kutistuisi tekstiksi.
commentsRoutes.post('/:id/images', requireAuth(), async (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')

  const existing = db.query<{ id: string }, [string]>('SELECT id FROM comments WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  // Avain: KESTÄVIN saatavilla oleva identiteetti. Pelkkä session.id olisi tehoton — uusi
  // kirjautuminen antaa uuden session ∴ kiintiö nollautuisi kolmella klikkauksella.
  // Järjestys: user_id (kirjautunut) > talkoolainen_code (pätkäkohtainen) > IP > sessio.
  // Yleissalasana-sessiolla molemmat ensimmäiset ovat NULL (auth.ts:105, B124) ∴ IP kantaa.
  const session = c.get('session')
  const ip = c.req.header('fly-client-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  const rateKey = session?.user_id ?? session?.talkoolainen_code ?? ip ?? session?.id ?? 'anon'
  if (rateLimited(rateKey, Date.now())) {
    return c.json({ error: 'rate_limited', retryAfterMs: RATE_WINDOW_MS }, 429)
  }

  const body = await c.req.parseBody()
  const file = body.image
  if (!(file instanceof File)) return c.json({ error: 'missing_file' }, 400)
  if (file.size > MAX_COMMENT_IMAGE_BYTES) return c.json({ error: 'file_too_large' }, 413)
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return c.json({ error: 'invalid_type' }, 400)

  const imageId = randomUUID()
  const data = Buffer.from(await file.arrayBuffer())
  db.run(
    'INSERT INTO comment_images (id, comment_id, content_type, data, created_at) VALUES (?, ?, ?, ?, ?)',
    [imageId, id, file.type, data, new Date().toISOString()],
  )

  return c.json({ url: `/api/comments/${id}/images/${imageId}` }, 201)
})

// GET /api/comments/:id/images/:imageId — ∀ autentikoitu (readonly).
commentsRoutes.get('/:id/images/:imageId', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const imageId = c.req.param('imageId')

  const row = db
    .query<{ content_type: string; data: Uint8Array }, [string, string]>(
      'SELECT content_type, data FROM comment_images WHERE id = ? AND comment_id = ?',
    )
    .get(imageId, id)
  if (!row) return c.json({ error: 'not_found' }, 404)

  return new Response(row.data, {
    headers: { 'Content-Type': row.content_type, 'Cache-Control': 'private, max-age=86400' },
  })
})

// PATCH /api/comments/:id/resolve — järjestäjä+ kuittaa työn tehdyksi (tai palauttaa avoimeksi).
// V248: kuittaus on KOORDINOINTIPÄÄTÖS ("tämä on hoidettu") ∴ se kuuluu järjestäjälle joka
// näkee kaikki pätkät. Talkoolainen ILMOITTAA, järjestäjä KUITTAA — sama työnjako kuin
// merkkien poistossa. Kuittaaja jää talteen: "kuka sanoi tämän hoidetuksi" on se kysymys
// johon 2026-07-25 incidentin jälkeen halutaan aina vastaus (V240-linja).
commentsRoutes.patch('/:id/resolve', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const existing = db.query<{ id: string }, [string]>('SELECT id FROM comments WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  const body = await c.req.json<{ resolved?: boolean }>().catch(() => ({ resolved: true }))
  const resolved = body.resolved !== false
  const session = c.get('session')
  const actor = session?.display_name ?? session?.role ?? null

  db.run('UPDATE comments SET resolved_at = ?, resolved_by = ? WHERE id = ?', [
    resolved ? new Date().toISOString() : null,
    resolved ? actor : null,
    id,
  ])

  const row = db.query<CommentRow, [string]>('SELECT * FROM comments WHERE id = ?').get(id)!
  return c.json(rowToComment(row, db))
})

// DELETE /api/comments/:id — vain järjestäjä+ (voi yliajaa kaiken, VISION r283).
commentsRoutes.delete('/:id', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  const existing = db.query<{ id: string }, [string]>('SELECT id FROM comments WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)
  // Cascade koodissa: orpo BLOB jäisi kantaan kasvamaan ilman mitään joka viittaa siihen.
  db.run('DELETE FROM comment_images WHERE comment_id = ?', [id])
  db.run('DELETE FROM comments WHERE id = ?', [id])
  return c.json({ ok: true })
})
