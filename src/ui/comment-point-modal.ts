import { registerEscClose, createBackdrop } from './modal-helpers'
import {
  postComment, deleteComment, deleteCommentImage, resolveComment, isOpenNote, NOTE_CATEGORIES,
  type Comment, type NewComment, type CommentImageError,
} from '../logic/comments'
import { renderIconSvg } from '../logic/icon-set'
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
  /** T367/V265: saako tämän huomion muokata/poistaa (omistaja tai järjestäjä). Oletus false. */
  canDelete?: (comment: Comment) => boolean
  /** Oletusnimi lomakkeeseen (esim. kirjautuneen näyttönimi). */
  defaultAuthorName?: () => string | undefined
  /** T338: kuvan liitos. Puuttuu → kuvaosio piilossa. null-paluu = onnistui. */
  uploadImage?: (commentId: string, file: File) => Promise<CommentImageError | null>
  /** T364/V263: kuittausnapin näkyvyys (järjestäjä+). Oletus false. */
  canResolve?: () => boolean
  /**
   * T366/V264: luonnospinnin elävä sijainti — raahaus siirtää sitä modaalin ollessa auki.
   * undefined-paluu ⇒ käytetään avaushetken koordinaatteja (pinniä ei ole).
   */
  draftPosition?: () => { lat: number; lon: number } | undefined
  /** T366: modaali sulkeutui (myös Esc/peruutus) → kutsuja siivoaa luonnospinnin. */
  onCreateClosed?: () => void
  /** B152(a): hae huomio uudelleen palvelimelta kun sen kuvat muuttuivat. */
  reload?: (id: string) => Promise<Comment | null>
}

// V262: käyttäjälle kerrotaan MIKSI lataus ei mennyt läpi. "Yritä uudelleen" on väärä ohje
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
  private creating = false
  // T366/V264: luonnoksen kuvat elävät PAIKALLISESTI kunnes Lähetä — peruttu luonnos ⊥ jätä
  // orpoja BLOBeja kantaan eikä syö kuvakiintiötä (V262: 2 kuvaa/60 s).
  private draftImages: { file: File; url: string }[] = []

  constructor(private readonly opts: CommentPointModalOptions = {}) {}

  /** Luontitila: kartalta valittu piste. Luonnos elää kunnes käyttäjä painaa Lähetä (V264). */
  openCreate(lat: number, lon: number): void {
    this.close()
    this.creating = true
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
    // objectURL on oikea muistivuoto mobiilissa jos sitä ei vapauteta.
    for (const img of this.draftImages) URL.revokeObjectURL(img.url)
    this.draftImages = []
    if (this.creating) {
      this.creating = false
      this.opts.onCreateClosed?.()
    }
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

    // V263: kategoria yhdellä painalluksella — dropdown on väärä kontrolli hanskat kädessä.
    // Valinta vaihtaa myös tekstikentän vihjeen ∴ käyttäjä näkee heti millaista tietoa odotetaan.
    const cats = document.createElement('div')
    cats.className = 'comment-point-cats'
    cats.setAttribute('role', 'radiogroup')
    cats.setAttribute('aria-label', 'Huomion tyyppi')
    let selectedIcon = NOTE_CATEGORIES[0].iconId

    const text = document.createElement('textarea')
    text.className = 'comment-point-text'
    text.rows = 3
    text.placeholder = NOTE_CATEGORIES[0].placeholder

    for (const cat of NOTE_CATEGORIES) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'comment-point-cat'
      chip.dataset.icon = cat.iconId
      chip.setAttribute('role', 'radio')
      chip.innerHTML = `<span class="comment-point-cat-icon">${renderIconSvg(cat.iconId, 18)}</span><span>${cat.label}</span>`
      const select = () => {
        selectedIcon = cat.iconId
        text.placeholder = cat.placeholder
        for (const c of cats.querySelectorAll('.comment-point-cat')) {
          const on = (c as HTMLElement).dataset.icon === cat.iconId
          c.classList.toggle('is-active', on)
          c.setAttribute('aria-checked', String(on))
        }
      }
      chip.addEventListener('click', select)
      cats.appendChild(chip)
      if (cat.iconId === selectedIcon) select()
    }
    body.appendChild(cats)
    body.appendChild(text)

    const controls = document.createElement('div')
    controls.className = 'comment-point-controls'

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

    // T366/V264: kuvat kertyvät paikallisesti — käyttäjä NÄKEE ne heti ja voi poistaa väärän
    // ennen lähetystä. Mitään ei mene palvelimelle ennen Lähetä-painallusta.
    body.appendChild(this.buildDraftImageSection())
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
    save.textContent = 'Lähetä'
    save.addEventListener('click', () => {
      // Sijainti luetaan VASTA nyt: pinniä on voitu raahata koko ajan modaalin ollessa auki.
      const pos = this.opts.draftPosition?.() ?? { lat, lon }
      const input: NewComment = {
        targetType: 'point',
        lat: pos.lat,
        lon: pos.lon,
        text: text.value,
        iconId: selectedIcon,
        authorName: name.value || undefined,
      }
      if (!input.text.trim()) {
        error.hidden = false
        error.textContent = 'Kirjoita huomio ensin.'
        return
      }
      save.disabled = true
      save.textContent = 'Lähetetään…'
      const files = this.draftImages.map(i => i.file)
      void postComment(input).then(async (created) => {
        if (!created) {
          save.disabled = false
          save.textContent = 'Lähetä'
          error.hidden = false
          error.textContent = '⚠ Tallennus epäonnistui — yritä uudelleen.'
          return
        }
        // Kuvat perässä: huomio on jo kannassa ∴ osittainen epäonnistuminen EI peru tekstiä
        // (teksti on arvokkaampi kuin kuva) mutta se kerrotaan ääneen.
        let failed = 0
        if (this.opts.uploadImage) {
          save.textContent = 'Lähetetään kuvia…'
          for (const file of files) {
            const err = await this.opts.uploadImage(created.id, file)
            if (err) failed++
          }
        }
        this.opts.onChanged?.()
        if (failed > 0) {
          save.disabled = false
          save.textContent = 'Lähetä'
          error.hidden = false
          error.textContent = `⚠ Huomio tallennettiin, mutta ${failed} kuvaa ei mennyt läpi. Voit lisätä ne uudelleen huomion kautta.`
          return
        }
        this.close()
      })
    })
    footer.appendChild(save)
    body.appendChild(footer)

    return body
  }

  // T366/V264: luonnoksen paikalliset kuvat. objectURL-esikatselu + ✕ per kuva.
  private buildDraftImageSection(): HTMLElement {
    const section = document.createElement('div')
    section.className = 'comment-point-images'
    if (!this.opts.uploadImage) return section

    const gallery = document.createElement('div')
    gallery.className = 'comment-point-image-gallery'
    section.appendChild(gallery)

    const error = document.createElement('p')
    error.className = 'comment-point-image-error'
    error.hidden = true

    const renderGallery = (): void => {
      gallery.replaceChildren()
      this.draftImages.forEach((img, i) => {
        const wrap = document.createElement('div')
        wrap.className = 'comment-point-image-wrap'

        const el = document.createElement('img')
        el.className = 'comment-point-image-thumb'
        el.src = img.url
        el.alt = `Liitettävä kuva ${i + 1}`
        el.setAttribute('role', 'button')
        el.tabIndex = 0
        el.setAttribute('aria-label', `Avaa kuva ${i + 1}`)
        el.addEventListener('click', () => openImageLightbox(img.url))
        wrap.appendChild(el)

        const remove = document.createElement('button')
        remove.type = 'button'
        remove.className = 'comment-point-image-remove'
        remove.setAttribute('aria-label', `Poista kuva ${i + 1}`)
        remove.textContent = '✕'
        remove.addEventListener('click', () => {
          URL.revokeObjectURL(img.url)
          this.draftImages = this.draftImages.filter(x => x !== img)
          renderGallery()
        })
        wrap.appendChild(remove)
        gallery.appendChild(wrap)
      })
    }

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'btn btn--secondary comment-point-add-image'
    addBtn.textContent = '📷 Lisää kuva'

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.setAttribute('capture', 'environment')
    fileInput.className = 'comment-point-file'
    fileInput.hidden = true

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0]
      if (!file) return
      fileInput.value = ''
      addBtn.disabled = true
      addBtn.textContent = 'Pienennetään…'
      error.hidden = true
      // Pienennys jo tässä (V262): kentällä näkee heti jos kuva on kelvoton, ei vasta
      // lähetyshetkellä kun peruminen maksaa koko lomakkeen.
      void downscaleImage(file)
        .then(({ file: prepared }) => {
          this.draftImages.push({ file: prepared, url: URL.createObjectURL(prepared) })
          renderGallery()
        })
        .catch(() => {
          error.hidden = false
          error.textContent = IMAGE_ERROR_TEXT.failed
        })
        .finally(() => {
          addBtn.disabled = false
          addBtn.textContent = '📷 Lisää kuva'
        })
    })

    addBtn.addEventListener('click', () => fileInput.click())
    section.appendChild(addBtn)
    section.appendChild(fileInput)
    section.appendChild(error)
    return section
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

    // V263: tila sanoin, ⊥ pelkkä väri (V197-linja). Kuitattu kertoo KUKA ja MILLOIN —
    // "kuka sanoi tämän hoidetuksi" on se kysymys johon halutaan aina vastaus.
    const state = document.createElement('p')
    state.className = isOpenNote(comment) ? 'comment-point-state comment-point-state--open' : 'comment-point-state comment-point-state--done'
    state.textContent = isOpenNote(comment)
      ? '● Avoin — odottaa tekijää'
      : `✓ Tehty${comment.resolvedBy ? ` — ${comment.resolvedBy}` : ''}${comment.resolvedAt ? ` · ${new Date(comment.resolvedAt).toLocaleString('fi-FI')}` : ''}`
    body.appendChild(state)

    body.appendChild(this.buildImageSection(comment))

    const footer = document.createElement('div')
    footer.className = 'comment-point-modal-footer'

    // V263: kuittaus on järjestäjän koordinointipäätös — talkoolainen ILMOITTAA, järjestäjä KUITTAA.
    if (this.opts.canResolve?.()) {
      const open = isOpenNote(comment)
      const resolveBtn = document.createElement('button')
      resolveBtn.type = 'button'
      resolveBtn.className = open
        ? 'btn btn--confirm comment-point-resolve'
        : 'btn btn--secondary comment-point-resolve'
      resolveBtn.textContent = open ? '✓ Merkitse tehdyksi' : '↩ Palauta avoimeksi'
      resolveBtn.addEventListener('click', () => {
        resolveBtn.disabled = true
        void resolveComment(comment.id, open).then((updated) => {
          resolveBtn.disabled = false
          if (!updated) return
          this.opts.onChanged?.()
          // Näkymä päivittyy paikallaan: käyttäjä näkee kuittauksen tuloksen ⊥ sulkeudu pois.
          this.openView(updated)
        })
      })
      footer.appendChild(resolveBtn)
    }

    if (this.opts.canDelete?.(comment)) {
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
        const wrap = document.createElement('div')
        wrap.className = 'comment-point-image-wrap'

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
        wrap.appendChild(img)

        // T368/V265: kuvan poisto samalla oikeudella kuin huomion muokkaus — kuva on todiste.
        if (this.opts.canDelete?.(comment)) {
          const del = document.createElement('button')
          del.type = 'button'
          del.className = 'comment-point-image-remove'
          del.setAttribute('aria-label', `Poista kuva ${i + 1}`)
          del.textContent = '✕'
          del.addEventListener('click', () => {
            if (!window.confirm('Poistetaanko kuva?')) return
            del.disabled = true
            void deleteCommentImage(url).then((ok) => {
              if (!ok) { del.disabled = false; return }
              // Näkymä päivittyy paikallaan: poisto ei saa sulkea modaalia jonka kautta
              // käyttäjä on juuri katsomassa muita kuvia.
              const left = (comment.images ?? []).filter(u => u !== url)
              this.opts.onChanged?.()
              this.openView({ ...comment, images: left })
            })
          })
          wrap.appendChild(del)
        }

        gallery.appendChild(wrap)
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
      // Pienennys ensin (V262): puhelimen 4000px/6 MB kuva → ~1600px/JPEG ∴ lähetys onnistuu
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
          // B152(a): avoin näkymä ! renderöityä uudelleen — ilman tätä käyttäjä ⊥ näe juuri
          // lataamaansa kuvaa & lataa sen toistamiseen (kiintiö V262 täyttyy kahdesta samasta).
          void this.opts.reload?.(comment.id).then((fresh) => {
            if (fresh) this.openView(fresh)
          })
        })
    })

    addBtn.addEventListener('click', () => fileInput.click())
    section.appendChild(addBtn)
    section.appendChild(fileInput)
    section.appendChild(error)
    return section
  }
}
