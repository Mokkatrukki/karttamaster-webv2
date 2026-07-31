import type { Segment } from './segments'

const LS_KEY = 'karttamaster-active-phase'

const VALID_PHASES: Segment['phase'][] = ['asettaminen', 'tarkastus', 'purku']

// T426/V317: AKTIIVINEN VAIHE ON JÄRJESTELMÄN TILA, ei katsojan näkymäsuodin.
//
// Ennen tätä arvo eli pelkässä `localStorage`ssa (T148) ∴ jokaisella selaimella oli oma
// totuus: järjestäjä siirtyi purkuun ja talkoolainen näki yhä asetusvaiheen pätkät.
// Nyt totuus on serverillä (`/api/phase`) ja `localStorage` on VÄLIMUISTI: se estää
// välkkeen ensimmäisellä renderillä ja pitää sovelluksen käytettävänä offline.
//
// EI POLLAUSTA (V317-raja): arvo luetaan sivun latauksessa. Metsässä yhteys on kallis ja
// vaihe vaihtuu kerran tapahtumassa, ei minuutissa. Kesken session tehty vaihdos näkyy
// talkoolaiselle seuraavassa latauksessa — tietoinen raja, ei puute.

function readCache(): Segment['phase'] {
  try {
    const stored = localStorage.getItem(LS_KEY)
    return VALID_PHASES.includes(stored as Segment['phase'])
      ? (stored as Segment['phase'])
      : 'asettaminen'
  } catch {
    return 'asettaminen'
  }
}

function writeCache(phase: Segment['phase']): void {
  try { localStorage.setItem(LS_KEY, phase) } catch { /* privaatti-ikkuna: välimuisti on optio */ }
}

let active: Segment['phase'] = readCache()

/** Synkroninen luku. Kutsujat renderöivät tällä — `loadActivePhase` on täyttänyt sen. */
export function getActivePhase(): Segment['phase'] {
  return active
}

/**
 * Lataa vaihe serveriltä. Kutsutaan KERRAN ennen ensimmäistä renderiä (main.ts, patkat.ts).
 * Epäonnistuminen ei ole virhe vaan paluu välimuistiin: sovellus on käytettävissä ilman
 * verkkoa, viimeisimmällä tunnetulla vaiheella.
 */
export async function loadActivePhase(): Promise<Segment['phase']> {
  try {
    const resp = await fetch('/api/phase')
    if (resp.ok) {
      const { phase } = (await resp.json()) as { phase?: string }
      if (VALID_PHASES.includes(phase as Segment['phase'])) {
        active = phase as Segment['phase']
        writeCache(active)
      }
    }
  } catch { /* offline → välimuisti kelpaa */ }
  return active
}

// ─── T434/V321: KATSELUVAIHE — järjestäjän silmä, ⊥ komento ───────────────────────────
//
// Globaali vaihe yllä on ADMININ komento (`PUT /api/phase` on admin-only, T432). Järjestäjä
// tarvitsee silti vapauden katsoa purkupätkiä kesken asetusvaiheen — ennen tätä sama valitsin
// teki molemmat ∴ katselu siirsi koko talkooporukan purkuun & sitä ⊥ voinut perua katsomatta.
//
// Katselu asuu VAIN `localStorage`ssa: ⊥ verkkokutsua, ⊥ vaikutusta kehenkään muuhun.
// Oletus = globaali vaihe ∴ tyhjä `localStorage` ⊥ ole eri mieltä kuin tapahtuma. Nimenomainen
// valinta säilyy override-arvona; globaaliin palaaminen NOLLAA sen (⊥ jätä kuollutta arvoa
// odottamaan seuraavaa vaiheenvaihtoa).
//
// Talkoolaisella ⊥ ole katselusuodinta (V318): hänelle vaihe on tapahtuman tosiasia ⊥ valinta.
// `PhaseSwitcher` on piilotettu häneltä & `/patkat` lukee `getActivePhase`ia suoraan.

const LS_VIEW_KEY = 'karttamaster-view-phase'

function readViewOverride(): Segment['phase'] | null {
  try {
    const stored = localStorage.getItem(LS_VIEW_KEY)
    return VALID_PHASES.includes(stored as Segment['phase']) ? (stored as Segment['phase']) : null
  } catch {
    return null
  }
}

let viewOverride: Segment['phase'] | null = readViewOverride()

/** Mitä järjestäjä KATSOO. Ilman nimenomaista valintaa = mikä on käynnissä. */
export function getViewPhase(): Segment['phase'] {
  return viewOverride ?? active
}

/** Katsooko järjestäjä muuta kuin käynnissä olevaa vaihetta? Pillerin ainoa ehto. */
export function isViewingOtherPhase(): boolean {
  return viewOverride !== null && viewOverride !== active
}

/** Vaihda KATSELUA. ⊥ koske serveriin ⊥ näy kenellekään muulle. */
export function setViewPhase(phase: Segment['phase']): void {
  viewOverride = phase === active ? null : phase
  try {
    if (viewOverride === null) localStorage.removeItem(LS_VIEW_KEY)
    else localStorage.setItem(LS_VIEW_KEY, viewOverride)
  } catch { /* privaatti-ikkuna: katselu elää session ajan muistissa */ }
}

/** Palaa katsomaan käynnissä olevaa vaihetta. */
export function resetViewPhase(): void {
  setViewPhase(active)
}

/**
 * Vaihda tapahtuman vaihe. **VAIN admin-paneelin käyttöön** (T433) — `PUT /api/phase` on
 * admin-only (T432) & kartan sivupalkin valitsin on katselusuodin joka ⊥ kutsu tätä. Palauttaa `false` jos serveri ei ottanut muutosta
 * vastaan — kutsuja näyttää bannerin. Paikallinen arvo palautetaan silloin ennalleen ∴
 * kerrokset eivät jää eri mieleen: näkymä ei saa väittää vaihdosta jota serveri ei tunne.
 */
export async function setActivePhase(phase: Segment['phase']): Promise<boolean> {
  const previous = active
  active = phase
  writeCache(phase)
  try {
    const resp = await fetch('/api/phase', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase }),
    })
    if (resp.ok) return true
  } catch { /* verkko poikki → sama peruutus kuin HTTP-virheessä */ }
  active = previous
  writeCache(previous)
  return false
}
