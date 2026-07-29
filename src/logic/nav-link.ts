// T395/V286: ulkoinen navigointi-handoff — merkin koordinaatit nav-appiin.
//
// Miksi oma tiedosto eikä navigation.ts: navigation.ts omistaa pätkän SISÄISEN
// merkiltä-merkille-navigoinnin (mikä on seuraava asettamaton, kuinka kaukana).
// Tämä on ULOSPÄIN-handoff toiseen appiin — eri vastuu, eri elinkaari.
//
// V286: YKSI ankkuri yhteen kohteeseen. Ei Waze-/Apple-haaraa, ei platform-
// sniffausta, ei nav-appivalitsinta — talkoolaisella on hanskat ja yksi käsi
// (VISION §UX "max 2 nappia"); appivalinta olisi kolmas napautus ennen kuin
// auto liikkuu. Ei tieverkkolaskentaa eikä routing-palvelua: se vaatisi
// verkkoyhteyden juuri metsässä missä sitä ei ole, ja lopputulos olisi silti
// arvaus. Tieverkkoon snappaus on nav-apin työ.
//
// Pure: ei DOM:ia, ei Leafletia, ei fetchiä → Vitest-pure.

import type { SignMarker } from './types'

// Googlen universal URL -sopimus (api=1). Sama merkkijono toimii Androidilla,
// iOS:llä ja desktopilla — siksi ei platform-sniffausta. Nämä parametrinimet
// ovat Googlen sopimus, eivät meidän: t395-nav-link.test.ts vahtii niitä.
const MAPS_BASE = 'https://www.google.com/maps/dir/?api=1'

// ~11 cm. Riittää metsämerkille ja lyhentää URLia.
const COORD_DECIMALS = 6

export interface NavPoint {
  lat: number
  lon: number
}

/**
 * Mihin "Navigoi tähän" osoittaa. TÄMÄ ON FEATUREN AINOA LAAJENNUSKOHTA.
 *
 * Nyt: merkin omat koordinaatit. Merkit ovat metsässä ∴ nav-appi vie niin
 * lähelle kuin tieverkko antaa ja loppumatka kävellään.
 *
 * Myöhemmin (VISION.md §Avoimet 8): jos pätkällä on järjestäjän asettama
 * pysäköintipiste-POI, kohde vaihtuu siihen. Lähimmän autolla saavutettavan
 * pisteen tuo IHMISTIETO — järjestäjä tuntee reitin — ei routing-laskenta.
 *
 * Vaihto tehdään TÄSSÄ funktiossa, ei kutsupaikoissa (V286). Yksi kohdefunktio
 * = yhden rivin vaihto kun POI tulee; kutsupaikkoihin hajautettu kohde = N
 * paikkaa joista osa unohtuu.
 */
export function navTarget(marker: Pick<SignMarker, 'lat' | 'lon'>): NavPoint {
  return { lat: marker.lat, lon: marker.lon }
}

/**
 * Nav-appiin osoittava URL, tai null jos koordinaatit ovat kelvottomat.
 *
 * Null → kutsupaikka jättää napin renderöimättä kokonaan. Ei disabloitua
 * nappia (kuollut pinta, V250), ei rikkinäistä linkkiä.
 */
export function navUrl(target: NavPoint): string | null {
  const { lat, lon } = target
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90) return null
  if (lon < -180 || lon > 180) return null

  // toFixed tuottaa vain [-0-9.] ∴ URL-turvallinen sellaisenaan — pilkku on
  // sallittu query-arvossa eikä sitä escapeta (Google odottaa "lat,lon").
  const destination = `${lat.toFixed(COORD_DECIMALS)},${lon.toFixed(COORD_DECIMALS)}`
  return `${MAPS_BASE}&destination=${destination}&travelmode=driving`
}
