import { Database } from 'bun:sqlite'
import { randomUUID } from 'crypto'
import type { User } from './types'

export function createDb(path: string = ':memory:'): Database {
  const db = new Database(path)
  db.exec('PRAGMA journal_mode=WAL')
  // V120/T188: synchronous=FULL fsyncaa WAL:n joka commitissa (ei vain checkpointissa).
  // Ilman tätä fly `auto_stop_machines=stop` voi pysäyttää VM:n ennen fsynciä →
  // checkpointtaamattomat kirjoitukset katoavat. NORMAL (Bun default) kestää vain
  // prosessin kaatumisen, ei VM-stopia/virtakatkoa.
  db.exec('PRAGMA synchronous=FULL')
  db.exec('PRAGMA foreign_keys=ON')
  initSchema(db)
  return db
}

// V120/T188: sammutuksessa taita WAL main-tiedostoon ja sulje siististi.
// SIGINT/SIGTERM (fly-koneen auto-stop) kutsuu tätä ennen exitiä, jottei
// checkpointtaamaton WAL jää alttiiksi VM-pysäytykselle. Best-effort:
// checkpoint-virhe ei estä siistiä closea.
export function gracefulClose(db: Database): void {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } catch {
    /* best-effort — sulje silti */
  }
  db.close()
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
      route_ids TEXT,
      start_dist REAL,
      end_dist REAL,
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

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      icon_id TEXT,
      image_id TEXT,
      parts_json TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS template_images (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
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
  // T162/V100: snapshot kattaa koko datasetin (markers+segments+areas+area_features)
  try { db.exec('ALTER TABLE snapshots ADD COLUMN dataset_json TEXT') } catch { /* already exists */ }
  // T170/V106: iconId denormalisoitu markers-tauluun (V99-ikonitier kartalle)
  try { db.exec('ALTER TABLE markers ADD COLUMN icon_id TEXT') } catch { /* already exists */ }
  // T172/V107: yhdistelmämerkin osat (JSON-taulukko) denormalisoitu markers-tauluun
  try { db.exec('ALTER TABLE markers ADD COLUMN parts_json TEXT') } catch { /* already exists */ }
  // T196/V131: template.imageId (bundle-avain tai backend-URL) denormalisoitu markerille
  try { db.exec('ALTER TABLE markers ADD COLUMN image_id TEXT') } catch { /* already exists */ }
  // T215/V143: templateId denormalisoitu markerille — dynaamisen markerTypeFilter-osuman vakaa viite
  try { db.exec('ALTER TABLE markers ADD COLUMN template_id TEXT') } catch { /* already exists */ }
  // B84/V121: bearing-feature poistettiin (T129/T132) mutta DROP-migraatiota ei koskaan
  // kirjoitettu. Ennen poistoa luotu markers-taulu (esim. tuotanto Jun 11) säilyttää
  // `bearing NOT NULL` -sarakkeen ilman defaultia → koodin INSERT (ei bearingia) kaatuu
  // SQLITE_CONSTRAINT_NOTNULL → EI YKSIKÄÄN merkki tallennu. Pudota sarake idempotentisti.
  try { db.exec('ALTER TABLE markers DROP COLUMN bearing') } catch { /* already dropped / never existed */ }

  // T213/V141: segments route-kentät nullable (reititön tehtävä persistoituu).
  migrateSegmentsNullable(db)
  // T216/V140: reitittömän tehtävän merkkiliitos — eksplisiittiset id:t + dynaaminen tyyppisuodatin.
  // HUOM: näiden ALTER-rivien PITÄÄ olla migrateSegmentsNullable JÄLKEEN (rebuild ei kopioi näitä
  // kolumneja; rebuild ajetaan vain kerran kun route_ids vielä NOT NULL, joten datakato ei uhkaa).
  try { db.exec('ALTER TABLE segments ADD COLUMN linked_marker_ids TEXT') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE segments ADD COLUMN marker_type_filter TEXT') } catch { /* already exists */ }

  const existing = db.query<{ count: number }, []>(
    "SELECT COUNT(*) as count FROM map_state WHERE key='status'"
  ).get()
  if (!existing || existing.count === 0) {
    db.run("INSERT INTO map_state (key, value) VALUES ('status', 'luonnos')")
  }
}

// T213/V141: route_ids/start_dist/end_dist NOT NULL → nullable (reititön tehtävä).
// SQLite ei tue NOT NULL -poistoa ALTER COLUMN:lla → rakenna taulu uudelleen transaktiossa.
// B84-oppi: EI DROP/recreate ilman datan kopiointia — vanhat reitilliset pätkät säilyvät.
// Idempotentti: aja vain jos route_ids on vielä NOT NULL (PRAGMA table_info notnull=1).
export function migrateSegmentsNullable(db: Database): void {
  const info = db.query<{ name: string; notnull: number }, []>('PRAGMA table_info(segments)').all()
  if (info.length === 0) return // taulua ei vielä ole (initSchema luo sen nullable-muodossa)
  const routeIdsCol = info.find(col => col.name === 'route_ids')
  if (!routeIdsCol || routeIdsCol.notnull === 0) return // jo nullable → ei tehtävää

  const hasInspected = info.some(col => col.name === 'inspected')
  const hasInspectionNote = info.some(col => col.name === 'inspection_note')
  const extra = [
    ...(hasInspected ? ['inspected'] : []),
    ...(hasInspectionNote ? ['inspection_note'] : []),
  ]
  const cols = [
    'id', 'route_ids', 'start_dist', 'end_dist', 'assigned_code',
    'display_name', 'description', 'equipment', 'phase', 'updated_at', ...extra,
  ].join(', ')

  db.transaction(() => {
    db.exec('ALTER TABLE segments RENAME TO segments_old')
    db.exec(`
      CREATE TABLE segments (
        id TEXT PRIMARY KEY,
        route_ids TEXT,
        start_dist REAL,
        end_dist REAL,
        assigned_code TEXT,
        display_name TEXT,
        description TEXT,
        equipment TEXT NOT NULL DEFAULT '[]',
        phase TEXT NOT NULL DEFAULT 'asettaminen',
        updated_at TEXT NOT NULL,
        inspected INTEGER NOT NULL DEFAULT 0,
        inspection_note TEXT
      )
    `)
    db.exec(`INSERT INTO segments (${cols}) SELECT ${cols} FROM segments_old`)
    db.exec('DROP TABLE segments_old')
  })()
}

export function seedAdmin(db: Database): void {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) return

  const existing = db.query<{ id: string; password_hash: string }, [string]>(
    'SELECT id, password_hash FROM users WHERE username = ?'
  ).get(username)

  if (existing) {
    if (!Bun.password.verifySync(password, existing.password_hash)) {
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', [
        Bun.password.hashSync(password),
        existing.id,
      ])
    }
    return
  }

  const passwordHash = Bun.password.hashSync(password)
  db.run(
    'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), username, passwordHash, 'admin', new Date().toISOString()]
  )
}

export type { User }
