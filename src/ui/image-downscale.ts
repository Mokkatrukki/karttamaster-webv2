// T338/V247: kuvan pienennys ENNEN lähetystä. Puhelimen kamerakuva on 3–8 MB ja 4000px leveä —
// karttahuomion todisteeksi riittää murto-osa. Pienennys on NOPEUS + KAISTA (talkoolainen
// metsässä, heikko yhteys, akku), EI turvatoimi: serverin portit (koko/mime/taajuus) ovat
// oikea suoja, koska API:a voi kutsua ohi clientin.
//
// Canvas vaatii DOM:in ∴ tämä on src/ui/-kerroksessa, ei src/logic/:ssa (arkkitehtuuriraja).

export const MAX_DIMENSION = 1600
export const JPEG_QUALITY = 0.8

export interface DownscaleResult {
  file: File
  /** true = kuva pienennettiin; false = alkuperäinen kelpasi sellaisenaan. */
  changed: boolean
}

/** Kohdemitat jotka säilyttävät kuvasuhteen ja mahtuvat max-neliöön. Pure → testattava ilman canvasia. */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_DIMENSION,
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height }
  const scale = max / Math.max(width, height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Pienennä kuva enintään MAX_DIMENSION-pitkäksi sivultaan ja pakkaa JPEG:ksi.
 *
 * Epäonnistuminen (ei canvas-tukea, korruptoitunut tiedosto, toBlob null) palauttaa
 * ALKUPERÄISEN tiedoston — huomio menee silti perille ja serverin koko-portti hoitaa loput.
 * Hiljainen epäonnistuminen olisi pahempi kuin iso kuva: kentällä otettu todiste katoaisi.
 */
export async function downscaleImage(
  file: File,
  max: number = MAX_DIMENSION,
): Promise<DownscaleResult> {
  if (!file.type.startsWith('image/')) return { file, changed: false }
  try {
    const bitmap = await loadBitmap(file)
    if (!bitmap) return { file, changed: false }
    const { width, height } = fitWithin(bitmap.width, bitmap.height, max)
    if (width === bitmap.width && height === bitmap.height && file.type === 'image/jpeg') {
      return { file, changed: false }
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { file, changed: false }
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      if (typeof canvas.toBlob !== 'function') { resolve(null); return }
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })
    if (!blob) return { file, changed: false }

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return { file: new File([blob], name, { type: 'image/jpeg' }), changed: true }
  } catch {
    return { file, changed: false }
  }
}

async function loadBitmap(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      return null
    }
  }
  return null
}
