import { describe, test, expect, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, unlinkSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createDb, gracefulClose } from './db'

// V120/T188: prod-SQLite-kirjoitukset kestävät fly-koneen auto-stopin.
describe('T188/V120: SQLite durability', () => {
  const tmpFiles: string[] = []

  afterEach(() => {
    for (const f of tmpFiles) {
      for (const suffix of ['', '-wal', '-shm']) {
        try { if (existsSync(f + suffix)) unlinkSync(f + suffix) } catch { /* ignore */ }
      }
    }
    tmpFiles.length = 0
  })

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'km-dur-'))
    const p = join(dir, 'test.db')
    tmpFiles.push(p)
    return p
  }

  test('createDb asettaa PRAGMA synchronous=FULL (2)', () => {
    const db = createDb(':memory:')
    const row = db.query<{ synchronous: number }, []>('PRAGMA synchronous').get()
    expect(row?.synchronous).toBe(2) // 2 = FULL
    db.close()
  })

  test('gracefulClose taittaa WAL:n main-tiedostoon — reopen näkee rivin', () => {
    const path = tempDbPath()

    const db = createDb(path)
    db.run(
      "INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ['DUR-1', 'wc', 65.6, 27.9, 100, '["30"]', 'suunniteltu', new Date().toISOString()],
    )
    // Sammutus: checkpoint + close (kuten SIGTERM-käsittelijä tekee).
    gracefulClose(db)

    // Uusi yhteys samaan tiedostoon (simuloi koneen uudelleenkäynnistys).
    const db2 = createDb(path)
    const found = db2.query<{ id: string }, [string]>('SELECT id FROM markers WHERE id = ?').get('DUR-1')
    expect(found?.id).toBe('DUR-1')
    db2.close()
  })

  test('gracefulClose ei heitä vaikka checkpoint epäonnistuisi (best-effort)', () => {
    const db = createDb(':memory:')
    expect(() => gracefulClose(db)).not.toThrow()
  })
})
