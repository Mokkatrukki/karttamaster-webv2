import {
  createLibrary,
  listTemplates,
  loadLibrary,
  type SignLibrary,
  type SignTemplate,
} from '../logic/sign-library'
import { buildMarkerVisual, type MarkerVisualInput } from './marker-visual-row'
import { SignTemplateModal } from './sign-template-modal'

// T200: SignTemplate ei kanna 'type'-kenttää jota buildMarkerVisual käyttää top-level-kuva-avaimena
// (signImageSrc(marker.type)) — SignTemplaten kuva-avainkonventio on t.imageId ?? t.id, ei type-pohjainen.
// color on SignTemplatella aina pakollinen, joten resolveColor() käyttää sitä suoraan (type-fallback
// väriin ei koskaan laukea) — type-kenttä tässä toimii vain kuva-avaimena.
function templateToMarkerVisual(t: SignTemplate): MarkerVisualInput {
  return { type: t.imageId ?? t.id, iconId: t.iconId, label: t.label, parts: t.parts, color: t.color }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// T195/V125: kirjasto seedaa TYHJÄNÄ. Järjestäjä rakentaa jokaisen mallin itse; ne
// jaetaan backendin kautta kaikille (V123). Vanhat oletusnuolet + webp-katalogi (signCatalog)
// poistettu seedistä — monet vanhat kuvat rikki/tuplakuvia; uudet tehdään käsin (T196 tuo
// kuvien latauksen backendiin). createSignLibrary palauttaa cachen tai tyhjän kirjaston.
export function createSignLibrary(): SignLibrary {
  const loaded = loadLibrary()
  if (loaded && loaded.size > 0) return loaded
  return createLibrary()
}

export class SignLibraryPanel {
  private collapsed = false
  private query = '' // hakusuodatin (yksi lista, scrollattava)
  // T235: template-detalji/edit-modaali eriytetty omaan moduuliin (SignTemplateModal). Paneeli
  // omistaa listan/gridin; modaali omistaa oman backdrop/Esc-tilansa. onChanged → re-render + onChange.
  private readonly modal: SignTemplateModal

  constructor(
    private readonly container: HTMLElement,
    private readonly library: SignLibrary,
    private readonly onChange: () => void,
    private readonly onPlace: (template: SignTemplate) => void,
    // T193/V123: backend-sync — luonti/päivitys/poisto reititetään outboxin kautta (markers-wiring wire).
    // Valinnainen: ilman näitä paneeli toimii vanhaan tapaan (cache-only).
    private readonly onSaveTemplate?: (template: SignTemplate, isNew: boolean) => void,
    private readonly onDeleteTemplate?: (id: string) => void,
  ) {
    this.modal = new SignTemplateModal(this.library, {
      onSaveTemplate: this.onSaveTemplate,
      onDeleteTemplate: this.onDeleteTemplate,
      onChanged: () => {
        this.render()
        this.onChange()
      },
    })
    this.render()
  }

  // T193: julkinen re-render — backend-latauksen jälkeen markers-wiring päivittää näkymän.
  refresh(): void {
    this.render()
  }

  private render(): void {
    const all = listTemplates(this.library)
    // T194/V126: Suosikit ensin omana väliotsikkonaan, sitten "Muut" label-aakkosjärjestyksessä.
    const byLabel = (a: SignTemplate, b: SignTemplate) => a.label.localeCompare(b.label, 'fi')
    const favorites = all.filter(t => t.favorite).sort(byLabel)
    const others = all.filter(t => !t.favorite).sort(byLabel)
    this.container.innerHTML = ''

    // Section header
    const sectionHeader = document.createElement('div')
    sectionHeader.className = 'left-panel-section-header'
    sectionHeader.setAttribute('role', 'button')
    sectionHeader.setAttribute('aria-expanded', String(!this.collapsed))
    sectionHeader.innerHTML = `
      <span class="section-header-toggle">${this.collapsed ? '▶' : '▼'}</span>
      <span class="section-header-name">Merkkikirjasto</span>
    `
    sectionHeader.addEventListener('click', () => {
      this.collapsed = !this.collapsed
      this.render()
    })
    this.container.appendChild(sectionHeader)

    if (this.collapsed) { this.bindEvents(); return }

    // Hakukenttä — suodattaa yhtä listaa
    const search = document.createElement('input')
    search.type = 'search'
    search.className = 'sign-lib-search'
    search.placeholder = 'Hae merkkiä…'
    search.value = this.query
    search.style.cssText = 'width:100%;box-sizing:border-box;min-height:44px;padding:0 12px;background:var(--field-tint);border:1px solid var(--border-default);color:var(--text-body);font-size:13px'
    this.container.appendChild(search)

    // Scrollattava lista, ryhmitelty väliotsikoilla (Suosikit / Muut). Ei accordionia (V126).
    const list = document.createElement('div')
    list.className = 'sign-lib-list'
    list.style.cssText = 'max-height:min(60vh,620px);overflow-y:auto'
    list.innerHTML = this.buildGroup('Suosikit', 'suosikit', favorites) + this.buildGroup('Muut', 'muut', others)
    // T200: buildMarkerVisual palauttaa HTMLElementin (ei stringiä) — täytetään slotit DOM:issa
    // innerHTML-asetuksen jälkeen, sama tuplamerkki-visuaali kuin SegmentDetailsModal (T199).
    list.querySelectorAll<HTMLElement>('.sign-lib-swatch-slot').forEach(slot => {
      const t = all.find(x => x.id === slot.dataset.templateId)
      if (!t) return
      slot.appendChild(buildMarkerVisual(templateToMarkerVisual(t), { size: 22, zoomable: false }))
    })
    this.container.appendChild(list)

    // Haku suodattaa rivit DOM:ssa (ei re-renderiä → syöttökenttä ei menetä fokusta).
    // Väliotsikko piiloutuu jos sen ryhmässä ei ole yhtään näkyvää riviä.
    const applyFilter = () => {
      const q = search.value.trim().toLowerCase()
      this.query = search.value
      list.querySelectorAll<HTMLElement>('.sign-lib-group').forEach(group => {
        let anyVisible = false
        group.querySelectorAll<HTMLElement>('.sign-lib-row').forEach(row => {
          const match = (row.dataset.label ?? '').includes(q)
          row.style.display = match ? '' : 'none'
          if (match) anyVisible = true
        })
        group.style.display = anyVisible ? '' : 'none'
      })
    }
    search.addEventListener('input', applyFilter)
    if (this.query) applyFilter()

    // Section footer
    const footer = document.createElement('button')
    footer.className = 'sign-lib-add-btn sign-lib-section-footer'
    footer.style.cssText = 'min-height:44px;width:100%;background:var(--field-tint);border:1px solid var(--border-default);border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);color:var(--text-muted);font-size:12px;cursor:pointer;text-align:left;padding:0 12px'
    footer.textContent = '+ Uusi merkki'
    this.container.appendChild(footer)

    this.bindEvents()
  }

  // T194/V126: yksi ryhmä (väliotsikko + rivit). Tyhjää ryhmää ei renderöidä.
  private buildGroup(title: string, key: string, templates: SignTemplate[]): string {
    if (templates.length === 0) return ''
    const subhead = `<div class="sign-lib-subhead" style="padding:8px 12px 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted)">${escapeHtml(title)}</div>`
    return `<div class="sign-lib-group" data-group="${escapeHtml(key)}">${subhead}${templates.map(t => this.buildRow(t)).join('')}</div>`
  }

  private buildRow(t: SignTemplate): string {
    // T194/V126: koko kuvaus näkyviin labelin alle (ei enää vain label). Tyhjä kuvaus → ei riviä.
    const descHtml = t.description.trim()
      ? `<span class="sign-lib-desc" style="font-size:11px;color:var(--text-muted);line-height:1.3;white-space:normal">${escapeHtml(t.description)}</span>`
      : ''
    const labelBlock = `<span style="display:flex;flex-direction:column;gap:1px;min-width:0">
             <span style="white-space:normal">${escapeHtml(t.label)}</span>
             ${descHtml}
           </span>`

    // T136/V83: kaikki mallit (myös custom) ovat suoraan sijoitettavissa kartalle — ei suosikkivaatimusta
    const placeBtn = `<button class="sign-type-btn sign-lib-place-btn" data-id="${escapeHtml(t.id)}" aria-label="Aseta ${escapeHtml(t.label)} kartalle" style="flex:1;min-width:0;min-height:44px;display:flex;align-items:center;gap:8px;padding:6px 8px;background:none;border:none;color:var(--text-body);font-size:13px;cursor:pointer;text-align:left;border-radius:var(--radius-sm)">
           <span class="sign-swatch sign-lib-swatch-slot" data-template-id="${escapeHtml(t.id)}" style="flex:none;width:22px;height:22px;position:relative"></span>
           ${labelBlock}
         </button>`

    return `<div class="sign-lib-row" data-label="${escapeHtml(t.label.toLowerCase())}" style="display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--border-card);padding:0">
      ${placeBtn}
      <button class="sign-lib-dots-btn" data-id="${t.id}" aria-label="Muokkaa mallia" style="flex:none;min-width:44px;min-height:44px;background:none;border:none;border-radius:var(--radius-sm);color:var(--text-muted);font-size:14px;cursor:pointer;letter-spacing:0.05em">···</button>
    </div>`
  }

  private bindEvents(): void {
    this.container.querySelectorAll<HTMLButtonElement>('.sign-lib-dots-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id
        if (!id) return
        const t = this.library.get(id)
        if (t) this.modal.open(t)
      })
    })

    // T136/V83: klikkaus sijoittaa mallin kartalle (arm + seuraava karttaklikki) — ei suosikkivaatimusta
    this.container.querySelectorAll<HTMLButtonElement>('.sign-lib-place-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id
        if (!id) return
        const t = this.library.get(id)
        if (t) this.onPlace(t)
      })
    })

    const addBtn = this.container.querySelector<HTMLButtonElement>('.sign-lib-add-btn')
    addBtn?.addEventListener('click', () => this.modal.open(null))
  }
}
