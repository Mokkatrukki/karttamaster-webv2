import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Database } from 'bun:sqlite'
import type { SessionData, Role } from '../types'

export type AuthEnv = {
  Variables: {
    session: SessionData
    db: Database
  }
}

export function dbMiddleware(db: Database) {
  return async (c: Context, next: Next) => {
    c.set('db', db)
    await next()
  }
}

export function requireAuth() {
  return async (c: Context, next: Next) => {
    const db: Database = c.get('db')
    const sessionId = getCookie(c, 'session')
    if (!sessionId) return c.json({ error: 'unauthorized' }, 401)

    const session = db.query<SessionData, [string, string]>(
      'SELECT * FROM sessions WHERE id = ? AND expires_at > ?'
    ).get(sessionId, new Date().toISOString())
    if (!session) return c.json({ error: 'unauthorized' }, 401)

    if (session.user_id) {
      const user = db.query<{ is_active: number }, [string]>(
        'SELECT is_active FROM users WHERE id = ?'
      ).get(session.user_id)
      if (user && user.is_active === 0) return c.json({ error: 'account_disabled' }, 401)
    }

    c.set('session', session)
    await next()
  }
}

export function requireRole(...roles: Role[]) {
  return async (c: Context, next: Next) => {
    const session: SessionData = c.get('session')
    if (!session) return c.json({ error: 'unauthorized' }, 401)
    if (!roles.includes(session.role)) return c.json({ error: 'forbidden' }, 403)
    await next()
  }
}
