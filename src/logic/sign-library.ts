const LS_KEY = 'karttamaster-sign-library'
const STORE_VERSION = 2 // T156: bump 1→2 — v1 UUID-id:t hylätään (greenfield reset, ei migraatiota)

// V97: template-id käsin annettu, filename-safe (toimii export-type-koodina + kuva-avaimena)
const ID_RE = /^[A-Za-z0-9_-]+$/

interface StoredLibrary {
  version: number
  templates: SignTemplate[]
}

export type IdValidationReason = 'empty' | 'format' | 'duplicate'
export type IdValidation = { valid: true } | { valid: false; reason: IdValidationReason }

// V97: validoi käsin annettu template-id ennen createTemplatea (UI näyttää syyn)
export function validateTemplateId(library: SignLibrary, id: string): IdValidation {
  if (!id) return { valid: false, reason: 'empty' }
  if (!ID_RE.test(id)) return { valid: false, reason: 'format' }
  if (library.has(id)) return { valid: false, reason: 'duplicate' }
  return { valid: true }
}

// V107: yhdistelmämerkin yksi osa — kuva>ikoni-precedence, EI label-fallbackia (aina tarkoituksella valittu)
export interface SignPart {
  iconId?: string
  imageId?: string
}

export interface SignTemplate {
  id: string
  label: string       // display name, e.g. "Oikealle" — kompakti kartta-teksti johdetaan tästä (V99/T160 compactLabel)
  color: string       // hex color for icon and swatch
  description: string // free text, e.g. "Käänny oikealle"
  favorite: boolean
  // V17x/T25x: keppi POISTETTU templatesta — malli = kylttipinta (yksi tunnus). Kiinnitystapa
  // (keppi/irto) elää nyt inventaariorivillä (InventoryItem.keppi), ei mallissa. Ks. signDisplayLabel.
  iconId?: string     // V50: optional Lucide icon name; if set, shown instead of compactLabel in circle
  imageId?: string    // V99/T158: optional template image key (convention = template.id); resolves src/assets/signs/<id>.webp
  parts?: SignPart[]  // V107: yhdistelmämerkki — pystypino kepissä, parts[0] ylin, max 4 osaa (ylimenevät typistetään)
}

/**
 * Näyttönimi (V17x): keppi=false → 'label - irto', muuten pelkkä label. keppi on RIVIN attribuutti
 * (InventoryItem.keppi), EI mallin — sama kylttipinta voi olla kepillä TAI irto samalla tunnuksella.
 * Puhdas, ei DOM. Käytetään VAIN inventaarion rivinäytössä (kartta/kirjasto = pelkkä tpl.label).
 * HUOM: kartan compactLabel-lyhenne johdetaan RAAKALABELISTA (tpl.label), ei tästä.
 */
export function signDisplayLabel(label: string, keppi?: boolean | null): string {
  return keppi === false ? `${label} - irto` : label
}

const MAX_PARTS = 4
function capParts(parts?: SignPart[]): SignPart[] | undefined {
  return parts ? parts.slice(0, MAX_PARTS) : parts
}

export type SignLibrary = Map<string, SignTemplate>

export function createLibrary(): SignLibrary {
  return new Map()
}

// V97: id on pakollinen, käsin annettu & uniikki. Ei random-UUID:ta.
// Heittää jos id on virheellinen/duplikaatti — kutsuja validoi ensin (validateTemplateId).
export function createTemplate(
  library: SignLibrary,
  template: Omit<SignTemplate, 'id'>,
  id: string,
): SignTemplate {
  const v = validateTemplateId(library, id)
  if (!v.valid) throw new Error(`createTemplate: kelvoton id "${id}" (${v.reason})`)
  const entry: SignTemplate = { id, ...template, parts: capParts(template.parts) }
  library.set(id, entry)
  return entry
}

export function updateTemplate(
  library: SignLibrary,
  id: string,
  patch: Partial<Omit<SignTemplate, 'id'>>,
): SignTemplate | null {
  const existing = library.get(id)
  if (!existing) return null
  const updated = { ...existing, ...patch, ...(patch.parts !== undefined ? { parts: capParts(patch.parts) } : {}) }
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
    const stored: StoredLibrary = { version: STORE_VERSION, templates: Array.from(library.values()) }
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
      (parsed as StoredLibrary).version !== STORE_VERSION ||
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
