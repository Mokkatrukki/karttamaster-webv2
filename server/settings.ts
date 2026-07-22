import type { Database } from 'bun:sqlite'

// T267/V188: yleiskäyttöinen key-value-asetustaulu. Talkoolaisten yleissalasana (hash)
// ja FAQ-markdown (T269) elävät tässä — ei omaa taulua kummallekaan.

export const SETTING_TALKOO_PASSWORD_HASH = 'talkoo_password_hash'
export const SETTING_FAQ_MARKDOWN = 'faq_markdown'

export function getSetting(db: Database, key: string): string | null {
  const row = db.query<{ value: string }, [string]>('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : null
}

export function setSetting(db: Database, key: string, value: string): void {
  db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  )
}
