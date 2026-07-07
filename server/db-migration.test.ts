import { describe, test, expect, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, unlinkSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createDb } from './db'

// B84/V121: vanha markers-taulu (ennen T129/T132 bearing-poistoa) säilyttää
// `bearing NOT NULL` -sarakkeen → INSERT ilman bearingia kaatuu. Migraatio pudottaa sen.
describe('B84/V121: bearing-sarakkeen DROP-migraatio', () => {
  const tmpFiles: string[] = []

  afterEach(() => {
    for (const f of tmpFiles) {
      for (const s of ['', '-wal', '-shm']) {
        try { if (existsSync(f + s)) unlinkSync(f + s) } catch { /* ignore */ }
      }
    }
    tmpFiles.length = 0
  })

  function legacyDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'km-mig-'))
    const p = join(dir, 'legacy.db')
    tmpFiles.push(p)
    // Luo tuotannon kaltainen vanha markers-taulu: bearing REAL NOT NULL, ei defaultia.
    const raw = new Database(p)
    raw.exec(`
      CREATE TABLE markers (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        distance_from_start REAL NOT NULL,
        route_ids TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'suunniteltu',
        location_note TEXT,
        bearing REAL NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT
      );
    `)
    raw.close()
    return p
  }

  test('migraatio pudottaa bearing-sarakkeen', () => {
    const path = legacyDbPath()
    const db = createDb(path)
    const cols = db
      .query<{ name: string }, []>('PRAGMA table_info(markers)')
      .all()
      .map((c) => c.name)
    expect(cols).not.toContain('bearing')
    db.close()
  })

  test('INSERT ilman bearingia onnistuu migraation jälkeen (B84-korjaus)', () => {
    const path = legacyDbPath()
    const db = createDb(path)
    // Sama INSERT kuin POST /api/markers (server/routes/markers.ts) — ei bearingia.
    expect(() =>
      db.run(
        'INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, location_note, color, label, icon_id, parts_json, description, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['M1', 'wc', 65.6, 27.9, 100, '["30"]', 'suunniteltu', null, null, null, null, null, null, new Date().toISOString(), 'testi'],
      ),
    ).not.toThrow()
    const row = db.query<{ id: string }, [string]>('SELECT id FROM markers WHERE id = ?').get('M1')
    expect(row?.id).toBe('M1')
    db.close()
  })

  test('tuore DB (ilman legacy-bearingia) ei kaadu migraatioon', () => {
    // createDb :memory: — bearing-saraketta ei ole; DROP on idempotentti no-op.
    expect(() => {
      const db = createDb(':memory:')
      db.close()
    }).not.toThrow()
  })
})
