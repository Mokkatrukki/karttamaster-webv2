import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth, requireRole } from '../middleware/auth'
import { getSetting, setSetting, SETTING_ACTIVE_PHASE } from '../settings'

// T426/V317: AKTIIVINEN VAIHE ON JÄRJESTELMÄN TILA, ei katsojan näkymäsuodin.
//
// Ennen tätä vaihe eli `localStorage`ssa (T148) ∴ jokaisella selaimella oli oma totuus:
// järjestäjä siirtyi purkuun ja talkoolainen näki yhä asetusvaiheen pätkät. Tapahtuma on
// yksi tapahtuma — kun purku alkaa, se alkaa kaikille.
//
// Luku on ∀ autentikoidun oikeus: talkoolainen TARVITSEE vaiheen tietääkseen mitä on menossa.
//
// T432/V321: KIRJOITUS ON ADMIN-ONLY. Aiemmin järjestäjä+admin — mutta se oikeus syntyi
// vahingossa siitä että katselu & komento olivat sama kytkin (`PhaseSwitcher` kirjoitti
// jokaisesta valinnasta tänne) ∴ järjestäjä ⊥ voinut katsoa purkupätkiä siirtämättä koko
// talkooporukkaa purkuun. Katselu asuu nyt järjestäjän omassa `localStorage`ssa (T434) &
// tämä reitti on se mitä se nimensä mukaan on: tapahtuman käynnistys, adminin komento.

const VALID_PHASES = ['asettaminen', 'tarkastus', 'purku'] as const
type Phase = (typeof VALID_PHASES)[number]

export const DEFAULT_PHASE: Phase = 'asettaminen'

export const phaseRoutes = new Hono<AuthEnv>()

phaseRoutes.get('/', requireAuth(), (c) => {
  const db: Database = c.get('db')
  const stored = getSetting(db, SETTING_ACTIVE_PHASE)
  // Tuntematon arvo kannassa (käsin muokattu / vanha enum) → oletus, ei 500. Sama V14-linja
  // kuin muillakin lukupoluilla: rikkinäinen data ⊥ saa kaataa koko sovelluksen käynnistystä.
  const phase = VALID_PHASES.includes(stored as Phase) ? (stored as Phase) : DEFAULT_PHASE
  return c.json({ phase })
})

phaseRoutes.put('/', requireAuth(), requireRole('admin'), async (c) => {
  const db: Database = c.get('db')
  const body = await c.req.json<{ phase?: string }>()
  // Tuntematon arvo → 400. Hiljainen putoaminen oletukseen olisi pahin mahdollinen: järjestäjä
  // luulisi vaihtaneensa vaiheen ja koko talkooporukka tekisi väärää työtä.
  if (!body.phase || !VALID_PHASES.includes(body.phase as Phase)) {
    return c.json({ error: 'invalid_phase' }, 400)
  }
  setSetting(db, SETTING_ACTIVE_PHASE, body.phase)
  return c.json({ phase: body.phase })
})
