export function parseGpx(xmlText: string): Array<{ lat: number; lon: number }> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const trkpts = doc.querySelectorAll('trkpt')
  const coords: Array<{ lat: number; lon: number }> = []
  trkpts.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') ?? '')
    const lon = parseFloat(pt.getAttribute('lon') ?? '')
    if (!isNaN(lat) && !isNaN(lon)) coords.push({ lat, lon })
  })
  return coords
}

export async function loadGpx(url: string): Promise<Array<{ lat: number; lon: number }>> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GPX fetch failed: ${res.status}`)
  return parseGpx(await res.text())
}
