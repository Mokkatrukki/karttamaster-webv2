// T307/V218: kartan katselu-/muokkaustila. Puhdas tilalogiikka — EI DOM:ia, EI Leafletia.
//
// Käyttäjätarve (kenttähavainto): "muokkaa-näkymä erikseen ettei vahingossa siirtele merkkejä".
// Kartta on talkoolaisen päänavigointi: panorointi ja zoomaus hanskoilla osuu helposti merkkiin
// → merkki siirtyi vahingossa (B121-suku). Ratkaisu: kaikki kartalla MUTATOIVAT eleet (merkin
// raahaus, klikillä/tuplaklikillä sijoitus, pätkän rajakahvat) elävät muokkaustilan alla.
//
// DEFAULT 'katselu' JOKAISELLA sivunlatauksella — tilaa EI persistoida (localStorage/sessionStorage).
// Persistointi tarkoittaisi että reloadin jälkeen kartta on taas "liukas" vaikka käyttäjä ei
// muista jättäneensä muokkaustilan päälle = juuri se vahinkomuokkaus jota tämä estää.

export type MapMode = 'katselu' | 'muokkaus'

export const DEFAULT_MAP_MODE: MapMode = 'katselu'

// --- Puhtaat funktiot (ei tilaa) ---

export function toggleMapMode(mode: MapMode): MapMode {
  return mode === 'katselu' ? 'muokkaus' : 'katselu'
}

/** Merkin raahaus kartalla. V218: vain muokkaustilassa (V150-rajat pätevät sen lisäksi). */
export function canDragMarkers(mode: MapMode): boolean {
  return mode === 'muokkaus'
}

/** Merkin sijoitus kartan klikillä/tuplaklikillä (PlaceMode). V218. */
export function canPlaceMarkers(mode: MapMode): boolean {
  return mode === 'muokkaus'
}

/** Pätkän rajakahvojen raahaus kartalla (segment-overlay.enterEditMode). V218. */
export function canDragSegmentBounds(mode: MapMode): boolean {
  return mode === 'muokkaus'
}

// --- Tilaolio (yksi totuus, jota UI ohjaa ja kuuntelee) ---

export interface MapModeState {
  get(): MapMode
  /** Asettaa tilan. Palauttaa uuden tilan. Sama arvo → ei kuuntelijakutsuja. */
  set(mode: MapMode): MapMode
  /** Vaihtaa katselu↔muokkaus. Palauttaa uuden tilan. */
  toggle(): MapMode
  isEditing(): boolean
  canDragMarkers(): boolean
  canPlaceMarkers(): boolean
  canDragSegmentBounds(): boolean
  /** Tilaa muutosilmoitukset. Palauttaa peruutusfunktion. */
  onChange(listener: (mode: MapMode) => void): () => void
}

export function createMapModeState(initial: MapMode = DEFAULT_MAP_MODE): MapModeState {
  let mode: MapMode = initial
  const listeners = new Set<(m: MapMode) => void>()

  const emit = (): void => { listeners.forEach(l => l(mode)) }

  const state: MapModeState = {
    get: () => mode,
    set(next) {
      if (next === mode) return mode
      mode = next
      emit()
      return mode
    },
    toggle() {
      return state.set(toggleMapMode(mode))
    },
    isEditing: () => mode === 'muokkaus',
    canDragMarkers: () => canDragMarkers(mode),
    canPlaceMarkers: () => canPlaceMarkers(mode),
    canDragSegmentBounds: () => canDragSegmentBounds(mode),
    onChange(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  return state
}

// Sovelluksen jaettu tila (yksi instanssi per sivunlataus, ⊥ persistointia). Kaikki portit
// (markers-wiring, place-mode, segments-wiring) ja UI-toggle (T308) lukevat/ohjaavat TÄTÄ —
// ei rinnakkaisia mekanismeja (V218). Moduulitila nollautuu joka latauksessa → default katselu.
export const mapMode: MapModeState = createMapModeState()
