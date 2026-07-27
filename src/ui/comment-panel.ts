import { fetchComments, isOpenNote, type Comment } from '../logic/comments'
import { renderIconSvg } from '../logic/icon-set'

// T340/V245: järjestäjän sivupalkin "Huomiot" — vapaa-piste-huomioiden selailu.
//
// Rivin klikkaus NÄYTTÄÄ KARTALLA (panoroi + avaa), ei hautaa modaaliin listan sisään:
// järjestäjä etsii PAIKKAA, ei lue tekstiä listasta (sama valinta kuin talkoolaisen
// keräyslistassa, segment-view.ts). Puhdas DOM — ei Leafletia (kerrosraja) → Vitest-jsdom.
//
// Sivupalkki on 240px (DESIGN.md §K LeftPanel) ∴ teksti katkaistaan ellipsillä; vaakavuoto
// rikkoisi koko paneelin (B104-oppi).

export interface CommentPanelOptions {
  /** Rivin klikkaus → panoroi kartalle + avaa huomio. */
  /** T369/B153: rivin klikkaus = NÄYTÄ KARTALLA (panoroi + korosta), ⊥ avaa modaalia. */
  onFocus?: (comment: Comment) => void
  /** T369: rivin oma nappi avaa huomion — kaksi eri kysymystä, kaksi eri kontrollia. */
  onOpen?: (comment: Comment) => void
  /** Datalähde. Oletus: fetchComments('point'). Testit injektoivat oman. */
  load?: () => Promise<Comment[] | null>
}

export class CommentPanel {
  private readonly listEl: HTMLElement
  private readonly titleEl: HTMLElement
  private comments: Comment[] = []

  constructor(
    private readonly container: HTMLElement,
    private readonly opts: CommentPanelOptions = {},
  ) {
    this.container.innerHTML = ''

    this.titleEl = document.createElement('div')
    this.titleEl.className = 'left-panel-section-title comment-panel-title'
    this.titleEl.textContent = 'Huomiot'
    this.container.appendChild(this.titleEl)

    this.listEl = document.createElement('div')
    this.listEl.className = 'comment-panel-list'
    this.container.appendChild(this.listEl)

    this.render()
  }

  /**
   * Aseta huomiot ULKOA. Kutsuja (markers-wiring) hakee rivit KERRAN ja jakaa ne sekä kartalle
   * että tälle paneelille — kaksi erillistä hakua ajautuisi eri mielisiksi (B127-oppi: kaksi
   * kerrosta, kaksi lukemaa, käyttäjä näkee eri luvut).
   */
  setComments(rows: Comment[]): void {
    this.comments = rows
    this.render()
  }

  /** Hakee itse (initin varapolku jos kutsuja ei syötä dataa). */
  async refresh(): Promise<void> {
    const loader = this.opts.load ?? (() => fetchComments('point'))
    const rows = await loader()
    // null = haku epäonnistui → säilytä edellinen lista (V14-pattern: tyhjä ⊥ ole sama kuin virhe).
    if (rows) this.comments = rows
    this.render()
  }

  private render(): void {
    this.listEl.innerHTML = ''

    // V263: laskuri kertoo AVOIMET, ⊥ kaikkia. Järjestäjä kysyy "montako työtä on tekemättä" —
    // kokonaismäärä kasvaa ikuisesti eikä vastaa siihen kysymykseen.
    const open = this.comments.filter(isOpenNote)
    const done = this.comments.filter(c => !isOpenNote(c))
    this.titleEl.textContent = open.length > 0 ? `Huomiot (${open.length})` : 'Huomiot'

    if (this.comments.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'comment-panel-empty'
      empty.textContent = 'Ei huomioita.'
      this.listEl.appendChild(empty)
      return
    }

    this.renderGroup(open, null)
    if (done.length > 0) {
      // Tehdyt eivät katoa (kartta & lista ⊥ valehtele) mutta ⊥ kilpaile avoimien kanssa:
      // oma otsikko, himmennetty rivi. Ryhmä ⊥ ole kokoontaitettava — 240px paneelissa
      // taitto-otsikko veisi saman tilan kuin rivi, & piilotettu tila unohtuu.
      this.renderGroup(done, `Tehdyt (${done.length})`)
    }
  }

  private renderGroup(rows: Comment[], heading: string | null): void {
    if (rows.length === 0) return
    if (heading) {
      const h = document.createElement('div')
      h.className = 'comment-panel-group'
      h.textContent = heading
      this.listEl.appendChild(h)
    }

    // Uusin ensin: järjestäjä lukee lokia, ⊥ arkistoa.
    const sorted = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

    for (const c of sorted) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = isOpenNote(c) ? 'comment-panel-item' : 'comment-panel-item comment-panel-item--done'
      row.dataset.commentId = c.id

      const icon = document.createElement('span')
      icon.className = 'comment-panel-item-icon'
      icon.innerHTML = c.iconId ? renderIconSvg(c.iconId, 16) : '💬'
      row.appendChild(icon)

      const main = document.createElement('span')
      main.className = 'comment-panel-item-main'

      const text = document.createElement('span')
      text.className = 'comment-panel-item-text'
      text.textContent = firstLine(c.text)
      main.appendChild(text)

      const meta = document.createElement('span')
      meta.className = 'comment-panel-item-meta'
      const when = c.createdAt ? new Date(c.createdAt).toLocaleDateString('fi-FI') : ''
      const photo = (c.images?.length ?? 0) > 0 ? ' · 📷' : ''
      const state = isOpenNote(c) ? '' : ' · ✓ tehty'
      meta.textContent = [c.authorName, when].filter(Boolean).join(' · ') + photo + state
      main.appendChild(meta)

      row.appendChild(main)
      // T369/B153: rivi vastaa kysymykseen "missä?" — se panoroi kartan eikä peitä sitä
      // modaalilla. Sama kuvio kuin talkoolaisen keräyslistalla ja pätkän nimilapulla.
      row.addEventListener('click', () => this.opts.onFocus?.(c))
      this.listEl.appendChild(row)

      if (this.opts.onOpen) {
        const open = document.createElement('button')
        open.type = 'button'
        open.className = 'comment-panel-item-open'
        open.setAttribute('aria-label', `Avaa huomio: ${firstLine(c.text)}`)
        open.title = 'Avaa huomio'
        open.textContent = '›'
        open.addEventListener('click', (e) => {
          e.stopPropagation()
          this.opts.onOpen?.(c)
        })
        row.appendChild(open)
      }
    }
  }
}

/** Listarivi näyttää yhden rivin — koko teksti luetaan avaamalla. */
function firstLine(text: string): string {
  const line = text.split('\n')[0].trim()
  return line || text.trim()
}
