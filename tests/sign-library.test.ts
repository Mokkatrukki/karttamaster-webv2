import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createLibrary,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  listFavorites,
  saveLibrary,
  loadLibrary,
  type SignTemplate,
  type SignLibrary,
} from '../src/logic/sign-library'

describe('sign-library', () => {
  let lib: SignLibrary

  beforeEach(() => {
    lib = createLibrary()
  })

  // V10: SignTemplate pitää sisältää ikoni (shortLabel), teksti (label), kuvaus (description)
  describe('createTemplate', () => {
    it('luo templaten kaikilla V10-kentillä', () => {
      const t = createTemplate(lib, {
        label: 'Oikealle',
        shortLabel: 'O',
        color: '#16a34a',
        description: 'Käänny oikealle',
        favorite: false,
      })
      expect(t.label).toBe('Oikealle')
      expect(t.shortLabel).toBe('O')
      expect(t.color).toBe('#16a34a')
      expect(t.description).toBe('Käänny oikealle')
      expect(t.id).toBeTruthy()
    })

    it('generoi uniikin id:n automaattisesti', () => {
      const a = createTemplate(lib, { label: 'A', shortLabel: 'A', color: '#fff', description: '', favorite: false })
      const b = createTemplate(lib, { label: 'B', shortLabel: 'B', color: '#fff', description: '', favorite: false })
      expect(a.id).not.toBe(b.id)
    })

    it('hyväksyy eksplisiittisen id:n', () => {
      const t = createTemplate(lib, { label: 'X', shortLabel: 'X', color: '#fff', description: '', favorite: false }, 'my-id')
      expect(t.id).toBe('my-id')
    })

    it('lisää templaten kirjastoon', () => {
      createTemplate(lib, { label: 'A', shortLabel: 'A', color: '#fff', description: '', favorite: false })
      expect(listTemplates(lib)).toHaveLength(1)
    })
  })

  describe('updateTemplate', () => {
    it('päivittää kentät osittain', () => {
      const t = createTemplate(lib, { label: 'Vanha', shortLabel: 'V', color: '#000', description: '', favorite: false })
      const updated = updateTemplate(lib, t.id, { label: 'Uusi', description: 'lisätty' })
      expect(updated?.label).toBe('Uusi')
      expect(updated?.description).toBe('lisätty')
      expect(updated?.shortLabel).toBe('V') // muuttumaton
    })

    it('palauttaa null tuntemattomalla id:llä', () => {
      expect(updateTemplate(lib, 'ei-ole', { label: 'X' })).toBeNull()
    })

    it('ei muuta id:tä', () => {
      const t = createTemplate(lib, { label: 'A', shortLabel: 'A', color: '#fff', description: '', favorite: false })
      const updated = updateTemplate(lib, t.id, { label: 'B' })
      expect(updated?.id).toBe(t.id)
    })
  })

  describe('deleteTemplate', () => {
    it('poistaa olemassa olevan templaten', () => {
      const t = createTemplate(lib, { label: 'A', shortLabel: 'A', color: '#fff', description: '', favorite: false })
      expect(deleteTemplate(lib, t.id)).toBe(true)
      expect(listTemplates(lib)).toHaveLength(0)
    })

    it('palauttaa false tuntemattomalla id:llä', () => {
      expect(deleteTemplate(lib, 'ei-ole')).toBe(false)
    })
  })

  describe('listTemplates', () => {
    it('palauttaa tyhjän taulukon tyhjälle kirjastolle', () => {
      expect(listTemplates(lib)).toEqual([])
    })

    it('palauttaa kaikki templatet lisäysjärjestyksessä', () => {
      createTemplate(lib, { label: 'A', shortLabel: 'A', color: '#fff', description: '', favorite: false }, 'id-a')
      createTemplate(lib, { label: 'B', shortLabel: 'B', color: '#fff', description: '', favorite: false }, 'id-b')
      const list = listTemplates(lib)
      expect(list).toHaveLength(2)
      expect(list.map(t => t.id)).toEqual(['id-a', 'id-b'])
    })
  })

  describe('createTemplate — favorite-kenttä', () => {
    it('luo templaten favorite:true', () => {
      const t = createTemplate(lib, { label: 'A', shortLabel: 'A', color: '#fff', description: '', favorite: true })
      expect(t.favorite).toBe(true)
    })

    it('luo templaten favorite:false', () => {
      const t = createTemplate(lib, { label: 'A', shortLabel: 'A', color: '#fff', description: '', favorite: false })
      expect(t.favorite).toBe(false)
    })
  })

  describe('saveLibrary / loadLibrary (V46)', () => {
    beforeEach(() => {
      let store: Record<string, string> = {}
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v },
        removeItem: (k: string) => { delete store[k] },
        clear: () => { store = {} },
      })
    })

    it('save/load roundtrip säilyttää kaikki kentät', () => {
      createTemplate(lib, { label: 'Testi', shortLabel: 'T', color: '#ff0000', description: 'kuvaus', favorite: true }, 'test-id')
      saveLibrary(lib)
      const loaded = loadLibrary()
      expect(loaded).not.toBeNull()
      expect(loaded!.size).toBe(1)
      const t = loaded!.get('test-id')!
      expect(t.label).toBe('Testi')
      expect(t.shortLabel).toBe('T')
      expect(t.color).toBe('#ff0000')
      expect(t.favorite).toBe(true)
    })

    it('tyhjä localStorage → null', () => {
      expect(loadLibrary()).toBeNull()
    })

    it('korruptoitunut JSON → null + avain poistettu (V14-pattern)', () => {
      localStorage.setItem('karttamaster-sign-library', 'not-json{{')
      expect(loadLibrary()).toBeNull()
      expect(localStorage.getItem('karttamaster-sign-library')).toBeNull()
    })

    it('väärä versio → null + avain poistettu', () => {
      localStorage.setItem('karttamaster-sign-library', JSON.stringify({ version: 99, templates: [] }))
      expect(loadLibrary()).toBeNull()
      expect(localStorage.getItem('karttamaster-sign-library')).toBeNull()
    })

    it('useat templatet tallennetaan ja palautetaan', () => {
      createTemplate(lib, { label: 'A', shortLabel: 'a', color: '#111', description: '', favorite: false }, 'id-a')
      createTemplate(lib, { label: 'B', shortLabel: 'b', color: '#222', description: '', favorite: true }, 'id-b')
      saveLibrary(lib)
      const loaded = loadLibrary()!
      expect(loaded.size).toBe(2)
      expect(loaded.get('id-a')?.label).toBe('A')
      expect(loaded.get('id-b')?.favorite).toBe(true)
    })
  })

  describe('listFavorites', () => {
    it('palauttaa tyhjän jos ei suosikkeja', () => {
      createTemplate(lib, { label: 'A', shortLabel: 'A', color: '#fff', description: '', favorite: false })
      expect(listFavorites(lib)).toHaveLength(0)
    })

    it('palauttaa vain suosikit', () => {
      createTemplate(lib, { label: 'A', shortLabel: 'A', color: '#fff', description: '', favorite: true }, 'fav')
      createTemplate(lib, { label: 'B', shortLabel: 'B', color: '#fff', description: '', favorite: false }, 'nonfav')
      const favs = listFavorites(lib)
      expect(favs).toHaveLength(1)
      expect(favs[0].id).toBe('fav')
    })

    it('palauttaa kaikki jos kaikki suosikkeja', () => {
      createTemplate(lib, { label: 'A', shortLabel: 'A', color: '#fff', description: '', favorite: true })
      createTemplate(lib, { label: 'B', shortLabel: 'B', color: '#fff', description: '', favorite: true })
      expect(listFavorites(lib)).toHaveLength(2)
    })
  })
})
