import { PHASE_MASTER_NAMES } from '../logic/phase-labels'
import { getActivePhase, getViewPhase } from '../logic/phase-view'
import type { Segment } from '../logic/segments'

// T443/V329 — VAIHE ON NÄKYVISSÄ AINA.
//
// V317/V321 tekivät vaiheesta järjestelmän tilan mutta jättivät sen NÄKYMÄTTÖMÄKSI: sama
// sovellus, samat pätkät, samat merkit — & ainoa vihje purun alkamisesta oli napin teksti
// pätkänäkymän sisällä. Tila jota ⊥ näe on tila jonka voi luulla joksikin muuksi.
//
// Kaksi kantajaa, ⊥ yksi:
//   (1) AKSENTTIVÄRI (`--phase-accent`) yläpalkissa & herossa — se huomataan ENNEN kuin
//       mitään luetaan, & se on ainoa joka toimii silmäyksellä ajaessa.
//   (2) NIMI ("Purkumaster") — väri ⊥ ole koskaan ainoa kantaja (V328-suku): aurinko pesee
//       kylläisyyden & osa käyttäjistä ⊥ erota sävyjä.
//
// Väri asetetaan `<body data-phase>`-attribuutille ∴ tokenit valuvat CSS:n kautta jokaiseen
// pintaan (DESIGN.md §C "Vaihe-aksentti"). ⊥ inline-tyyliä: kaksi väripaikkaa ajautuisi erilleen.

export type PhaseAudience = 'talkoolainen' | 'järjestäjä'

/**
 * KAKSI ERI LÄHDETTÄ, ⊥ kolmatta (V318/V321):
 *   talkoolainen → GLOBAALI vaihe. Hänellä ⊥ ole katselusuodinta — vaihe on tapahtuman
 *                  tosiasia ⊥ valinta.
 *   järjestäjä   → KATSELUvaihe. Hän saa katsoa purkupätkiä kesken asetusvaiheen; T434:n
 *                  "katselet muuta kuin globaalia" -pilleri kertoo eron (se säilyy, V321).
 */
export function phaseSourceFor(audience: PhaseAudience): () => Segment['phase'] {
  return audience === 'talkoolainen' ? getActivePhase : getViewPhase
}

export class PhaseIndicator {
  constructor(
    private readonly container: HTMLElement,
    private readonly source: () => Segment['phase'],
    private readonly root: HTMLElement = document.body,
  ) {
    this.container.classList.add('phase-name')
    this.container.setAttribute('role', 'status')
    this.sync()
  }

  /** Lue lähde uudelleen & piirrä. Kutsutaan aina kun vaihe voi olla vaihtunut. */
  sync(): void {
    const phase = this.source()
    this.root.dataset.phase = phase
    this.container.textContent = PHASE_MASTER_NAMES[phase]
    this.container.title = `Käynnissä oleva näkymä: ${PHASE_MASTER_NAMES[phase]}`
  }
}

// Sovelluksessa on täsmälleen yksi indikaattori, mutta vaihe voi vaihtua kaukana siitä
// (PhaseSwitcher). Rekisteri säästää callback-ketjun jonka jokainen uusi kutsupaikka unohtaisi.
let mounted: PhaseIndicator | null = null

export function registerPhaseIndicator(indicator: PhaseIndicator | null): void {
  mounted = indicator
}

export function syncPhaseIndicator(): void {
  mounted?.sync()
}
