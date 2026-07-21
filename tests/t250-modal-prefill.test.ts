import { describe, it, expect, beforeEach } from 'vitest'
import { SignTemplateModal } from '../src/ui/sign-template-modal'
import { createLibrary } from '../src/logic/sign-library'
import { slugify } from '../src/logic/sign-id-slug'

beforeEach(() => { document.body.innerHTML = '' })

describe('T250 SignTemplateModal prefill (inventaarion "Muuta merkiksi")', () => {
  it('esitäytetty nimi täyttää Tunnuksen slugilla heti', () => {
    const modal = new SignTemplateModal(createLibrary(), { onChanged: () => {}, onSaveTemplate: () => {} })
    modal.open(null, { label: '20km kyltti irto' })
    const label = document.querySelector<HTMLInputElement>('.sign-lib-label-input')!
    const id = document.querySelector<HTMLInputElement>('.sign-lib-id-input')!
    expect(label.value).toBe('20km kyltti irto')
    expect(id.value).toBe(slugify('20km kyltti irto')) // '20km-kyltti-irto'
  })

  it('keppi-täppä default ON prefillillä (keppi=true)', () => {
    const modal = new SignTemplateModal(createLibrary(), { onChanged: () => {}, onSaveTemplate: () => {} })
    modal.open(null, { label: 'Oikealle', keppi: true, favorite: false })
    expect(document.querySelector<HTMLInputElement>('.sign-lib-keppi-checkbox')!.checked).toBe(true)
    expect(document.querySelector<HTMLInputElement>('.sign-lib-fav-checkbox')!.checked).toBe(false)
  })
})
