// T465 (pilkko, T464-lippu): pätkän VÄRIKIELI omana moduulinaan.
//
// Jakolinja on **väri / status** ⊥ "kaikki mikä liittyy viivaan": `segmentLineState` jäi
// `segments.ts`:ään koska se lukee `PhaseProgress`ia joka on sen OMA tyyppi ∴ siirto tekisi kehän
// (segment-color → segments → segment-color). Raja tulee RIIPPUVUUDESTA ⊥ nimestä.
//
// Riippuvuus kulkee yhteen suuntaan: tämä moduuli lukee `Segment`in & `segmentPrimaryRouteId`in,
// `segments.ts` ⊥ lue täältä mitään.
import type { Segment, SegmentLineState } from './segments'
import { segmentPrimaryRouteId } from './segments'

// T152/V96: pätkän tunnistehue.
// V132/T202: valkoiselle kartalle sopivat värit.
// T304/V216/V244: pätkäpaletti on TUMMA perhe & reittipaletti on KESKIKIRKAS ∴ (a) leikkaus
// reittiväreihin on tyhjä myös silmällä ⊥ vain pikselinä (ennen `#2F6FB0` = smtb-55 pikselilleen),
// (b) pätkä & reitti erottuvat päällekkäin myös akromaattisesti (vaaleusero, ⊥ sävyero).
// Vihreä puuttuu tarkoituksella: se on varattu status-kanavalle (SEGMENT_DONE_COLOR, V96-amend).
export const SEGMENT_COLORS = ['#163A5F', '#552070', '#681A41', '#582F0F']

// T152/V96: stabiili per id. T464/V352 kumosi tämän KARTAN värinä (ks. `assignSegmentColors`),
// mutta funktio jää: reititön tehtävä ⊥ ole intervalli ∴ sille naapurisuhdetta ⊥ ole olemassa.
export function colorForSegment(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return SEGMENT_COLORS[Math.abs(hash) % SEGMENT_COLORS.length]
}

// T464/V352 (B200): pätkäväri on SUHDE NAAPUREIHIN ⊥ funktio id:stä. `colorForSegment` antoi
// vakauden (poisto ⊥ siirrä muita) mutta ⊥ luvannut erottuvuutta ∴ 4 väriä & 13 purkupätkää
// tuotti kolme PERÄKKÄISTÄ samanväristä = katkeamaton 16 km viiva jossa rajoja ⊥ näy.
//
// Ahne intervallivärjäys aloitusjärjestyksessä on intervalligraafilla OPTIMAALINEN ∴ paletti
// riittää kunnes viisi pätkää on päällekkäin yhtä aikaa. Ryhmä = (phase + primary-reitti): eri
// vaiheen tai eri reitin pätkä ⊥ piirry samaan pikseliin ∴ se ⊥ ole naapuri eikä saa rajoittaa.
//
// Jako on RIIPPUMATON `completed`-lipusta vaikka valmis pätkä piirtyy vihreänä (T348): jos
// valmistuminen vapauttaisi värin, yhden pätkän kuittaus vaihtaisi naapureiden värit kesken
// työpäivän. Puhdas ∴ Vitest-pure.
export function assignSegmentColors(segments: Iterable<Segment>): Map<string, string> {
  const result = new Map<string, string>()
  const groups = new Map<string, Segment[]>()

  for (const seg of segments) {
    // V139-reititön tehtävä ⊥ ole intervalli ∴ sillä ⊥ ole naapuria josta erottua — hash kelpaa.
    if (seg.startDist === undefined || seg.endDist === undefined) {
      result.set(seg.id, colorForSegment(seg.id))
      continue
    }
    const key = `${seg.phase} ${segmentPrimaryRouteId(seg) ?? ''}`
    const g = groups.get(key)
    if (g) g.push(seg)
    else groups.set(key, [seg])
  }

  for (const group of groups.values()) {
    // Vakaa järjestys: startDist, tasapeli id ∴ sama syöte → sama väritys joka renderissä
    // (Map-iteraatiojärjestys ⊥ saa vuotaa väreihin).
    group.sort((a, b) => (a.startDist! - b.startDist!) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const placed: { start: number; end: number; idx: number }[] = []
    for (const seg of group) {
      const start = seg.startDist!
      const end = seg.endDist!
      const used = new Set<number>()
      for (const p of placed) {
        // Leikkaus TAI kosketus: jaettu päätepiste (edellisen end === tämän start) on juuri se
        // tapaus jossa sama väri sulattaa kaksi pätkää yhdeksi ∴ `≤` molempiin suuntiin.
        if (start <= p.end && p.start <= end) used.add(p.idx)
      }
      let idx = 0
      while (idx < SEGMENT_COLORS.length && used.has(idx)) idx++
      // Paletti loppui (≥5 päällekkäistä yhtä aikaa): törmäys hyväksytään. ⊥ kaadu & ⊥ keksi
      // väriä paletin ulkopuolelta — V244:n ehdot (∩ ROUTE = ∅, ≥3:1 valkoista vasten) pätevät.
      if (idx === SEGMENT_COLORS.length) idx = 0
      placed.push({ start, end, idx })
      result.set(seg.id, SEGMENT_COLORS[idx])
    }
  }

  return result
}

// T348/V96-amend: valmis-tila ohittaa tunnistevärin. Valmiin pätkän identiteetti ⊥ enää kanna
// tietoa (kukaan ⊥ etsi kartalta "kuka teki tämän loppuun") — status kantaa. Arvo on §C:n
// KARTTAPINTA-tokenin `--segment-done` peili (V253): Leaflet-polyline ⊥ lue CSS-muuttujaa ∴
// JS-vakio on pakko, mutta se ! olla YKSI paikka (V132: ⊥ hajota hexiä kutsupaikkoihin).
// ⊥ sido tätä `--confirm`iin (B136): se on chrome-token joka vaihtuu Kaamoksessa #2FA35B:ksi
// ∴ viiva & nimilapun reunus ajautuisivat eri vihreisiin teemanvaihdossa.
// Vihreä sävyperhe on VARATTU tälle kanavalle — SEGMENT_COLORS ⊥ saa sisältää vihreää (T304).
export const SEGMENT_DONE_COLOR = '#1F8A50'

// T348/V96-amend: KARTAN viivaväri = tunniste PAITSI valmiina, jolloin status voittaa.
//
// T464/V352: parametri on TUNNISTEVÄRI ⊥ id. Ennen tätä funktio hashasi id:n itse ∴ kutsupaikka
// ⊥ voinut antaa naapuritietoista väriä ilman että sääntö "valmis voittaa identiteetin" olisi
// pitänyt kopioida sinne. Väri tulee `assignSegmentColors`ilta; jos lista/sivupalkki joskus
// näyttää pätkävärin, se lukee SAMAA jakoa (V96: rivi & kartta ⊥ saa olla eri mieltä
// identiteetistä). Testattavuus: Vitest-pure.
export function segmentLineColor(identityColor: string, state: SegmentLineState): string {
  return state === 'valmis' ? SEGMENT_DONE_COLOR : identityColor
}
