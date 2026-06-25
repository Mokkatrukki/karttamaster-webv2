import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const MOCK_AREA = {
  id: 'area-111',
  name: 'Huoltopiste 25km',
  centerLat: 65.628,
  centerLng: 27.628,
  widthM: 200,
  heightM: 100,
  rotation: 0,
  markdownDescription: '## Tarjoilu\n\n- Ruoka\n- Juoma',
  status: 'suunniteltu',
  hashCode: 'testi-hash-111',
  features: [
    {
      id: 'feat-1',
      name: 'Tarjoilupöytä',
      centerLat: 65.6281,
      centerLng: 27.6281,
      widthM: 10,
      heightM: 5,
      rotation: 0,
      color: '#4ade80',
    },
  ],
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('print', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
  document.body.innerHTML = ''
})

describe('T111 — area-view: renderMarkdown', () => {
  it('renderöi otsikon HTML:ksi', async () => {
    const { renderMarkdown } = await import('../src/ui/area-view')
    const html = renderMarkdown('## Otsikko')
    expect(html).toContain('<h2')
    expect(html).toContain('Otsikko')
  })

  it('renderöi listan HTML:ksi', async () => {
    const { renderMarkdown } = await import('../src/ui/area-view')
    const html = renderMarkdown('- Kohta 1\n- Kohta 2')
    expect(html).toContain('<li')
    expect(html).toContain('Kohta 1')
  })

  it('tyhjä teksti palauttaa tyhjän', async () => {
    const { renderMarkdown } = await import('../src/ui/area-view')
    const html = renderMarkdown('')
    expect(html.trim()).toBe('')
  })
})

describe('T111 — area-view: initAreaView', () => {
  it('ei tee mitään jos pathname ei ole /a/...', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/', search: '', hash: '' },
    })
    const { initAreaView } = await import('../src/ui/area-view')
    const mockMap = { flyTo: vi.fn() }
    await initAreaView(mockMap)
    expect(mockMap.flyTo).not.toHaveBeenCalled()
    expect(document.querySelector('.area-view-modal')).toBeNull()
  })

  it('avaa modaalin kun /a/<hash> ja API palauttaa alueen', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/a/testi-hash-111', search: '', hash: '' },
    })
    vi.mocked(window.fetch).mockResolvedValue({
      ok: true,
      json: async () => MOCK_AREA,
    } as Response)

    const { initAreaView } = await import('../src/ui/area-view')
    const mockMap = { flyTo: vi.fn() }
    await initAreaView(mockMap)

    const modal = document.querySelector('.area-view-modal')
    expect(modal).not.toBeNull()
    expect(modal!.textContent).toContain('Huoltopiste 25km')
  })

  it('kutsuu flyTo(centerLat, centerLng, 18) kun modaali avautuu', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/a/testi-hash-111', search: '', hash: '' },
    })
    vi.mocked(window.fetch).mockResolvedValue({
      ok: true,
      json: async () => MOCK_AREA,
    } as Response)

    const { initAreaView } = await import('../src/ui/area-view')
    const mockMap = { flyTo: vi.fn() }
    await initAreaView(mockMap)

    expect(mockMap.flyTo).toHaveBeenCalledWith([65.628, 27.628], 18)
  })

  it('ei avaa modaalia kun API palauttaa 404', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/a/ei-ole-hash', search: '', hash: '' },
    })
    vi.mocked(window.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    } as Response)

    const { initAreaView } = await import('../src/ui/area-view')
    const mockMap = { flyTo: vi.fn() }
    await initAreaView(mockMap)

    expect(document.querySelector('.area-view-modal')).toBeNull()
    expect(mockMap.flyTo).not.toHaveBeenCalled()
  })

  it('modaali sisältää tulosta-napin', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/a/testi-hash-111', search: '', hash: '' },
    })
    vi.mocked(window.fetch).mockResolvedValue({
      ok: true,
      json: async () => MOCK_AREA,
    } as Response)

    const { initAreaView } = await import('../src/ui/area-view')
    const mockMap = { flyTo: vi.fn() }
    await initAreaView(mockMap)

    const printBtn = document.querySelector('.btn-area-print')
    expect(printBtn).not.toBeNull()
    expect(printBtn!.textContent).toContain('Tulosta')
  })

  it('tulosta-nappi kutsuu window.print()', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/a/testi-hash-111', search: '', hash: '' },
    })
    vi.mocked(window.fetch).mockResolvedValue({
      ok: true,
      json: async () => MOCK_AREA,
    } as Response)

    const { initAreaView } = await import('../src/ui/area-view')
    const mockMap = { flyTo: vi.fn() }
    await initAreaView(mockMap)

    const printBtn = document.querySelector('.btn-area-print') as HTMLButtonElement
    printBtn.click()
    expect(window.print).toHaveBeenCalled()
  })

  it('feature-taulukko sisältää feature-nimet', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/a/testi-hash-111', search: '', hash: '' },
    })
    vi.mocked(window.fetch).mockResolvedValue({
      ok: true,
      json: async () => MOCK_AREA,
    } as Response)

    const { initAreaView } = await import('../src/ui/area-view')
    const mockMap = { flyTo: vi.fn() }
    await initAreaView(mockMap)

    const table = document.querySelector('.area-features-table')
    expect(table).not.toBeNull()
    expect(table!.textContent).toContain('Tarjoilupöytä')
  })

  it('markdown-kuvaus renderöityy HTML:ksi modaalissa', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/a/testi-hash-111', search: '', hash: '' },
    })
    vi.mocked(window.fetch).mockResolvedValue({
      ok: true,
      json: async () => MOCK_AREA,
    } as Response)

    const { initAreaView } = await import('../src/ui/area-view')
    const mockMap = { flyTo: vi.fn() }
    await initAreaView(mockMap)

    const desc = document.querySelector('.area-markdown-desc')
    expect(desc).not.toBeNull()
    expect(desc!.innerHTML).toContain('<h2')
    expect(desc!.innerHTML).toContain('<li')
  })
})
