// UX-MOBIILIAUDIT — jokainen näkymä, jokainen rooli, oikean puhelimen kokoisena.
//
// Kaksi asiaa joita yksikkötesti ei näe ja jotka rikkovat talkoolaisen työn metsässä:
//   1. TOIMINTO EI MAHDU RUUDULLE — nappi on olemassa, mutta se on viewportin oikealla puolella
//      tai hero peittää sen ∴ toiminto on olemassa vain koodissa.
//   2. TOIMINTO EI OSU — <44px kohde hanskat kädessä (DESIGN.md §R/§A).
//
// Mittari on siksi geometrinen, ei DOM-olemassaolo: `must`-lista vaatii että elementti on
// NÄKYVISSÄ VIEWPORTISSA, ei että se löytyy querySelectorilla.
//
// Kaksi leveyttä: 390px (iPhone 12/13/14, mediaani) ja 360px (halpa Android, kapein jota
// tuetaan). 360 on se joka paljastaa vaakaleikkaukset.
import { test, expect } from 'playwright/test'
import type { Page } from 'playwright/test'
import fs from 'fs'
import path from 'path'
import { mockEverything, CODE } from './helpers/fixtures'

const PHONE = { width: 390, height: 844 }
const NARROW = { width: 360, height: 640 }
const LOAD = 2200

const SHOT_DIR = path.resolve('screenshots')
const REPORT_DIR = path.resolve('screenshots', 'audit-json')

type Offender = { sel: string; text: string; w: number; h: number; right?: number }
type ViewReport = {
  view: string
  width: number
  docScrollWidth: number
  hOverflow: boolean
  offscreenRight: Offender[]
  smallTargets: Offender[]
  missing: string[]
}

// Yksi tiedosto per näkymä: rinnakkaiset workerit eivät jaa muistia ∴ yhteinen taulukko
// olisi hävinnyt viimeisen workerin kirjoitukseen.
function writeReport(rep: ViewReport): void {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  fs.writeFileSync(path.join(REPORT_DIR, `${rep.view}.json`), JSON.stringify(rep, null, 2))
}

/**
 * Mittaa yhden näkymän. `must` = selektorit joiden PITÄÄ näkyä viewportissa (mitä
 * käyttäjä tulee tähän näkymään tekemään). `ignore` = selektorit jotka saavat ylittää
 * reunan (kartta-canvas, tarkoituksella leikkaavat nauhat).
 */
async function auditView(
  page: Page,
  view: string,
  must: string[] = [],
  ignore: string[] = [],
): Promise<ViewReport> {
  const vp = page.viewportSize()!
  await page.screenshot({ path: path.join(SHOT_DIR, `audit_${view}.png`) })

  const data = await page.evaluate((ignoreSel: string[]) => {
    const vw = window.innerWidth
    const IGNORE = [
      '.leaflet-pane', '.leaflet-tile', '.leaflet-tile-container', '.leaflet-map-pane',
      '.leaflet-marker-icon', '.leaflet-overlay-pane', '.leaflet-shadow-pane',
      '.leaflet-tooltip-pane', '.leaflet-popup-pane', '.leaflet-proxy', 'svg', 'path', 'g',
      // Karttalisenssin attribuutiolinkki (Leaflet/MML). Se ! olla pieni & huomaamaton —
      // se ⊥ ole toiminto vaan lakisääteinen maininta ∴ §A:n 44px ei koske sitä.
      '.leaflet-control-attribution',
      ...ignoreSel,
    ]
    const skip = (el: Element) => IGNORE.some(s => el.matches(s) || el.closest(s))

    const label = (el: Element) => {
      const id = el.id ? `#${el.id}` : ''
      const cls = typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
        : ''
      return `${el.tagName.toLowerCase()}${id}${cls}`
    }
    const txt = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)

    const visible = (el: Element) => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }

    const offscreenRight: Offender[] = []
    const smallTargets: Offender[] = []
    const seen = new Set<string>()

    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (skip(el) || !visible(el)) continue
      const r = el.getBoundingClientRect()

      // Vaakaleikkaus: elementin oikea reuna ruudun ulkopuolella (2px toleranssi pyöristykselle).
      // Vain jos elementti on pystysuunnassa näkyvissä — alaspäin scrollattava sisältö ei ole vika.
      if (r.right > vw + 2 && r.bottom > 0 && r.top < window.innerHeight) {
        const k = label(el) + txt(el)
        if (!seen.has(k)) {
          seen.add(k)
          offscreenRight.push({ sel: label(el), text: txt(el), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) })
        }
      }

      // Kosketuskohde (DESIGN.md §A: 44×44).
      const interactive = el.matches('button, [role="button"], a[href], input:not([type=hidden]), select, textarea')
      if (interactive && (r.width < 44 || r.height < 44)) {
        smallTargets.push({ sel: label(el), text: txt(el), w: Math.round(r.width), h: Math.round(r.height) })
      }
    }

    return {
      docScrollWidth: document.documentElement.scrollWidth,
      offscreenRight: offscreenRight.slice(0, 25),
      smallTargets: smallTargets.slice(0, 25),
    }
  }, ignore)

  // `must`: elementin pitää olla näkyvissä JA kokonaan viewportissa vaakasuunnassa.
  const missing: string[] = []
  for (const sel of must) {
    const loc = page.locator(sel).first()
    const count = await loc.count()
    if (!count) { missing.push(`${sel} (ei DOM:issa)`); continue }
    if (!(await loc.isVisible())) { missing.push(`${sel} (ei näkyvissä)`); continue }
    const box = await loc.boundingBox()
    if (!box) { missing.push(`${sel} (ei laatikkoa)`); continue }
    if (box.x < -2 || box.x + box.width > vp.width + 2) {
      missing.push(`${sel} (ruudun ulkopuolella: x=${Math.round(box.x)}..${Math.round(box.x + box.width)})`)
    }
  }

  const rep: ViewReport = {
    view,
    width: vp.width,
    docScrollWidth: data.docScrollWidth,
    hOverflow: data.docScrollWidth > vp.width + 2,
    offscreenRight: data.offscreenRight,
    smallTargets: data.smallTargets,
    missing,
  }
  writeReport(rep)

  expect.soft(rep.hOverflow, `${view}: vaakascroll (${rep.docScrollWidth} > ${vp.width})`).toBe(false)
  expect.soft(rep.offscreenRight, `${view}: elementtejä ruudun oikealla puolella`).toEqual([])
  expect.soft(rep.smallTargets, `${view}: kosketuskohde <44px`).toEqual([])
  expect.soft(rep.missing, `${view}: pakolliset elementit puuttuvat/ei mahdu`).toEqual([])
  return rep
}

// ─────────────────────────────────────────────────────────────────────────────
// TALKOOLAINEN — mobiili on ENSISIJAINEN näkymä (VISION §Talkoolainen)
// ─────────────────────────────────────────────────────────────────────────────

for (const [tag, vp] of [['390', PHONE], ['360', NARROW]] as const) {
  test.describe(`talkoolainen ${tag}px`, () => {
    test.use({ viewport: vp })

    test(`patkat-hub_${tag}`, async ({ page }) => {
      await mockEverything(page, 'talkoolainen')
      await page.goto('/patkat')
      await page.waitForTimeout(LOAD)
      // Mitä hubissa PITÄÄ näkyä: tervetuloa, pätkälista, kartalle-linkki, FAQ.
      await auditView(page, `patkat-hub_${tag}`, [
        '.patkat-hero', '.patkat-list', '.patkat-row', '.patkat-row-open',
        '.patkat-to-map', '.patkat-faq',
      ])
    })

    // KOTI-moodi (V174): kartta on TARKOITUKSELLA piilossa — koti on landing, kartalle
    // mennään "Kartalle →":sta. Siksi `#map` ⊥ ole tämän näkymän `must`-listalla.
    test(`patka-koti_${tag}`, async ({ page }) => {
      await mockEverything(page, 'talkoolainen')
      await page.goto(`/s/${CODE}`)
      await page.waitForTimeout(LOAD)
      await auditView(page, `patka-koti_${tag}`, [
        '#toolbar', '#btn-menu', '.segment-koti-tabbar',
        '.segment-view-equipment', '#btn-to-map',
      ])
    })

    test(`patka-merkit_${tag}`, async ({ page }) => {
      await mockEverything(page, 'talkoolainen')
      await page.goto(`/s/${CODE}`)
      await page.waitForTimeout(LOAD)
      await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
      await page.waitForTimeout(500)
      await auditView(page, `patka-merkit_${tag}`, [
        '.segment-koti-panel[data-tab="merkit"]', '.segment-view-markers-row',
      ])
    })

    // KARTTA-moodi: hero (seuraava merkki + kuittaus) on talkoolaisen core-flow.
    test(`patka-kartta_${tag}`, async ({ page }) => {
      await mockEverything(page, 'talkoolainen')
      await page.goto(`/s/${CODE}`)
      await page.waitForTimeout(LOAD)
      await page.click('#btn-to-map')
      await page.waitForTimeout(700)
      await auditView(page, `patka-kartta_${tag}`, [
        '#toolbar', '#btn-menu', '#map', '#btn-home-view', '.segment-view-next-row',
      ])
    })

    test(`patka-valikko_${tag}`, async ({ page }) => {
      await mockEverything(page, 'talkoolainen')
      await page.goto(`/s/${CODE}`)
      await page.waitForTimeout(LOAD)
      await page.click('#btn-menu')
      await page.waitForTimeout(400)
      // ⋯-valikko on talkoolaisen core-toimintojen koti (T257/R8).
      await auditView(page, `patka-valikko_${tag}`, [
        '#toolbar-menu', '#btn-tk-gps', '#btn-tk-add-marker', '#btn-layer',
      ])
    })

    // `/kasat` renderöi listan VAIN purkuvaiheessa (V332) ∴ fixtuurin vaihe = purku.
    test(`kasat_${tag}`, async ({ page }) => {
      await mockEverything(page, 'talkoolainen', { phase: 'purku' })
      await page.goto('/kasat')
      await page.waitForTimeout(LOAD)
      await auditView(page, `kasat_${tag}`, ['.kasat-header', '#kasat-map', '#kasat-content'])
    })

    test(`patka-merkkimodaali_${tag}`, async ({ page }) => {
      await mockEverything(page, 'talkoolainen')
      await page.goto(`/s/${CODE}`)
      await page.waitForTimeout(LOAD)
      await page.locator('.segment-koti-tab[data-tab="merkit"]').click()
      await page.locator('.segment-view-markers-row').first().click()
      await page.waitForTimeout(500)
      await auditView(page, `patka-merkkimodaali_${tag}`, ['.marker-detail-modal'])
    })

    test(`patka-varusteet-muokkaus_${tag}`, async ({ page }) => {
      await mockEverything(page, 'talkoolainen')
      await page.goto(`/s/${CODE}`)
      await page.waitForTimeout(LOAD)
      await page.locator('.segment-view-equipment-edit').click()
      await page.waitForTimeout(500)
      await auditView(page, `patka-varusteet-muokkaus_${tag}`, [])
    })

    // Purkuvaihe: kasanappi + keräyslista ilmestyvät — oma layoutinsa jota asetusvaihe ⊥ näytä.
    test(`patka-purku_${tag}`, async ({ page }) => {
      await mockEverything(page, 'talkoolainen', { phase: 'purku' })
      await page.goto(`/s/${CODE}`)
      await page.waitForTimeout(LOAD)
      await auditView(page, `patka-purku_${tag}`, ['#toolbar', '#btn-to-map'])
    })

    test(`patkat-login_${tag}`, async ({ page }) => {
      await page.route('**/api/auth/me', r => r.fulfill({ status: 401, body: '{}' }))
      await page.goto('/patkat')
      await page.waitForTimeout(1500)
      await auditView(page, `patkat-login_${tag}`, ['.patkat-login-card'])
    })

    test(`auth_${tag}`, async ({ page }) => {
      await page.route('**/api/auth/me', r => r.fulfill({ status: 401, body: '{}' }))
      await page.goto('/')
      await page.waitForTimeout(1200)
      await auditView(page, `auth_${tag}`)
    })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// JÄRJESTÄJÄ — mobiili on VÄLTTÄVÄ mutta ei saa olla rikki (VISION §Järjestäjä)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('järjestäjä 390px', () => {
  test.use({ viewport: PHONE })

  test('jarjestaja-kartta_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await auditView(page, 'jarjestaja-kartta_390', [
      '#toolbar', '#btn-list', '#btn-menu', '#map', '#left-panel-toggle',
    ])
  })

  test('jarjestaja-sivupaneeli_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#left-panel-toggle')
    await page.waitForTimeout(500)
    await auditView(page, 'jarjestaja-sivupaneeli_390', ['#left-panel'])
  })

  test('jarjestaja-patkat_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#left-panel-toggle')
    await page.waitForTimeout(400)
    await page.locator('.left-panel-section-header').filter({ hasText: 'Reittipätkät' }).click()
    await page.waitForTimeout(400)
    await auditView(page, 'jarjestaja-patkat_390', ['#btn-segment-create'])
  })

  test('jarjestaja-suodatin_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    // Kapea ruutu → bar kutistuu yhdeksi sheet-triggeriksi (B160/B161/V274).
    await page.locator('.map-filter-sheet-trigger').click()
    await page.waitForTimeout(400)
    await auditView(page, 'jarjestaja-suodatin_390', ['.map-filter-groups'])
  })

  test('jarjestaja-merkkilista_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#btn-list')
    await page.waitForTimeout(600)
    await auditView(page, 'jarjestaja-merkkilista_390', ['.marker-overview'])
  })

  test('jarjestaja-valikko_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#btn-menu')
    await page.waitForTimeout(400)
    await auditView(page, 'jarjestaja-valikko_390', ['#toolbar-menu', '#btn-layer'])
  })

  test('jarjestaja-patkamodaali_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#left-panel-toggle')
    await page.waitForTimeout(400)
    await page.locator('.left-panel-section-header').filter({ hasText: 'Reittipätkät' }).click()
    await page.waitForTimeout(400)
    await page.locator('.segment-info').first().click()
    await page.waitForTimeout(600)
    await auditView(page, 'jarjestaja-patkamodaali_390', [])
  })

  test('jarjestaja-alueet_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#left-panel-toggle')
    await page.waitForTimeout(400)
    await page.locator('.left-panel-section-header').filter({ hasText: 'Alueet' }).click()
    await page.waitForTimeout(400)
    await auditView(page, 'jarjestaja-alueet_390', [])
  })

  test('inventaario_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/inventory.html')
    await page.waitForTimeout(LOAD)
    await auditView(page, 'inventaario_390', ['#inventory-header', '#inventory-content'])
  })

  test('loki_390', async ({ page }) => {
    await mockEverything(page, 'admin')
    await page.goto('/loki.html')
    await page.waitForTimeout(LOAD)
    await auditView(page, 'loki_390', ['#loki-header', '#loki-content'])
  })

  test('admin_390', async ({ page }) => {
    await mockEverything(page, 'admin')
    await page.goto('/admin.html')
    await page.waitForTimeout(LOAD)
    await auditView(page, 'admin_390', ['#admin-header', '#admin-content', '#admin-settings'])
  })

  test('jarjestaja-merkkikirjasto_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#left-panel-toggle')
    await page.waitForTimeout(400)
    const dots = page.locator('.sign-lib-dots-btn').first()
    await dots.waitFor({ state: 'visible' })
    await dots.click()
    await page.waitForTimeout(500)
    await auditView(page, 'jarjestaja-merkkikirjasto_390', ['.sign-lib-modal'])
  })

  test('jarjestaja-varmuuskopiot_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#btn-menu')
    await page.waitForTimeout(300)
    await page.click('#btn-snapshot-panel')
    await page.waitForTimeout(600)
    await auditView(page, 'jarjestaja-varmuuskopiot_390', [])
  })

  test('jarjestaja-aluemodaali_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#left-panel-toggle')
    await page.waitForTimeout(400)
    await page.locator('.left-panel-section-header').filter({ hasText: 'Alueet' }).click()
    await page.waitForTimeout(400)
    await page.locator('.btn-area-dots').first().click()
    await page.waitForTimeout(600)
    await auditView(page, 'jarjestaja-aluemodaali_390', [])
  })

  test('jarjestaja-patkaluonti_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#left-panel-toggle')
    await page.waitForTimeout(400)
    await page.locator('.left-panel-section-header').filter({ hasText: 'Reittipätkät' }).click()
    await page.waitForTimeout(400)
    await page.click('#btn-segment-create')
    await page.waitForTimeout(600)
    await auditView(page, 'jarjestaja-patkaluonti_390', [])
  })

  test('jarjestaja-merkkimodaali_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#btn-list')
    await page.waitForTimeout(600)
    await page.locator('.marker-overview-menu').first().click()
    await page.waitForTimeout(600)
    await auditView(page, 'jarjestaja-merkkimodaali_390', ['.marker-detail-modal'])
  })

  // B184/V344: admin AJAA JÄRJESTÄJÄN LAYOUTIA. Ennen korjausta `body[data-role="admin"]`
  // ohitti jokaisen `[data-role="järjestäjä"]`-säännön ∴ "Suodata" asettui
  // `#left-panel-toggle`in päälle & nappasi klikin — suunnittelupaneelia ⊥ saanut auki.
  // Geometria ei riitä vahdiksi: mitataan KUKA SAA KLIKIN togglen keskipisteessä.
  test('admin-kartta_390', async ({ page }) => {
    await mockEverything(page, 'admin')
    await page.goto('/')
    await page.waitForTimeout(LOAD)

    const hit = await page.evaluate(() => {
      const tog = document.querySelector('#left-panel-toggle')
      if (!tog) return 'ei togglea'
      const b = tog.getBoundingClientRect()
      const el = document.elementFromPoint((b.x + b.right) / 2, (b.y + b.bottom) / 2)
      return el?.id || el?.className || 'null'
    })
    expect(hit, 'Suodata-nappi peittää sivupaneelin togglen (B184)').toContain('left-panel-toggle')

    // Paneelin ! oikeasti avautua klikistä — hit-testi yksin ⊥ todista koko ketjua.
    await page.click('#left-panel-toggle')
    await page.waitForTimeout(400)
    await expect(page.locator('#left-panel')).not.toHaveClass(/collapsed/)

    await auditView(page, 'admin-kartta_390', [
      '#toolbar', '#btn-menu', '#map', '#left-panel-toggle',
    ])
  })

  test('admin-valikko_390', async ({ page }) => {
    await mockEverything(page, 'admin')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await page.click('#btn-menu')
    await page.waitForTimeout(400)
    // ✎ Muokkaa ! löytyä valikosta myös adminilta (yläpalkin nappi on piilossa ≤560px),
    // ja talkoolaisen lohko ! olla piilossa.
    await expect(page.locator('#btn-menu-map-mode')).toBeVisible()
    await expect(page.locator('#tk-menu-actions')).toBeHidden()
    await auditView(page, 'admin-valikko_390', ['#toolbar-menu', '#btn-layer', '#btn-menu-map-mode'])
  })

  test('inventaario-muokkaus_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/inventory.html')
    await page.waitForTimeout(LOAD)
    await page.click('#inv-mode-toggle')
    await page.waitForTimeout(500)
    await auditView(page, 'inventaario-muokkaus_390', [])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// KAAMOS-TUMMA (V132/T202) — sama geometria, eri tokenit. Teema ⊥ saa muuttaa
// mittoja; jos muuttaa, jokin luki värin kokoa määräävästä paikasta.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('tumma teema 390px', () => {
  test.use({ viewport: PHONE })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('karttamaster-theme', 'dark') } catch { /* privaatti-ikkuna */ }
    })
  })

  test('tumma-patka-koti_390', async ({ page }) => {
    await mockEverything(page, 'talkoolainen')
    await page.goto(`/s/${CODE}`)
    await page.waitForTimeout(LOAD)
    await auditView(page, 'tumma-patka-koti_390', ['.segment-koti-tabbar', '#btn-to-map'])
  })

  test('tumma-patka-kartta_390', async ({ page }) => {
    await mockEverything(page, 'talkoolainen')
    await page.goto(`/s/${CODE}`)
    await page.waitForTimeout(LOAD)
    await page.click('#btn-to-map')
    await page.waitForTimeout(700)
    await auditView(page, 'tumma-patka-kartta_390', ['#map', '.segment-view-next-row'])
  })

  test('tumma-jarjestaja-kartta_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/')
    await page.waitForTimeout(LOAD)
    await auditView(page, 'tumma-jarjestaja-kartta_390', ['#toolbar', '#btn-menu', '#map'])
  })

  test('tumma-kasat_390', async ({ page }) => {
    await mockEverything(page, 'talkoolainen', { phase: 'purku' })
    await page.goto('/kasat')
    await page.waitForTimeout(LOAD)
    await auditView(page, 'tumma-kasat_390', ['.kasat-header', '#kasat-map'])
  })

  test('tumma-patkat-hub_390', async ({ page }) => {
    await mockEverything(page, 'talkoolainen')
    await page.goto('/patkat')
    await page.waitForTimeout(LOAD)
    await auditView(page, 'tumma-patkat-hub_390', ['.patkat-hero', '.patkat-list'])
  })

  test('tumma-inventaario_390', async ({ page }) => {
    await mockEverything(page, 'järjestäjä')
    await page.goto('/inventory.html')
    await page.waitForTimeout(LOAD)
    await auditView(page, 'tumma-inventaario_390', ['#inventory-content'])
  })

  test('tumma-admin_390', async ({ page }) => {
    await mockEverything(page, 'admin')
    await page.goto('/admin.html')
    await page.waitForTimeout(LOAD)
    await auditView(page, 'tumma-admin_390', ['#admin-content'])
  })

  test('tumma-loki_390', async ({ page }) => {
    await mockEverything(page, 'admin')
    await page.goto('/loki.html')
    await page.waitForTimeout(LOAD)
    await auditView(page, 'tumma-loki_390', ['#loki-content'])
  })

  // Teema on VALINTA joka persistoituu (V132/T202) ∴ sen ! päteä JOKAISELLA sivulla.
  // Ennen UX-auditia 2026-08-01 vain `main.ts` kutsui `initTheme()`ä — muut viisi
  // entrypointia jättivät `<html data-theme>`n asettamatta & näyttivät täyden valkoisen.
  for (const [name, url] of [
    ['kartta', '/'], ['patkat', '/patkat'], ['kasat', '/kasat'],
    ['inventaario', '/inventory.html'], ['admin', '/admin.html'], ['loki', '/loki.html'],
  ] as const) {
    test(`teema pätee sivulla ${name}`, async ({ page }) => {
      await mockEverything(page, 'admin', { phase: 'purku' })
      await page.goto(url)
      await page.waitForTimeout(1200)
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    })
  }
})
