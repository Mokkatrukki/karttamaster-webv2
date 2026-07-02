export class GpkgControls {
  constructor(
    private readonly importBtn: HTMLButtonElement,
    private readonly fileInput: HTMLInputElement,
    private readonly statusEl: HTMLElement,
  ) {
    this.importBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.fileInput.click()
    })
    this.fileInput.addEventListener('change', () => {
      this.handleFileSelected().catch(() => {
        this.statusEl.textContent = 'Virhe: yhteys epäonnistui'
      })
    })
  }

  private async handleFileSelected(): Promise<void> {
    const file = this.fileInput.files?.[0]
    this.fileInput.value = ''
    if (!file) return

    this.statusEl.textContent = 'Tuodaan…'
    const form = new FormData()
    form.set('file', file)

    const res = await fetch('/api/gpkg/import', { method: 'POST', body: form })
    if (!res.ok) {
      this.statusEl.textContent = `Virhe (${res.status})`
      return
    }
    const body = (await res.json()) as { created: number; updated: number }
    this.statusEl.textContent = `Tuotu: ${body.created} uutta, ${body.updated} päivitetty`
  }
}
