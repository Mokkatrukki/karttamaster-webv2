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

  it('V17x: keppi-täppä POISTETTU mallista (kiinnitystapa elää rivillä), favorite säilyy', () => {
    const modal = new SignTemplateModal(createLibrary(), { onChanged: () => {}, onSaveTemplate: () => {} })
    modal.open(null, { label: 'Oikealle', favorite: false })
    expect(document.querySelector('.sign-lib-keppi-checkbox')).toBeNull() // ei enää mallissa
    expect(document.querySelector<HTMLInputElement>('.sign-lib-fav-checkbox')!.checked).toBe(false)
  })
})
