import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'

// V100: snapshot kattaa koko datasetin, ei vain markers-taulua.
// Yksi kanoninen serialisointi — käytetään sekä admin-routessa että
// snapshot-schedulerissa (ei copy-pastea, B66).

export interface DatasetV1 {
  version: 1
  markers: Record<string, unknown>[]
  segments: Record<string, unknown>[]
  areas: Record<string, unknown>[]
  areaFeatures: Record<string, unknown>[]
}

/** Lue koko dataset kannasta (SELECT * → kaikki sarakkeet round-trippaavat). */
export function serializeDataset(db: Database): DatasetV1 {
  return {
    version: 1,
    markers: db.query('SELECT * FROM markers').all() as Record<string, unknown>[],
    segments: db.query('SELECT * FROM segments').all() as Record<string, unknown>[],
    areas: db.query('SELECT * FROM areas').all() as Record<string, unknown>[],
    areaFeatures: db.query('SELECT * FROM area_features').all() as Record<string, unknown>[],
  }
}

/**
 * Kirjoita rivit tauluun sarakkeet objektin avaimista — geneerinen, jotta
 * uudet sarakkeet round-trippaavat ilman koodimuutosta (aiempi restore droppasi
 * color/short_label/description/label kovakoodatulla INSERT-listalla).
 */
export function insertRows(db: Database, table: string, rows: Record<string, unknown>[]): void {
  for (const row of rows) {
    const cols = Object.keys(row)
    if (cols.length === 0) continue
    const colList = cols.map((c) => `"${c}"`).join(', ')
    const placeholders = cols.map(() => '?').join(', ')
    const values = cols.map((k) => row[k] as never)
    db.run(`INSERT INTO ${table} (${colList}) VALUES (${placeholders})`, values)
  }
}

/**
 * Korvaa koko dataset atomisesti. Caller vastaa transaktiosta (V24/V100).
 * Poistojärjestys child→parent, insert parent→child (area_features FK areas).
 */
export function restoreDataset(db: Database, data: DatasetV1): void {
  db.run('DELETE FROM area_features')
  db.run('DELETE FROM areas')
  db.run('DELETE FROM markers')
  db.run('DELETE FROM segments')
  insertRows(db, 'markers', data.markers)
  insertRows(db, 'segments', data.segments)
  insertRows(db, 'areas', data.areas)
  insertRows(db, 'area_features', data.areaFeatures)
}

/**
 * Ota snapshot koko datasetista + prune 20 uusimpaan. Kanoninen luontikohta —
 * sekä manuaali, restore, että yökopio kutsuvat tätä.
 * markers_json täytetään yhä (NOT NULL + legacy-lukijat), dataset_json on totuus.
 */
export function createSnapshot(db: Database, label: string, createdBy: string, trigger: string): void {
  const dataset = serializeDataset(db)
  db.run(
    'INSERT INTO snapshots (id, label, markers_json, dataset_json, created_at, created_by, trigger) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [randomUUID(), label, JSON.stringify(dataset.markers), JSON.stringify(dataset), new Date().toISOString(), createdBy, trigger],
  )
  // Prune: keep max 20 by insertion order (rowid monotone, avoids timestamp ties)
  db.run(`
    DELETE FROM snapshots WHERE rowid NOT IN (
      SELECT rowid FROM snapshots ORDER BY rowid DESC LIMIT 20
    )
  `)
}
