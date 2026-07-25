import { fetchComments, type Comment } from '../logic/comments'
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
  onFocus?: (comment: Comment) => void
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
    this.titleEl.textContent = this.comments.length > 0 ? `Huomiot (${this.comments.length})` : 'Huomiot'
    this.listEl.innerHTML = ''

    if (this.comments.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'comment-panel-empty'
      empty.textContent = 'Ei huomioita.'
      this.listEl.appendChild(empty)
      return
    }

    // Uusin ensin: järjestäjä lukee lokia, ⊥ arkistoa.
    const sorted = [...this.comments].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

    for (const c of sorted) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'comment-panel-item'
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
      meta.textContent = [c.authorName, when].filter(Boolean).join(' · ') + photo
      main.appendChild(meta)

      row.appendChild(main)
      row.addEventListener('click', () => this.opts.onFocus?.(c))
      this.listEl.appendChild(row)
    }
  }
}

/** Listarivi näyttää yhden rivin — koko teksti luetaan avaamalla. */
function firstLine(text: string): string {
  const line = text.split('\n')[0].trim()
  return line || text.trim()
}
