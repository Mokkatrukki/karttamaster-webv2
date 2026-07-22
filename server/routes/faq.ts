import { Hono } from 'hono'
import type { Database } from 'bun:sqlite'
import type { AuthEnv } from '../middleware/auth'
import { requireAuth } from '../middleware/auth'
import { getSetting, SETTING_FAQ_MARKDOWN } from '../settings'

// T269/V190: FAQ-sisältö talkoolais-hubille. Luku ∀ autentikoitu (talkoolainen tai järjestäjä),
// kirjoitus admin-vain (admin.ts PUT /api/admin/faq). Renderöinti sanitoidaan clientissä (V190).
export const faqRoutes = new Hono<AuthEnv>()

faqRoutes.get('/', requireAuth(), (c) => {
  const db: Database = c.get('db')
  return c.json({ markdown: getSetting(db, SETTING_FAQ_MARKDOWN) ?? '' })
})
