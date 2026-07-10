import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CommentThread, type CommentThreadApi } from '../src/ui/comment-thread'
import type { Comment, NewComment } from '../src/logic/comments'

// Injektoitava fake-api: pitää sisäisen taulun, jäljittelee slicen sopimusta.
function makeApi(initial: Comment[] = []): CommentThreadApi & { store: Comment[] } {
  const store = [...initial]
  return {
    store,
    fetch: vi.fn(async () => [...store]),
    post: vi.fn(async (input: NewComment) => {
      const c: Comment = {
        id: `c${store.length + 1}`,
        targetType: input.targetType,
        targetId: input.targetId,
        text: input.text.trim(),
        iconId: input.iconId,
        authorName: input.authorName,
        createdAt: `2026-07-10T10:0${store.length}:00.000Z`,
      }
      store.push(c)
      return c
    }),
    del: vi.fn(async (id: string) => {
      const i = store.findIndex(c => c.id === id)
      if (i >= 0) store.splice(i, 1)
      return true
    }),
  }
}

const flush = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => { document.body.innerHTML = '' })
afterEach(() => vi.restoreAllMocks())

describe('T221: CommentThread (jsdom)', () => {
  it('tyhjä lanka → "Ei kommentteja vielä."', async () => {
    const api = makeApi([])
    const thread = new CommentThread({ targetType: 'marker', targetId: 'm1', canDelete: false, api })
    document.body.appendChild(thread.el)
    await thread.load()
    expect(thread.el.querySelector('.comment-thread-empty')).not.toBeNull()
  })

  it('load renderöi olemassa olevat kommentit aikajärjestyksessä', async () => {
    const api = makeApi([
      { id: 'c1', targetType: 'marker', targetId: 'm1', text: 'eka', authorName: 'Anna', createdAt: '2026-07-10T09:00:00.000Z' },
      { id: 'c2', targetType: 'marker', targetId: 'm1', text: 'toka', createdAt: '2026-07-10T08:00:00.000Z' },
    ])
    const thread = new CommentThread({ targetType: 'marker', targetId: 'm1', canDelete: false, api })
    document.body.appendChild(thread.el)
    await thread.load()
    const items = thread.el.querySelectorAll('.comment-thread-item')
    expect(items.length).toBe(2)
    // vanhin ensin (08:00 < 09:00)
    expect(items[0].querySelector('.comment-thread-item-text')!.textContent).toBe('toka')
    expect(items[1].querySelector('.comment-thread-item-text')!.textContent).toBe('eka')
  })

  it('kutsuu fetchin oikealla targetilla', async () => {
    const api = makeApi([])
    const thread = new CommentThread({ targetType: 'segment', targetId: 'seg-1', canDelete: false, api })
    await thread.load()
    expect(api.fetch).toHaveBeenCalledWith('segment', 'seg-1')
  })

  it('lähetä postaa kommentin ja lisää sen listaan + tyhjentää inputin', async () => {
    const api = makeApi([])
    const thread = new CommentThread({ targetType: 'marker', targetId: 'm1', canDelete: false, api })
    document.body.appendChild(thread.el)
    await thread.load()
    const input = thread.el.querySelector('.comment-thread-input') as HTMLTextAreaElement
    input.value = 'uusi huomio'
    ;(thread.el.querySelector('.comment-thread-send') as HTMLButtonElement).click()
    await flush()
    expect(api.post).toHaveBeenCalledTimes(1)
    const call = (api.post as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.targetType).toBe('marker')
    expect(call.targetId).toBe('m1')
    expect(call.text).toBe('uusi huomio')
    expect(thread.el.querySelector('.comment-thread-item-text')!.textContent).toBe('uusi huomio')
    expect(input.value).toBe('')
  })

  it('tyhjä text → virhe, ei postausta', async () => {
    const api = makeApi([])
    const thread = new CommentThread({ targetType: 'marker', targetId: 'm1', canDelete: false, api })
    document.body.appendChild(thread.el)
    await thread.load()
    ;(thread.el.querySelector('.comment-thread-send') as HTMLButtonElement).click()
    await flush()
    expect(api.post).not.toHaveBeenCalled()
    const err = thread.el.querySelector('.comment-thread-error') as HTMLElement
    expect(err.hidden).toBe(false)
  })

  it('lähettää valitun ikonin ja nimen', async () => {
    const api = makeApi([])
    const thread = new CommentThread({ targetType: 'marker', targetId: 'm1', canDelete: false, api })
    document.body.appendChild(thread.el)
    await thread.load()
    ;(thread.el.querySelector('.comment-thread-input') as HTMLTextAreaElement).value = 'varo'
    const iconSelect = thread.el.querySelector('.comment-thread-icon-select') as HTMLSelectElement
    iconSelect.value = 'alert-triangle'
    ;(thread.el.querySelector('.comment-thread-name') as HTMLInputElement).value = 'Pekka'
    ;(thread.el.querySelector('.comment-thread-send') as HTMLButtonElement).click()
    await flush()
    const call = (api.post as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.iconId).toBe('alert-triangle')
    expect(call.authorName).toBe('Pekka')
    // ikoni renderöityy listaan
    expect(thread.el.querySelector('.comment-thread-item-icon svg')).not.toBeNull()
  })

  it('canDelete=false → ei poistonappia', async () => {
    const api = makeApi([{ id: 'c1', targetType: 'marker', targetId: 'm1', text: 'x', createdAt: '2026-07-10T10:00:00.000Z' }])
    const thread = new CommentThread({ targetType: 'marker', targetId: 'm1', canDelete: false, api })
    document.body.appendChild(thread.el)
    await thread.load()
    expect(thread.el.querySelector('.comment-thread-delete')).toBeNull()
  })

  it('canDelete=true → poistonappi poistaa kommentin (confirm)', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    const api = makeApi([{ id: 'c1', targetType: 'marker', targetId: 'm1', text: 'x', createdAt: '2026-07-10T10:00:00.000Z' }])
    const thread = new CommentThread({ targetType: 'marker', targetId: 'm1', canDelete: true, api })
    document.body.appendChild(thread.el)
    await thread.load()
    const delBtn = thread.el.querySelector('.comment-thread-delete') as HTMLButtonElement
    expect(delBtn).not.toBeNull()
    delBtn.click()
    await flush()
    expect(api.del).toHaveBeenCalledWith('c1')
    expect(thread.el.querySelector('.comment-thread-item')).toBeNull()
    expect(thread.el.querySelector('.comment-thread-empty')).not.toBeNull()
  })

  it('load-epäonnistuminen (null) → lataus-virheteksti, ei kaadu', async () => {
    const api: CommentThreadApi = { fetch: vi.fn(async () => null), post: vi.fn(), del: vi.fn() }
    const thread = new CommentThread({ targetType: 'marker', targetId: 'm1', canDelete: false, api })
    document.body.appendChild(thread.el)
    await thread.load()
    expect(thread.el.querySelector('.comment-thread-load-error')).not.toBeNull()
  })
})
