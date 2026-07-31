// T446/V330: prosessin sisäinen muutosväylä SSE-streamille.
//
// Väylä kuljettaa VAIN herätteen `{type,id,rev}` — EI dataa. Peruste (V330): jos muutos
// tulisi osittain streamista ja osittain REST:istä, clientilla olisi kaksi eri-ikäistä
// totuutta samasta rivistä eikä mitään tapaa tietää kumpi voittaa. Heräte kehottaa
// clientia hakemaan; haku on ja pysyy REST:in vastuulla.
//
// `rev` on prosessikohtainen monotoninen laskuri. Se ei ole rivin versio vaan väylän
// järjestysnumero: client voi pudottaa vanhentuneet/duplikaatit ilman että serverin
// tarvitsee tuntea clientin tilaa. Uudelleenkäynnistys nollaa sen — se on ok, koska
// heräte on vain kiihdytin (pollaus ei riipu siitä).

export type ChangeType = 'marker' | 'segment' | 'pile'

export interface ChangeEvent {
  type: ChangeType
  id: string
  rev: number
}

type Listener = (e: ChangeEvent) => void

let rev = 0
const listeners = new Set<Listener>()

/** Julkaise muutosheräte kaikille avoimille streameille. Palauttaa lähetetyn tapahtuman. */
export function publishChange(type: ChangeType, id: string): ChangeEvent {
  rev += 1
  const event: ChangeEvent = { type, id, rev }
  // Kopio: kuuntelija saa sulkea streamin (unsubscribe) kesken iteroinnin.
  for (const listener of [...listeners]) {
    try {
      listener(event)
    } catch {
      // Yhden streamin kirjoitusvirhe ⊥ saa kaataa mutaatiota joka juuri onnistui.
      // Katkennut yhteys korjaantuu selaimen reconnectilla + pollauksella (V330).
    }
  }
  return event
}

/** Tilaa herätteet. Palauttaa peruutusfunktion (kutsuttava kun stream sulkeutuu). */
export function subscribeChanges(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Väylän nykyinen järjestysnumero — lähetetään `hello`-tapahtumassa lähtötasoksi. */
export function currentRev(): number {
  return rev
}

/** Avointen tilaajien määrä. Testien vuotovahti (sulkeutuuko stream siististi). */
export function listenerCount(): number {
  return listeners.size
}
