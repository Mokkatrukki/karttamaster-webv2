// T175/V109: kartan merkki-ikonien zoom-skaalaus. Kaukana zoomattuna pieni, lähellä täysi koko.
// T210/V138 (B93): skaalaa kartan todelliseen maxZoomiin (19, tile-layers.ts) asti, ei
// kovakoodattuun 17:ään — muuten merkki lakkaa kasvamasta ja näyttää kutistuvan suhteessa
// karttaan viimeisillä zoom-tasoilla. MAX>1 → loppuzoomissa suurimmillaan. Ei-vähenevä.
export const MARKER_SCALE_ZOOM_MIN = 11
export const MARKER_SCALE_ZOOM_MAX = 19
export const MARKER_SCALE_MIN = 0.3
export const MARKER_SCALE_MAX = 1.2

export function markerScaleForZoom(zoom: number): number {
  if (zoom <= MARKER_SCALE_ZOOM_MIN) return MARKER_SCALE_MIN
  if (zoom >= MARKER_SCALE_ZOOM_MAX) return MARKER_SCALE_MAX
  const t = (zoom - MARKER_SCALE_ZOOM_MIN) / (MARKER_SCALE_ZOOM_MAX - MARKER_SCALE_ZOOM_MIN)
  return MARKER_SCALE_MIN + t * (MARKER_SCALE_MAX - MARKER_SCALE_MIN)
}

// T419/V309-amend: pätkän NIMILAPPU skaalautuu samalla logiikalla kuin merkki-ikoni — kaukana
// pieni, lähellä täysi. Kaari asuu TÄSSÄ tiedostossa merkkikaaren rinnalla, ⊥ omassa: "sama
// kuin merkit" on väite jonka lukija ! voi tarkistaa yhdellä silmäyksellä (kaksi tiedostoa =
// kaksi kaarta jotka karkaavat toisistaan seuraavassa säädössä).
//
// **Lappu ⊥ katoa MILLOINKAAN** (käyttäjäpäätös 2026-07-30, korvaa T418:n binäärisen portin):
// piiloutuva nimi tekee kartasta arvoituksen — järjestäjän ! nähdä MITKÄ pätkät ovat missä
// ilman zoomausta, & merkit eivät katoa sekään ∴ lappu ⊥ saa olla ainoa kerros joka katoaa.
// Ongelma ei ollut lapun OLEMASSAOLO vaan sen KOKO kaukana: 11px-lappu ∀ pätkälle zoomilla
// ~13,4 peitti maaston. 0,25× = ~2,8px teksti (säädetty 0,4:stä käyttäjäpalautteen jälkeen) =
// pelkkä tumma tahra kartalla: pätkän paikka & määrä näkyvät, nimi ⊥ ole luettava — se onkin
// tarkoitus, sillä 15 luettavaa nimeä yhtä aikaa ON se ongelma jota tämä ratkaisee.
//
// Eri kaari kuin merkillä TIETOISESTI: teksti saavuttaa täyden koon jo 16:ssa (⊥ 19) & ⊥ kasva
// yli 1,0:n — merkki on kuva joka kestää suurennuksen, lappu on typografiaa jonka §K lukitsee
// 11px/700:aan (DESIGN §K SegmentLabel).
export const SEGMENT_LABEL_SCALE_ZOOM_MIN = 12
export const SEGMENT_LABEL_SCALE_ZOOM_MAX = 16
export const SEGMENT_LABEL_SCALE_MIN = 0.25
export const SEGMENT_LABEL_SCALE_MAX = 1

// `isOwn` = talkoolaisen oma tehtävä → AINA täysi koko: hänen ainoa työkohteensa ⊥ kutistu
// pois luettavuudesta metsässä (VISION §Talkoolainen). Järjestäjällä `isOwn` on aina false.
export function segmentLabelScaleForZoom(zoom: number, isOwn = false): number {
  if (isOwn) return SEGMENT_LABEL_SCALE_MAX
  // `getZoom()` ⊥ palauta NaN:ia, mutta jos palauttaisi, `calc()` NaN:illa tappaisi koko
  // sääntökimpun ∴ tuntematon zoom → täysi koko (näkyvä > näkymätön, V309-linja).
  if (!Number.isFinite(zoom)) return SEGMENT_LABEL_SCALE_MAX
  if (zoom <= SEGMENT_LABEL_SCALE_ZOOM_MIN) return SEGMENT_LABEL_SCALE_MIN
  if (zoom >= SEGMENT_LABEL_SCALE_ZOOM_MAX) return SEGMENT_LABEL_SCALE_MAX
  const t = (zoom - SEGMENT_LABEL_SCALE_ZOOM_MIN) / (SEGMENT_LABEL_SCALE_ZOOM_MAX - SEGMENT_LABEL_SCALE_ZOOM_MIN)
  return SEGMENT_LABEL_SCALE_MIN + t * (SEGMENT_LABEL_SCALE_MAX - SEGMENT_LABEL_SCALE_MIN)
}
