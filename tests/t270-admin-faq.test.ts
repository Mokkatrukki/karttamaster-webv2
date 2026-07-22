import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderAdminFaq } from '../src/ui/admin-page'

describe('T270/V190 — admin FAQ-editori (textarea-baseline)', () => {
  let c: HTMLElement
  beforeEach(() => {
    c = document.createElement('div')
    document.body.appendChild(c)
  })

  it('renderöi textarean nykyisellä markdownilla', () => {
    renderAdminFaq(c, { markdown: '# Aikataulu\n\nAamupala 9–10', onSave: vi.fn() })
    const ta = c.querySelector('.admin-faq-textarea') as HTMLTextAreaElement
    expect(ta).not.toBeNull()
    expect(ta.value).toContain('Aikataulu')
  })

  it('Tallenna kutsuu onSave textarean sisällöllä', () => {
    const onSave = vi.fn()
    renderAdminFaq(c, { markdown: 'vanha', onSave })
    const ta = c.querySelector('.admin-faq-textarea') as HTMLTextAreaElement
    ta.value = '## Lounas 13–15 3BA-mökissä'
    ;(c.querySelector('.admin-faq-save') as HTMLButtonElement).click()
    expect(onSave).toHaveBeenCalledWith('## Lounas 13–15 3BA-mökissä')
  })

  it('näyttää ohjetekstin', () => {
    renderAdminFaq(c, { markdown: '', onSave: vi.fn() })
    expect(c.querySelector('.admin-faq-section')?.textContent).toContain('/patkat')
  })
})
