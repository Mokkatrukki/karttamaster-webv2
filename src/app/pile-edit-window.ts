// T457/V342: JUURI JÄTETTY KASA ON VIELÄ KESKEN — korjausikkuna sulkeutuu käyttäjän SEURAAVASTA
// teosta, ⊥ luontihetkestä eikä ajastimesta.
//
// Käyttäjä 2026-07-31: "voin muokata ja siirtää sitä siihen asti kun painan seuraavaa merkkiä,
// tai kun painan jotain muuta nappia." Vahvistus (T454) on päätös SISÄLLÖSTÄ — sijainnin
// tarkkuus selviää vasta askeleen päästä ("jäi ojan väärälle puolelle") & siihen asti ainoa
// korjaus oli poistaa kasa (merkit takaisin listalle, T438) & tehdä koko virta uudelleen.
//
// EI ajastinta: aika on mitta jota käyttäjä ⊥ näe & joka umpeutuu juuri kun hanska riisutaan.
// Sulkijana on TEKO — mikä tahansa nappi tai linkki. Kartan panorointi & kasan oma raahaus
// EIVÄT sulje: ne ovat tämän ikkunan käyttöä, ⊥ siitä poistumista.
//
// OMA MODUULINSA ⊥ rivi wiringissä: avaus (raahattavuus + rivi) & sulku (raahattavuus + rivi +
// kuuntelija) ovat pari, & wiringin sisällä ne olisivat neljä riviä joista yksi jää pois —
// unohtunut sulku jättäisi VIERAAN merkin raahattavaksi loputtomiin (V150-vuoto).
//
// DOM ilman Leafletia → Vitest-jsdom.

export interface PileEditWindowDeps {
  /** Kasa joka on korjattavissa. */
  markerId: string
  /** Raahattavuuden portti — `null` palauttaa normaalin säännön (V150). */
  setEditable(id: string | null): void
  /** Kuittausrivin koti: rivin katoaminen on ikkunan sulkeutumisen NÄKYVÄ puoli (V250). */
  host: HTMLElement
  /** Kuuntelijan juuri — testeissä sama `document`, tuotannossa `document`. */
  root?: Document
}

export interface PileEditWindow {
  markerId: string
  close(): void
}

/** Kuittausrivi — sen katoaminen on ikkunan sulkeutumisen näkyvä puoli. */
const OWN_ROW = '.pile-done-row'

/**
 * Avaa korjausikkunan. Palauttaa ohjaimen — kutsuja sulkee sen myös moodinvaihdosta &
 * seuraavan kasan sijoituksesta (kaksi auki olevaa ikkunaa olisi kaksi raahattavaa kasaa).
 */
export function openPileEditWindow(deps: PileEditWindowDeps): PileEditWindow {
  const root = deps.root ?? document
  let open = true

  deps.setEditable(deps.markerId)

  const close = (): void => {
    if (!open) return
    open = false
    root.removeEventListener('click', onClick, true)
    deps.setEditable(null)
    deps.host.querySelector(OWN_ROW)?.remove()
  }

  // Capture-vaihe: sulku tapahtuu ENNEN kuin napin oma käsittelijä ehtii vaihtaa näkymää —
  // bubble-vaiheessa kuuntelija voisi jäädä irronneen DOM:n taakse elämään.
  function onClick(e: Event): void {
    const el = e.target as HTMLElement | null
    const btn = el?.closest?.('button, a, [role="button"]')
    if (!btn) return
    // Rivin OMAT napit sulkevat myös (✕ = kuittaus, linkki vie pois) ∴ ⊥ poikkeusta —
    // mutta ne saavat tehdä oman työnsä ensin: sulku ⊥ estä tapahtumaa.
    close()
  }

  root.addEventListener('click', onClick, true)

  return { markerId: deps.markerId, close }
}
