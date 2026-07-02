import { randomUUID } from 'crypto'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { GpkgFeatureCollection } from './geojson'

export function hasOgr2ogr(): boolean {
  return Bun.which('ogr2ogr') !== null
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'gpkg-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function runOgr2ogr(args: string[]): Promise<void> {
  const proc = Bun.spawn(['ogr2ogr', ...args], { stdout: 'pipe', stderr: 'pipe' })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`ogr2ogr failed (exit ${exitCode}): ${stderr}`)
  }
}

export async function geoJSONToGpkg(fc: GpkgFeatureCollection, layerName: string): Promise<Uint8Array> {
  return withTempDir(async (dir) => {
    const geojsonPath = join(dir, `${randomUUID()}.geojson`)
    const gpkgPath = join(dir, `${randomUUID()}.gpkg`)
    await Bun.write(geojsonPath, JSON.stringify(fc))
    await runOgr2ogr(['-f', 'GPKG', gpkgPath, geojsonPath, '-nln', layerName])
    return new Uint8Array(await Bun.file(gpkgPath).arrayBuffer())
  })
}

// Ei layer-nimeä: QGIS nimeää layerin uudelleen tallennuksen yhteydessä (esim.
// "kyltit" -> "2026_testikyltit__kyltit"), joten ogr2ogr saa valita ainoan/ensimmäisen
// layerin tiedostosta sen sijaan että vaadittaisiin täsmällistä nimeä.
export async function gpkgToGeoJSON(gpkgBytes: Uint8Array): Promise<GpkgFeatureCollection> {
  return withTempDir(async (dir) => {
    const gpkgPath = join(dir, `${randomUUID()}.gpkg`)
    const geojsonPath = join(dir, `${randomUUID()}.geojson`)
    await Bun.write(gpkgPath, gpkgBytes)
    await runOgr2ogr(['-f', 'GeoJSON', geojsonPath, gpkgPath])
    return JSON.parse(await Bun.file(geojsonPath).text()) as GpkgFeatureCollection
  })
}
