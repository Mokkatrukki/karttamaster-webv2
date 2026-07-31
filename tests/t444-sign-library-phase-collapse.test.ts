// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { SignLibraryPanel } from '../src/ui/sign-library-panel'
import { createLibrary, type SignLibrary, type SignTemplate } from '../src/logic/sign-library'

// T444/V250 — merkkikirjasto kutistuu purkuvaiheessa, mutta ei katoa.
// Purussa merkkejä ei aseteta ∴ paneeli vie pystytilaa toiminnolta jota ei käytetä. Täyspiilotus
// olisi kuitenkin KADONNUT toiminto: järjestäjä voi tarvita kirjastoa korjaukseen kesken purun.

function template(id: string, label: string): SignTemplate {
  return { id, label, description: '', color: '#2563EB', favorite: false } as SignTemplate
}

function mount(): { panel: SignLibraryPanel; container: HTMLElement; library: SignLibrary } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const library = createLibrary()
  library.set('a', template('a', 'Nuoli vasen'))
  const panel = new SignLibraryPanel(container, library, () => {}, () => {})
  return { panel, container, library }
}

beforeEach(() => { document.body.innerHTML = '' })

describe('vaiheen oletus', () => {
  it('purku → paneeli kutistuu', () => {
    const { panel } = mount()
    panel.setPhase('purku')
    expect(panel.isCollapsed()).toBe(true)
  })

  it('asetusvaihe → paneeli pysyy ennallaan (auki)', () => {
    const { panel } = mount()
    panel.setPhase('asettaminen')
    expect(panel.isCollapsed()).toBe(false)
  })

  it('tarkastusvaihe → paneeli pysyy auki (merkkejä voi yhä lisätä)', () => {
    const { panel } = mount()
    panel.setPhase('tarkastus')
    expect(panel.isCollapsed()).toBe(false)
  })
})

describe('paneeli ei katoa — collapse, ei täyspiilotus (V250)', () => {
  it('kutistettunakin otsikko on DOM:issa ja avattavissa', () => {
    const { panel, container } = mount()
    panel.setPhase('purku')
    const toggle = container.querySelector('button')
    expect(toggle).not.toBeNull()
    expect(container.textContent).toContain('Merkkikirjasto')
  })

  it('sisältölista on poissa kutistettuna, takaisin avattuna', () => {
    const { panel, container } = mount()
    panel.setPhase('purku')
    expect(container.querySelector('.sign-lib-list')).toBeNull()
    container.querySelector<HTMLButtonElement>('button')!.click()
    expect(container.querySelector('.sign-lib-list')).not.toBeNull()
  })
})

describe('käyttäjän avaus säilyy istunnon ajan', () => {
  it('avaus purussa ei peruunnu saman vaiheen uudella synkalla', () => {
    const { panel, container } = mount()
    panel.setPhase('purku')
    container.querySelector<HTMLButtonElement>('button')!.click()
    expect(panel.isCollapsed()).toBe(false)
    panel.setPhase('purku')
    expect(panel.isCollapsed()).toBe(false)
  })

  it('avaus voittaa myös myöhemmän vaiheenvaihdon purkuun', () => {
    const { panel, container } = mount()
    panel.setPhase('asettaminen')
    container.querySelector<HTMLButtonElement>('button')!.click() // käyttäjä sulkee
    container.querySelector<HTMLButtonElement>('button')!.click() // ja avaa
    panel.setPhase('purku')
    expect(panel.isCollapsed()).toBe(false)
  })

  it('refresh() ei kutista uudelleen — render ei omista tilaa', () => {
    const { panel, container } = mount()
    panel.setPhase('purku')
    container.querySelector<HTMLButtonElement>('button')!.click()
    panel.refresh()
    expect(panel.isCollapsed()).toBe(false)
    expect(container.querySelector('.sign-lib-list')).not.toBeNull()
  })
})
