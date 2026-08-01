// T460/V345: KUKA OMISTAA KARTAN NAPAUTUKSEN.
//
// Kartalla on viisi klikkiomistajaa (merkki→modaali, himmennetty merkki→lehtinen, pätkäviiva,
// rajakahva, reittiviiva) & jokainen kutsuu `L.DomEvent.stopPropagation`ia — perustellusti:
// ilman sitä merkin klikki laukaisisi myös kartan alla olevan kerroksen. Mutta se tarkoittaa
// että kartan OMA `click` (ainoa paikka josta sijoitus lukee koordinaatin) ⊥ laukea kun
// napautus osuu mihin tahansa kerrokseen ∴ sijoitustilassa merkin päälle napauttaminen avasi
// merkkimodaalin (B192). Ja juuri siihen kohtaan kasa kuuluu: merkit kerättiin siitä.
//
// YKSI OMISTAJUUSMEKANISMI ⊥ VIISI `if (armed)`-HAARAA. Virittäjä VARAA napautukset & jokainen
// kerros luovuttaa klikkinsä yhdellä rivillä ennen omaa työtään. Viisi haaraa olisi viisi
// kohtaa joista yksi jää lisäämättä kun kuudes kerros tulee — & se on juuri se kerros jonka
// päälle käyttäjä napauttaa.
//
// Moduulitila kuten `map-mode.ts` (V218-kuvio): yksi instanssi per sivunlataus, ⊥ persistointia.
// Kartta on yksi ∴ sen omistajakin on yksi — kahdesta rinnakkaisesta varauksesta ei olisi
// mitään tapaa päätellä kumpi voittaa.
//
// Puhdas: ei DOM, ei Leaflet, ei fetch → Vitest-pure.

export type MapClickConsumer = (lat: number, lon: number) => void

let consumer: MapClickConsumer | null = null

/**
 * Varaa kartan napautukset. Palauttaa vapautusfunktion — VAIN se vapauttaa, & vain jos varaus
 * on yhä sama: myöhempi varaaja ⊥ menetä omaansa siihen että edellinen siivoaa jälkiään.
 */
export function claimMapClicks(fn: MapClickConsumer): () => void {
  consumer = fn
  return () => {
    if (consumer === fn) consumer = null
  }
}

/** Onko napautus varattu — kerros joka haluaa vain TIETÄÄ (esim. kursori/CSS). */
export function mapClickClaimed(): boolean {
  return consumer !== null
}

/**
 * Kerros luovuttaa klikkinsä. `true` = varaaja kulutti sen ∴ kutsuja ⊥ tee omaa työtään.
 * Kutsutaan ENNEN omaa käsittelyä — jälkeenpäin modaali olisi jo auki.
 */
export function deliverMapClick(lat: number, lon: number): boolean {
  if (!consumer) return false
  consumer(lat, lon)
  return true
}

/** Testien & poikkeustilanteiden nollaus — tuotannossa vapautus tulee varaajalta. */
export function resetMapClicks(): void {
  consumer = null
}
