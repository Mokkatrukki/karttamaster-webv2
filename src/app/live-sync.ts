import { startChangeStream, fetchMarkers, type ChangeStreamOptions } from '../logic/sync'
import type { MarkerManager } from '../map/markers'

// T446(b)/V330 — SSE-heräte PÄÄSOVELLUKSELLE (kartta + pätkänäkymä).
//
// `startChangeStream` (T446(a)) oli kytketty vain `/kasat`-sivulle ∴ kartta & pätkänäkymä
// näkivät toisen porukan muutokset vasta sivun uudelleenlatauksesta. Sama heräte, sama kuvio,
// eri hakupolku: kasat hakee merkit itse, täällä ne menevät `MarkerManager.reload`iin.
//
// Kolme V330-sääntöä joita tämä moduuli ⊥ saa rikkoa:
//  1. Heräte AIKAISTAA haun, se ⊥ kanna dataa. Payload `{type,id,rev}` kertoo vain "hae nyt" —
//     kaikki data tulee olemassa olevaa polkua (`fetchMarkers`, `reloadSegments`).
//  2. Katkennut stream ⊥ pysäytä mitään: ilman `EventSource`-tukea `startChangeStream`
//     palauttaa no-opin & sovellus toimii täsmälleen kuten ennen tätä tiedostoa.
//  3. Reconnect on SELAIMEN. Täällä ⊥ ole backoffia, uudelleenyhteyttä eikä ajastinta.
export interface LiveSyncDeps {
  /** Forward-ref: manager syntyy `markers-wiring`issa vasta kytkennän jälkeen. */
  getMarkerManager(): MarkerManager | null
  /** Pätkädatan uudelleenlataus samasta polusta kuin alkulataus (`segments-wiring`). */
  reloadSegments(): Promise<void>
  /** Injektio testeille — sama kuvio kuin `startChangeStream`in omat. */
  stream?: Pick<ChangeStreamOptions, 'create' | 'coalesceMs' | 'url'>
}

/** Palauttaa sulkijan (idempotentti). Ei koskaan heitä soittajalle. */
export function wireLiveSync(deps: LiveSyncDeps): () => void {
  // Päällekkäisiä hakuja ⊥ sallita: kaksi lentävää `fetchMarkers`ia voi palata väärässä
  // järjestyksessä ∴ vanhempi vastaus ylikirjoittaisi uudemman. Lippu ⊥ ole backoff (sääntö 3)
  // vaan järjestystakuu — heräte joka osuu lennossa olevaan hakuun on jo katettu sillä haulla.
  let inFlight = false

  const refresh = async (wantMarkers: boolean, wantSegments: boolean): Promise<void> => {
    if (inFlight) return
    inFlight = true
    try {
      if (wantMarkers) {
        const res = await fetchMarkers()
        // T184/V118: latausvirhe ≠ "0 merkkiä". `reload([])` pyyhkisi koko kartan verkkopiikin
        // takia — heräte joka tyhjentää näkymän on pahempi kuin heräte joka ei tee mitään.
        if (res.ok) deps.getMarkerManager()?.reload(res.markers)
      }
      if (wantSegments) await deps.reloadSegments()
    } catch {
      // Hakupolun virhe on hakupolun asia — heräte ⊥ saa kaataa streamia (V330 sääntö 2).
    } finally {
      inFlight = false
    }
  }

  return startChangeStream({
    ...deps.stream,
    onWake: events => {
      // Kasan muutos on merkkien muutos (kasa ON merkki, V314/V331) ∴ sama hakupolku.
      const wantMarkers = events.some(e => e.type === 'marker' || e.type === 'pile')
      const wantSegments = events.some(e => e.type === 'segment')
      if (!wantMarkers && !wantSegments) return
      void refresh(wantMarkers, wantSegments)
    },
  })
}
