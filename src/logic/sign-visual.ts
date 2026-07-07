import type { SignTemplate } from './sign-library'

const MAX_PARTS = 4

// V99: sign-visualin valintajärjestys kuva > ikoni > compactLabel(label).
export type SignVisual =
  | { kind: 'image'; src: string }
  | { kind: 'icon'; id: string }
  | { kind: 'label'; text: string }

// V99/T160: kompakti kartta-teksti johdetaan labelista — 3 ekaa merkkiä isolla.
// Ei erillistä shortLabel-kenttää. Puhdas: ei DOM:ia, ei riippuvuuksia. Tyhjä → ''.
export function compactLabel(label: string): string {
  return label.slice(0, 3).toUpperCase()
}

// Puhdas valintafunktio — ei DOM:ia, ei Vite-glob-riippuvuutta. imageSrc resolvoidaan
// kutsujassa (signImageSrc), jotta precedence-logiikka on testattava ilman assetteja.
// V99-precedence: kuva jos src on, muuten Lucide-ikoni (iconId), muuten compactLabel(label).
export function signVisual(
  template: Pick<SignTemplate, 'iconId' | 'label'>,
  imageSrc?: string,
): SignVisual {
  if (imageSrc) return { kind: 'image', src: imageSrc }
  if (template.iconId) return { kind: 'icon', id: template.iconId }
  return { kind: 'label', text: compactLabel(template.label) }
}

// V107: yhdistelmämerkki — pystypino kepissä, parts[0] ylin, max 4 osaa. Per-osa
// kuva>ikoni-precedence, EI label-fallbackia (combo-osa on aina tarkoituksella valittu).
// Ei parts-kenttää → sama 1-elementin taulukko kuin signVisual (backward-compat).
// resolveImageSrc pidetään erillisenä parametrina — pysyy testattavana ilman Vite-assetteja.
export function signVisualParts(
  template: Pick<SignTemplate, 'iconId' | 'label' | 'imageId' | 'parts'>,
  resolveImageSrc: (imageId?: string) => string | undefined,
): SignVisual[] {
  const parts = template.parts?.slice(0, MAX_PARTS)
  if (parts && parts.length > 0) {
    return parts.map((p): SignVisual => {
      const src = resolveImageSrc(p.imageId)
      if (src) return { kind: 'image', src }
      if (p.iconId) return { kind: 'icon', id: p.iconId }
      return { kind: 'label', text: '' }
    })
  }
  return [signVisual(template, resolveImageSrc(template.imageId))]
}
