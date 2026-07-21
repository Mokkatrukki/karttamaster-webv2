import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { showToast, dismissToast } from '../src/ui/toast'

describe('showToast — jaettu toast-komponentti (T253, V172)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })
  afterEach(() => {
    dismissToast()
    vi.useRealTimers()
  })

  it('renderöi viestin + Kumoa-napin', () => {
    showToast('Poistit: Nitoja', { actionLabel: 'Kumoa', onAction: () => {} })
    const toast = document.querySelector('.toast')!
    expect(toast).toBeTruthy()
    expect(toast.getAttribute('role')).toBe('status')
    expect(toast.getAttribute('aria-live')).toBe('polite')
    expect(toast.querySelector('.toast-msg')!.textContent).toBe('Poistit: Nitoja')
    const action = toast.querySelector('.toast-action') as HTMLButtonElement
    expect(action.textContent).toBe('Kumoa')
  })

  it('user-teksti textContent (V164) — ei innerHTML-injektiota', () => {
    showToast('Poistit: <img src=x>', { actionLabel: 'Kumoa', onAction: () => {} })
    const msg = document.querySelector('.toast-msg')!
    expect(msg.querySelector('img')).toBeNull()
    expect(msg.textContent).toBe('Poistit: <img src=x>')
  })

  it('Kumoa-klikki kutsuu onAction + sulkee toastin', () => {
    const onAction = vi.fn()
    showToast('Muutit määrää: Nitoja', { actionLabel: 'Kumoa', onAction })
    ;(document.querySelector('.toast-action') as HTMLButtonElement).click()
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.toast')).toBeNull()
  })

  it('toinen showToast korvaa ensimmäisen (V172: yksi kerrallaan)', () => {
    showToast('eka', { actionLabel: 'Kumoa', onAction: () => {} })
    showToast('toka', { actionLabel: 'Kumoa', onAction: () => {} })
    const toasts = document.querySelectorAll('.toast')
    expect(toasts.length).toBe(1)
    expect(toasts[0].querySelector('.toast-msg')!.textContent).toBe('toka')
  })

  it('auto-dismiss ~5s (fake timers)', () => {
    showToast('katoaa', { actionLabel: 'Kumoa', onAction: () => {} })
    expect(document.querySelector('.toast')).toBeTruthy()
    vi.advanceTimersByTime(4999)
    expect(document.querySelector('.toast')).toBeTruthy()
    vi.advanceTimersByTime(1)
    expect(document.querySelector('.toast')).toBeNull()
  })

  it('uusi toast resetoi timerin (ei peri vanhaa)', () => {
    showToast('eka', {})
    vi.advanceTimersByTime(4000)
    showToast('toka', {})
    vi.advanceTimersByTime(4000) // yht. 8s ekasta, mutta tokan timer vasta 4s
    expect(document.querySelector('.toast')!.querySelector('.toast-msg')!.textContent).toBe('toka')
    vi.advanceTimersByTime(1000)
    expect(document.querySelector('.toast')).toBeNull()
  })

  it('ilman actionLabelia → pelkkä viesti, ei nappia', () => {
    showToast('pelkkä', {})
    expect(document.querySelector('.toast-action')).toBeNull()
    expect(document.querySelector('.toast-msg')!.textContent).toBe('pelkkä')
  })
})
