export interface SnapshotEntry {
  id: string
  label: string
  created_at: string
  created_by: string
  trigger: string
}

export class SnapshotPanel {
  private readonly backdrop: HTMLElement
  private readonly listEl: HTMLElement
  private readonly countEl: HTMLElement
  private snapshotCount = 0

  constructor(private readonly role: string) {
    const { backdrop, listEl, countEl } = this.build()
    this.backdrop = backdrop
    this.listEl = listEl
    this.countEl = countEl
    document.body.appendChild(backdrop)

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close()
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close()
    })

    if (this.isAllowed()) {
      this.refresh().catch(console.error)
    }
  }

  private isAllowed(): boolean {
    return this.role === 'järjestäjä' || this.role === 'admin'
  }

  private isOpen(): boolean {
    return this.backdrop.classList.contains('open')
  }

  open(): void {
    if (!this.isAllowed()) return
    this.backdrop.classList.add('open')
    this.refresh().catch(console.error)
  }

  close(): void {
    this.backdrop.classList.remove('open')
  }

  private build(): { backdrop: HTMLElement; listEl: HTMLElement; countEl: HTMLElement } {
    const backdrop = document.createElement('div')
    backdrop.id = 'snapshot-modal-backdrop'
    backdrop.className = 'snapshot-modal-backdrop'

    const modal = document.createElement('div')
    modal.id = 'snapshot-modal'
    modal.className = 'snapshot-modal'
    modal.addEventListener('click', (e) => e.stopPropagation())

    const header = document.createElement('div')
    header.className = 'snapshot-modal-header'

    const titleWrap = document.createElement('h3')
    titleWrap.className = 'snapshot-modal-title'
    titleWrap.textContent = 'Varmuuskopiot ('
    const countEl = document.createElement('span')
    countEl.textContent = '0'
    titleWrap.appendChild(countEl)
    titleWrap.appendChild(document.createTextNode(')'))
    header.appendChild(titleWrap)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'btn-snapshot-modal-close'
    closeBtn.setAttribute('aria-label', 'Sulje')
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => this.close())
    header.appendChild(closeBtn)

    modal.appendChild(header)

    const actions = document.createElement('div')
    actions.className = 'snapshot-modal-actions'

    const createBtn = document.createElement('button')
    createBtn.id = 'btn-snapshot-create'
    createBtn.textContent = 'Luo varmuuskopio'
    createBtn.className = 'btn-snapshot-create'
    createBtn.addEventListener('click', () => { this.handleCreate().catch(console.error) })
    actions.appendChild(createBtn)

    // V102/T164: off-site-turva — lataa koko dataset tiedostona / palauta tiedostosta
    const downloadBtn = document.createElement('button')
    downloadBtn.id = 'btn-snapshot-download'
    downloadBtn.className = 'btn-snapshot-download'
    downloadBtn.textContent = '⬇ Lataa varmuuskopio'
    downloadBtn.addEventListener('click', () => this.handleDownload())
    actions.appendChild(downloadBtn)

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'application/json,.json'
    fileInput.className = 'snapshot-file-input'
    fileInput.hidden = true
    fileInput.addEventListener('change', () => { this.handleRestoreFromFile(fileInput).catch(console.error) })
    actions.appendChild(fileInput)

    const restoreFileBtn = document.createElement('button')
    restoreFileBtn.id = 'btn-snapshot-restore-file'
    restoreFileBtn.className = 'btn-snapshot-restore-file'
    restoreFileBtn.textContent = '⬆ Palauta tiedostosta'
    restoreFileBtn.addEventListener('click', () => fileInput.click())
    actions.appendChild(restoreFileBtn)

    modal.appendChild(actions)

    const listEl = document.createElement('ul')
    listEl.id = 'snapshot-list'
    listEl.className = 'snapshot-list'
    const defaultEmpty = document.createElement('li')
    defaultEmpty.className = 'snapshot-empty'
    defaultEmpty.textContent = 'Ei varmuuskopioita'
    listEl.appendChild(defaultEmpty)
    modal.appendChild(listEl)

    backdrop.appendChild(modal)

    return { backdrop, listEl, countEl }
  }

  async refresh(): Promise<void> {
    if (!this.isAllowed()) return
    try {
      const res = await fetch('/api/admin/snapshots')
      if (!res.ok) return
      const snapshots = await res.json() as SnapshotEntry[]
      this.snapshotCount = snapshots.length
      this.countEl.textContent = String(this.snapshotCount)
      this.render(snapshots)
    } catch {
      // network error — leave list as-is
    }
  }

  private render(snapshots: SnapshotEntry[]): void {
    this.listEl.innerHTML = ''
    if (snapshots.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'snapshot-empty'
      empty.textContent = 'Ei varmuuskopioita'
      this.listEl.appendChild(empty)
      return
    }
    for (const snap of snapshots) {
      const li = document.createElement('li')
      li.className = 'snapshot-item'
      li.dataset.id = snap.id

      const info = document.createElement('span')
      info.className = 'snapshot-info'
      const date = snap.created_at.slice(0, 16).replace('T', ' ')
      info.textContent = `${snap.label} — ${date} (${snap.created_by})`
      li.appendChild(info)

      const restoreBtn = document.createElement('button')
      restoreBtn.className = 'btn-snapshot-restore'
      restoreBtn.textContent = 'Palauta tämä versio'
      restoreBtn.dataset.id = snap.id
      restoreBtn.dataset.label = snap.label
      restoreBtn.addEventListener('click', () => { this.handleRestore(snap).catch(console.error) })
      li.appendChild(restoreBtn)

      this.listEl.appendChild(li)
    }
  }

  private handleDownload(): void {
    // Server asettaa Content-Disposition: attachment → selain lataa, ei navigoi.
    // <a> vie session-cookien mukana (GET /api/admin/backup vaatii auth).
    const a = document.createElement('a')
    a.href = '/api/admin/backup'
    a.download = ''
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  private async handleRestoreFromFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!confirm('Palautetaanko varmuuskopio tiedostosta?\n\nKoko nykyinen data (merkit, pätkät, alueet) korvataan.')) return
    let payload: string
    try {
      payload = await file.text()
    } catch {
      alert('Tiedoston luku epäonnistui.')
      return
    }
    try {
      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
      if (res.ok) {
        await this.refresh()
        alert('Varmuuskopio palautettu.')
      } else if (res.status === 400) {
        alert('Virheellinen varmuuskopiotiedosto.')
      } else {
        alert(`Palautus epäonnistui (${res.status}).`)
      }
    } catch {
      alert('Palautus epäonnistui (verkkovirhe).')
    }
  }

  private async handleCreate(): Promise<void> {
    try {
      const res = await fetch('/api/admin/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) await this.refresh()
    } catch {
      console.error('[snapshot-panel] create failed')
    }
  }

  private async handleRestore(snap: SnapshotEntry): Promise<void> {
    if (!confirm(`Palautetaanko versio "${snap.label}"?\n\nKaikki nykyiset merkit korvataan tällä versiolla.`)) return
    try {
      const res = await fetch(`/api/admin/snapshots/${snap.id}/restore`, { method: 'POST' })
      if (res.ok) {
        await this.refresh()
      } else {
        console.error('[snapshot-panel] restore failed', res.status)
      }
    } catch {
      console.error('[snapshot-panel] restore network error')
    }
  }
}
