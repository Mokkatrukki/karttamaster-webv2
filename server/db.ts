import { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'
import type { User } from './types'

export function createDb(path: string = ':memory:'): Database {
  const db = new Database(path)
  db.exec('PRAGMA journal_mode=WAL')
  db.exec('PRAGMA foreign_keys=ON')
  initSchema(db)
  return db
}

function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      invite_token TEXT UNIQUE,
      display_name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS talkoolainen_codes (
      code TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      segment_id TEXT,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      talkoolainen_code TEXT,
      role TEXT NOT NULL,
      display_name TEXT,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS markers (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      bearing REAL NOT NULL,
      distance_from_start REAL NOT NULL,
      route_ids TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'suunniteltu',
      location_note TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS map_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      markers_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      trigger TEXT NOT NULL
    );
  `)

  const existing = db.query<{ count: number }, []>(
    "SELECT COUNT(*) as count FROM map_state WHERE key='status'"
  ).get()
  if (!existing || existing.count === 0) {
    db.run("INSERT INTO map_state (key, value) VALUES ('status', 'luonnos')")
  }
}

export async function seedAdmin(db: Database): Promise<void> {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) return

  const exists = db.query<{ id: string }, [string]>(
    'SELECT id FROM users WHERE username = ?'
  ).get(username)
  if (exists) return

  const passwordHash = await Bun.password.hash(password)
  db.run(
    'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), username, passwordHash, 'admin', new Date().toISOString()]
  )
}

export type { User }
