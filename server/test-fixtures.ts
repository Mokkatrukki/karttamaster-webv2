import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { Role } from './types'

// cost 4 = fastest valid bcrypt for tests (~1ms vs ~100ms at cost 10)
export const TEST_PASSWORD = 'test-salasana-123'
const TEST_PASSWORD_HASH = Bun.password.hashSync(TEST_PASSWORD, { algorithm: 'bcrypt', cost: 4 })

export const TEST_USERS = {
  admin: {
    username: 'test-admin',
    password: TEST_PASSWORD,
    passwordHash: TEST_PASSWORD_HASH,
    role: 'admin' as Role,
    displayName: 'Testi Admin',
  },
  järjestäjä: {
    username: 'test-jarjestaja',
    password: TEST_PASSWORD,
    passwordHash: TEST_PASSWORD_HASH,
    role: 'järjestäjä' as Role,
    displayName: 'Testi Järjestäjä',
  },
  talkoolainen: {
    code: 'TEST-KOODI-1',
    displayName: 'Testi Talkoolainen',
    role: 'talkoolainen' as Role,
  },
}

/** Seed all three test roles into db. Idempotent (INSERT OR IGNORE). */
export function seedTestUsers(db: Database): void {
  for (const u of [TEST_USERS.admin, TEST_USERS.järjestäjä]) {
    db.run(
      'INSERT OR IGNORE INTO users (id, username, password_hash, role, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), u.username, u.passwordHash, u.role, u.displayName, new Date().toISOString()]
    )
  }
  const t = TEST_USERS.talkoolainen
  db.run(
    'INSERT OR IGNORE INTO talkoolainen_codes (code, display_name, created_at) VALUES (?, ?, ?)',
    [t.code, t.displayName, new Date().toISOString()]
  )
}

/** Create a live session for given role. Returns session id. */
export function makeTestSession(db: Database, role: Role, expiresOffsetSec = 3600): string {
  const id = randomUUID()
  const expires = new Date(Date.now() + expiresOffsetSec * 1000).toISOString()
  const displayName =
    role === 'talkoolainen'
      ? TEST_USERS.talkoolainen.displayName
      : role === 'admin'
        ? TEST_USERS.admin.displayName
        : TEST_USERS.järjestäjä.displayName
  db.run(
    'INSERT INTO sessions (id, user_id, talkoolainen_code, role, display_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, null, null, role, displayName, expires]
  )
  return id
}

/** Cookie header object for use in app.request() calls. */
export function cookieHeader(sessionId: string): { Cookie: string } {
  return { Cookie: `session=${sessionId}` }
}

/** One-liner: create session + return header. Most tests only need this. */
export function authHeaders(db: Database, role: Role): { Cookie: string } {
  return cookieHeader(makeTestSession(db, role))
}
