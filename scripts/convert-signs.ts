#!/usr/bin/env bun
// T161: kylttikuvien konversio-pipeline (dev-työkalu, EI runtime).
// PNG-kyltit → src/assets/signs/<id>.webp — sign-images.ts glob-import poimii ne
// automaattisesti (T158/V99). Uudelleenajettava & idempotentti (ylikirjoittaa).
//
// Käyttö:  bun scripts/convert-signs.ts ["<lähdekansio>"]
//   oletus lähdekansio: "Kyltit Syöte MTB"
//
// Väripohja korjataan ENNEN pienennystä: indexed/colormap-PNG → truecolor RGBA,
// muuten 8-bit-paletin reunat rikkoutuvat resizessä. Sitten trim + Lanczos + webp.
//
// Ainoa src-importti on puhdas signIdFromFilename — ei muuta runtimea.
import { readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { signIdFromFilename } from '../src/logic/sign-id-slug'

const SRC_DIR = process.argv[2] ?? 'Kyltit Syöte MTB'
const OUT_DIR = 'src/assets/signs'
const MAX_DIM = 256 // pisin sivu px

type Row = {
  source: string
  id: string
  dims: string
  out: string
  status: 'ok' | 'skip-collision' | 'skip-empty-id' | 'fail'
}

function identifyDims(path: string): string {
  const p = Bun.spawnSync(['magick', 'identify', '-format', '%wx%h', path])
  return p.success ? p.stdout.toString().trim() : '?'
}

// Väripohja truecoloriksi ENNEN resizeä → -type TrueColorAlpha ensin.
// -filter Lanczos asetetaan ennen -resize. -trim +repage poistaa tyhjän reunan.
// -resize WxH (ilman '!') säilyttää kuvasuhteen, mahtuu MAX_DIM-ruutuun.
function convert(src: string, out: string): boolean {
  const p = Bun.spawnSync([
    'magick',
    src,
    '-type', 'TrueColorAlpha',
    '-trim', '+repage',
    '-filter', 'Lanczos',
    '-resize', `${MAX_DIM}x${MAX_DIM}`,
    '-quality', '90',
    out,
  ])
  if (!p.success) process.stderr.write(p.stderr.toString())
  return p.success
}

function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`Lähdekansio puuttuu: "${SRC_DIR}"`)
    process.exit(1)
  }
  mkdirSync(OUT_DIR, { recursive: true })

  const pngs = readdirSync(SRC_DIR)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort()

  // Törmäysten esitunnistus: id → lähdetiedostot.
  const idToSources = new Map<string, string[]>()
  for (const f of pngs) {
    const id = signIdFromFilename(f)
    const arr = idToSources.get(id) ?? []
    arr.push(f)
    idToSources.set(id, arr)
  }

  const rows: Row[] = []
  for (const f of pngs) {
    const src = join(SRC_DIR, f)
    const id = signIdFromFilename(f)
    const dims = identifyDims(src)

    if (!id) {
      rows.push({ source: f, id: '(tyhjä)', dims, out: '—', status: 'skip-empty-id' })
      continue
    }
    if ((idToSources.get(id)?.length ?? 0) > 1) {
      // Törmäys → EI kirjoiteta (ambiguous); kuratointi ratkaisee uudelleennimeämällä.
      rows.push({ source: f, id, dims, out: '—', status: 'skip-collision' })
      continue
    }
    const out = join(OUT_DIR, `${id}.webp`)
    const ok = convert(src, out)
    rows.push({ source: f, id, dims, out, status: ok ? 'ok' : 'fail' })
  }

  // Mapping-raportti.
  console.log(`\nSign-konversio: ${SRC_DIR} → ${OUT_DIR}\n`)
  for (const r of rows) {
    const mark = r.status === 'ok' ? '✓' : '✗'
    console.log(`${mark} ${r.source}`)
    console.log(`    id=${r.id}  dims=${r.dims}  → ${r.out}  [${r.status}]`)
  }

  const ok = rows.filter((r) => r.status === 'ok').length
  const collisions = [...idToSources.entries()].filter(([, s]) => s.length > 1)
  const emptyIds = rows.filter((r) => r.status === 'skip-empty-id')
  const fails = rows.filter((r) => r.status === 'fail')

  console.log(`\nYhteenveto: ${ok}/${pngs.length} kirjoitettu.`)

  if (collisions.length) {
    console.error(`\nID-TÖRMÄYKSET (${collisions.length}) — ei kirjoitettu, nimeä uudelleen:`)
    for (const [id, srcs] of collisions) {
      console.error(`  "${id}" ← ${srcs.join(', ')}`)
    }
  }
  if (emptyIds.length) {
    console.error(`\nTYHJÄ ID (${emptyIds.length}):`)
    for (const r of emptyIds) console.error(`  ${r.source}`)
  }
  if (fails.length) {
    console.error(`\nMAGICK-VIRHE (${fails.length}):`)
    for (const r of fails) console.error(`  ${r.source}`)
  }

  // Törmäys / tyhjä id / magick-virhe → epäonnistunut ajo.
  if (collisions.length || emptyIds.length || fails.length) process.exit(1)
}

main()
