import { describe, it, expect } from 'vitest'
import { signIdFromFilename, isValidSignId, slugify } from '../src/logic/sign-id-slug'

describe('T161 signIdFromFilename — slug-johto tiedostonimestä', () => {
  it('pudottaa printtiprefixin ja slugifioi lopun', () => {
    expect(signIdFromFilename('A3 vaaka leikattu 1 kpl iso-syöte 430.png')).toBe('iso-syote-430')
  })

  it('translitteroi ä→a ö→o', () => {
    expect(signIdFromFilename('pysäköintikielto.png')).toBe('pysakointikielto')
    expect(signIdFromFilename('pumppaamo_lisäkilpi.png')).toBe('pumppaamo_lisakilpi')
  })

  it('muuttaa välilyönnit viivoiksi', () => {
    expect(signIdFromFilename('park and ride.png')).toBe('park-and-ride')
    expect(signIdFromFilename('nuoli alas tupla.png')).toBe('nuoli-alas-tupla')
  })

  it('slugifioi prefiksittömän nimen suoraan', () => {
    expect(signIdFromFilename('wc.png')).toBe('wc')
    expect(signIdFromFilename('uimaranta.png')).toBe('uimaranta')
  })

  it('kattaa prefix-variantit: "6kpl" (ei väliä), "N kpl", neliö, ilman vaaka/pysty', () => {
    expect(signIdFromFilename('A3 pysty rajattu 6kpl kaannos_vasemmalle.png')).toBe('kaannos_vasemmalle')
    expect(signIdFromFilename('A4 vaaka rajattu 8 kpl 200 m.png')).toBe('200-m')
    expect(signIdFromFilename('A3 neliö 35 kpl nuoli.png')).toBe('nuoli')
    expect(signIdFromFilename('A3 leikattu 4 kpl kapeneva tie.png')).toBe('kapeneva-tie')
  })

  it('säilyttää sallitut _ ja - merkit', () => {
    expect(signIdFromFilename('A3 pysty 2 kpl u-kaannos_oikealle.png')).toBe('u-kaannos_oikealle')
  })

  it('numerosarjat viivotettuna', () => {
    expect(signIdFromFilename('A3 vaaka rajattu 1 kpl 30 65 100 260 a.png')).toBe('30-65-100-260-a')
  })

  it('tuottaa aina ID_RE-kelvollisen tuloksen (isValidSignId)', () => {
    const names = [
      'A3 vaaka leikattu 1 kpl iso-syöte 430.png',
      'pysäköintikielto.png',
      'park and ride.png',
      'A3 neliö 35 kpl nuoli.png',
      'A3 pysty 2 kpl u-kaannos_oikealle.png',
    ]
    for (const n of names) {
      expect(isValidSignId(signIdFromFilename(n))).toBe(true)
    }
  })

  it('T239: slugify Nimestä — perusesimerkit (auto-slug tunnukselle)', () => {
    expect(slugify('Oikea')).toBe('oikea')
    expect(slugify('Varo oikealta')).toBe('varo-oikealta')
    expect(slugify('Määränpää')).toBe('maaranpaa')
    expect(slugify('Töyssy')).toBe('toyssy')
  })

  it('T239: slugify poistaa @-merkin ja kelvottomat, kutistaa viivat', () => {
    expect(slugify('a@b')).toBe('ab')
    expect(slugify('Huoltopiste 25km')).toBe('huoltopiste-25km')
    expect(slugify('  reuna  välit  ')).toBe('reuna-valit')
    expect(slugify('---')).toBe('')
  })

  it('törmäys havaittavissa: kaksi eri tiedostoa → sama id', () => {
    // Kuratointi ratkaisee nämä; skripti flägää. Tässä varmistetaan että slug on
    // deterministinen ja törmäys tuottaa saman avaimen.
    const a = signIdFromFilename('A4 vaaka leikattu 1 kpl peikkopolku.png')
    const b = signIdFromFilename('peikkopolku.png')
    expect(a).toBe(b)
    expect(a).toBe('peikkopolku')
  })
})
