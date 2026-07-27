import { createBackdrop, registerEscClose } from './modal-helpers'

/**
 * T337/V246 — jaettu lightbox-kuori (fix B132).
 *
 * Yksi toteutus kaikille suurennetuille kuville: merkkien valokuvat, huomioiden kuvat (T338)
 * ja kylttivisuaali (marker-visual-row). Kolme erillistä toteutusta tarkoittaisi kolmea eri
 * sulkemiskäytöstä — Esc, backdrop-klikki ja ✕ kuuluvat toimia samoin joka paikassa (escape-chain).
 *
 * Nostettu marker-visual-row.ts:n openMarkerLightboxista; rakenne ja luokkanimet säilytetty
 * (.marker-visual-lightbox*) jotta olemassa oleva CSS ja testit pysyvät voimassa.
 */

export interface LightboxOptions {
  /** Sisältö joka renderöidään lavalle (kuva, merkkivisuaali, mikä tahansa elementti). */
  stage: HTMLElement
  /** Kuvateksti lavan alla. Tyhjä/puuttuva → ei caption-elementtiä. */
  caption?: string
  /** Lavan taustaväri — valokuvalle tumma, merkkivisuaalille valkoinen (oletus). */
  stageBackground?: string
}

/** Avaa lightboxin annetulla sisällöllä. Palauttaa close-funktion (testattavuus + ulkoinen sulku). */
export function openLightbox(opts: LightboxOptions): () => void {
  const close = () => {
    backdrop.remove()
    unregEsc()
  }
  const backdrop = createBackdrop('marker-visual-lightbox-backdrop', close)
  backdrop.style.cssText = 'position:fixed;inset:0;background:var(--overlay);backdrop-filter:blur(2px);z-index:5000;display:flex;align-items:center;justify-content:center;padding:16px'

  const box = document.createElement('div')
  box.className = 'marker-visual-lightbox'
  box.style.cssText = 'position:relative;max-width:min(90vw,420px);width:100%;background:var(--surface-card);border:1px solid var(--border-default);border-radius:var(--radius-lg);box-shadow:0 24px 64px rgba(0,0,0,0.6);padding:16px'
  box.addEventListener('click', (e) => e.stopPropagation())

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'marker-visual-lightbox-close'
  closeBtn.setAttribute('aria-label', 'Sulje')
  closeBtn.textContent = '✕'
  closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:8px;border:1px solid var(--border-strong);background:transparent;color:var(--text-muted);font-size:15px;cursor:pointer'
  closeBtn.addEventListener('click', close)
  box.appendChild(closeBtn)

  const stage = document.createElement('div')
  stage.className = 'marker-visual-lightbox-stage'
  stage.style.cssText = `background:${opts.stageBackground ?? '#fff'};border-radius:var(--radius-sm);min-height:200px;display:flex;align-items:center;justify-content:center;margin-top:6px`
  stage.appendChild(opts.stage)
  box.appendChild(stage)

  if (opts.caption) {
    const caption = document.createElement('p')
    caption.className = 'marker-visual-lightbox-caption'
    caption.style.cssText = 'text-align:center;font-size:13px;color:var(--text-muted);margin:10px 0 0'
    caption.textContent = opts.caption
    box.appendChild(caption)
  }

  backdrop.appendChild(box)
  document.body.appendChild(backdrop)
  const unregEsc = registerEscClose(close)
  return close
}

/**
 * Avaa VALOKUVAN täysikokoisena (V246). `object-fit:contain` — thumbnailin `cover` rajaa,
 * ja juuri se rajaus hävittää sen mitä kentällä kuvattiin ∴ isossa ei saa rajata.
 * Tumma lava: valokuva erottuu vaaleasta modaalikehyksestä eikä valkoinen reuna sekoitu kuvaan.
 */
export function openImageLightbox(src: string, caption?: string): () => void {
  const img = document.createElement('img')
  img.className = 'image-lightbox-photo'
  img.src = src
  img.alt = caption ?? 'Kuva'
  img.style.cssText = 'max-width:100%;max-height:70vh;object-fit:contain;display:block;border-radius:var(--radius-sm)'
  return openLightbox({ stage: img, caption, stageBackground: 'var(--surface-app)' })
}
