/**
 * T349/V253/B136 — karttapinnan värit ovat teemariippumattomia.
 *
 * B136: T348:n valmis-vihreä tuli kahdesta lähteestä — viiva JS-vakiosta SEGMENT_DONE_COLOR,
 * nimilapun reunus CSS-tokenista var(--confirm). `:root`issa molemmat #1F8A50 ∴ VAALEASSA
 * teemassa pari täsmäsi & vika oli näkymätön; Kaamos määrittää --confirm: #2FA35B ∴ teemanvaihto
 * hajotti parin. Yksikään testi ei ajanut Kaamosta ∴ vain teemakierros nappaa tämän luokan viat.
 *
 * Tämä testi ajaa SAMAN näkymän molemmilla teemoilla ja vaatii karttapinnan värit identtisiksi.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockMarkers } from './helpers/auth'

const SEGMENTS = [
  { id: 's-valmis', routeIds: ['smtb-30'], startDist: 200, endDist: 1400, displayName: 'Valmispätkä', equipment: [], phase: 'asettaminen' },
  { id: 's-kesken', routeIds: ['smtb-30'], startDist: 1700, endDist: 2900, displayName: 'Keskenpätkä', equipment: [], phase: 'asettaminen' },
]

// Wire-muoto on snake_case — camelCase jättää route_ids normalisoinnissa undefiniksi.
const marker = (id: string, dist: number, status: string) => ({
  id, type: 'right', lat: 65.62, lon: 27.62, distance_from_start: dist,
  route_ids: ['smtb-30'], status, location_note: null, color: null,
  label: null, icon_id: null, image_id: null, template_id: null, parts_json: null,
  description: null, images: [], created_by: null,
})

/** Karttapinnan värit: nimilapun reunus + tausta (B106) + pätkäviivojen stroke. */
async function mapSurfaceColors(page: import('playwright/test').Page) {
  return page.evaluate(() => {
    const label = document.querySelector('.segment-label--done') as HTMLElement | null
    const cs = label ? getComputedStyle(label) : null
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      labelBorder: cs?.borderTopColor ?? null,
      labelBackground: cs?.backgroundColor ?? null,
      labelColor: cs?.color ?? null,
      strokes: Array.from(document.querySelectorAll<SVGPathElement>('.leaflet-overlay-pane path'))
        .filter(p => ['11', '9'].includes(p.getAttribute('stroke-width') ?? ''))
        .map(p => p.getAttribute('stroke'))
        .sort(),
    }
  })
}

async function loadWithTheme(page: import('playwright/test').Page, theme: 'light' | 'dark') {
  await page.route(/\/api\/segments(\?|$)/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SEGMENTS) }))
  await mockAuthAsJarjestaja(page)
  await mockMarkers(page, [
    marker('a1', 400, 'asetettu'), marker('a2', 1100, 'asetettu'),      // valmis 2/2
    marker('b1', 1900, 'asetettu'), marker('b2', 2600, 'suunniteltu'),  // kesken 1/2
  ])
  await page.addInitScript(t => localStorage.setItem('karttamaster-theme', t), theme)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForTimeout(1800)
}

test.describe('T349/V253 — karttapinta on teemariippumaton', () => {
  test('valmis-pätkän värit identtiset vaaleassa ja Kaamoksessa (B136)', async ({ page }) => {
    await loadWithTheme(page, 'light')
    const light = await mapSurfaceColors(page)
    expect(light.labelBorder, 'valmis-lappu ei renderöitynyt').not.toBeNull()

    await page.context().clearCookies()
    await loadWithTheme(page, 'dark')
    const dark = await mapSurfaceColors(page)

    // Teema TODELLA vaihtui — muuten testi vertaisi kahta identtistä vaaleaa ajoa ja olisi valhetta.
    expect(light.theme).toBe('light')
    expect(dark.theme).toBe('dark')

    // B136: reunus ja viivat ovat karttapintaa → identtiset. B106: tausta+teksti kiinteät.
    expect(dark.labelBorder).toBe(light.labelBorder)
    expect(dark.labelBackground).toBe(light.labelBackground)
    expect(dark.labelColor).toBe(light.labelColor)
    expect(dark.strokes).toEqual(light.strokes)
  })

  // T350: karttapinta-tokenien rekisteri. Jos joku lisää tokenin [data-theme]-lohkoon,
  // tämä hajoaa — riippumatta siitä onko kyseinen elementti juuri nyt näkyvissä ruudulla.
  test('kaikki karttapinta-tokenit identtiset teemojen välillä (V253)', async ({ page }) => {
    const MAP_SURFACE_TOKENS = ['--segment-done', '--marker-glow']
    const read = () => page.evaluate((tokens: string[]) => {
      const root = getComputedStyle(document.documentElement)
      return Object.fromEntries(tokens.map(t => [t, root.getPropertyValue(t).trim()]))
    }, MAP_SURFACE_TOKENS)

    await loadWithTheme(page, 'light')
    const light = await read()
    await loadWithTheme(page, 'dark')
    const dark = await read()

    for (const t of MAP_SURFACE_TOKENS) {
      expect(light[t], `${t} puuttuu :root'ista`).not.toBe('')
      expect(dark[t], `${t} on ylikirjoitettu [data-theme="dark"]:ssa — karttapinta ei saa vaihtua teemasta`).toBe(light[t])
    }
  })

  test('nimilapun reunus seuraa --segment-done -tokenia, EI --confirmia', async ({ page }) => {
    await loadWithTheme(page, 'dark')
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      const label = document.querySelector('.segment-label--done') as HTMLElement
      return {
        segmentDone: root.getPropertyValue('--segment-done').trim(),
        confirm: root.getPropertyValue('--confirm').trim(),
        border: getComputedStyle(label).borderTopColor,
      }
    })
    // Kaamoksessa tokenit eroavat — juuri se tekee tästä testistä merkityksellisen.
    expect(tokens.confirm.toLowerCase()).not.toBe(tokens.segmentDone.toLowerCase())
    expect(tokens.border).toBe('rgb(31, 138, 80)') // #1F8A50 = --segment-done
  })
})
