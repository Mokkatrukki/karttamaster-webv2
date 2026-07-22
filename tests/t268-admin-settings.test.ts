import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderAdminSettings } from '../src/ui/admin-page'

describe('T268/V188 — admin talkoolais-salasana UI', () => {
  let c: HTMLElement
  beforeEach(() => {
    c = document.createElement('div')
    document.body.appendChild(c)
  })

  it('näyttää "asetettu" kun salasana on', () => {
    renderAdminSettings(c, { talkooPasswordSet: true, onSaveTalkooPassword: vi.fn() })
    expect(c.querySelector('.admin-settings-status')?.textContent).toContain('asetettu')
  })

  it('näyttää "ei asetettu" kun salasanaa ei ole', () => {
    renderAdminSettings(c, { talkooPasswordSet: false, onSaveTalkooPassword: vi.fn() })
    expect(c.querySelector('.admin-settings-status')?.textContent?.toLowerCase()).toContain('ei asetettu')
  })

  it('Tallenna kutsuu callbackia salasanalla', () => {
    const onSave = vi.fn()
    renderAdminSettings(c, { talkooPasswordSet: false, onSaveTalkooPassword: onSave })
    const input = c.querySelector('.admin-talkoo-password-input') as HTMLInputElement
    input.value = 'syote2026'
    ;(c.querySelector('.admin-talkoo-password-save') as HTMLButtonElement).click()
    expect(onSave).toHaveBeenCalledWith('syote2026')
  })

  it('liian lyhyt salasana → ei kutsu callbackia, näyttää virheen', () => {
    const onSave = vi.fn()
    renderAdminSettings(c, { talkooPasswordSet: false, onSaveTalkooPassword: onSave })
    const input = c.querySelector('.admin-talkoo-password-input') as HTMLInputElement
    input.value = 'ab'
    ;(c.querySelector('.admin-talkoo-password-save') as HTMLButtonElement).click()
    expect(onSave).not.toHaveBeenCalled()
    expect(c.querySelector('.admin-settings-status')?.textContent).toContain('vähintään')
  })

  it('Näytä/Piilota-toggle vaihtaa input-tyypin', () => {
    renderAdminSettings(c, { talkooPasswordSet: false, onSaveTalkooPassword: vi.fn() })
    const input = c.querySelector('.admin-talkoo-password-input') as HTMLInputElement
    const toggle = c.querySelector('.admin-password-toggle') as HTMLButtonElement
    expect(input.type).toBe('password')
    toggle.click()
    expect(input.type).toBe('text')
    toggle.click()
    expect(input.type).toBe('password')
  })
})
