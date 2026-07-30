import { createSegment } from './segments'
import type { Segment, SegmentStore } from './segments'
import { pushSegment } from './segment-sync'

// T403/V299: pätkän luonti on KOLMIKKO — `createSegment` (paikallinen totuus) + `pushSegment`
// (backend on ainoa totuus, V18) + kutsujan oma päivitys. Sekvenssi oli inline-duplikoitu
// kahdesti `segment-creation-modal.ts`:ssä (reitillinen + reititön haara) ∴ kolmas kutsupaikka
// olisi ollut kolmas kopio. Unohtunut `pushSegment` = pätkä joka elää VAIN selaimessa & katoaa
// sivulatauksessa — hiljainen datakato, ⊥ virheilmoitus.
//
// Push on tarkoituksella fire-and-forget: `pushSegment` hoitaa itse virhepolkunsa & luonnin
// UI ⊥ jää odottamaan verkkoa (V116-outbox kantaa kirjoitukset). Kutsuja päivittää oman
// näkymänsä heti paikallisesta storesta.
export function createAndPushSegment(store: SegmentStore, data: Omit<Segment, 'id'>): Segment {
  const seg = createSegment(store, data)
  void pushSegment(seg).catch(() => {})
  return seg
}
