// T336/V244/B137: pätkä & reitti ovat ERI tietoa mutta piirtyvät samaan pikseliin — yksi viiva
// = yksi kanava = toinen tieto katoaa. Casing-kuvio erottaa ne GEOMETRIALLA, ei värillä:
//
//   ┌─ pätkäväri, weight 15 (reuna 2px/puoli) ─ tunniste + status (dashArray/opacity)
//   │ ┌─ valkoinen erotin, weight 11 (halo 1px/puoli) ─ takaa kontrastin kummallekin
//   │ │ ┌─ reitin väri (sisus 9px) ─ mikä reitti tämä on
//
// Erotin ⊥ ole koriste. Ilman sitä reunus & sisus ovat vierekkäin ∴ V244 vaati niiden väliltä
// ≥3:1 — ehto joka on YLIMÄÄRITELTY (B137): reittiväri on lukittu kaistaan jonka toisessa päässä
// on taustakartan kontrasti & toisessa reittipillerin tekstin kontrasti, eikä mikään pätkäpaletti
// täytä 3:1:tä kaikille pareille (mitattu huonoin 2.19). Valkoista vasten kumpikin saa ≥3.4:1.
//
// Puhdas: palauttaa tyylikuvaukset, Leaflet vain soveltaa ∴ Vitest-pure.

export type SegmentLayerRole = 'casing' | 'separator' | 'core'

export interface SegmentLayerStyle {
  role: SegmentLayerRole
  color: string
  weight: number
  opacity: number
  dashArray?: string
  /** Vain YKSI kerros ottaa klikin — kaksi kuuntelijaa samasta klikistä = tuplalaukaisu. */
  interactive: boolean
}

/** Leveydet: näkyvä osuus per puoli = (ulompi − sisempi)/2 ⇒ pätkäreuna 2px, valkoinen halo 1px.
 *  Halo on ohut tarkoituksella: se on EROTIN ⊥ oma kanava — paksuna se lukisi valkoisena viivana
 *  kartalla & söisi molempien värien pinta-alaa. */
export const CASING_WEIGHT = 15
export const SEPARATOR_WEIGHT = 11
export const CORE_WEIGHT = 9
export const SEPARATOR_COLOR = '#FFFFFF'

export interface SegmentStyleInput {
  /** Pätkän tunnisteväri (T348: valmiina status-vihreä). */
  segmentColor: string
  /** Primary-reitin väri. undefined = reititön tehtävä (V139) tai tuntematon reitti. */
  routeColor?: string
  /** Kontekstisovitettu perustyyli (LINE_STATE_STYLE + V142-himmennys). */
  base: { opacity: number; weight: number; dashArray?: string }
  /** V142: himmennetty konteksti-pätkä ⊥ saa casingia — casing on korostuksen kieli. */
  interactive: boolean
}

/**
 * Pätkän kartta-kerrokset piirtojärjestyksessä (ensimmäinen alimmaiseksi).
 *
 * Casing vain kun (a) pätkä on korostettu (⊥ V142-himmennetty konteksti) JA (b) reitin väri
 * tiedetään. Muuten yksi viiva kuten ennen — reitittömällä tehtävällä ei ole sisusta jota kehystää
 * eikä taustalle anneta korostuksen kieltä.
 */
export function segmentLayerStyles(input: SegmentStyleInput): SegmentLayerStyle[] {
  const { segmentColor, routeColor, base, interactive } = input

  if (!interactive || !routeColor) {
    return [{
      role: 'casing',
      color: segmentColor,
      weight: base.weight,
      opacity: base.opacity,
      dashArray: base.dashArray,
      interactive,
    }]
  }

  return [
    // Status (dashArray + opacity) elää CASINGISSA — sisus pysyy ehjänä, muuten katkoviiva
    // paljastaisi pohjakartan keskeltä viivaa & koko kuvio hajoaisi.
    { role: 'casing', color: segmentColor, weight: CASING_WEIGHT, opacity: base.opacity, dashArray: base.dashArray, interactive: true },
    { role: 'separator', color: SEPARATOR_COLOR, weight: SEPARATOR_WEIGHT, opacity: base.opacity, interactive: false },
    { role: 'core', color: routeColor, weight: CORE_WEIGHT, opacity: 0.95, interactive: false },
  ]
}
