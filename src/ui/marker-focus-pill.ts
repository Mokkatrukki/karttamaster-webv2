// T335/V243: korostustilan pysyvä poistumis-affordanssi. Sama kuvio kuin muokkaustilan
// pilleri (T308/V219, `map-mode-toggle.ts`): tila kerrotaan SANOIN, ei pelkällä värillä, ja
// se näkyy niin kauan kuin tila on päällä.
//
// Miksi oma komponentti eikä modaalin sisäinen indikaattori: korostus kytketään pätkämodaalista,
// joka sulkeutuu heti perään. Modaalin sisällä elävä poistumisnappi katoaa tilan kanssa →
// käyttäjä jää himmennettyyn karttaan ilman ulospääsyä (B131:n umpikuja-luokka).
//
// Tila EI asu täällä eikä localStoragessa (korostus on hetken työkalu, ei asetus) — omistaja
// on wiring, tämä vain heijastaa sen.

export interface MarkerFocusPillOptions {
  /** Pilleri. Oletus: `#marker-focus-pill`. */
  pill?: HTMLElement | null
  /** Tekstisolu. Oletus: `#marker-focus-pill-label`. */
  label?: HTMLElement | null
  /** Nollausnappi. Oletus: `#btn-marker-focus-clear`. */
  clearBtn?: HTMLElement | null
  /** Juuri josta oletusselektorit haetaan (testit antavat fragmentin). */
  root?: ParentNode
  /** ✕-klikki. Wiring nollaa tilan tässä. */
  onClear: () => void
}

export interface MarkerFocusPillHandle {
  /** Näytä pilleri pätkän nimellä. */
  show(segmentName: string): void
  /** Piilota pilleri (tila pois). */
  hide(): void
  /** Onko pilleri näkyvissä. */
  isVisible(): boolean
  /** Irrota kuuntelija (re-init ei kasaa kuuntelijoita). */
  destroy(): void
}

// DESIGN.md §K MarkerFocus: pillerin teksti on `Korostus: <pätkän nimi>` + erillinen ✕.
// Ei ikoniprefiksiä — ✕ on jo pillerin oma symboli, ja kaksi symbolia samassa pillerissä
// kilpailee siitä kumpaa painetaan.
export function pillText(segmentName: string): string {
  return `Korostus: ${segmentName}`
}

export function initMarkerFocusPill(opts: MarkerFocusPillOptions): MarkerFocusPillHandle {
  const root: ParentNode = opts.root ?? document
  const pill = opts.pill !== undefined ? opts.pill : root.querySelector<HTMLElement>('#marker-focus-pill')
  const label = opts.label !== undefined ? opts.label : root.querySelector<HTMLElement>('#marker-focus-pill-label')
  const clearBtn = opts.clearBtn !== undefined ? opts.clearBtn : root.querySelector<HTMLElement>('#btn-marker-focus-clear')

  const onClick = (e: Event): void => {
    e.preventDefault()
    opts.onClear()
  }
  clearBtn?.addEventListener('click', onClick)

  return {
    show(segmentName: string): void {
      if (label) label.textContent = pillText(segmentName)
      pill?.removeAttribute('hidden')
    },
    hide(): void {
      pill?.setAttribute('hidden', '')
    },
    isVisible(): boolean {
      return !!pill && !pill.hasAttribute('hidden')
    },
    destroy(): void {
      clearBtn?.removeEventListener('click', onClick)
    },
  }
}
