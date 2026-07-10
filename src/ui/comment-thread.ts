import type { Comment, NewComment, CommentTargetType } from '../logic/comments'
import { fetchComments, postComment, deleteComment } from '../logic/comments'
import { CURATED_ICONS, renderIconSvg } from '../logic/icon-set'

// T221/T75: yleiskäyttöinen kommenttilanka. Näytetään merkin/pätkän modaalissa (targetType
// 'marker'|'segment') ja periaatteessa myös vapaalle pisteelle. PUHDAS DOM (ei Leafletia) →
// Vitest-jsdom-testattava. Verkkokutsut injektoitavissa (api) testejä varten; oletuksena
// oikea logic/comments-slice. Kuka tahansa autentikoitu voi lähettää; poisto (canDelete) vain
// järjestäjä+ (nappi näkyy vain kun canDelete=true, backend gate hoitaa varsinaisen auktorisoinnin).

export interface CommentThreadApi {
  fetch: (targetType?: CommentTargetType, targetId?: string) => Promise<Comment[] | null>
  post: (input: NewComment) => Promise<Comment | null>
  del: (id: string) => Promise<boolean>
}

export interface CommentThreadOptions {
  targetType: 'marker' | 'segment'
  targetId: string
  // Poisto-oikeus (järjestäjä+). Näyttää roskakori-napin jokaiselle kommentille.
  canDelete: boolean
  // Valinnainen esitäyttö nimikentälle (talkoolaisen koodi / järjestäjän nimi).
  authorName?: string
  // Injektoitavat verkkokutsut (testit). Oletus = oikea slice.
  api?: CommentThreadApi
}

const DEFAULT_API: CommentThreadApi = {
  fetch: fetchComments,
  post: postComment,
  del: deleteComment,
}

export class CommentThread {
  readonly el: HTMLElement
  private readonly listEl: HTMLElement
  private readonly api: CommentThreadApi
  private comments: Comment[] = []

  constructor(private readonly opts: CommentThreadOptions) {
    this.api = opts.api ?? DEFAULT_API

    this.el = document.createElement('div')
    this.el.className = 'comment-thread'

    const label = document.createElement('label')
    label.className = 'marker-detail-label'
    label.textContent = 'Kommentit'
    this.el.appendChild(label)

    this.listEl = document.createElement('div')
    this.listEl.className = 'comment-thread-list'
    this.el.appendChild(this.listEl)

    this.el.appendChild(this.buildForm())
    this.renderList()
  }

  // Hae kommentit palvelimelta ja renderöi. Kutsutaan modaalin avautuessa.
  async load(): Promise<void> {
    const rows = await this.api.fetch(this.opts.targetType, this.opts.targetId)
    if (rows === null) {
      // Lataus epäonnistui — älä pyyhi mahdollista aiempaa tilaa hiljaa (V14/V118).
      this.renderList('load-error')
      return
    }
    this.comments = rows
    this.renderList()
  }

  private buildForm(): HTMLElement {
    const form = document.createElement('div')
    form.className = 'comment-thread-form'

    const input = document.createElement('textarea')
    input.className = 'comment-thread-input'
    input.rows = 2
    input.placeholder = 'Kirjoita kommentti...'
    form.appendChild(input)

    const controls = document.createElement('div')
    controls.className = 'comment-thread-controls'
    controls.style.display = 'flex'
    controls.style.gap = '8px'
    controls.style.marginTop = '6px'
    controls.style.flexWrap = 'wrap'

    // Valinnainen ikoni.
    const iconSelect = document.createElement('select')
    iconSelect.className = 'comment-thread-icon-select'
    iconSelect.setAttribute('aria-label', 'Kommentin ikoni (valinnainen)')
    const noIcon = document.createElement('option')
    noIcon.value = ''
    noIcon.textContent = 'Ei ikonia'
    iconSelect.appendChild(noIcon)
    for (const icon of CURATED_ICONS) {
      const opt = document.createElement('option')
      opt.value = icon.id
      opt.textContent = icon.label
      iconSelect.appendChild(opt)
    }
    controls.appendChild(iconSelect)

    // Valinnainen nimi.
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.className = 'comment-thread-name'
    nameInput.placeholder = 'Nimi (valinnainen)'
    nameInput.value = this.opts.authorName ?? ''
    controls.appendChild(nameInput)

    form.appendChild(controls)

    const sendBtn = document.createElement('button')
    sendBtn.type = 'button'
    sendBtn.className = 'btn btn--confirm comment-thread-send'
    sendBtn.textContent = 'Lähetä'
    sendBtn.style.marginTop = '6px'
    sendBtn.addEventListener('click', () => {
      void this.submit(input, nameInput, iconSelect, sendBtn)
    })
    form.appendChild(sendBtn)

    const err = document.createElement('p')
    err.className = 'comment-thread-error'
    err.hidden = true
    err.style.color = 'var(--danger-text)'
    err.style.fontSize = '12px'
    err.style.margin = '4px 0 0'
    form.appendChild(err)

    return form
  }

  private async submit(
    input: HTMLTextAreaElement,
    nameInput: HTMLInputElement,
    iconSelect: HTMLSelectElement,
    sendBtn: HTMLButtonElement,
  ): Promise<void> {
    const err = this.el.querySelector('.comment-thread-error') as HTMLElement | null
    const text = input.value.trim()
    if (err) err.hidden = true
    if (text === '') {
      if (err) { err.textContent = 'Kirjoita kommentti ennen lähetystä.'; err.hidden = false }
      return
    }
    sendBtn.disabled = true
    const created = await this.api.post({
      targetType: this.opts.targetType,
      targetId: this.opts.targetId,
      text,
      iconId: iconSelect.value || undefined,
      authorName: nameInput.value.trim() || undefined,
    })
    sendBtn.disabled = false
    if (!created) {
      if (err) { err.textContent = 'Kommentin lähetys epäonnistui — yritä uudelleen.'; err.hidden = false }
      return
    }
    this.comments.push(created)
    input.value = ''
    iconSelect.value = ''
    this.renderList()
  }

  private renderList(state?: 'load-error'): void {
    this.listEl.innerHTML = ''
    if (state === 'load-error' && this.comments.length === 0) {
      const errEl = document.createElement('p')
      errEl.className = 'comment-thread-load-error'
      errEl.textContent = 'Kommenttien lataus epäonnistui.'
      errEl.style.color = 'var(--text-muted)'
      errEl.style.fontSize = '12px'
      this.listEl.appendChild(errEl)
      return
    }
    if (this.comments.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'comment-thread-empty'
      empty.textContent = 'Ei kommentteja vielä.'
      empty.style.color = 'var(--text-muted)'
      empty.style.fontSize = '12px'
      this.listEl.appendChild(empty)
      return
    }
    // Aikajärjestys (vanhin ensin) — sama kuin backend ORDER BY created_at ASC.
    const sorted = [...this.comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (const c of sorted) this.listEl.appendChild(this.buildItem(c))
  }

  private buildItem(c: Comment): HTMLElement {
    const item = document.createElement('div')
    item.className = 'comment-thread-item'
    item.dataset.commentId = c.id
    item.style.display = 'flex'
    item.style.gap = '8px'
    item.style.padding = '8px 0'
    item.style.borderTop = '1px solid var(--border-subtle)'

    if (c.iconId && renderIconSvg(c.iconId, 20)) {
      const iconWrap = document.createElement('span')
      iconWrap.className = 'comment-thread-item-icon'
      iconWrap.style.color = 'var(--accent)'
      iconWrap.style.flexShrink = '0'
      iconWrap.innerHTML = renderIconSvg(c.iconId, 20)
      item.appendChild(iconWrap)
    }

    const body = document.createElement('div')
    body.style.flex = '1'
    body.style.minWidth = '0'

    const textEl = document.createElement('p')
    textEl.className = 'comment-thread-item-text'
    textEl.textContent = c.text
    textEl.style.margin = '0'
    textEl.style.color = 'var(--text-primary)'
    textEl.style.fontSize = '13px'
    textEl.style.wordBreak = 'break-word'
    body.appendChild(textEl)

    const meta = document.createElement('span')
    meta.className = 'comment-thread-item-meta'
    meta.textContent = this.metaText(c)
    meta.style.color = 'var(--text-muted)'
    meta.style.fontSize = '11px'
    body.appendChild(meta)

    item.appendChild(body)

    if (this.opts.canDelete) {
      const delBtn = document.createElement('button')
      delBtn.type = 'button'
      delBtn.className = 'modal-btn-destructive comment-thread-delete'
      delBtn.setAttribute('aria-label', 'Poista kommentti')
      delBtn.textContent = 'Poista'
      delBtn.addEventListener('click', () => { void this.remove(c.id, delBtn) })
      item.appendChild(delBtn)
    }

    return item
  }

  private metaText(c: Comment): string {
    const who = c.authorName || 'Nimetön'
    const when = this.formatTime(c.createdAt)
    return when ? `${who} · ${when}` : who
  }

  private formatTime(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  private async remove(id: string, btn: HTMLButtonElement): Promise<void> {
    if (!window.confirm('Poistetaanko kommentti?')) return
    btn.disabled = true
    const ok = await this.api.del(id)
    if (!ok) { btn.disabled = false; return }
    this.comments = this.comments.filter(c => c.id !== id)
    this.renderList()
  }
}
