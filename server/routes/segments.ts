import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'

interface SegmentRow {
  id: string
  route_ids: string | null
  primary_route_id: string | null
  start_dist: number | null
  end_dist: number | null
  assigned_code: string | null
  slug: string | null
  display_name: string | null
  description: string | null
  equipment: string
  phase: string
  inspected: number
  inspection_note: string | null
  completed: number
  linked_marker_ids: string | null
  excluded_marker_ids: string | null
  marker_type_filter: string | null
  track: string | null
  updated_at: string
}

function rowToSegment(row: SegmentRow) {
  return {
    // V141: reititön tehtävä — route-kentät null kannassa → undefined ulos.
    id: row.id,
    routeIds: row.route_ids ? (JSON.parse(row.route_ids) as string[]) : undefined,
    // T299/V211/B114: mitä reittiä startDist/endDist mittaavat. NULL = legacy → client
    // johtaa routeIds[0]:sta (segmentPrimaryRouteId), ei backfilliä.
    primaryRouteId: row.primary_route_id ?? undefined,
    startDist: row.start_dist ?? undefined,
    endDist: row.end_dist ?? undefined,
    assignedCode: row.assigned_code ?? undefined,
    // T297/V209: slug ∀ pätkällä — jakamatonkin avattavissa /s/<slug>.
    slug: row.slug ?? undefined,
    displayName: row.display_name ?? undefined,
    description: row.description ?? undefined,
    equipment: JSON.parse(row.equipment) as { name: string; count: number }[],
    phase: row.phase as 'asettaminen' | 'tarkastus' | 'purku',
    inspected: !!row.inspected,
    inspectionNote: row.inspection_note ?? undefined,
    completed: !!row.completed,
    // V140: reitittömän tehtävän merkkiliitos — eksplisiittiset id:t + dynaaminen tyyppisuodatin.
    linkedMarkerIds: row.linked_marker_ids ? (JSON.parse(row.linked_marker_ids) as string[]) : undefined,
    // T360/V259: järjestäjän ohitus — merkki pois pätkästä geometrian yli.
    excludedMarkerIds: row.excluded_marker_ids ? (JSON.parse(row.excluded_marker_ids) as string[]) : undefined,
    markerTypeFilter: row.marker_type_filter ?? undefined,
    // T360/V258: pätkän oma jälki. NULL = legacy → client johtaa sen rajoista (T361).
    track: row.track ? (JSON.parse(row.track) as { lat: number; lon: number; d: number }[]) : undefined,
  }
}

export const segmentRoutes = new Hono<AuthEnv>()

// Järjestäjä: hae kaikki segmentit
// T271/V188 (talkoolais-hub): talkoolainen näkee kaikki pätkät /patkat-hubissa (Model B,
// VISION "kaikki näkevät kaikkien" — avoimuus tarkoituksellista). Luku ∀ autentikoitu;
// mutaatiot (POST/PUT/DELETE alla) pysyvät järjestäjä+.
segmentRoutes.get('/', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const rows = db.query<SegmentRow, []>('SELECT * FROM segments ORDER BY start_dist ASC').all()
  return c.json(rows.map(rowToSegment))
})

// Järjestäjä: luo tai päivitä (upsert by id)
segmentRoutes.post('/', requireAuth(), requireRole('admin', 'järjestäjä'), async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{
    id?: string
    routeIds?: string[]
    primaryRouteId?: string
    startDist?: number
    endDist?: number
    assignedCode?: string
    slug?: string
    displayName?: string
    description?: string
    equipment?: { name: string; count: number }[]
    phase?: string
    inspected?: boolean
    inspectionNote?: string
    completed?: boolean
    linkedMarkerIds?: string[]
    excludedMarkerIds?: string[]
    markerTypeFilter?: string
    track?: { lat: number; lon: number; d: number }[]
  }>()

  const id = body.id ?? randomUUID()
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO segments (id, route_ids, primary_route_id, start_dist, end_dist, assigned_code, slug, display_name, description, equipment, phase, inspected, inspection_note, completed, linked_marker_ids, excluded_marker_ids, marker_type_filter, track, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       route_ids = excluded.route_ids,
       primary_route_id = excluded.primary_route_id,
       start_dist = excluded.start_dist,
       end_dist = excluded.end_dist,
       assigned_code = excluded.assigned_code,
       slug = excluded.slug,
       display_name = excluded.display_name,
       description = excluded.description,
       equipment = excluded.equipment,
       phase = excluded.phase,
       inspected = excluded.inspected,
       inspection_note = excluded.inspection_note,
       completed = excluded.completed,
       linked_marker_ids = excluded.linked_marker_ids,
       excluded_marker_ids = excluded.excluded_marker_ids,
       marker_type_filter = excluded.marker_type_filter,
       track = excluded.track,
       updated_at = excluded.updated_at`,
    [
      id,
      // V141: reititön tehtävä → route-kentät null kantaan.
      body.routeIds != null ? JSON.stringify(body.routeIds) : null,
      body.primaryRouteId ?? null,
      body.startDist ?? null,
      body.endDist ?? null,
      body.assignedCode?.toUpperCase() ?? null,
      // T297/V209: slug säilyy pienaakkosina (URL-luettavuus) — ei uppercase-normalisointia.
      body.slug ?? null,
      body.displayName ?? null,
      body.description ?? null,
      JSON.stringify(body.equipment ?? []),
      body.phase ?? 'asettaminen',
      body.inspected ? 1 : 0,
      body.inspectionNote ?? null,
      body.completed ? 1 : 0,
      // V140: merkkiliitos — tyhjä/puuttuva → null (ei tallenna tyhjää taulukkoa)
      body.linkedMarkerIds != null && body.linkedMarkerIds.length > 0 ? JSON.stringify(body.linkedMarkerIds) : null,
      body.excludedMarkerIds != null && body.excludedMarkerIds.length > 0 ? JSON.stringify(body.excludedMarkerIds) : null,
      body.markerTypeFilter ?? null,
      // T360/V258: jälki on pätkän geometrian totuus — tyhjä jälki tallentuu null:ina (legacy-tila).
      body.track != null && body.track.length > 0 ? JSON.stringify(body.track) : null,
      now,
    ],
  )

  const row = db.query<SegmentRow, [string]>('SELECT * FROM segments WHERE id = ?').get(id)!
  return c.json(rowToSegment(row), 201)
})

// Päivitä (patch). Järjestäjä+ kaikki kentät; talkoolainen vain oma pätkä + rajatut kentät (V93/V43).
segmentRoutes.put('/:id', requireAuth(), async (c) => {
  const db: Database = c.get('db')
  const session = c.get('session')
  const id = c.req.param('id')
  const raw = await c.req.json<Partial<{
    routeIds: string[]
    primaryRouteId: string
    startDist: number
    endDist: number
    assignedCode: string | null
    slug: string | null
    displayName: string
    description: string
    equipment: { name: string; count: number }[]
    phase: string
    inspected: boolean
    inspectionNote: string
    completed: boolean
    linkedMarkerIds: string[]
    excludedMarkerIds: string[]
    markerTypeFilter: string | null
    track: { lat: number; lon: number; d: number }[]
  }>>()

  const existing = db.query<SegmentRow, [string]>('SELECT * FROM segments WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'not_found' }, 404)

  const isOrganizer = session.role === 'admin' || session.role === 'järjestäjä'
  const isOwnTalkoolainen =
    session.role === 'talkoolainen' &&
    session.talkoolainen_code != null &&
    existing.assigned_code != null &&
    session.talkoolainen_code.toUpperCase() === existing.assigned_code.toUpperCase()
  // T306/V217/B119: Model B -talkoo-sessio (yleissalasana V188) EI kanna pätkäkoodia ∴ vanha
  // omistajuusehto hylkäsi sen aina → kaikki kenttätyö 403. Käyttäjäpäätös 2026-07-25: ei
  // hierarkiaa — kooditon sessio saa kenttätyöoikeuden ∀ pätkään. Sallittu kenttäjoukko (alla)
  // rajaa silti järjestäjän kentät pois.
  const isCodelessTalkoo = session.role === 'talkoolainen' && session.talkoolainen_code == null
  if (!isOrganizer && !isOwnTalkoolainen && !isCodelessTalkoo) return c.json({ error: 'forbidden' }, 403)

  // V93 (T224 laajennus): talkoolainen saa muuttaa oman pätkän kenttätyön kentät: inspected/
  // inspectionNote/startDist/endDist + equipment (varustelistan päivitys ennen lähtöä, VISION r42/239).
  const body = isOrganizer
    ? raw
    : {
        inspected: raw.inspected,
        inspectionNote: raw.inspectionNote,
        completed: raw.completed,
        startDist: raw.startDist,
        endDist: raw.endDist,
        equipment: raw.equipment,
        // T360/T363/V258: rajamuokkaus kentällä johtaa JÄLJEN uudelleen ∴ jäljen ! olla samassa
        // sallitussa joukossa kuin rajat. Muuten talkoolaisen siirto tallentaisi rajat mutta
        // jättäisi vanhan jäljen → jäsenyys (V259) jäisi vastaamaan rajaa jota ei enää ole.
        track: raw.track,
        // T416/V307: merkkiliitos on talkoolaiselle sallittu MUTTA vain ADDITIIVISENA — arvo
        // lasketaan alla unionina, ⊥ oteta clientin listaa totuutena. Ilman tätä kenttää
        // "Lisää tehtävääni" näyttäisi onnistuvan & katoaisi reloadissa (hiljainen datahäviö).
        linkedMarkerIds: raw.linkedMarkerIds,
        // `excludedMarkerIds` EI ole listalla: poisto on järjestäjän oikeus (V307).
      }

  // T416/V307: talkoolaisen patch = `existing ∪ body` ∴ hän ⊥ voi poistaa toisen lisäystä eikä
  // nollata listaa VANHENTUNEELLA clientilla (offline-outbox voi lähettää vanhan listan —
  // korvaus söisi välissä tehdyt lisäykset). Järjestäjän patch säilyy KORVAAVANA: hän omistaa
  // listan & poisto tapahtuu vain hänen kautta.
  const linkedPatch = ((): string | null => {
    if (!('linkedMarkerIds' in body) || body.linkedMarkerIds === undefined) return existing.linked_marker_ids
    if (isOrganizer) {
      return body.linkedMarkerIds.length > 0 ? JSON.stringify(body.linkedMarkerIds) : null
    }
    const current: string[] = existing.linked_marker_ids ? (JSON.parse(existing.linked_marker_ids) as string[]) : []
    const union = [...current, ...body.linkedMarkerIds.filter(id => !current.includes(id))]
    return union.length > 0 ? JSON.stringify(union) : null
  })()

  const now = new Date().toISOString()
  db.run(
    `UPDATE segments SET
      route_ids = ?, primary_route_id = ?, start_dist = ?, end_dist = ?, assigned_code = ?, slug = ?,
      display_name = ?, description = ?, equipment = ?, phase = ?,
      inspected = ?, inspection_note = ?, completed = ?, linked_marker_ids = ?, excluded_marker_ids = ?,
      marker_type_filter = ?, track = ?, updated_at = ?
     WHERE id = ?`,
    [
      'routeIds' in body && body.routeIds ? JSON.stringify(body.routeIds) : existing.route_ids,
      'primaryRouteId' in body && body.primaryRouteId ? body.primaryRouteId : existing.primary_route_id,
      body.startDist ?? existing.start_dist,
      body.endDist ?? existing.end_dist,
      'assignedCode' in body ? (body.assignedCode?.toUpperCase() ?? null) : existing.assigned_code,
      'slug' in body ? (body.slug ?? null) : existing.slug,
      'displayName' in body ? (body.displayName ?? existing.display_name) : existing.display_name,
      'description' in body && body.description !== undefined ? body.description : existing.description,
      'equipment' in body && body.equipment ? JSON.stringify(body.equipment) : existing.equipment,
      'phase' in body ? (body.phase ?? existing.phase) : existing.phase,
      body.inspected !== undefined ? (body.inspected ? 1 : 0) : existing.inspected,
      body.inspectionNote !== undefined ? body.inspectionNote : existing.inspection_note,
      body.completed !== undefined ? (body.completed ? 1 : 0) : existing.completed,
      // V140/V307: järjestäjän patch KORVAA, talkoolaisen on UNIONI (laskettu yllä).
      linkedPatch,
      'excludedMarkerIds' in body
        ? (body.excludedMarkerIds && body.excludedMarkerIds.length > 0 ? JSON.stringify(body.excludedMarkerIds) : null)
        : existing.excluded_marker_ids,
      'markerTypeFilter' in body ? (body.markerTypeFilter ?? null) : existing.marker_type_filter,
      // T360/V258: `'track' in body` ⊥ `body.track ?? existing` — patch joka EI mainitse jälkeä
      // säilyttää sen, mutta eksplisiittinen tyhjä jälki nollaa sen (paluu legacy-tilaan).
      'track' in body ? (body.track && body.track.length > 0 ? JSON.stringify(body.track) : null) : existing.track,
      now,
      id,
    ],
  )

  const row = db.query<SegmentRow, [string]>('SELECT * FROM segments WHERE id = ?').get(id)!
  return c.json(rowToSegment(row))
})

// Järjestäjä: poista
segmentRoutes.delete('/:id', requireAuth(), requireRole('admin', 'järjestäjä'), (c) => {
  const db: Database = c.get('db')
  const id = c.req.param('id')
  db.run('DELETE FROM segments WHERE id = ?', [id])
  return c.json({ ok: true })
})

// Talkoolainen: hae oma pätkä koodilla (auth vaaditaan — session.talkoolainen_code)
segmentRoutes.get('/by-code/:code', requireAuth(), (c) => {
  const db: Database = c.get('db')
  // T297/V209: slug ensin (∀ pätkällä), assigned_code legacy-fallbackina (vanhat jaetut linkit).
  const code = c.req.param('code').toUpperCase()
  const row = db.query<SegmentRow, [string]>(
    'SELECT * FROM segments WHERE UPPER(slug) = ?',
  ).get(code)
    ?? db.query<SegmentRow, [string]>(
      'SELECT * FROM segments WHERE assigned_code = ?',
    ).get(code)
  if (!row) return c.json({ error: 'not_found' }, 404)
  return c.json(rowToSegment(row))
})
