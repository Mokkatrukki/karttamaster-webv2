import type { SignTemplate } from './sign-library'

// V99: sign-visualin valintajärjestys kuva > ikoni > shortLabel.
export type SignVisual =
  | { kind: 'image'; src: string }
  | { kind: 'icon'; id: string }
  | { kind: 'label'; text: string }

// Puhdas valintafunktio — ei DOM:ia, ei Vite-glob-riippuvuutta. imageSrc resolvoidaan
// kutsujassa (signImageSrc), jotta precedence-logiikka on testattava ilman assetteja.
// V99-precedence: kuva jos src on, muuten Lucide-ikoni (iconId), muuten shortLabel-teksti.
export function signVisual(
  template: Pick<SignTemplate, 'iconId' | 'shortLabel'>,
  imageSrc?: string,
): SignVisual {
  if (imageSrc) return { kind: 'image', src: imageSrc }
  if (template.iconId) return { kind: 'icon', id: template.iconId }
  return { kind: 'label', text: template.shortLabel }
}
