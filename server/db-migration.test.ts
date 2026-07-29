import { describe, test, expect, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, unlinkSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createDb, backfillMarkerTemplateIds } from './db'

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

// T213/V141: vanha segments-taulu (route_ids/start_dist/end_dist NOT NULL) → nullable.
// SQLite ei tue NOT NULL -poistoa ALTER:lla → taulu rakennetaan uudelleen. Data säilyy (B84).
describe('T213/V141: segments route-kentät nullable -migraatio', () => {
  const tmpFiles: string[] = []

  afterEach(() => {
    for (const f of tmpFiles) {
      for (const s of ['', '-wal', '-shm']) {
        try { if (existsSync(f + s)) unlinkSync(f + s) } catch { /* ignore */ }
      }
    }
    tmpFiles.length = 0
  })

  function legacySegmentsDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'km-seg-mig-'))
    const p = join(dir, 'legacy.db')
    tmpFiles.push(p)
    // Vanha skeema: route_ids/start_dist/end_dist NOT NULL + inspected/inspection_note (T149-ALTER).
    const raw = new Database(p)
    raw.exec(`
      CREATE TABLE segments (
        id TEXT PRIMARY KEY,
        route_ids TEXT NOT NULL,
        start_dist REAL NOT NULL,
        end_dist REAL NOT NULL,
        assigned_code TEXT,
        display_name TEXT,
        description TEXT,
        equipment TEXT NOT NULL DEFAULT '[]',
        phase TEXT NOT NULL DEFAULT 'asettaminen',
        updated_at TEXT NOT NULL,
        inspected INTEGER NOT NULL DEFAULT 0,
        inspection_note TEXT
      );
    `)
    // Reitillinen pätkä olemassa ennen migraatiota — EI saa kadota.
    raw.run(
      `INSERT INTO segments (id, route_ids, start_dist, end_dist, display_name, equipment, phase, updated_at)
       VALUES ('seg-vanha', '["35km"]', 1000, 5000, 'Vanha pätkä', '[]', 'asettaminen', '2026-01-01T00:00:00Z')`,
    )
    raw.close()
    return p
  }

  test('route_ids muuttuu nullableksi ja vanha data säilyy', () => {
    const path = legacySegmentsDbPath()
    const db = createDb(path)
    const routeIdsCol = db
      .query<{ name: string; notnull: number }, []>('PRAGMA table_info(segments)')
      .all()
      .find(c => c.name === 'route_ids')
    expect(routeIdsCol?.notnull).toBe(0) // enää ei NOT NULL

    const row = db.query<{ route_ids: string; display_name: string; start_dist: number }, [string]>(
      'SELECT route_ids, display_name, start_dist FROM segments WHERE id = ?',
    ).get('seg-vanha')
    expect(row?.route_ids).toBe('["35km"]') // reitillinen data koskematon
    expect(row?.display_name).toBe('Vanha pätkä')
    expect(row?.start_dist).toBe(1000)
    db.close()
  })

  test('reitittömän tehtävän INSERT (route-kentät NULL) onnistuu migraation jälkeen', () => {
    const path = legacySegmentsDbPath()
    const db = createDb(path)
    expect(() =>
      db.run(
        `INSERT INTO segments (id, route_ids, start_dist, end_dist, display_name, equipment, phase, updated_at)
         VALUES ('seg-reititon', NULL, NULL, NULL, 'Maalialue', '[]', 'purku', '2026-01-02T00:00:00Z')`,
      ),
    ).not.toThrow()
    const row = db.query<{ route_ids: string | null }, [string]>(
      'SELECT route_ids FROM segments WHERE id = ?',
    ).get('seg-reititon')
    expect(row?.route_ids).toBeNull()
    db.close()
  })

  test('migraatio on idempotentti — uudelleenavaus ei kaada eikä hukkaa dataa', () => {
    const path = legacySegmentsDbPath()
    const db1 = createDb(path)
    db1.close()
    // Toinen createDb samaan tiedostoon — route_ids jo nullable → migraatio no-op.
    const db2 = createDb(path)
    const count = db2.query<{ c: number }, []>('SELECT COUNT(*) as c FROM segments').get()
    expect(count?.c).toBe(1) // vanha pätkä yhä tallessa
    db2.close()
  })

  test('tuore DB: segments jo nullable, migraatio ei tee mitään', () => {
    const db = createDb(':memory:')
    const routeIdsCol = db
      .query<{ name: string; notnull: number }, []>('PRAGMA table_info(segments)')
      .all()
      .find(c => c.name === 'route_ids')
    expect(routeIdsCol?.notnull).toBe(0)
    db.close()
  })
})

// T297/V209/B113: slug-sarake + backfill vanhoille riveille. Vanha jaettu linkki
// (assigned_code) voittaa nimen — se jatkaa toimintaansa migraation yli.
describe('T297/V209: segments.slug-migraatio + backfill', () => {
  const tmpFiles: string[] = []

  afterEach(() => {
    for (const f of tmpFiles) {
      for (const s of ['', '-wal', '-shm']) {
        try { if (existsSync(f + s)) unlinkSync(f + s) } catch { /* ignore */ }
      }
    }
    tmpFiles.length = 0
  })

  function legacySegmentsDb(): string {
    const dir = mkdtempSync(join(tmpdir(), 'km-slug-'))
    const p = join(dir, 'legacy.db')
    tmpFiles.push(p)
    const raw = new Database(p)
    raw.exec(`
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
        updated_at TEXT NOT NULL
      );
    `)
    raw.run("INSERT INTO segments (id, display_name, assigned_code, updated_at) VALUES ('a', 'Pätkä 1', 'VARIKKO-1', '2026-01-01')")
    raw.run("INSERT INTO segments (id, display_name, updated_at) VALUES ('b', 'Pätkä 2', '2026-01-01')")
    raw.run("INSERT INTO segments (id, display_name, updated_at) VALUES ('c', 'Pätkä 2', '2026-01-01')")
    raw.close()
    return p
  }

  test('backfill: assigned_code voittaa nimen, törmäys suffiksoituu, idempotentti', () => {
    const p = legacySegmentsDb()
    const db = createDb(p)
    const rows = db.query<{ id: string; slug: string }, []>('SELECT id, slug FROM segments ORDER BY id').all()
    expect(rows.map(r => r.slug)).toEqual(['varikko-1', 'patka-2', 'patka-2-2'])
    db.close()

    // Idempotentti: toinen avaus ei muuta slugeja eikä kaadu (ALTER TABLE jo tehty).
    const db2 = createDb(p)
    const again = db2.query<{ id: string; slug: string }, []>('SELECT id, slug FROM segments ORDER BY id').all()
    expect(again.map(r => r.slug)).toEqual(['varikko-1', 'patka-2', 'patka-2-2'])
    db2.close()
  })
})

// T383/V276/V277: markers.template_id -backfill. Liitos on templates.id (V276); ehto on
// SANATARKKA label-täsmäys — V277:n ainoa konepoikkeus, ∴ ⊥ fuzzy ⊥ case-insensitive.
describe('T383/V276/V277: markers.template_id label-backfill', () => {
  function seedDb(): Database {
    const db = createDb(':memory:')
    const now = '2026-07-29T00:00:00Z'
    const tpl = (id: string, label: string) =>
      db.run('INSERT INTO templates (id, label, color, updated_at) VALUES (?, ?, ?, ?)', [id, label, '#000', now])
    tpl('vasen-1', 'vasen')
    tpl('ylos-1', 'Ylös')
    tpl('dup-a', 'Kaksoislabel')
    tpl('dup-b', 'Kaksoislabel')
    tpl('kymmenen-1', '10,1 km')
    return db
  }

  function marker(db: Database, id: string, label: string | null, templateId: string | null): void {
    db.run(
      `INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, label, template_id, updated_at)
       VALUES (?, 'sign', 65.6, 27.9, 0, '["30"]', 'suunniteltu', ?, ?, '2026-07-29T00:00:00Z')`,
      [id, label, templateId],
    )
  }

  const templateIdOf = (db: Database, id: string): string | null =>
    db.query<{ template_id: string | null }, [string]>('SELECT template_id FROM markers WHERE id = ?')
      .get(id)?.template_id ?? null

  test('V276: sanatarkka label-täsmäys täyttää template_id:n', () => {
    const db = seedDb()
    marker(db, 'M1', 'vasen', null)
    marker(db, 'M2', 'Ylös', null)
    backfillMarkerTemplateIds(db)
    expect(templateIdOf(db, 'M1')).toBe('vasen-1')
    expect(templateIdOf(db, 'M2')).toBe('ylos-1')
    db.close()
  })

  test('V277: täsmäämätön label jää nulliksi — ⊥ fuzzy, ⊥ case-insensitive', () => {
    const db = seedDb()
    marker(db, 'M1', 'VASEN', null)      // case-ero
    marker(db, 'M2', '10,1km', null)     // välilyöntiero
    marker(db, 'M3', 'Taittopöytä', null) // vieras nimi
    marker(db, 'M4', null, null)          // ei labelia lainkaan
    backfillMarkerTemplateIds(db)
    expect(templateIdOf(db, 'M1')).toBeNull()
    expect(templateIdOf(db, 'M2')).toBeNull()
    expect(templateIdOf(db, 'M3')).toBeNull()
    expect(templateIdOf(db, 'M4')).toBeNull()
    db.close()
  })

  test('V277: duplikaattilabel (COUNT>1) ⊥ päivitä — monitulkintainen on ihmisen asia', () => {
    const db = seedDb()
    marker(db, 'M1', 'Kaksoislabel', null)
    backfillMarkerTemplateIds(db)
    expect(templateIdOf(db, 'M1')).toBeNull()
    db.close()
  })

  test('jo linkatun merkin template_id ⊥ ylikirjoitu', () => {
    const db = seedDb()
    marker(db, 'M1', 'vasen', 'kasin-asetettu')
    backfillMarkerTemplateIds(db)
    expect(templateIdOf(db, 'M1')).toBe('kasin-asetettu')
    db.close()
  })

  test('idempotentti: 2. ajo päivittää 0 riviä', () => {
    const db = seedDb()
    marker(db, 'M1', 'vasen', null)
    marker(db, 'M2', 'Taittopöytä', null)
    backfillMarkerTemplateIds(db)
    expect(templateIdOf(db, 'M1')).toBe('vasen-1')

    // Toinen ajo: WHERE template_id IS NULL sulkee jo linkatun pois ∴ vain M2 tarkastellaan,
    // eikä sekään täsmää → 0 muutosta.
    const before = db.query<{ id: string; template_id: string | null }, []>(
      'SELECT id, template_id FROM markers ORDER BY id',
    ).all()
    backfillMarkerTemplateIds(db)
    const after = db.query<{ id: string; template_id: string | null }, []>(
      'SELECT id, template_id FROM markers ORDER BY id',
    ).all()
    expect(after).toEqual(before)
    db.close()
  })

  test('createDb ajaa backfillin automaattisesti eikä kaadu tyhjään kantaan', () => {
    expect(() => {
      const db = createDb(':memory:')
      db.close()
    }).not.toThrow()
  })
})
