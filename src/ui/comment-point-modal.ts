import { registerEscClose, createBackdrop } from './modal-helpers'
import { postComment, deleteComment, type Comment, type NewComment, type CommentImageError } from '../logic/comments'
import { renderIconSvg, CURATED_ICONS } from '../logic/icon-set'
import { openImageLightbox } from './image-lightbox'
import { downscaleImage } from './image-downscale'

// T237/V245 (VISION §Avoimet #6): vapaan pisteen HUOMIO — luonti kartalta + katselu/poisto.
//
// Huomio ⊥ ole merkki (V245): ei tyyppiä, ei statusta, ei pätkäjäsenyyttä. Tämä modaali on
// tarkoituksella OMA komponenttinsa eikä MarkerDetailModalin haara — jaettu modaali ajautuisi
// nopeasti "kumpi tila tämä on" -ehtoketjuksi ja huomion erillisyys hämärtyisi.
//
// Luonti ∀ autentikoidulle (V13) — talkoolainen on se joka NÄKEE ongelman maastossa.
// Poisto vain järjestäjä+ (backend gate `server/routes/comments.ts`; canDelete piilottaa napin).

export interface CommentPointModalOptions {
  /** Kutsutaan kun kommentti luotiin, poistettiin tai kuva lisättiin → kartta/lista päivitetään. */
  onChanged?: () => void
  /** Poistonapin näkyvyys (järjestäjä+). Oletus false. */
  canDelete?: () => boolean
  /** Oletusnimi lomakkeeseen (esim. kirjautuneen näyttönimi). */
  defaultAuthorName?: () => string | undefined
  /** T338: kuvan liitos. Puuttuu → kuvaosio piilossa. null-paluu = onnistui. */
  uploadImage?: (commentId: string, file: File) => Promise<CommentImageError | null>
}

// V247: käyttäjälle kerrotaan MIKSI lataus ei mennyt läpi. "Yritä uudelleen" on väärä ohje
// kun kiintiö on täynnä — silloin oikea ohje on odottaa.
const IMAGE_ERROR_TEXT: Record<CommentImageError, string> = {
  rate_limited: '⚠ Liian monta kuvaa peräkkäin — odota hetki (max 2 kuvaa minuutissa).',
  too_large: '⚠ Kuva on liian suuri.',
  invalid_type: '⚠ Tiedosto ei ole tuettu kuva (JPEG, PNG tai WebP).',
  failed: '⚠ Kuvan lataus epäonnistui — yritä uudelleen.',
}

export class CommentPointModal {
  private backdrop: HTMLElement | null = null
  private unregEsc: (() => void) | null = null

  constructor(private readonly opts: CommentPointModalOptions = {}) {}

  /** Luontitila: kartalta valittu piste. */
  openCreate(lat: number, lon: number): void {
    this.close()
    this.render(this.buildCreateBody(lat, lon), 'Uusi huomio')
  }

  /** Katselutila: olemassa oleva huomio (klikattu kartalta tai sivupalkista). */
  openView(comment: Comment): void {
    this.close()
    this.render(this.buildViewBody(comment), 'Huomio')
  }

  close(): void {
    this.backdrop?.remove()
    this.backdrop = null
    this.unregEsc?.()
    this.unregEsc = null
  }

  isOpen(): boolean { return this.backdrop !== null }

  // ---- kuori ----

  private render(body: HTMLElement, title: string): void {
    const backdrop = createBackdrop('comment-point-modal-backdrop', () => this.close())

    const modal = document.createElement('div')
    modal.className = 'comment-point-modal'
    modal.addEventListener('click', (e) => e.stopPropagation())

    const header = document.createElement('div')
    header.className = 'comment-point-modal-header'
    const h = document.createElement('h3')
    h.className = 'comment-point-modal-title'
    h.textContent = title
    header.appendChild(h)

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'comment-point-modal-close'
    closeBtn.setAttribute('aria-label', 'Sulje')
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => this.close())
    header.appendChild(closeBtn)

    modal.appendChild(header)
    modal.appendChild(body)
    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)

    this.backdrop = backdrop
    this.unregEsc = registerEscClose(() => this.close())
  }

  // ---- luonti ----

  private buildCreateBody(lat: number, lon: number): HTMLElement {
    const body = document.createElement('div')
    body.className = 'comment-point-modal-body'

    const hint = document.createElement('p')
    hint.className = 'comment-point-modal-hint'
    hint.textContent = 'Huomio kiinnittyy valittuun karttapisteeseen. Se ei ole merkki eikä näy tehtävälistoissa.'
    body.appendChild(hint)

    const text = document.createElement('textarea')
    text.className = 'comment-point-text'
    text.rows = 3
    text.placeholder = 'Esim. tämä voisi korjata — juurakko rikki'
    body.appendChild(text)

    const controls = document.createElement('div')
    controls.className = 'comment-point-controls'

    const iconSelect = document.createElement('select')
    iconSelect.className = 'comment-point-icon'
    iconSelect.setAttribute('aria-label', 'Ikoni (valinnainen)')
    const none = document.createElement('option')
    none.value = ''
    none.textContent = 'Ei ikonia'
    iconSelect.appendChild(none)
    for (const icon of CURATED_ICONS) {
      const o = document.createElement('option')
      o.value = icon.id
      o.textContent = icon.label ?? icon.id
      iconSelect.appendChild(o)
    }
    controls.appendChild(iconSelect)

    const name = document.createElement('input')
    name.className = 'comment-point-name'
    name.type = 'text'
    name.placeholder = 'Nimi (valinnainen)'
    name.value = this.opts.defaultAuthorName?.() ?? ''
    controls.appendChild(name)
    body.appendChild(controls)

    const error = document.createElement('p')
    error.className = 'comment-point-error'
    error.hidden = true
    body.appendChild(error)

    const footer = document.createElement('div')
    footer.className = 'comment-point-modal-footer'

    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'btn btn--ghost comment-point-cancel'
    cancel.textContent = 'Peruuta'
    cancel.addEventListener('click', () => this.close())
    footer.appendChild(cancel)

    const save = document.createElement('button')
    save.type = 'button'
    save.className = 'btn btn--confirm comment-point-save'
    save.textContent = 'Tallenna huomio'
    save.addEventListener('click', () => {
      const input: NewComment = {
        targetType: 'point',
        lat,
        lon,
        text: text.value,
        iconId: iconSelect.value || undefined,
        authorName: name.value || undefined,
      }
      if (!input.text.trim()) {
        error.hidden = false
        error.textContent = 'Kirjoita huomio ensin.'
        return
      }
      save.disabled = true
      save.textContent = 'Tallennetaan…'
      void postComment(input).then((created) => {
        if (!created) {
          save.disabled = false
          save.textContent = 'Tallenna huomio'
          error.hidden = false
          error.textContent = '⚠ Tallennus epäonnistui — yritä uudelleen.'
          return
        }
        this.opts.onChanged?.()
        // Kuvan voi liittää vasta kun kommentilla on id (T338) → siirry katselutilaan.
        this.openView(created)
      })
    })
    footer.appendChild(save)
    body.appendChild(footer)

    return body
  }

  // ---- katselu ----

  private buildViewBody(comment: Comment): HTMLElement {
    const body = document.createElement('div')
    body.className = 'comment-point-modal-body'

    const head = document.createElement('div')
    head.className = 'comment-point-view-head'
    if (comment.iconId) {
      const icon = document.createElement('span')
      icon.className = 'comment-point-view-icon'
      icon.innerHTML = renderIconSvg(comment.iconId, 20)
      head.appendChild(icon)
    }
    const textEl = document.createElement('p')
    textEl.className = 'comment-point-view-text'
    textEl.textContent = comment.text
    head.appendChild(textEl)
    body.appendChild(head)

    const meta = document.createElement('p')
    meta.className = 'comment-point-view-meta'
    const when = comment.createdAt ? new Date(comment.createdAt).toLocaleString('fi-FI') : ''
    meta.textContent = [comment.authorName, when].filter(Boolean).join(' · ')
    body.appendChild(meta)

    body.appendChild(this.buildImageSection(comment))

    const footer = document.createElement('div')
    footer.className = 'comment-point-modal-footer'

    if (this.opts.canDelete?.()) {
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'btn btn--ghost comment-point-delete'
      del.textContent = '🗑 Poista'
      del.addEventListener('click', () => {
        if (!window.confirm(`Poistetaanko huomio: "${comment.text}"?`)) return
        del.disabled = true
        void deleteComment(comment.id).then((ok) => {
          if (!ok) { del.disabled = false; return }
          this.opts.onChanged?.()
          this.close()
        })
      })
      footer.appendChild(del)
    }

    const ok = document.createElement('button')
    ok.type = 'button'
    ok.className = 'btn btn--secondary comment-point-ok'
    ok.textContent = 'Sulje'
    ok.addEventListener('click', () => this.close())
    footer.appendChild(ok)
    body.appendChild(footer)

    return body
  }

  // T338: kuvat — thumbit avaavat jaetun lightboxin (T337/V246), lisäys ∀ autentikoidulle (V13).
  private buildImageSection(comment: Comment): HTMLElement {
    const section = document.createElement('div')
    section.className = 'comment-point-images'

    const images = comment.images ?? []
    if (images.length > 0) {
      const gallery = document.createElement('div')
      gallery.className = 'comment-point-image-gallery'
      images.forEach((url, i) => {
        const img = document.createElement('img')
        img.className = 'comment-point-image-thumb'
        img.src = url
        img.loading = 'lazy'
        img.alt = `Huomion kuva ${i + 1}`
        img.setAttribute('role', 'button')
        img.tabIndex = 0
        img.setAttribute('aria-label', `Avaa kuva ${i + 1}`)
        const open = () => openImageLightbox(url, comment.text)
        img.addEventListener('click', open)
        img.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
        })
        img.addEventListener('error', () => {
          const ph = document.createElement('div')
          ph.className = 'comment-point-image-placeholder'
          ph.textContent = '[kuva ei saatavilla]'
          img.replaceWith(ph)
        })
        gallery.appendChild(img)
      })
      section.appendChild(gallery)
    }

    if (!this.opts.uploadImage) return section

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn--secondary comment-point-add-image'
    addBtn.textContent = '📷 Lisää kuva'

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    // Mobiilikamera suoraan: talkoolainen kuvaa ongelman siinä missä seisoo.
    fileInput.setAttribute('capture', 'environment')
    fileInput.className = 'comment-point-file'
    fileInput.hidden = true

    const error = document.createElement('p')
    error.className = 'comment-point-image-error'
    error.hidden = true

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0]
      if (!file) return
      addBtn.disabled = true
      addBtn.textContent = 'Pienennetään…'
      error.hidden = true
      // Pienennys ensin (V247): puhelimen 4000px/6 MB kuva → ~1600px/JPEG ∴ lähetys onnistuu
      // heikollakin yhteydellä eikä kanta täyty. Epäonnistuva pienennys palauttaa alkuperäisen.
      void downscaleImage(file)
        .then(({ file: prepared }) => {
          addBtn.textContent = 'Ladataan…'
          return this.opts.uploadImage!(comment.id, prepared)
        })
        .then((err) => {
          addBtn.disabled = false
          addBtn.textContent = '📷 Lisää kuva'
          fileInput.value = ''
          if (err) {
            error.hidden = false
            error.textContent = IMAGE_ERROR_TEXT[err]
            return
          }
          this.opts.onChanged?.()
        })
    })

    addBtn.addEventListener('click', () => fileInput.click())
    section.appendChild(addBtn)
    section.appendChild(fileInput)
    section.appendChild(error)
    return section
  }
}
