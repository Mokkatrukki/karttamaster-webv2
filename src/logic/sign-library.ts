const LS_KEY = 'karttamaster-sign-library'

interface StoredLibrary {
  version: number
  templates: SignTemplate[]
}

export interface SignTemplate {
  id: string
  label: string       // display name, e.g. "Oikealle"
  shortLabel: string  // compact label for map icons, e.g. "O"
  color: string       // hex color for icon and swatch
  description: string // free text, e.g. "Käänny oikealle"
  favorite: boolean
  iconId?: string     // V50: optional Lucide icon name; if set, shown instead of shortLabel in circle
}

export type SignLibrary = Map<string, SignTemplate>

export function createLibrary(): SignLibrary {
  return new Map()
}

export function createTemplate(
  library: SignLibrary,
  template: Omit<SignTemplate, 'id'>,
  id?: string,
): SignTemplate {
  const entry: SignTemplate = { id: id ?? crypto.randomUUID(), ...template }
  library.set(entry.id, entry)
  return entry
}

export function updateTemplate(
  library: SignLibrary,
  id: string,
  patch: Partial<Omit<SignTemplate, 'id'>>,
): SignTemplate | null {
  const existing = library.get(id)
  if (!existing) return null
  const updated = { ...existing, ...patch }
  library.set(id, updated)
  return updated
}

export function deleteTemplate(library: SignLibrary, id: string): boolean {
  return library.delete(id)
}

export function listTemplates(library: SignLibrary): SignTemplate[] {
  return Array.from(library.values())
}

export function listFavorites(library: SignLibrary): SignTemplate[] {
  return Array.from(library.values()).filter(t => t.favorite)
}

export function saveLibrary(library: SignLibrary): void {
  try {
    const stored: StoredLibrary = { version: 1, templates: Array.from(library.values()) }
    localStorage.setItem(LS_KEY, JSON.stringify(stored))
  } catch {
    console.warn('saveLibrary: failed to write localStorage')
  }
}

export function loadLibrary(): SignLibrary | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' || parsed === null ||
      (parsed as StoredLibrary).version !== 1 ||
      !Array.isArray((parsed as StoredLibrary).templates)
    ) {
      console.warn('loadLibrary: corrupt data, resetting')
      try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
      return null
    }
    const lib = createLibrary()
    for (const t of (parsed as StoredLibrary).templates) {
      if (t && typeof t.id === 'string') lib.set(t.id, t)
    }
    return lib
  } catch {
    console.warn('loadLibrary: parse error, resetting')
    try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
    return null
  }
}
