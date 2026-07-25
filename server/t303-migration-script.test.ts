import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createDb } from './db'
import { ROUTE_DEFS } from '../src/logic/route-defs'
import type { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// T303/V215/B117+B118: migraatioskripti KORJATTU muttei ajettu tuotantoon (§C-parkki).
// Testit vahtivat että seuraava ajo ei toista vahinkoa: reittilista tulee ROUTE_DEFSistä,
// primary on lähin reitti, kaukaiset orvot jätetään rauhaan ja --apply vaatii vahvistuksen.

const SCRIPT = join(import.meta.dir, '..', 'scripts', 'migrate-marker-routes.ts')

function run(args: string[]): { stdout: string; stderr: string; code: number } {
  const p = Bun.spawnSync(['bun', SCRIPT, ...args], { cwd: join(import.meta.dir, '..') })
  return {
    stdout: new TextDecoder().decode(p.stdout),
    stderr: new TextDecoder().decode(p.stderr),
    code: p.exitCode ?? -1,
  }
}

function seedMarker(db: Database, id: string, lat: number, lon: number): void {
  db.run(
    `INSERT INTO markers (id, type, lat, lon, distance_from_start, route_ids, status, updated_at)
     VALUES (?, 'nuoli', ?, ?, 0, '["vanha-reitti"]', 'suunniteltu', ?)`,
    [id, lat, lon, new Date().toISOString()],
  )
}

describe('T303/V215 — migraatioskripti', () => {
  let dir: string
  let dbPath: string
  let db: Database

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 't303-'))
    dbPath = join(dir, 'test.db')
    db = createDb(dbPath)
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  test('B117: reittilista = ROUTE_DEFS, sisältää 110km-siirtymän joka puuttui', () => {
    expect(ROUTE_DEFS.map(r => r.id)).toContain('smtb-110-siirtyma')
    expect(ROUTE_DEFS).toHaveLength(6)
  })

  test('B118: kaukainen orpo jätetään koskematta ja raportoidaan käsin', () => {
    // Helsinki — satoja kilometrejä Syötteestä
    seedMarker(db, 'kaukainen', 60.17, 24.94)
    const r = run([dbPath])
    expect(r.stdout).toContain('KÄSIN')
    expect(r.stdout).toMatch(/käsin-tarkistettavat=1/)

    const row = db.query<{ route_ids: string }, []>('SELECT route_ids FROM markers WHERE id = \'kaukainen\'').get()!
    expect(row.route_ids).toBe('["vanha-reitti"]') // dry-run ei kirjoita
  })

  test('dry-run on oletus — mitään ei kirjoiteta', () => {
    seedMarker(db, 'kaukainen', 60.17, 24.94)
    const r = run([dbPath])
    expect(r.stdout).toContain('Dry-run')
    expect(r.code).toBe(0)
  })

  test('--apply yksin ei riitä — vaatii eksplisiittisen vahvistuksen', () => {
    const r = run([dbPath, '--apply'])
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('--yes-i-checked-the-dry-run')
  })
})
