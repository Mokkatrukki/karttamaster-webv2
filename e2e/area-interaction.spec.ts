/**
 * T117 E2E — V69: MapRectEditor exit + polygon click guard
 * Vaatii dev-serverin (bun run dev) ja Chromium.
 */
import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

const MOCK_AREA = {
  id: 'area-e2e-01',
  name: 'Testihuolto',
  centerLat: 65.6277,   // GPX-reittien läheisyydessä → näkyy fitBounds-viewissä
  centerLng: 27.6275,
  widthM: 500,
  heightM: 300,
  rotation: 0,
  markdownDescription: '',
  status: 'suunniteltu',
  hashCode: 'testhash',
  features: [],
}

async function setupMocks(page: import('playwright/test').Page) {
  await mockAuthAsJarjestaja(page)
  await page.route('/api/areas', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_AREA]) })
  )
  await page.route('/api/markers', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
  await page.route('/api/segments', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )
}

test.describe('T117 — V69: MapRectEditor edit exit + polygon guard', () => {
  test('dblclick alue-polygoni → nurkkahandlet ilmestyvät', async ({ page }) => {
    await setupMocks(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(2000)

    // Odota kunnes polygon on renderöity koordinaateilla (ei vain "M0 0")
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.area-polygon')
        return el && el.getAttribute('d') !== 'M0 0' && el.getAttribute('d') !== ''
      },
      { timeout: 8000 },
    )

    await zoomToArea(page)

    const poly = page.locator('.area-polygon').first()

    // Ennen editiä: ei nurkkahandleja
    await expect(page.locator('.area-corner-handle')).toHaveCount(0)

    // dblclick polygonin kulmassa — drag-handle on centerissä, reunassa on vapaa
    await dblclickPolyEdge(page, poly)
    await page.waitForTimeout(500)
    await expect(page.locator('.area-corner-handle')).toHaveCount(4)
  })

  async function waitForAreaRendered(page: import('playwright/test').Page) {
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.area-polygon')
        return el && el.getAttribute('d') !== 'M0 0' && el.getAttribute('d') !== ''
      },
      { timeout: 8000 },
    )
  }

  // T324/V233: alkuzoom EI ole vakio — se seuraa `route-defs.ts`:n reittimäärää fitBoundsin kautta.
  // Kun reittejä oli 2, testialue (500×300 m) renderöityi isoksi; 6 reitin jälkeen se kutistui
  // 12×8 px:iin ja keskellä oleva `.area-drag-handle` peitti sen kokonaan → dblclick ei koskaan
  // tavoittanut polygonia (elementFromPoint todisti: osui drag-handleen). Testi ei saa olettaa
  // kartan mittakaavaa: aja kartta alueen päälle tunnetulla zoomilla ennen geometria-mittauksia.
  async function zoomToArea(page: import('playwright/test').Page) {
    await page.evaluate(([lat, lng]) => {
      const m = (window as unknown as Record<string, unknown>)['__testMap'] as
        { setView(c: [number, number], z: number, o?: unknown): void } | undefined
      m?.setView([lat as number, lng as number], 15, { animate: false })
    }, [MOCK_AREA.centerLat, MOCK_AREA.centerLng])
    // zoom 15 @ lat 65.6 ≈ 2 m/px → 500×300 m alue ≈ 250×150 px: mahtuu viewportiin
    // ja on selvästi isompi kuin center drag-handle ∴ nurkka on vapaa.
    await page.waitForFunction(() => {
      const el = document.querySelector('.area-polygon')
      return !!el && el.getBoundingClientRect().width > 100
    }, { timeout: 5000 })
  }

  // Etsi kartalta piste jossa ylin elementti on itse Leaflet-kontaineri (ei paneeli, kontrolli,
  // polygoni eikä merkki) ja klikkaa sitä. Kiinteä koordinaatti mätänee heti kun jokin overlay
  // kasvaa — tämä ei (T324/V233).
  async function clickEmptyMapSpot(page: import('playwright/test').Page) {
    const mapBox = await page.locator('#map').boundingBox()
    if (!mapBox) throw new Error('map element not found')
    const spot = await page.evaluate(([x0, y0, w, h]) => {
      const map = document.getElementById('map')!
      for (let fy = 0.85; fy >= 0.15; fy -= 0.05) {
        for (let fx = 0.1; fx <= 0.9; fx += 0.05) {
          const px = (x0 as number) + (w as number) * fx
          const py = (y0 as number) + (h as number) * fy
          const el = document.elementFromPoint(px, py)
          if (!el || !map.contains(el)) continue
          // Tyhjä kartta = ei interaktiivista layeria, ei kontrollia, ei merkki-ikonia
          const blocked = el.closest('.leaflet-interactive, .leaflet-control, .leaflet-marker-icon, .leaflet-tooltip')
          if (!blocked) {
            return { x: Math.round(px - (x0 as number)), y: Math.round(py - (y0 as number)) }
          }
        }
      }
      return null
    }, [mapBox.x, mapBox.y, mapBox.width, mapBox.height])
    if (!spot) throw new Error('no empty map spot found')
    await page.click('#map', { position: spot })
  }

  // Dblclick polygonin reunaan (ei centeriin missä drag-handle on)
  async function dblclickPolyEdge(page: import('playwright/test').Page, poly: import('playwright/test').Locator) {
    const box = await poly.boundingBox()
    if (!box) throw new Error('polygon bounding box null')
    // Klikkaa top-left-kulmaa (+4px sisälle) — kaukana center drag-handlesta
    await page.mouse.dblclick(box.x + 4, box.y + 4)
  }

  test('edit-tilassa karttaklikki → handleit katoavat (V69)', async ({ page }) => {
    await setupMocks(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(2000)
    await waitForAreaRendered(page)
    await zoomToArea(page)

    const poly = page.locator('.area-polygon').first()

    // Aktivoi edit
    await dblclickPolyEdge(page, poly)
    await page.waitForTimeout(500)
    await expect(page.locator('.area-corner-handle')).toHaveCount(4)

    // Klikkaa tyhjää kohtaa kartalla — page.click('#map', {position}) rekisteröityy Leafletin
    // map-clickinä (toisin kuin raaka page.mouse.click nurkkaan, joka osui kontrolliin/paneeliin).
    // T324/V233: kohta ETSITÄÄN elementFromPointilla, ei arvata kiinteistä koordinaateista —
    // status-panel kasvaa reittimäärän mukana (6 riviä) ja söi entisen "vasen ylälaita" -pisteen.
    // Siirrä näkymä pois alueen päältä ENNEN karttaklikkiä: dblclick zoomaa Leafletissa sisään
    // ∴ edit-tilassa polygoni täyttää koko viewportin eikä tyhjää kohtaa ole. Panorointi ei
    // lopeta editiä (vain map-click tai Esc tekee sen — juuri se tässä testataan).
    await page.evaluate(([lat, lng]) => {
      const m = (window as unknown as Record<string, unknown>)['__testMap'] as
        { setView(c: [number, number], z: number, o?: unknown): void } | undefined
      m?.setView([(lat as number) + 0.03, lng as number], 14, { animate: false })
    }, [MOCK_AREA.centerLat, MOCK_AREA.centerLng])
    await expect(page.locator('.area-corner-handle')).toHaveCount(4) // edit yhä päällä panoroinnin jälkeen
    await clickEmptyMapSpot(page)
    await page.waitForTimeout(500)

    // Handleit poistuvat
    await expect(page.locator('.area-corner-handle')).toHaveCount(0)
  })

  test('edit-tilassa Esc → handleit katoavat', async ({ page }) => {
    await setupMocks(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(2000)
    await waitForAreaRendered(page)
    await zoomToArea(page)

    const poly = page.locator('.area-polygon').first()

    await dblclickPolyEdge(page, poly)
    await page.waitForTimeout(500)
    await expect(page.locator('.area-corner-handle')).toHaveCount(4)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await expect(page.locator('.area-corner-handle')).toHaveCount(0)
  })

  test('edit-tilassa polygon-klikki ei avaa modaalia (V69)', async ({ page }) => {
    await setupMocks(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await page.waitForTimeout(2000)
    await waitForAreaRendered(page)
    await zoomToArea(page)

    const poly = page.locator('.area-polygon').first()

    // Aktivoi edit
    await dblclickPolyEdge(page, poly)
    await page.waitForTimeout(500)
    await expect(page.locator('.area-corner-handle')).toHaveCount(4)

    // Klikki polygonilla — V69: modaali ei saa aueta edit-tilassa
    await poly.click({ force: true })
    await page.waitForTimeout(500)
    await expect(page.locator('.area-details-modal')).toHaveCount(0)
  })
})
