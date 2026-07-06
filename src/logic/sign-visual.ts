import type { SignTemplate } from './sign-library'

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
