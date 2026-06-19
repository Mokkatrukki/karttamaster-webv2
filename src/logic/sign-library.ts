export interface SignTemplate {
  id: string
  label: string       // display name, e.g. "Oikealle"
  shortLabel: string  // compact label for map icons, e.g. "O"
  color: string       // hex color for icon and swatch
  description: string // free text, e.g. "Käänny oikealle"
  favorite: boolean
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
