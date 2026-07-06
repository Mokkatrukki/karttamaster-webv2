// T161-kuratointi: rakentaa merkkikirjaston kuva-templatet automaattisesti kaikista
// src/assets/signs/-webp-tiedostoista. Uusi webp hakemistoon → tulee katalogiin ilman koodimuutosta.
//
// Skip: perusnuolet/käännökset (kuuluvat Lucide-ikoneiksi, T159) + tapahtumalogot.
// Favorite:true → näkyy talkoolaisen quick-pickissä (listFavorites); muut vain järjestäjän
// kirjastopaneelissa → 80-kohdan katalogi ei sotke pikavalintaa.
import { signImageIds } from './sign-images'

// Perusnuolet + logot pois — nuolet ikoneina (default-templatet left/right/upcoming + T159),
// logot eivät ole kenttämerkkejä.
const SKIP = new Set([
  'nuoli', 'nuoli-musta', 'kaannos_oikealle', 'kaannos_vasemmalle',
  'jyrkka_kaannos_oikealle', 'u-kaannos_oikealle',
  'syotemtb_musta', 'syotemtb_oik', 'syotemtb_oik_yla_s', 'syote-mtb',
])

// Quick-pickiin (talkoolainen) nostetut yleisimmät.
const FAVORITES = new Set([
  'wc', 'huolto-service', 'maali-finish', 'park-and-ride-vas', 'p', 'uusi-kierros',
])

// Käsin siistityt labelit (ä/ö + luettava muoto). Muut johdetaan humanize():lla.
const LABELS: Record<string, string> = {
  // palvelut
  wc: 'WC', p: 'Pysäköinti', pesutilat: 'Pesutilat', pesutilat2: 'Pesutilat 2',
  uimaranta: 'Uimaranta', 'park-and-ride': 'Park & Ride', 'park-and-ride-vas': 'Park & Ride ←',
  pysakointikielto: 'Pysäköinti kielletty', 'pysakointi-kielletty': 'Pysäköinti kielletty',
  pysakointikieltoalue: 'Pysäköintikieltoalue', 'maali-finish': 'Maali / Finish',
  'huolto-service': 'Huolto / Service', omahuolto: 'Omahuolto', pumppaamo: 'Pumppaamo',
  pumppaamo_lisakilpi: 'Pumppaamo (lisäkilpi)', pyorakilpailut2: 'Pyöräkilpailut',
  syotemtb_kanslia15: 'Kanslia', 'uusi-kierros': 'Uusi kierros',
  'huolto-ohituskaista-1': 'Huolto ohituskaista 1', 'huolto-ohituskaista-2': 'Huolto ohituskaista 2',
  'huolto-ohituskaista-3': 'Huolto ohituskaista 3', 'huolto-ohituskaista-4': 'Huolto ohituskaista 4',
  // varoitukset / erikoiset
  'kapeneva-tie': 'Kapeneva tie', epatasainen_tie: 'Epätasainen tie',
  ylamaki_26: 'Ylämäki 26', ylamaki_27: 'Ylämäki 27', ylamaki_31: 'Ylämäki 31',
  muurahainen: 'Muurahainen', peikko: 'Peikko', peikkopolku: 'Peikkopolku',
  otb: 'OTB', lack: 'Lack', 'antti-kestin-polku': 'Antti Kestin polku',
  'nuoli-alas-tupla': 'Nuoli alas (tupla)',
  // matka- ja kierroskyltit
  '5-km': '5 km', '30': '30 km', '30km-only': '30 km only',
  '30km_100km1st': '30 km & 100 km 1st', '30km_100km1st_only': '30 km & 100 km 1st (only)',
  '101km': '101 km', '180km': '180 km', '200-m': '200 m', '231km': '231 km',
  '333km': '333 km', '430km': '430 km', '534km': '534 km', '615km': '615 km',
  '65-130-260': '65/130/260 km', '65-130-260-km-only': '65/130/260 km only',
  '65km_100km2nd_260km': '65 km & 100 km 2nd, 260 km', '65km_100km2nd_260km_only': '65 km & 100 km 2nd (only)',
  '30-65-100-260-a': '30/65/100/260 (a)', '30-65-100-260-b': '30/65/100/260 (b)',
  '30-65-130-km-oik': '30/65/130 km →', '30-65-130-km-vas': '30/65/130 km ←',
  // paikannimet
  'iso-syote-430': 'Iso-Syöte 430', 'pikku-syote': 'Pikku-Syöte', 'annintupa-208': 'Annintupa 208',
  'myllyharju-228': 'Myllyharju 228', 'niskavaara-195': 'Niskavaara 195',
  'kellarilampi-199': 'Kellarilampi 199', 'pitamavaara-262': 'Pitämävaara 262',
  'pitamavaara-320': 'Pitämävaara 320', 'luokanvaara-297': 'Luokanvaara 297',
  'puolivalinlampi-222': 'Puolivälinlampi 222', 'pytkynharju-185': 'Pytkynharju 185',
  'romekangas-207': 'Romekangas 207', 'parjanjoen-rantabulevardi-207': 'Pärjänjoen rantabulevardi 207',
  sakkisenlammit: 'Sakkisenlammit', soininsuo: 'Soininsuo', riihisuo: 'Riihisuo',
  portinoja: 'Portinoja', lauttaoja: 'Lauttaoja', myllyn_laavu: 'Myllyn laavu',
}

// Kertakäyttöiset paikkamerkit — sijoitetaan kartalle yleensä yhden kerran (paikannimi/kohta).
// Erotellaan omaan katalogi-osioon ettei arjen pikavalinta täyty (~20 nimeä).
const PLACE_IDS = new Set([
  'iso-syote-430', 'pikku-syote', 'annintupa-208', 'myllyharju-228', 'niskavaara-195',
  'kellarilampi-199', 'pitamavaara-262', 'pitamavaara-320', 'luokanvaara-297',
  'puolivalinlampi-222', 'pytkynharju-185', 'romekangas-207', 'parjanjoen-rantabulevardi-207',
  'sakkisenlammit', 'soininsuo', 'riihisuo', 'portinoja', 'lauttaoja', 'myllyn_laavu',
  'antti-kestin-polku', 'peikkopolku',
])

function humanize(id: string): string {
  const s = id.replace(/[-_]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export type SignCategory = 'sign' | 'place'

export interface CatalogEntry {
  id: string
  label: string
  favorite: boolean
  category: SignCategory
}

// Kaikki webp-taustaiset merkit (paitsi SKIP) katalogimuodossa, id-järjestyksessä.
// category 'place' = kertakäyttöinen paikkamerkki (oma osio kirjastossa), muuten 'sign'.
export function signCatalog(): CatalogEntry[] {
  return signImageIds()
    .filter((id) => !SKIP.has(id))
    .sort()
    .map((id) => ({
      id,
      label: LABELS[id] ?? humanize(id),
      favorite: FAVORITES.has(id),
      category: PLACE_IDS.has(id) ? 'place' : 'sign',
    }))
}

// Kertakäyttöisten paikkamerkkien id:t (kirjastopaneelin oma osio).
export function placeSignIds(): Set<string> {
  return new Set(signCatalog().filter((e) => e.category === 'place').map((e) => e.id))
}
