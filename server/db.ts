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

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      route_ids TEXT NOT NULL,
      start_dist REAL NOT NULL,
      end_dist REAL NOT NULL,
      assigned_code TEXT,
      display_name TEXT,
      description TEXT,
      equipment TEXT NOT NULL DEFAULT '[]',
      phase TEXT NOT NULL DEFAULT 'asettaminen',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devfeedback (
      id TEXT PRIMARY KEY,
      tag TEXT NOT NULL,
      description TEXT NOT NULL,
      dom_path TEXT,
      element_html TEXT,
      page_url TEXT NOT NULL,
      session_path TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'avoin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      center_lat REAL NOT NULL,
      center_lng REAL NOT NULL,
      width_m REAL NOT NULL,
      height_m REAL NOT NULL,
      rotation REAL NOT NULL DEFAULT 0,
      markdown_description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'suunniteltu',
      hash_code TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS area_features (
      id TEXT PRIMARY KEY,
      area_id TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
      name TEXT,
      center_lat REAL NOT NULL,
      center_lng REAL NOT NULL,
      width_m REAL NOT NULL,
      height_m REAL NOT NULL,
      rotation REAL NOT NULL DEFAULT 0,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marker_images (
      id TEXT PRIMARY KEY,
      marker_id TEXT NOT NULL REFERENCES markers(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL,
      data BLOB NOT NULL,
      created_at TEXT NOT NULL
    );
  `)

  // Migraatiot — idempotent ALTER TABLE (epäonnistuu hiljaa jos kolumni jo on)
  try { db.exec('ALTER TABLE markers ADD COLUMN color TEXT') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE markers ADD COLUMN short_label TEXT') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE markers ADD COLUMN description TEXT') } catch { /* already exists */ }
  // T157/V98: label denormalisoitu markers-tauluun (GPKG-export properties.name)
  try { db.exec('ALTER TABLE markers ADD COLUMN label TEXT') } catch { /* already exists */ }
  // T149/V93: tarkastuskuittaus persistoituu segmentille
  try { db.exec('ALTER TABLE segments ADD COLUMN inspected INTEGER NOT NULL DEFAULT 0') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE segments ADD COLUMN inspection_note TEXT') } catch { /* already exists */ }

  const existing = db.query<{ count: number }, []>(
    "SELECT COUNT(*) as count FROM map_state WHERE key='status'"
  ).get()
  if (!existing || existing.count === 0) {
    db.run("INSERT INTO map_state (key, value) VALUES ('status', 'luonnos')")
  }
}

export function seedAdmin(db: Database): void {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) return

  const exists = db.query<{ id: string }, [string]>(
    'SELECT id FROM users WHERE username = ?'
  ).get(username)
  if (exists) return

  const passwordHash = Bun.password.hashSync(password)
  db.run(
    'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), username, passwordHash, 'admin', new Date().toISOString()]
  )
}

export type { User }
