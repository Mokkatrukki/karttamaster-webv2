// T448/V332: KASALISTA JOHDETAAN KASOISTA — työ jonka pitää ensin LUODA on työ jota ei tehdä.
//
// Kasojen haku vaati ennen tätä että joku perusti keräystehtävän (pätkän jolla
// `markerTypeFilter`) ∴ autoporukan työ oli olemassa vasta kun järjestäjä muisti perustaa sen —
// & B174 osoitti ettei sitä voinut perustaa ennen ensimmäistä kasaa (valikko johdettiin
// olemassa olevista merkeistä). Umpisolmu, jonka käyttäjä kuvasi sanoilla "en tiedä mistä voin
// tehdä kasan keräyspätkän".
//
// Nyt lista on `kind === 'kasa'` -suodatin koko merkkijoukosta: kasa syntyy metsässä & ilmestyy
// listalle itsestään, ilman välikättä. Tehtäväolio olisi kantanut nimen, vastuuhenkilön &
// talkoolaislinkin — mutta se on hinta jonka maksaa JOKA KERTA, & sen ainoa tehtävä oli
// suodattaa tyypin mukaan (`markerKind` tekee sen nyt).
//
// OMA TIEDOSTO ⊥ `pile.ts`: `marker-kind.ts` lukee `PILE_TEMPLATE_ID`in `pile.ts`:stä ∴
// listaus `pile.ts`:ssä olisi importtisykli jonka moduulitason vakiot laukaisisivat TDZ-
// virheenä ajossa. Sykli ⊥ ole tyylikysymys vaan kaatuva sovellus.
//
// Puhdas: ei DOM, ei Leaflet, ei fetch → Vitest-pure.

import type { SignMarker } from './types'
import { markerKind } from './marker-kind'
import { PILE_TEMPLATE_ID } from './pile'
import { haversineDistance } from './bearing'
import { segmentTarget } from './phase-target'

export interface GeoFix {
  lat: number
  lon: number
}

export interface PileRow {
  marker: SignMarker
  /** Montako merkkiä kasassa on — rivin sisältöyhteenveto. */
  count: number
  /** Metrit GPS-fixistä. `null` = fixiä ⊥ ole ∴ UI ⊥ näytä etäisyyttä (⊥ arvaa nollaa). */
  distanceM: number | null
  /** Onko kasa jo haettu. */
  done: boolean
}

// T421/V313: kasan elinkaari on KERÄYSTEHTÄVÄ ⊥ pätkän vaihe — kasa syntyy `suunniteltu`na
// (= hakematta) & "Haettu" vie `kerätty`yn. Sana & statusjoukko tulevat lookupista, ⊥ tästä:
// neljäs kopio olisi se joka jää päivittämättä.
export const PILE_TARGET = segmentTarget({ markerTypeFilter: PILE_TEMPLATE_ID })

/**
 * Kaksi RYHMÄÄ ⊥ yksi litteä lista (käyttäjäpäätös 2026-07-31). Hännille pudottaminen oli
 * lajittelusääntö jonka VAIN koodi tiesi: pitkällä listalla haettu kasa katosi käytännössä
 * näkyvistä & "onko tämä haettu vai unohtunut" oli kysymys jota ⊥ voinut ratkaista selaamatta.
 * Ryhmä otsikon & määrän kanssa sanoo saman asian ääneen — & UI ⊥ joudu arvaamaan rajaa
 * uudelleen (`done`-lipun etsiminen litteästä taulukosta olisi toinen totuus samasta jaosta).
 */
export interface PileGroups {
  /** Hakematta olevat, lähin ensin. TYÖ. */
  open: PileRow[]
  /** Jo haetut, sama järjestys. TAPAHTUNUT TOSIASIA — ⊥ katoa, ⊥ ole työtä. */
  done: PileRow[]
}

/** Molemmat ryhmät yhtenä listana — kartta piirtää kaikki kasat, ⊥ vain työt. */
export function allPileRows(groups: PileGroups): PileRow[] {
  return [...groups.open, ...groups.done]
}

/**
 * V332: autoporukan lista. Järjestys ryhmän SISÄLLÄ = etäisyys fixistä (lähin ensin); ilman
 * fixiä luontijärjestys (= syötteen järjestys) — arvattu etäisyys olisi väärä järjestys joka
 * NÄYTTÄÄ oikealta.
 *
 * Haettu kasa EI katoa listalta: se on tapahtunut tosiasia jonka toinenkin porukka pitää voida
 * nähdä — piilotettu tieto on tieto jota ⊥ voi kyseenalaistaa.
 */
export function listPiles(markers: SignMarker[], fix: GeoFix | null = null): PileGroups {
  const rows = markers
    .filter(m => markerKind(m) === 'kasa')
    .map((marker, index) => ({
      index,
      marker,
      count: marker.pileMarkerIds?.length ?? 0,
      distanceM: fix ? haversineDistance(fix, { lat: marker.lat, lon: marker.lon }) : null,
      done: !PILE_TARGET.openStatuses.includes(marker.status),
    }))

  rows.sort((a, b) => {
    if (a.distanceM !== null && b.distanceM !== null) return a.distanceM - b.distanceM
    return a.index - b.index
  })

  const strip = ({ marker, count, distanceM, done }: typeof rows[number]): PileRow =>
    ({ marker, count, distanceM, done })

  return {
    open: rows.filter(r => !r.done).map(strip),
    done: rows.filter(r => r.done).map(strip),
  }
}

/** "1,2 km" | "340 m" | "" (⊥ fixiä). Yksi muotoilu ∴ kaksi pintaa ⊥ ole eri mieltä. */
export function formatPileDistance(distanceM: number | null): string {
  if (distanceM === null || !Number.isFinite(distanceM)) return ''
  if (distanceM < 1000) return `${Math.round(distanceM)} m`
  return `${(distanceM / 1000).toFixed(1).replace('.', ',')} km`
}

/** Sisältöyhteenveto riville — yhden rivin luku. Ryhmitelty lista: `groupPileContents`. */
export function formatPileSummary(count: number): string {
  if (count === 0) return 'Tyhjä kasa'
  return `${count} merkkiä`
}

// ── T450: KASAN SISÄLTÖ RYHMITELTYNÄ ────────────────────────────────────────────────────────
//
// Kasassa on tyypillisesti tusina merkkiä joista puolet on samaa nuolta ∴ raaka lista olisi
// 12 identtistä riviä joista ihminen laskee itse kuinka monta kutakin on. Ryhmittely on se
// työ jonka kone tekee paremmin — & se on SAMA sekä vahvistuksessa ("mitä olen jättämässä")
// että katselussa ("mitä olen hakemassa"): yksi ryhmittely ∴ kaksi pintaa ⊥ ole eri mieltä.

export interface PileContentGroup {
  /** Ryhmittelyavain — templateId jos on, muuten tyyppi. */
  key: string
  /** Näyttönimi ("Nuoli vasen"). */
  label: string
  count: number
  /** Edustaja merkkivisuaalille — UI ⊥ toista ryhmittelyä. */
  sample: SignMarker
}

/**
 * Kasan sisältö tyypeittäin. Järjestys = ensiesiintymä syötteessä (deterministinen; sama
 * kuvio kuin `equipment-counts.ts`) — lajittelu määrän mukaan vaihtaisi rivien paikkaa aina
 * kun yksi merkki lisätään, & liikkuva lista on lukukelvoton hanskoilla.
 */
export function groupPileContents(contents: SignMarker[]): PileContentGroup[] {
  const groups = new Map<string, PileContentGroup>()
  for (const m of contents) {
    const key = m.templateId ?? m.type
    const existing = groups.get(key)
    if (existing) existing.count++
    else groups.set(key, { key, label: m.label?.trim() || m.type, count: 1, sample: m })
  }
  return [...groups.values()]
}

/** Kasan sisältö id-listasta. Puuttuva merkki (poistettu) putoaa hiljaa pois, ⊥ kaada. */
export function resolvePileContents(
  pileMarkerIds: string[] | undefined,
  allMarkers: SignMarker[],
): SignMarker[] {
  if (!pileMarkerIds || pileMarkerIds.length === 0) return []
  const byId = new Map(allMarkers.map(m => [m.id, m]))
  return pileMarkerIds.map(id => byId.get(id)).filter((m): m is SignMarker => m !== undefined)
}
