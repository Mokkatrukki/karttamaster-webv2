import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GpkgControls } from '../src/ui/gpkg-controls'

function makeDom() {
  document.body.innerHTML = `
    <button id="btn-gpkg-import"></button>
    <input id="gpkg-file-input" type="file" />
    <span id="gpkg-import-status"></span>
  `
  return {
    importBtn: document.getElementById('btn-gpkg-import') as HTMLButtonElement,
    fileInput: document.getElementById('gpkg-file-input') as HTMLInputElement,
    statusEl: document.getElementById('gpkg-import-status') as HTMLElement,
  }
}

function selectFile(fileInput: HTMLInputElement, file: File) {
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
  fileInput.dispatchEvent(new Event('change'))
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('GpkgControls', () => {
  it('klikki tuo-nappia avaa file-inputin', () => {
    const { importBtn, fileInput, statusEl } = makeDom()
    new GpkgControls(importBtn, fileInput, statusEl)
    const clickSpy = vi.spyOn(fileInput, 'click')
    importBtn.click()
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('onnistunut import näyttää created/updated-määrät', async () => {
    const { importBtn, fileInput, statusEl } = makeDom()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ created: 2, updated: 1 }) })),
    )
    new GpkgControls(importBtn, fileInput, statusEl)
    selectFile(fileInput, new File(['x'], 'kyltit.gpkg'))
    await vi.waitFor(() => expect(statusEl.textContent).toContain('2 uutta'))
    expect(statusEl.textContent).toBe('Tuotu: 2 uutta, 1 päivitetty')
  })

  it('onnistunut import kutsuu onImported-callbackin', async () => {
    const { importBtn, fileInput, statusEl } = makeDom()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ created: 1, updated: 0 }) })),
    )
    const onImported = vi.fn()
    new GpkgControls(importBtn, fileInput, statusEl, onImported)
    selectFile(fileInput, new File(['x'], 'kyltit.gpkg'))
    await vi.waitFor(() => expect(onImported).toHaveBeenCalledOnce())
  })

  it('epäonnistunut import ei kutsu onImported-callbackia', async () => {
    const { importBtn, fileInput, statusEl } = makeDom()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))
    const onImported = vi.fn()
    new GpkgControls(importBtn, fileInput, statusEl, onImported)
    selectFile(fileInput, new File(['x'], 'kyltit.gpkg'))
    await vi.waitFor(() => expect(statusEl.textContent).toContain('500'))
    expect(onImported).not.toHaveBeenCalled()
  })

  it('epäonnistunut import (403) näyttää statuskoodin', async () => {
    const { importBtn, fileInput, statusEl } = makeDom()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })))
    new GpkgControls(importBtn, fileInput, statusEl)
    selectFile(fileInput, new File(['x'], 'kyltit.gpkg'))
    await vi.waitFor(() => expect(statusEl.textContent).toContain('403'))
  })

  it('verkkovirhe näyttää virheilmoituksen', async () => {
    const { importBtn, fileInput, statusEl } = makeDom()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network fail') }))
    new GpkgControls(importBtn, fileInput, statusEl)
    selectFile(fileInput, new File(['x'], 'kyltit.gpkg'))
    await vi.waitFor(() => expect(statusEl.textContent).toContain('epäonnistui'))
  })

  it('ei tiedostoa valittuna → ei kutsu fetchiä', async () => {
    const { importBtn, fileInput, statusEl } = makeDom()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    new GpkgControls(importBtn, fileInput, statusEl)
    Object.defineProperty(fileInput, 'files', { value: [], configurable: true })
    fileInput.dispatchEvent(new Event('change'))
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
