const TAGS = [
  { id: 'bug', label: 'Bug', color: '#ef4444' },
  { id: 'ux', label: 'UX', color: '#f97316' },
  { id: 'feature', label: 'Feature', color: '#3b82f6' },
  { id: 'idea', label: 'Idea', color: '#22c55e' },
] as const

type Tag = typeof TAGS[number]['id']

interface FeedbackItem {
  id: string
  tag: Tag
  description: string
  dom_path: string | null
  element_html: string | null
  page_url: string
  session_path: string[]
  status: 'avoin' | 'tehty'
  created_at: string
}

const STYLES = `
  #fb-toggle {
    position: fixed; bottom: 20px; left: 20px;
    width: 44px; height: 44px; border-radius: 50%;
    background: #1a1a2e; border: 2px solid #4a4a6a;
    color: #fff; font-size: 18px; cursor: pointer;
    z-index: 9998; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    transition: background 0.15s;
    user-select: none;
  }
  #fb-toggle:hover { background: #2d2d4e; }
  #fb-toggle.fb-active { background: #6d28d9; border-color: #8b5cf6; }

  #fb-panel {
    position: fixed; bottom: 74px; left: 20px;
    width: 340px; max-height: 520px;
    background: #0f0f1a; border: 1px solid #3a3a5a;
    border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    z-index: 9999; display: none; flex-direction: column; overflow: hidden;
    font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #e2e8f0;
  }
  #fb-panel.fb-open { display: flex; }

  .fb-tabs { display: flex; border-bottom: 1px solid #3a3a5a; flex-shrink: 0; }
  .fb-tab {
    flex: 1; padding: 10px 0; background: none; border: none;
    color: #64748b; cursor: pointer; font-size: 13px; font-family: inherit;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
  }
  .fb-tab.active { color: #e2e8f0; border-bottom-color: #8b5cf6; }
  .fb-tab:hover { color: #94a3b8; }

  .fb-content { padding: 12px; overflow-y: auto; flex: 1; }

  .fb-tags { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
  .fb-tag-btn {
    padding: 4px 12px; border-radius: 20px; border: 1px solid currentColor;
    background: transparent; cursor: pointer; font-size: 12px;
    opacity: 0.4; font-family: inherit; font-weight: 500;
  }
  .fb-tag-btn:hover { opacity: 0.7; }
  .fb-tag-btn.selected { opacity: 1; }

  #fb-textarea {
    width: 100%; min-height: 80px;
    background: #070710; border: 1px solid #3a3a5a; border-radius: 6px;
    color: #e2e8f0; padding: 8px; font-size: 13px; resize: vertical;
    box-sizing: border-box; font-family: inherit;
  }
  #fb-textarea:focus { outline: 2px solid #6d28d9; border-color: transparent; }

  .fb-picker-row {
    display: flex; align-items: center; gap: 8px; margin: 8px 0;
  }
  .fb-picker-btn {
    padding: 5px 10px; background: #1e1e3a; border: 1px solid #3a3a5a;
    border-radius: 6px; color: #e2e8f0; cursor: pointer; font-size: 12px;
    white-space: nowrap; font-family: inherit;
  }
  .fb-picker-btn:hover { background: #2a2a4a; }
  .fb-picker-btn.active { background: #6d28d9; border-color: #8b5cf6; }

  .fb-element-info {
    background: #070710; border: 1px solid #3a3a5a; border-radius: 6px;
    padding: 6px 8px; font-size: 11px; color: #64748b;
    font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    margin-bottom: 4px;
  }

  .fb-bubble-btns { display: flex; gap: 4px; }
  .fb-bubble-btn {
    padding: 3px 7px; background: #1e1e3a; border: 1px solid #3a3a5a;
    border-radius: 4px; color: #64748b; cursor: pointer; font-size: 11px;
    font-family: inherit;
  }
  .fb-bubble-btn:hover { color: #e2e8f0; background: #2a2a4a; }

  #fb-submit {
    width: 100%; padding: 9px; margin-top: 10px;
    background: #6d28d9; border: none; border-radius: 6px;
    color: #fff; font-size: 14px; cursor: pointer; font-weight: 600;
    font-family: inherit;
  }
  #fb-submit:hover { background: #7c3aed; }
  #fb-submit:disabled { opacity: 0.4; cursor: not-allowed; }

  .fb-list-item {
    background: #070710; border: 1px solid #3a3a5a; border-radius: 8px;
    padding: 10px; margin-bottom: 8px;
  }
  .fb-list-item.status-tehty { opacity: 0.45; }
  .fb-list-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
  .fb-list-tag { font-size: 10px; padding: 2px 7px; border-radius: 10px; font-weight: 700; }
  .fb-list-desc { font-size: 13px; color: #e2e8f0; margin-bottom: 4px; line-height: 1.4; }
  .fb-list-url { font-size: 10px; color: #475569; font-family: monospace; word-break: break-all; }
  .fb-list-actions { display: flex; gap: 6px; margin-top: 8px; }
  .fb-list-btn {
    font-size: 11px; padding: 3px 9px; background: #1e1e3a;
    border: 1px solid #3a3a5a; border-radius: 4px; color: #94a3b8; cursor: pointer;
    font-family: inherit;
  }
  .fb-list-btn:hover { background: #2a2a4a; color: #e2e8f0; }

  #fb-export {
    width: 100%; padding: 8px; margin-bottom: 10px;
    background: #0a1f14; border: 1px solid #1a4a2e; border-radius: 6px;
    color: #4ade80; font-size: 13px; cursor: pointer; font-family: inherit;
  }
  #fb-export:hover { background: #0d2819; }

  .fb-empty { color: #475569; text-align: center; padding: 24px 0; }

  .fb-highlight-hover {
    outline: 2px dashed #8b5cf6 !important;
    outline-offset: 2px !important;
    cursor: crosshair !important;
  }
  .fb-highlight-selected {
    outline: 2px solid #4ade80 !important;
    outline-offset: 2px !important;
  }
`

function getCssSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`
  const parts: string[] = []
  let current: HTMLElement | null = el
  while (current && current !== document.body && parts.length < 5) {
    if (current.id) { parts.unshift(`#${current.id}`); break }
    let sel = current.tagName.toLowerCase()
    const cls = Array.from(current.classList)
      .filter(c => !c.startsWith('fb-highlight'))
      .filter(c => !c.startsWith('leaflet-'))
      .slice(0, 1)[0]
    if (cls) sel += `.${cls}`
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName)
      if (siblings.length > 1) sel += `:nth-child(${siblings.indexOf(current) + 1})`
    }
    parts.unshift(sel)
    current = current.parentElement
  }
  return parts.join(' > ')
}

export class FeedbackWidget {
  private panel!: HTMLElement
  private toggleBtn!: HTMLElement
  private pickerMode = false
  private selectedEl: HTMLElement | null = null
  private hoverEl: HTMLElement | null = null
  private sessionPath: string[] = [window.location.href]
  private selectedTag: Tag = 'bug'
  private textarea!: HTMLTextAreaElement
  private elementInfo!: HTMLElement
  private listContent!: HTMLElement

  constructor() {
    this.trackNavigation()
    this.inject()
  }

  private trackNavigation(): void {
    const orig = history.pushState.bind(history)
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      orig(...args)
      this.recordNav()
    }
    window.addEventListener('popstate', () => this.recordNav())
  }

  private recordNav(): void {
    const href = window.location.href
    if (this.sessionPath[this.sessionPath.length - 1] !== href) {
      this.sessionPath.push(href)
      if (this.sessionPath.length > 10) this.sessionPath.shift()
    }
  }

  private inject(): void {
    const style = document.createElement('style')
    style.textContent = STYLES
    document.head.appendChild(style)

    this.toggleBtn = document.createElement('button')
    this.toggleBtn.id = 'fb-toggle'
    this.toggleBtn.textContent = '🐛'
    this.toggleBtn.setAttribute('aria-label', 'Feedback (F2)')
    this.toggleBtn.addEventListener('click', () => this.toggle())
    document.body.appendChild(this.toggleBtn)

    this.panel = document.createElement('div')
    this.panel.id = 'fb-panel'
    this.panel.setAttribute('aria-label', 'Feedback panel')
    this.panel.innerHTML = this.buildPanelHTML()
    document.body.appendChild(this.panel)

    this.textarea = this.panel.querySelector('#fb-textarea')!
    this.elementInfo = this.panel.querySelector('#fb-element-info')!
    this.listContent = this.panel.querySelector('#fb-list-content')!

    this.bindEvents()

    document.addEventListener('keydown', (e) => {
      if (e.key === 'F2') { e.preventDefault(); this.toggle() }
      if (e.key === 'Escape' && this.pickerMode) this.stopPicker()
    })
  }

  private buildPanelHTML(): string {
    const tagBtns = TAGS.map(t =>
      `<button class="fb-tag-btn${t.id === 'bug' ? ' selected' : ''}" data-tag="${t.id}" style="color:${t.color}">${t.label}</button>`
    ).join('')

    return `
      <div class="fb-tabs">
        <button class="fb-tab active" data-tab="uusi">Uusi</button>
        <button class="fb-tab" data-tab="lista">Lista</button>
      </div>
      <div class="fb-content" id="fb-pane-uusi">
        <div class="fb-tags">${tagBtns}</div>
        <textarea id="fb-textarea" placeholder="Kuvaile ongelma tai idea…"></textarea>
        <div class="fb-picker-row">
          <button class="fb-picker-btn" id="fb-picker-toggle">🎯 Valitse elementti</button>
          <div class="fb-bubble-btns">
            <button class="fb-bubble-btn" id="fb-bubble-up" title="parent">↑</button>
            <button class="fb-bubble-btn" id="fb-bubble-down" title="child">↓</button>
          </div>
        </div>
        <div class="fb-element-info" id="fb-element-info">Ei elementtiä valittuna</div>
        <button id="fb-submit">Tallenna</button>
      </div>
      <div class="fb-content" id="fb-pane-lista" style="display:none">
        <button id="fb-export">📋 Vie Claudelle</button>
        <div id="fb-list-content"></div>
      </div>
    `
  }

  private bindEvents(): void {
    this.panel.querySelectorAll('.fb-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab as 'uusi' | 'lista'
        this.switchTab(tab)
      })
    })

    this.panel.querySelectorAll('.fb-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.panel.querySelectorAll('.fb-tag-btn').forEach(b => b.classList.remove('selected'))
        btn.classList.add('selected')
        this.selectedTag = (btn as HTMLElement).dataset.tag as Tag
      })
    })

    this.panel.querySelector('#fb-picker-toggle')!
      .addEventListener('click', () => this.pickerMode ? this.stopPicker() : this.startPicker())

    this.panel.querySelector('#fb-bubble-up')!.addEventListener('click', () => this.bubbleUp())
    this.panel.querySelector('#fb-bubble-down')!.addEventListener('click', () => this.bubbleDown())
    this.panel.querySelector('#fb-submit')!.addEventListener('click', () => this.submit())
    this.panel.querySelector('#fb-export')!.addEventListener('click', () => this.exportForClaude())
  }

  private switchTab(tab: 'uusi' | 'lista'): void {
    this.panel.querySelectorAll('.fb-tab').forEach(b => {
      b.classList.toggle('active', (b as HTMLElement).dataset.tab === tab)
    })
    ;(this.panel.querySelector('#fb-pane-uusi') as HTMLElement).style.display = tab === 'uusi' ? '' : 'none'
    ;(this.panel.querySelector('#fb-pane-lista') as HTMLElement).style.display = tab === 'lista' ? '' : 'none'
    if (tab === 'lista') this.loadList()
  }

  private startPicker(): void {
    this.pickerMode = true
    this.panel.querySelector('#fb-picker-toggle')?.classList.add('active')
    document.addEventListener('mouseover', this.onHover)
    document.addEventListener('click', this.onPickerClick, true)
    document.body.style.cursor = 'crosshair'
  }

  private stopPicker(): void {
    this.pickerMode = false
    this.panel.querySelector('#fb-picker-toggle')?.classList.remove('active')
    document.removeEventListener('mouseover', this.onHover)
    document.removeEventListener('click', this.onPickerClick, true)
    document.body.style.cursor = ''
    this.hoverEl?.classList.remove('fb-highlight-hover')
    this.hoverEl = null
  }

  private onHover = (e: MouseEvent): void => {
    const target = e.target as HTMLElement
    if (target.closest('#fb-panel') || target.closest('#fb-toggle')) return
    if (this.hoverEl !== target) {
      this.hoverEl?.classList.remove('fb-highlight-hover')
      this.hoverEl = target
      target.classList.add('fb-highlight-hover')
    }
  }

  private onPickerClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement
    if (target.closest('#fb-panel') || target.closest('#fb-toggle')) return
    e.preventDefault()
    e.stopPropagation()
    this.selectedEl?.classList.remove('fb-highlight-selected')
    this.selectedEl = target
    target.classList.add('fb-highlight-selected')
    this.updateElementInfo()
    this.stopPicker()
  }

  private updateElementInfo(): void {
    if (!this.selectedEl) return
    const selector = getCssSelector(this.selectedEl)
    this.elementInfo.textContent = selector
    this.elementInfo.setAttribute('data-html', this.selectedEl.outerHTML.substring(0, 300))
  }

  private bubbleUp(): void {
    if (!this.selectedEl) return
    const parent = this.selectedEl.parentElement
    if (!parent || parent === document.body || parent === document.documentElement) return
    this.selectedEl.classList.remove('fb-highlight-selected')
    this.selectedEl = parent
    this.selectedEl.classList.add('fb-highlight-selected')
    this.updateElementInfo()
  }

  private bubbleDown(): void {
    if (!this.selectedEl) return
    const child = this.selectedEl.firstElementChild as HTMLElement | null
    if (!child) return
    this.selectedEl.classList.remove('fb-highlight-selected')
    this.selectedEl = child
    this.selectedEl.classList.add('fb-highlight-selected')
    this.updateElementInfo()
  }

  private async submit(): Promise<void> {
    const desc = this.textarea.value.trim()
    if (!desc) { this.textarea.focus(); return }

    const submitBtn = this.panel.querySelector('#fb-submit') as HTMLButtonElement
    submitBtn.disabled = true

    try {
      await fetch('/api/devfeedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag: this.selectedTag,
          description: desc,
          dom_path: this.selectedEl ? getCssSelector(this.selectedEl) : null,
          element_html: this.selectedEl ? this.selectedEl.outerHTML.substring(0, 500) : null,
          page_url: window.location.href,
          session_path: this.sessionPath.slice(-5),
        }),
      })
      this.textarea.value = ''
      this.selectedEl?.classList.remove('fb-highlight-selected')
      this.selectedEl = null
      this.elementInfo.textContent = 'Ei elementtiä valittuna'
      this.toggleBtn.textContent = '✓'
      setTimeout(() => { this.toggleBtn.textContent = '🐛' }, 1500)
    } catch (err) {
      console.error('[feedback] submit failed', err)
    } finally {
      submitBtn.disabled = false
    }
  }

  private async loadList(): Promise<void> {
    this.listContent.innerHTML = '<p class="fb-empty">Ladataan…</p>'
    try {
      const res = await fetch('/api/devfeedback')
      const items: FeedbackItem[] = await res.json()
      this.renderList(items)
    } catch {
      this.listContent.innerHTML = '<p class="fb-empty" style="color:#ef4444">Lataus epäonnistui</p>'
    }
  }

  private renderList(items: FeedbackItem[]): void {
    if (items.length === 0) {
      this.listContent.innerHTML = '<p class="fb-empty">Ei palautetta vielä</p>'
      return
    }

    this.listContent.innerHTML = items.map(item => {
      const tag = TAGS.find(t => t.id === item.tag)!
      const date = new Date(item.created_at).toLocaleDateString('fi-FI')
      const urlShort = item.page_url.replace(/^https?:\/\/[^/]+/, '')
      return `
        <div class="fb-list-item status-${item.status}" data-id="${item.id}">
          <div class="fb-list-meta">
            <span class="fb-list-tag" style="background:${tag.color}22;color:${tag.color}">${tag.label}</span>
            <span style="color:#475569;font-size:11px">${date}</span>
            ${item.status === 'tehty' ? '<span style="color:#4ade80;font-size:11px">✓ tehty</span>' : ''}
          </div>
          <div class="fb-list-desc">${escapeHtml(item.description)}</div>
          ${item.dom_path ? `<div class="fb-list-url">${escapeHtml(item.dom_path)}</div>` : ''}
          <div class="fb-list-url">${escapeHtml(urlShort)}</div>
          <div class="fb-list-actions">
            ${item.status === 'avoin'
              ? `<button class="fb-list-btn" data-action="tehty" data-id="${item.id}">Merkitse tehdyksi</button>`
              : `<button class="fb-list-btn" data-action="avoin" data-id="${item.id}">Avaa uudelleen</button>`
            }
          </div>
        </div>
      `
    }).join('')

    this.listContent.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.id!
        const status = (btn as HTMLElement).dataset.action!
        await fetch(`/api/devfeedback/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        this.loadList()
      })
    })
  }

  private async exportForClaude(): Promise<void> {
    try {
      const res = await fetch('/api/devfeedback?status=avoin')
      const items: FeedbackItem[] = await res.json()

      if (items.length === 0) {
        this.listContent.innerHTML = '<p class="fb-empty">Ei avoimia palautteita</p>'
        return
      }

      const today = new Date().toISOString().split('T')[0]
      const text = `## Feedback-lista (${today})\n\n` + items.map(item => {
        const lines = [`### [${item.tag}] ${item.description}`, `Sivu: ${item.page_url}`]
        if (item.dom_path) lines.push(`Elementti: ${item.dom_path}`)
        if (item.session_path?.length > 1) lines.push(`Polku: ${item.session_path.join(' → ')}`)
        return lines.join('\n')
      }).join('\n\n')

      await navigator.clipboard.writeText(text)

      const btn = this.panel.querySelector('#fb-export') as HTMLButtonElement
      btn.textContent = '✓ Kopioitu!'
      setTimeout(() => { btn.textContent = '📋 Vie Claudelle' }, 2000)
    } catch (err) {
      console.error('[feedback] export failed', err)
    }
  }

  toggle(): void {
    const open = this.panel.classList.toggle('fb-open')
    this.toggleBtn.classList.toggle('fb-active', open)
    if (!open) {
      if (this.pickerMode) this.stopPicker()
      this.selectedEl?.classList.remove('fb-highlight-selected')
      this.selectedEl = null
      this.elementInfo.textContent = 'Ei elementtiä valittuna'
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
