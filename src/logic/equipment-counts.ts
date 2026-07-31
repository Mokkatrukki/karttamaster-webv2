// T393/V285: varustelistan phase-tietoinen tyyppilaskuri.
//
// Varustelista vastaa kysymykseen "paljonko PAKKAAN", ei "paljonko pätkällä on" (V285).
// Ennen tätä kolme kutsupaikkaa (SegmentEquipment, EquipmentModal, SegmentDetailsModal)
// laskivat merkit tyypeittäin statusta katsomatta → talkoolainen näki "10× Oikealle" ja
// pakkasi 10 kylttiä vaikka 6 oli jo maastossa. VISION.md:285 lupasi laskurin
// ("tällä pätkällä 30 merkkiä, otettu 12") — lupaus oli lunastamatta.
//
// Oma moduuli, ei `segments.ts`:ään (377 riviä). Puhdas laskenta: ei DOM, ei Leaflet,
// ei localStorage → Vitest-pure.
//
// HUOM `markers` on kutsujan vastuulla JO pätkälle rajattu (getMarkersForSegment /
// resolveTaskMarkers). Kaikki kolme kutsupaikkaa tekevät rajauksen ennen kutsua; tämä
// moduuli ei tunne pätkäjäsenyyttä (V259/V283) eikä sen kuulukaan.

import type { SignMarker } from './types'
import type { Segment } from './segments'
import { phaseTarget } from './phase-target'
import { countsAsSign } from './marker-kind'

export interface EquipmentCount {
  type: string
  /** Phase-sana metaan: "N/M asetettu" | "N/M kerätty". UI ei päättele tätä (V285). */
  label: string
  /** Ota mukaan — jäljellä olevat. Tämä on rivin ISO luku (V285). */
  take: number
  /** Jo tehty tässä phasessa. */
  done: number
  /** Yhteensä ilman `ei_tarpeen`-merkkejä. */
  total: number
  /** Edustaja merkkivisuaalille (buildMarkerVisual) — ei toista ryhmittelyä UI:ssa. */
  sample: SignMarker
}

export interface EquipmentSummary {
  total: number
  done: number
  take: number
  notNeeded: number
  label: string
}

// T421/V313: taulu asui ennen tässä JA `segments.ts`:ssä identtisenä — nyt `phase-target.ts`.
// `tarkastus` putoaa yhä `asettaminen`-oletukseen (V91: per-merkki-tason "tarkastettu"-statusta
// ei ole, segmentin oma inspected-boolean sen sijaan).
const targetFor = phaseTarget

// `ei_tarpeen` ei ole "tehty" vaan "ei koskaan" (V285) ∴ se poistuu myös nimittäjästä.
// Muuten total kasvaisi merkeistä joita kukaan ei koskaan aseta eikä laskuri täyttyisi.
function counts(markers: SignMarker[], phase: Segment['phase']): { total: number; done: number } {
  const target = targetFor(phase)
  let total = 0
  let done = 0
  for (const m of markers) {
    if (m.status === 'ei_tarpeen') continue
    total++
    if (target.doneStatuses.includes(m.status)) done++
  }
  return { total, done }
}

// Tyypeittäin. Järjestys = ensiesiintymä markers-listassa (deterministinen, sama kuin
// entinen Map-pohjainen ryhmittely). Tyyppi jolla on VAIN `ei_tarpeen`-merkkejä katoaa
// riveiltä kokonaan — se ei ole `0×`-haamurivi vaan asia jota ei ole.
export function getEquipmentCounts(segment: Segment, markers: SignMarker[]): EquipmentCount[] {
  const groups = new Map<string, SignMarker[]>()
  // T447/V331: varustelista vastaa "paljonko PAKKAAN" (V285) — kasaa ⊥ pakata mukaan, se
  // syntyy maastossa. Rivi "Keräyskasa ×3" olisi kehotus ottaa autoon jotain jota ⊥ ole.
  for (const m of markers.filter(countsAsSign)) {
    const arr = groups.get(m.type)
    if (arr) arr.push(m)
    else groups.set(m.type, [m])
  }

  const target = targetFor(segment.phase)
  const rows: EquipmentCount[] = []
  for (const [type, ms] of groups) {
    const { total, done } = counts(ms, segment.phase)
    if (total === 0) continue
    const sample = ms.find(m => m.status !== 'ei_tarpeen') ?? ms[0]
    rows.push({ type, label: target.label, take: total - done, done, total, sample })
  }
  return rows
}

// Sektiorivi: "Pätkällä N merkkiä · M jo asetettu · ota mukaan K" (+ "· J ei tarpeen").
export function getEquipmentSummary(segment: Segment, markers: SignMarker[]): EquipmentSummary {
  // T447/V331: sama rajaus kuin riveillä — muuten sektiorivin "Pätkällä N merkkiä" ⊥ vastaisi
  // omien riviensä summaa (kaksi lukua samasta joukosta, joista toinen valehtelee).
  const signs = markers.filter(countsAsSign)
  const { total, done } = counts(signs, segment.phase)
  const notNeeded = signs.filter(m => m.status === 'ei_tarpeen').length
  return { total, done, take: total - done, notNeeded, label: targetFor(segment.phase).label }
}

export function formatEquipmentSummary(s: EquipmentSummary): string {
  if (s.total === 0 && s.notNeeded === 0) return 'Ei merkkejä pätkällä'
  const parts = [`Pätkällä ${s.total} merkkiä`]
  if (s.done > 0) parts.push(`${s.done} jo ${s.label}`)
  parts.push(`ota mukaan ${s.take}`)
  if (s.notNeeded > 0) parts.push(`${s.notNeeded} ei tarpeen`)
  return parts.join(' · ')
}
