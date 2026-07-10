import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  validateTemplateId,
  type IdValidationReason,
  type SignLibrary,
  type SignTemplate,
  type SignPart,
} from '../logic/sign-library'
import { CURATED_ICONS, getIconById, renderIconSvg } from '../logic/icon-set'
import { signImageIds, signImageSrc } from '../logic/sign-images'
import { registerEscClose, createBackdrop, signPreviewHtml } from './modal-helpers'

// T195/V125: kirjasto käynnistyy tyhjänä — ei suojattuja oletusmalleja. Kaikki mallit
// ovat järjestäjän itse tekemiä ja poistettavissa (edit-modaalin destructive-nappi).
const DEFAULT_IDS = new Set<string>()
const MAX_PARTS = 4 // V107: yhdistelmämerkin osien katto

const ID_ERROR_MSG: Record<IdValidationReason, string> = {
  empty: 'Anna tunnus.',
  format: 'Vain A-Z, a-z, 0-9, _ ja - sallittu.',
  duplicate: 'Tunnus on jo käytössä.',
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Callbackit joilla template-modaali kutsuu paneelia/backendia (T193/V123). onChanged
// ajaa paneelin re-renderin + ulkoisen onChangen tallennuksen/poiston jälkeen.
export interface SignTemplateModalCallbacks {
  onSaveTemplate?: (template: SignTemplate, isNew: boolean) => void
  onDeleteTemplate?: (id: string) => void
  onChanged: () => void
}

// T235: template-detalji/edit-modaali eriytetty SignLibraryPanelista (pilkkotaski). Sama
// käyttäytyminen — modaali omistaa oman backdrop/Esc-tilansa (activeModal/unregEsc).
export class SignTemplateModal {
  private activeModal: HTMLElement | null = null
  private unregEsc: (() => void) | null = null

  constructor(
    private readonly library: SignLibrary,
    private readonly callbacks: SignTemplateModalCallbacks,
  ) {}

  open(template: SignTemplate | null): void {
    this.closeModal()

    // T178-jälkeinen korjaus (B-löydös): pää-visuali (yllä) ja "Osat"-lista (alla) olivat kaksi
    // erillistä tilaa — ensin valittu ikoni/kuva ei koskaan päätynyt osalistaan, käyttäjä joutui
    // valitsemaan sen uudestaan osana. comboActive-tilassa pää-visuali kirjoittaa aina parts[0]:seen
    // (ja toisin päin: osalistan poisto/järjestys index 0:ssa synkkaa takaisin päävisualiin).
    let selectedParts: SignPart[] = template?.parts ? [...template.parts] : []
    let comboActive = selectedParts.length > 0
    // Top-valitsimen alkuarvo: parts[0] jos combo jo olemassa, muuten template.iconId/imageId
    // (vanha yksittäis-templaten polku, ennallaan).
    let selectedIconId: string | null = selectedParts[0]?.iconId ?? template?.iconId ?? null
    let selectedImageId: string | null = selectedParts[0]?.imageId ?? template?.imageId ?? null
    let visualTab: 'icon' | 'image' = selectedImageId ? 'image' : 'icon'
    const isDefault = template ? DEFAULT_IDS.has(template.id) : false
    const currentTopPart = (): SignPart | null =>
      selectedImageId ? { imageId: selectedImageId } : (selectedIconId ? { iconId: selectedIconId } : null)

    // comboActive: top-valinta kirjoittaa aina parts[0]:seen (kutsutaan renderPartsList myöhemmin
    // määriteltynä — turvallista, koska nämä funktiot kutsutaan vasta käyttäjän klikatessa).
    function syncPart0FromTop(): void {
      if (!comboActive) return
      const topPart = currentTopPart()
      selectedParts = topPart ? [topPart, ...selectedParts.slice(1)] : selectedParts.slice(1)
      renderPartsList()
    }
    // Osalistan reorder/poisto index 0:ssa synkkaa takaisin top-valitsimeen.
    function syncTopFromPart0(): void {
      const p0 = selectedParts[0]
      selectedIconId = p0?.iconId ?? null
      selectedImageId = p0?.imageId ?? null
      if (selectedParts.length === 0) comboActive = false
      updateIconGrid()
      updateImageGrid()
    }

    const backdrop = createBackdrop('sign-lib-modal-backdrop', () => this.closeModal())
    backdrop.style.cssText = 'position:fixed;inset:0;background:var(--overlay);backdrop-filter:blur(2px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px'

    const modal = document.createElement('div')
    modal.className = 'sign-lib-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-label', template ? 'Muokkaa mallia' : 'Uusi malli')
    modal.style.cssText = 'background:var(--surface-card);border-radius:var(--radius-lg);box-shadow:0 16px 48px rgba(0,0,0,0.5);width:min(480px,92vw);max-height:80vh;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px'
    modal.addEventListener('click', e => e.stopPropagation())

    // Header
    const header = document.createElement('div')
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center'
    const titleEl = document.createElement('span')
    titleEl.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em'
    titleEl.textContent = template ? 'Muokkaa mallia' : 'Uusi malli'
    const closeBtn = document.createElement('button')
    closeBtn.className = 'sign-lib-modal-close'
    closeBtn.setAttribute('aria-label', 'Sulje')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText = 'min-width:44px;min-height:44px;background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;border-radius:var(--radius-sm)'
    closeBtn.addEventListener('click', () => this.closeModal())
    header.appendChild(titleEl)
    header.appendChild(closeBtn)
    modal.appendChild(header)

    // SignPreview (DESIGN.md §K): editissä iso esikatselu templaten kuvasta/ikonista/labelista.
    if (template) {
      const preview = document.createElement('div')
      preview.innerHTML = signPreviewHtml({
        id: template.id,
        imageId: template.imageId,
        label: template.label,
        color: template.color,
        iconId: template.iconId,
        parts: template.parts,
      })
      modal.appendChild(preview)
    }

    // V97: id-kenttä — vain luonnissa (id on muuttumaton avain, editissä lukittu)
    let idInput: HTMLInputElement | null = null
    let idError: HTMLElement | null = null
    if (!template) {
      const idSectionLabel = document.createElement('div')
      idSectionLabel.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em'
      idSectionLabel.textContent = 'Tunnus (uniikki, esim. N-OIK)'
      modal.appendChild(idSectionLabel)

      idInput = document.createElement('input')
      idInput.className = 'sign-lib-id-input'
      idInput.type = 'text'
      idInput.placeholder = 'A-Z, 0-9, _ ja -'
      idInput.style.cssText = 'padding:8px 10px;min-height:44px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-body);font-size:13px;width:100%;box-sizing:border-box'
      modal.appendChild(idInput)

      idError = document.createElement('div')
      idError.className = 'sign-lib-id-error'
      idError.style.cssText = 'font-size:12px;color:var(--danger-text);min-height:0;display:none'
      idError.setAttribute('role', 'alert')
      modal.appendChild(idError)
    }

    // Visual-osio label + tabit (T176): Ikoni vs Kuva — vaihtoehtoiset, kumpi tahansa
    // asetettu viimeksi voittaa (V99 kuva>ikoni>label, DESIGN.md §K ImageGalleryPicker)
    const visualSectionLabel = document.createElement('div')
    visualSectionLabel.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em'
    visualSectionLabel.textContent = 'Ulkoasu (valinnainen)'
    modal.appendChild(visualSectionLabel)

    const tabRow = document.createElement('div')
    tabRow.style.cssText = 'display:flex;border-bottom:1px solid var(--border-default)'
    const iconTabBtn = document.createElement('button')
    iconTabBtn.type = 'button'
    iconTabBtn.className = 'sign-visual-tab'
    iconTabBtn.textContent = 'Ikoni'
    const imageTabBtn = document.createElement('button')
    imageTabBtn.type = 'button'
    imageTabBtn.className = 'sign-visual-tab'
    imageTabBtn.textContent = 'Kuva'
    const tabBtnStyle = (active: boolean) =>
      `flex:1;min-height:44px;background:none;border:none;border-bottom:2px solid ${active ? 'var(--accent)' : 'transparent'};color:${active ? 'var(--text-body)' : 'var(--text-muted)'};font-size:13px;font-weight:${active ? '600' : '400'};cursor:pointer`
    tabRow.appendChild(iconTabBtn)
    tabRow.appendChild(imageTabBtn)
    modal.appendChild(tabRow)

    // Icon grid
    const iconGrid = document.createElement('div')
    iconGrid.className = 'sign-lib-icon-grid'
    iconGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:4px'

    const makeIconBtnStyle = (selected: boolean) =>
      `min-height:44px;background:${selected ? 'var(--accent)' : 'var(--field-tint)'};color:${selected ? 'white' : 'var(--text-muted)'};border:1.5px solid ${selected ? 'var(--accent)' : 'var(--border-default)'};border-radius:var(--radius-sm);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0`

    // "No icon" option
    const noIconBtn = document.createElement('button')
    noIconBtn.className = 'sign-lib-icon-btn'
    noIconBtn.dataset.iconId = ''
    noIconBtn.title = 'Ei ikonia'
    noIconBtn.style.cssText = makeIconBtnStyle(selectedIconId === null) + ';font-size:14px'
    noIconBtn.textContent = '—'
    iconGrid.appendChild(noIconBtn)

    for (const icon of CURATED_ICONS) {
      const btn = document.createElement('button')
      btn.className = 'sign-lib-icon-btn'
      btn.dataset.iconId = icon.id
      btn.title = icon.label
      btn.style.cssText = makeIconBtnStyle(selectedIconId === icon.id)
      btn.innerHTML = renderIconSvg(icon.id, 20)  // safe: content from CURATED_ICONS only
      iconGrid.appendChild(btn)
    }

    const updateIconGrid = () => {
      iconGrid.querySelectorAll<HTMLButtonElement>('.sign-lib-icon-btn').forEach(b => {
        const isSel = (b.dataset.iconId === '') ? (selectedIconId === null) : (b.dataset.iconId === selectedIconId)
        b.style.background = isSel ? 'var(--accent)' : 'var(--field-tint)'
        b.style.color = isSel ? 'white' : 'var(--text-muted)'
        b.style.borderColor = isSel ? 'var(--accent)' : 'var(--border-default)'
      })
    }

    iconGrid.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.sign-lib-icon-btn')
      if (!btn) return
      const chosen = btn.dataset.iconId || null
      selectedIconId = chosen
      if (chosen) selectedImageId = null // V99: kuva>ikoni valinta on vaihtoehtoinen, ei molempia yhtä aikaa
      updateIconGrid()
      updateImageGrid()
      syncPart0FromTop() // T178-korjaus: comboActive-tilassa top-valinta kirjoittaa parts[0]:seen
    })

    modal.appendChild(iconGrid)

    // Kuva-galleria (T176/ImageGalleryPicker) — grid 89:sta T161-konvertoidusta kylttikuvasta.
    // Thumbnail 64x64, klikkaus valitsee suoraan; zoom-nappi avaa lightboxin ilman valintaa.
    const imageGrid = document.createElement('div')
    imageGrid.className = 'sign-image-gallery'
    // flex-shrink:0 (B91/V130): galleria on modaalin (flex-column, overflow-y:auto) lapsi ja
    // sillä on oma overflow-y:auto → CSS antaa flex-itemille min-height:auto=0, jolloin matalalla
    // mobiiliviewportilla modaalin muu sisältö kutistaa gallerian 0-korkeuteen. flex-shrink:0
    // estää kutistuksen → galleria pitää korkeutensa, modaalin oma scroll hoitaa ylipursun.
    imageGrid.style.cssText = 'display:none;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px;max-height:min(50vh,420px);overflow-y:auto;flex-shrink:0'

    const makeImageThumb = (imageId: string | null): HTMLButtonElement => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'sign-image-thumb'
      btn.dataset.imageId = imageId ?? ''
      btn.title = imageId ?? 'Ei kuvaa'
      btn.style.cssText = 'position:relative;width:64px;height:64px;padding:0;background:#fff;border:2px solid var(--border-default);border-radius:var(--radius-sm);cursor:pointer;overflow:hidden'
      if (imageId) {
        const src = signImageSrc(imageId)
        btn.innerHTML = `<img src="${src}" alt="" style="width:100%;height:100%;object-fit:contain;pointer-events:none">
          <span class="sign-image-zoom-btn" data-image-id="${imageId}" role="button" aria-label="Suurenna ${imageId}" style="position:absolute;bottom:0;right:0;width:44px;height:44px;display:flex;align-items:flex-end;justify-content:flex-end;padding:3px;box-sizing:border-box;cursor:zoom-in">
            <span style="width:18px;height:18px;background:rgba(0,0,0,0.55);border-radius:3px;display:flex;align-items:center;justify-content:center;pointer-events:none">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
          </span>`
      } else {
        btn.style.display = 'flex'
        btn.style.alignItems = 'center'
        btn.style.justifyContent = 'center'
        btn.style.color = 'var(--text-muted)'
        btn.style.fontSize = '11px'
        btn.textContent = 'Ei kuvaa'
      }
      return btn
    }

    imageGrid.appendChild(makeImageThumb(null))
    for (const imageId of signImageIds()) {
      imageGrid.appendChild(makeImageThumb(imageId))
    }

    const updateImageGrid = () => {
      imageGrid.querySelectorAll<HTMLButtonElement>('.sign-image-thumb').forEach(b => {
        const isSel = (b.dataset.imageId ?? '') === (selectedImageId ?? '')
        b.style.borderColor = isSel ? 'var(--accent)' : 'var(--border-default)'
        const existing = b.querySelector('.sign-image-selected-badge')
        if (isSel && b.dataset.imageId && !existing) {
          const badge = document.createElement('span')
          badge.className = 'sign-image-selected-badge'
          badge.style.cssText = 'position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:var(--accent);color:var(--accent-text);font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1'
          badge.textContent = '✓'
          b.appendChild(badge)
        } else if (!isSel && existing) {
          existing.remove()
        }
      })
    }
    updateImageGrid()

    imageGrid.addEventListener('click', (e) => {
      const zoomBtn = (e.target as HTMLElement).closest<HTMLElement>('.sign-image-zoom-btn')
      if (zoomBtn) {
        e.stopPropagation()
        const imageId = zoomBtn.dataset.imageId
        if (imageId) this.openImageLightbox(imageId, (chosen) => {
          selectedImageId = chosen
          selectedIconId = null
          updateIconGrid()
          updateImageGrid()
          syncPart0FromTop()
        })
        return
      }
      const thumb = (e.target as HTMLElement).closest<HTMLButtonElement>('.sign-image-thumb')
      if (!thumb) return
      const chosen = thumb.dataset.imageId || null
      selectedImageId = chosen
      if (chosen) selectedIconId = null // V99: kuva>ikoni — vain yksi ulkoasu-lähde kerrallaan
      updateIconGrid()
      updateImageGrid()
      syncPart0FromTop()
    })

    // T196/V123: "Lataa oma kuva" — järjestäjä lataa oman kuvan backendiin (multipart POST),
    // template.imageId = palautettu URL → jaetaan kaikille (ei bundle-riippuvuutta, ratkaisee
    // tuplakuvat/huonot nimet). Ladattu kuva prependataan galleriaan valittuna thumbnailina.
    const uploadRow = document.createElement('div')
    uploadRow.style.cssText = 'display:none;flex-direction:column;gap:4px'
    const uploadBtn = document.createElement('button')
    uploadBtn.type = 'button'
    uploadBtn.className = 'sign-lib-image-upload-btn'
    uploadBtn.textContent = '⬆ Lataa oma kuva'
    uploadBtn.style.cssText = 'min-height:44px;background:var(--field-tint);border:1px dashed var(--border-default);border-radius:var(--radius-sm);color:var(--text-body);font-size:13px;cursor:pointer'
    const uploadInput = document.createElement('input')
    uploadInput.type = 'file'
    uploadInput.accept = 'image/*'
    uploadInput.className = 'sign-lib-image-upload-input'
    uploadInput.style.display = 'none'
    const uploadError = document.createElement('div')
    uploadError.className = 'sign-lib-image-upload-error'
    uploadError.style.cssText = 'font-size:12px;color:var(--danger-text);display:none'
    uploadError.setAttribute('role', 'alert')
    uploadBtn.addEventListener('click', () => uploadInput.click())
    uploadInput.addEventListener('change', async () => {
      const file = uploadInput.files?.[0]
      if (!file) return
      const tid = template?.id ?? idInput?.value.trim() ?? ''
      if (!tid) {
        uploadError.textContent = 'Anna ensin tunnus (id) ennen kuvan lataamista.'
        uploadError.style.display = 'block'
        uploadInput.value = ''
        return
      }
      uploadError.style.display = 'none'
      uploadBtn.disabled = true
      uploadBtn.textContent = 'Ladataan…'
      try {
        const form = new FormData()
        form.append('image', file)
        const res = await fetch(`/api/templates/${encodeURIComponent(tid)}/images`, { method: 'POST', body: form })
        if (!res.ok) throw new Error(String(res.status))
        const { url } = (await res.json()) as { url: string }
        const thumb = makeImageThumb(url) // signImageSrc(url)→url (T196), renderöi <img>
        imageGrid.insertBefore(thumb, imageGrid.children[1] ?? null) // heti "Ei kuvaa":n jälkeen
        selectedImageId = url
        selectedIconId = null
        updateIconGrid()
        updateImageGrid()
        syncPart0FromTop()
      } catch {
        uploadError.textContent = 'Kuvan lataus epäonnistui. Yritä uudelleen.'
        uploadError.style.display = 'block'
      } finally {
        uploadBtn.disabled = false
        uploadBtn.textContent = '⬆ Lataa oma kuva'
        uploadInput.value = ''
      }
    })
    uploadRow.appendChild(uploadBtn)
    uploadRow.appendChild(uploadInput)
    uploadRow.appendChild(uploadError)
    modal.appendChild(uploadRow)

    modal.appendChild(imageGrid)

    const setVisualTab = (tab: 'icon' | 'image') => {
      visualTab = tab
      iconGrid.style.display = tab === 'icon' ? 'grid' : 'none'
      imageGrid.style.display = tab === 'image' ? 'grid' : 'none'
      uploadRow.style.display = tab === 'image' ? 'flex' : 'none'
      iconTabBtn.style.cssText = tabBtnStyle(tab === 'icon')
      imageTabBtn.style.cssText = tabBtnStyle(tab === 'image')
    }
    iconTabBtn.addEventListener('click', () => setVisualTab('icon'))
    imageTabBtn.addEventListener('click', () => setVisualTab('image'))
    setVisualTab(visualTab)

    // T172/V107: yhdistelmämerkki — pystypino kepissä. parts[0] ylin, max MAX_PARTS osaa.
    // comboActive=false: valinnainen lisä ylemmän yksi-ikoni-kentän rinnalla (ei korvaa sitä).
    // comboActive=true (T178-korjaus): parts[0] ON pää-visuali, synkassa top-valitsimen kanssa.
    const partsSectionLabel = document.createElement('div')
    partsSectionLabel.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em'
    partsSectionLabel.textContent = 'Osat (yhdistelmämerkki, valinnainen)'
    modal.appendChild(partsSectionLabel)

    const partsList = document.createElement('div')
    partsList.className = 'sign-lib-parts-list'
    modal.appendChild(partsList)

    const addPartRow = document.createElement('div')
    addPartRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:6px'
    const addPartBtn = document.createElement('button')
    addPartBtn.className = 'sign-lib-part-add-toggle'
    addPartBtn.type = 'button'
    addPartBtn.textContent = '+ Lisää osa'
    addPartBtn.style.cssText = 'min-height:36px;padding:4px 10px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-muted);font-size:12px;cursor:pointer'
    addPartRow.appendChild(addPartBtn)
    modal.appendChild(addPartRow)

    // T177: osan lisäys — Ikoni/Kuva-tabit (sama pattern kuin päävisualin T176-galleria).
    // Yksi osa on aina joko-tai (SignPart{iconId?, imageId?}) — ei molempia per osa (V107).
    const partPicker = document.createElement('div')
    partPicker.className = 'sign-lib-part-picker'
    partPicker.style.cssText = 'display:none;flex-direction:column;gap:4px'

    const partTabRow = document.createElement('div')
    partTabRow.style.cssText = 'display:flex;border-bottom:1px solid var(--border-default)'
    const partIconTabBtn = document.createElement('button')
    partIconTabBtn.type = 'button'
    partIconTabBtn.className = 'sign-part-visual-tab'
    partIconTabBtn.textContent = 'Ikoni'
    const partImageTabBtn = document.createElement('button')
    partImageTabBtn.type = 'button'
    partImageTabBtn.className = 'sign-part-visual-tab'
    partImageTabBtn.textContent = 'Kuva'
    partTabRow.appendChild(partIconTabBtn)
    partTabRow.appendChild(partImageTabBtn)
    partPicker.appendChild(partTabRow)

    const partIconGrid = document.createElement('div')
    partIconGrid.className = 'sign-lib-part-icon-grid'
    partIconGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:4px'
    for (const icon of CURATED_ICONS) {
      const btn = document.createElement('button')
      btn.className = 'sign-lib-part-icon-btn'
      btn.type = 'button'
      btn.dataset.iconId = icon.id
      btn.title = icon.label
      btn.style.cssText = 'min-height:40px;background:var(--field-tint);color:var(--text-muted);border:1px solid var(--border-default);border-radius:var(--radius-sm);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0'
      btn.innerHTML = renderIconSvg(icon.id, 18) // safe: content from CURATED_ICONS only
      partIconGrid.appendChild(btn)
    }
    partPicker.appendChild(partIconGrid)

    const partImageGrid = document.createElement('div')
    partImageGrid.className = 'sign-lib-part-image-grid'
    partImageGrid.style.cssText = 'display:none;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:4px;max-height:min(40vh,320px);overflow-y:auto'
    for (const imageId of signImageIds()) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'sign-lib-part-image-btn'
      btn.dataset.imageId = imageId
      btn.title = imageId
      btn.style.cssText = 'width:44px;height:44px;padding:0;background:#fff;border:1px solid var(--border-default);border-radius:var(--radius-sm);cursor:pointer;overflow:hidden'
      btn.innerHTML = `<img src="${signImageSrc(imageId)}" alt="" style="width:100%;height:100%;object-fit:contain;pointer-events:none">`
      partImageGrid.appendChild(btn)
    }
    partPicker.appendChild(partImageGrid)
    modal.appendChild(partPicker)

    const setPartTab = (tab: 'icon' | 'image') => {
      partIconGrid.style.display = tab === 'icon' ? 'grid' : 'none'
      partImageGrid.style.display = tab === 'image' ? 'grid' : 'none'
      partIconTabBtn.style.cssText = tabBtnStyle(tab === 'icon')
      partImageTabBtn.style.cssText = tabBtnStyle(tab === 'image')
    }
    partIconTabBtn.addEventListener('click', () => setPartTab('icon'))
    partImageTabBtn.addEventListener('click', () => setPartTab('image'))
    setPartTab('icon')

    const renderPartsList = () => {
      partsList.innerHTML = selectedParts.map((p, i) => {
        const iconEntry = p.iconId ? getIconById(p.iconId) : null
        const inner = p.imageId
          ? `<img src="${signImageSrc(p.imageId)}" alt="" style="width:100%;height:100%;object-fit:contain;background:#fff">`
          : (iconEntry ? renderIconSvg(p.iconId!, 16) : '?') // safe: CURATED_ICONS content only
        const swatchBg = p.imageId ? 'transparent' : 'var(--text-muted)'
        const partLabel = p.imageId ?? iconEntry?.label ?? '?'
        return `<div class="sign-lib-part-row" data-idx="${i}" style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border-card)">
          <span style="width:28px;height:28px;flex-shrink:0;border-radius:4px;background:${swatchBg};color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden">${inner}</span>
          <span style="flex:1;font-size:12px;color:var(--text-muted)">${i + 1}. ${escapeHtml(partLabel)}</span>
          <button class="sign-lib-part-up" data-idx="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Siirrä ylös" style="min-width:44px;min-height:44px;background:none;border:none;color:var(--text-muted);cursor:pointer">↑</button>
          <button class="sign-lib-part-down" data-idx="${i}" ${i === selectedParts.length - 1 ? 'disabled' : ''} aria-label="Siirrä alas" style="min-width:44px;min-height:44px;background:none;border:none;color:var(--text-muted);cursor:pointer">↓</button>
          <button class="sign-lib-part-remove" data-idx="${i}" aria-label="Poista osa" style="min-width:44px;min-height:44px;background:none;border:none;color:var(--danger-text);cursor:pointer">×</button>
        </div>`
      }).join('')
      addPartBtn.disabled = selectedParts.length >= MAX_PARTS
      addPartBtn.style.opacity = addPartBtn.disabled ? '0.5' : '1'

      partsList.querySelectorAll<HTMLButtonElement>('.sign-lib-part-up').forEach(b => {
        b.addEventListener('click', () => {
          const i = Number(b.dataset.idx)
          if (i <= 0) return
          ;[selectedParts[i - 1], selectedParts[i]] = [selectedParts[i], selectedParts[i - 1]]
          syncTopFromPart0() // reorder voi vaihtaa index 0:n sisällön — top-valitsin seuraa perässä
          renderPartsList()
        })
      })
      partsList.querySelectorAll<HTMLButtonElement>('.sign-lib-part-down').forEach(b => {
        b.addEventListener('click', () => {
          const i = Number(b.dataset.idx)
          if (i >= selectedParts.length - 1) return
          ;[selectedParts[i + 1], selectedParts[i]] = [selectedParts[i], selectedParts[i + 1]]
          syncTopFromPart0()
          renderPartsList()
        })
      })
      partsList.querySelectorAll<HTMLButtonElement>('.sign-lib-part-remove').forEach(b => {
        b.addEventListener('click', () => {
          const i = Number(b.dataset.idx)
          selectedParts = selectedParts.filter((_, idx) => idx !== i)
          syncTopFromPart0() // poisto voi tyhjentää tai vaihtaa index 0:n — top-valitsin seuraa perässä
          renderPartsList()
        })
      })
    }
    renderPartsList()

    // T178-korjaus: ensimmäinen "+ Lisää osa" -klikkaus siirtää senhetkisen top-valinnan
    // (jos on) osalistan ekaksi riviksi ennen pickerin avaamista — käyttäjän ei tarvitse
    // valita samaa merkkiä kahdesti. Sen jälkeen top pysyy synkassa parts[0]:n kanssa.
    addPartBtn.addEventListener('click', () => {
      if (!comboActive) {
        comboActive = true
        const topPart = currentTopPart()
        if (topPart && selectedParts.length === 0) {
          selectedParts = [topPart]
          renderPartsList()
        }
      }
      partPicker.style.display = partPicker.style.display === 'none' ? 'flex' : 'none'
    })

    partIconGrid.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.sign-lib-part-icon-btn')
      if (!btn || selectedParts.length >= MAX_PARTS) return
      selectedParts = [...selectedParts, { iconId: btn.dataset.iconId }]
      partPicker.style.display = 'none'
      syncTopFromPart0() // jos top oli tyhjä, tästä tuli juuri parts[0] — top-valitsin seuraa perässä
      renderPartsList()
    })

    partImageGrid.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.sign-lib-part-image-btn')
      if (!btn || selectedParts.length >= MAX_PARTS) return
      selectedParts = [...selectedParts, { imageId: btn.dataset.imageId }]
      partPicker.style.display = 'none'
      syncTopFromPart0()
      renderPartsList()
    })

    // Label
    const labelSectionLabel = document.createElement('div')
    labelSectionLabel.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em'
    labelSectionLabel.textContent = 'Nimi'
    modal.appendChild(labelSectionLabel)

    const labelInput = document.createElement('input')
    labelInput.className = 'sign-lib-label-input'
    labelInput.type = 'text'
    labelInput.placeholder = 'Esim. Huoltopiste 25km'
    labelInput.value = template?.label ?? ''
    labelInput.style.cssText = 'padding:8px 10px;min-height:44px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-body);font-size:13px;width:100%;box-sizing:border-box'
    modal.appendChild(labelInput)

    // V99/T160: ei erillistä lyhenne-kenttää — kartta-teksti johdetaan labelista (compactLabel).
    // Color-rivi (vain custom-malleille; oletusmalleilla väri lukittu).
    let colorInput: HTMLInputElement | null = null
    if (!isDefault) {
      const colorRow = document.createElement('div')
      colorRow.style.cssText = 'display:flex;gap:6px'
      colorInput = document.createElement('input')
      colorInput.type = 'color'
      colorInput.className = 'sign-lib-color-input'
      colorInput.value = template?.color ?? '#f59e0b'
      colorInput.style.cssText = 'width:44px;height:44px;border:1px solid var(--border-default);border-radius:var(--radius-sm);cursor:pointer;background:none;padding:2px;flex-shrink:0'
      colorRow.appendChild(colorInput)
      modal.appendChild(colorRow)
    }

    // Description
    const descInput = document.createElement('input')
    descInput.className = 'sign-lib-desc-input'
    descInput.type = 'text'
    descInput.placeholder = 'Kuvaus (valinnainen)'
    descInput.value = template?.description ?? ''
    descInput.style.cssText = 'padding:8px 10px;min-height:44px;background:var(--field-tint);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-body);font-size:13px;width:100%;box-sizing:border-box'
    modal.appendChild(descInput)

    // Favorite toggle (i)
    const favLabel = document.createElement('label')
    favLabel.style.cssText = 'display:flex;align-items:center;gap:8px;min-height:44px;cursor:pointer;font-size:13px;color:var(--text-body)'
    const favCheckbox = document.createElement('input')
    favCheckbox.type = 'checkbox'
    favCheckbox.className = 'sign-lib-fav-checkbox'
    favCheckbox.checked = template?.favorite ?? true
    favCheckbox.style.cssText = 'width:18px;height:18px;cursor:pointer'
    favLabel.appendChild(favCheckbox)
    favLabel.appendChild(document.createTextNode('Näytä suosikit-pickissä'))
    modal.appendChild(favLabel)

    // Save / Cancel
    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:4px'

    const saveBtn = document.createElement('button')
    saveBtn.className = 'sign-lib-save-btn'
    saveBtn.textContent = 'Tallenna'
    saveBtn.style.cssText = 'flex:1;padding:8px;min-height:44px;background:var(--confirm);color:var(--confirm-text);border:none;border-radius:var(--radius-sm);font-size:13px;font-weight:600;cursor:pointer'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'sign-lib-cancel-btn'
    cancelBtn.textContent = 'Peruuta'
    cancelBtn.style.cssText = 'padding:8px 16px;min-height:44px;background:var(--field-tint);color:var(--text-muted);border:1px solid var(--border-default);border-radius:var(--radius-sm);font-size:13px;cursor:pointer'

    cancelBtn.addEventListener('click', () => this.closeModal())

    saveBtn.addEventListener('click', () => {
      const label = labelInput.value.trim()
      if (!label) return

      const description = descInput.value.trim()
      const iconId = selectedIconId ?? undefined
      const imageId = selectedImageId ?? undefined
      const favorite = favCheckbox.checked
      const parts = selectedParts.length > 0 ? selectedParts : undefined

      if (!template) {
        const id = idInput!.value.trim()
        const v = validateTemplateId(this.library, id)
        if (!v.valid) {
          if (idError) {
            idError.textContent = ID_ERROR_MSG[v.reason]
            idError.style.display = 'block'
          }
          idInput!.focus()
          return
        }
        const color = colorInput?.value ?? '#f59e0b'
        const created = createTemplate(this.library, { label, color, description, favorite, iconId, imageId, parts }, id)
        this.callbacks.onSaveTemplate?.(created, true)
      } else {
        const patch: Partial<Omit<SignTemplate, 'id'>> = { label, description, iconId, imageId, favorite, parts }
        if (colorInput) patch.color = colorInput.value
        const updated = updateTemplate(this.library, template.id, patch)
        if (updated) this.callbacks.onSaveTemplate?.(updated, false)
      }

      this.closeModal()
      this.callbacks.onChanged()
    })

    btnRow.appendChild(saveBtn)
    btnRow.appendChild(cancelBtn)
    modal.appendChild(btnRow)

    // Destructive delete button (ii) — only for non-defaults
    if (template && !isDefault) {
      const deleteBtn = document.createElement('button')
      deleteBtn.className = 'modal-btn-destructive'
      deleteBtn.textContent = 'Poista malli'
      deleteBtn.style.cssText = 'width:100%;padding:8px;min-height:44px;background:var(--danger-soft);color:var(--danger-text);border:none;border-radius:var(--radius-sm);font-size:13px;cursor:pointer;margin-top:4px'
      deleteBtn.addEventListener('click', () => {
        if (!confirm(`Poistetaanko malli "${template.label}"? Toimintoa ei voi peruuttaa.`)) return
        deleteTemplate(this.library, template.id)
        this.callbacks.onDeleteTemplate?.(template.id)
        this.closeModal()
        this.callbacks.onChanged()
      })
      modal.appendChild(deleteBtn)
    }

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    this.activeModal = backdrop
    this.unregEsc = registerEscClose(() => this.closeModal())
  }

  // T176/ImageGalleryPicker (DESIGN.md §K): suurentaa thumbnailin — pienet 64px-kuvat eivät
  // riitä erottamaan samankaltaisia kylttejä (esim. "ylämäki"-variaatiot). z-index 5000 ylittää
  // edit-modaalin (1000). Sulkeutuu Esc/backdrop/✕; "Valitse tämä kuva" valitsee suoraan.
  private openImageLightbox(imageId: string, onChoose: (imageId: string) => void): void {
    // Stacked modal: lightbox on edit-modaalin päällä. Esc saa sulkea vain päällimmäisen —
    // varastetaan edit-modaalin Esc-kuuntelu pois ajaksi, palautetaan sulkiessa.
    this.unregEsc?.()
    let unregEsc: (() => void) | null = null
    const close = () => {
      backdrop.remove()
      unregEsc?.()
      this.unregEsc = registerEscClose(() => this.closeModal())
    }
    const backdrop = createBackdrop('sign-image-lightbox-backdrop', close)
    backdrop.style.cssText = 'position:fixed;inset:0;background:var(--overlay);backdrop-filter:blur(2px);z-index:5000;display:flex;align-items:center;justify-content:center;padding:16px'

    const box = document.createElement('div')
    box.className = 'sign-image-lightbox'
    box.style.cssText = 'position:relative;max-width:min(90vw,640px);max-height:85vh;background:#fff;border-radius:var(--radius-md);overflow:hidden;display:flex;flex-direction:column'
    box.addEventListener('click', e => e.stopPropagation())

    const img = document.createElement('img')
    img.src = signImageSrc(imageId) ?? ''
    img.alt = imageId
    img.style.cssText = 'width:100%;height:100%;max-height:70vh;object-fit:contain;display:block'
    box.appendChild(img)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'sign-image-lightbox-close'
    closeBtn.setAttribute('aria-label', 'Sulje')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText = 'position:absolute;top:8px;right:8px;min-width:44px;min-height:44px;background:rgba(0,0,0,0.55);border:none;border-radius:var(--radius-sm);color:#fff;font-size:16px;cursor:pointer'
    closeBtn.addEventListener('click', close)
    box.appendChild(closeBtn)

    const footer = document.createElement('div')
    footer.style.cssText = 'padding:10px;display:flex;justify-content:center;background:var(--surface-card)'
    const chooseBtn = document.createElement('button')
    chooseBtn.textContent = 'Valitse tämä kuva'
    chooseBtn.style.cssText = 'min-height:44px;padding:0 20px;background:var(--confirm);color:var(--confirm-text);border:none;border-radius:var(--radius-sm);font-size:13px;font-weight:600;cursor:pointer'
    chooseBtn.addEventListener('click', () => {
      onChoose(imageId)
      close()
    })
    footer.appendChild(chooseBtn)
    box.appendChild(footer)

    backdrop.appendChild(box)
    document.body.appendChild(backdrop)
    unregEsc = registerEscClose(close)
  }

  closeModal(): void {
    if (this.activeModal) {
      this.activeModal.remove()
      this.activeModal = null
    }
    this.unregEsc?.()
    this.unregEsc = null
  }
}
