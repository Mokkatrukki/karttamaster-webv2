import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CommentPointModal } from '../src/ui/comment-point-modal'
import { CommentPanel } from '../src/ui/comment-panel'
import { fitWithin } from '../src/ui/image-downscale'
import type { Comment } from '../src/logic/comments'

// T237/T338/T340 — huomio (targetType='point'): luonti kartalta, kuvaliite, sivupalkin lista.
// V245: huomio ⊥ ole merkki. V246: kuva auki täysikokoisena. V247: kuvaputki rajattu.

const makeComment = (o: Partial<Comment> = {}): Comment => ({
  id: 'c-1',
  targetType: 'point',
  lat: 65.1,
  lon: 27.5,
  text: 'Tämä voisi korjata — juurakko rikki',
  createdAt: '2026-07-25T10:00:00.000Z',
  ...o,
})

describe('T237 — huomion luonti kartalta', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  afterEach(() => { vi.unstubAllGlobals() })

  it('openCreate renderöi lomakkeen ja kertoo ettei huomio ole merkki (V245)', () => {
    new CommentPointModal().openCreate(65.1, 27.5)
    expect(document.querySelector('.comment-point-modal')).not.toBeNull()
    expect(document.querySelector('.comment-point-text')).not.toBeNull()
    expect(document.querySelector('.comment-point-modal-hint')?.textContent).toContain('ei ole merkki')
  })

  it('tyhjä teksti → ei POSTia, virheilmoitus näkyviin', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    new CommentPointModal().openCreate(65.1, 27.5)
    ;(document.querySelector('.comment-point-save') as HTMLButtonElement).click()
    expect(fetchMock).not.toHaveBeenCalled()
    expect((document.querySelector('.comment-point-error') as HTMLElement).hidden).toBe(false)
  })

  it('tallennus POSTaa point-kommentin klikatuilla koordinaateilla + siirtyy katseluun', async () => {
    const created = makeComment({ text: 'Puu kaatuu' })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => created })
    vi.stubGlobal('fetch', fetchMock)
    const onChanged = vi.fn()

    new CommentPointModal({ onChanged }).openCreate(65.1, 27.5)
    ;(document.querySelector('.comment-point-text') as HTMLTextAreaElement).value = 'Puu kaatuu'
    ;(document.querySelector('.comment-point-save') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled())

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.targetType).toBe('point')
    expect(body.lat).toBe(65.1)
    expect(body.lon).toBe(27.5)
    expect(body.text).toBe('Puu kaatuu')
    // Kuvan voi liittää vasta kun id on olemassa → katselutila avautuu automaattisesti.
    expect(document.querySelector('.comment-point-view-text')?.textContent).toBe('Puu kaatuu')
  })

  it('Esc sulkee, Peruuta sulkee', () => {
    const modal = new CommentPointModal()
    modal.openCreate(65.1, 27.5)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(modal.isOpen()).toBe(false)

    modal.openCreate(65.1, 27.5)
    ;(document.querySelector('.comment-point-cancel') as HTMLButtonElement).click()
    expect(modal.isOpen()).toBe(false)
  })
})

describe('T237 — huomion katselu ja poisto', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  afterEach(() => { vi.unstubAllGlobals() })

  it('näyttää tekstin + tekijän, poistonappi piilossa ilman canDeletea', () => {
    new CommentPointModal().openView(makeComment({ authorName: 'Matti' }))
    expect(document.querySelector('.comment-point-view-text')?.textContent).toContain('juurakko rikki')
    expect(document.querySelector('.comment-point-view-meta')?.textContent).toContain('Matti')
    expect(document.querySelector('.comment-point-delete')).toBeNull()
  })

  it('järjestäjä näkee poiston; vahvistus + DELETE + onChanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))
    const onChanged = vi.fn()

    const modal = new CommentPointModal({ canDelete: () => true, onChanged })
    modal.openView(makeComment())
    ;(document.querySelector('.comment-point-delete') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled())

    expect(fetchMock.mock.calls[0][0]).toBe('/api/comments/c-1')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
    expect(modal.isOpen()).toBe(false)
  })

  it('vahvistuksen peruminen ei poista', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => false))
    new CommentPointModal({ canDelete: () => true }).openView(makeComment())
    ;(document.querySelector('.comment-point-delete') as HTMLButtonElement).click()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('T338 — kuva huomioon', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('kuvaosio piilossa jos uploadImage puuttuu', () => {
    new CommentPointModal().openView(makeComment())
    expect(document.querySelector('.comment-point-add-image')).toBeNull()
  })

  it('thumbit renderöityvät ja avaavat lightboxin (V246)', () => {
    new CommentPointModal().openView(makeComment({ images: ['/api/comments/c-1/images/i1'] }))
    const thumb = document.querySelector('.comment-point-image-thumb') as HTMLImageElement
    expect(thumb.getAttribute('role')).toBe('button')
    thumb.click()
    const photo = document.querySelector('.image-lightbox-photo') as HTMLImageElement
    expect(photo.getAttribute('src')).toBe('/api/comments/c-1/images/i1')
    expect(photo.style.objectFit).toBe('contain')
  })

  it('rate_limited → kertoo odottamisesta, EI "yritä uudelleen" (V247)', async () => {
    const upload = vi.fn().mockResolvedValue('rate_limited' as const)
    new CommentPointModal({ uploadImage: upload }).openView(makeComment())

    const input = document.querySelector('.comment-point-file') as HTMLInputElement
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'kuva.jpg', { type: 'image/jpeg' })],
      configurable: true,
    })
    input.dispatchEvent(new Event('change'))

    await vi.waitFor(() => {
      const err = document.querySelector('.comment-point-image-error') as HTMLElement
      expect(err.hidden).toBe(false)
      expect(err.textContent).toContain('odota')
      expect(err.textContent).toContain('2 kuvaa minuutissa')
    })
  })
})

describe('T338 — kuvan pienennys (V247)', () => {
  it('fitWithin säilyttää kuvasuhteen ja mahduttaa max-neliöön', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
  })

  it('pienempi kuva jätetään rauhaan (⊥ skaalata ylöspäin)', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
})

describe('T340 — järjestäjän sivupalkin Huomiot-lista', () => {
  let container: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  it('tyhjä tila kun huomioita ei ole', () => {
    new CommentPanel(container)
    expect(container.querySelector('.comment-panel-empty')?.textContent).toBe('Ei huomioita.')
    expect(container.querySelector('.comment-panel-title')?.textContent).toBe('Huomiot')
  })

  it('setComments renderöi rivit + laskurin, uusin ensin', () => {
    const panel = new CommentPanel(container)
    panel.setComments([
      makeComment({ id: 'a', text: 'Vanha', createdAt: '2026-07-20T10:00:00.000Z' }),
      makeComment({ id: 'b', text: 'Uusi', createdAt: '2026-07-25T10:00:00.000Z' }),
    ])
    expect(container.querySelector('.comment-panel-title')?.textContent).toBe('Huomiot (2)')
    const rows = container.querySelectorAll('.comment-panel-item')
    expect(rows).toHaveLength(2)
    expect(rows[0].querySelector('.comment-panel-item-text')?.textContent).toBe('Uusi')
  })

  it('rivin klikkaus kutsuu onFocus koordinaateilla (näytä kartalla, ei modaalia listassa)', () => {
    const onFocus = vi.fn()
    const panel = new CommentPanel(container, { onFocus })
    panel.setComments([makeComment({ id: 'x', lat: 65.5, lon: 28.1 })])
    ;(container.querySelector('.comment-panel-item') as HTMLButtonElement).click()
    expect(onFocus).toHaveBeenCalledWith(expect.objectContaining({ id: 'x', lat: 65.5, lon: 28.1 }))
  })

  it('monirivinen teksti katkaistaan ensimmäiseen riviin (240px sivupalkki, B104-oppi)', () => {
    const panel = new CommentPanel(container)
    panel.setComments([makeComment({ text: 'Eka rivi\nToka rivi\nKolmas' })])
    expect(container.querySelector('.comment-panel-item-text')?.textContent).toBe('Eka rivi')
  })

  it('kuvallinen huomio saa 📷-merkinnän metaan', () => {
    const panel = new CommentPanel(container)
    panel.setComments([makeComment({ images: ['/img/1'], authorName: 'Matti' })])
    expect(container.querySelector('.comment-panel-item-meta')?.textContent).toContain('📷')
  })

  it('epäonnistunut haku EI tyhjennä listaa (V14-pattern)', async () => {
    const panel = new CommentPanel(container, { load: async () => null })
    panel.setComments([makeComment()])
    await panel.refresh()
    expect(container.querySelectorAll('.comment-panel-item')).toHaveLength(1)
  })
})
