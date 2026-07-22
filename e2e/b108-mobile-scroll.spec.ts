import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja } from './helpers/auth'

// B108/V187: mobiili-scroll-hygienia. Fixed karttakuori + sisäiset scroll-alueet eivät
// saa valuttaa scrollia taustan karttaan ("kaikki liikkuu"). CSS-invariantit — luetaan
// getComputedStyle, ei kuvavertailua.
const MOBILE = { width: 320, height: 568 }

test.describe('B108 — mobiili-scroll-hygienia', () => {
  test('karttakuori (:has(#app)) ei scrollaa itse — html/body overflow hidden', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await page.waitForTimeout(1500)
    const overflow = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).overflowY,
      body: getComputedStyle(document.body).overflowY,
    }))
    expect(overflow.html).toBe('hidden')
    expect(overflow.body).toBe('hidden')
  })

  test('sisäiset scroll-alueet estävät scroll-chainingin (overscroll-behavior: contain)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await page.waitForTimeout(1500)
    // #marker-modal-items renderöityy vasta modaalin auettua; testataan avaamatta
    // suoraan CSS-selektorin kautta injektoidulla proto-elementillä.
    const ob = await page.evaluate(() => {
      const el = document.createElement('div')
      el.id = 'marker-modal-items'
      document.body.appendChild(el)
      const v = getComputedStyle(el).overscrollBehaviorY
      el.remove()
      return v
    })
    expect(ob).toBe('contain')
  })

  test('#toolbar-menu on capattu ruudun korkeuteen (max-height ≠ none, overflow auto)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await page.waitForTimeout(1500)
    await page.click('#btn-menu')
    await page.waitForTimeout(300)
    const menu = await page.evaluate(() => {
      const el = document.getElementById('toolbar-menu')!
      const cs = getComputedStyle(el)
      return {
        maxHeight: cs.maxHeight,
        overflowY: cs.overflowY,
        rectBottom: el.getBoundingClientRect().bottom,
        vh: window.innerHeight,
      }
    })
    expect(menu.maxHeight).not.toBe('none')
    expect(menu.overflowY).toBe('auto')
    // Valikko ei valu ruudun alareunan yli (kaikki kohteet tavoitettavissa)
    expect(menu.rectBottom).toBeLessThanOrEqual(menu.vh + 1)
  })

  test('modaali-backdrop nappaa eleet (touch-action: none)', async ({ page }) => {
    await mockAuthAsJarjestaja(page)
    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await page.waitForTimeout(1500)
    const ta = await page.evaluate(() => {
      const el = document.getElementById('marker-modal-backdrop')!
      return getComputedStyle(el).touchAction
    })
    expect(ta).toBe('none')
  })
})
