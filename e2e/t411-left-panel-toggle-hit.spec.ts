import { test, expect } from 'playwright/test'
import { mockAuthAsJarjestaja, mockMarkers } from './helpers/auth'

// T411/V302 (B170): ≤480px `#left-panel` on absoluuttinen lipasto (T181/V114) & `#map-filter-bar`
// on `z-index:1100`. Lipasto oli 500 ∴ AVATTUNA bar peitti `#left-panel-toggle`in & nappasi
// klikin — paneelia ⊥ saanut kiinni lainkaan. T181:n `margin-left:40px` kattoi vain KUTISTETUN
// 32px kaistan. Tämä testi lukitsee molemmat tilat: klikki ! osua nappiin, ⊥ bariin.

test.use({ viewport: { width: 390, height: 800 } })

test('avattu sivupaneeli: ◀ saa klikin, ⊥ suodatinbar (B170)', async ({ page }) => {
  await mockAuthAsJarjestaja(page)
  await mockMarkers(page, [])
  await page.goto('/')
  await page.waitForSelector('#map-filter-bar', { state: 'visible' })

  const panel = page.locator('#left-panel')
  const toggle = page.locator('#left-panel-toggle')

  // Mobiilissa lipasto alkaa kutistettuna (left-panel.ts:15) → avaa se.
  if (await panel.evaluate(el => el.classList.contains('collapsed'))) {
    await toggle.click()
  }
  await expect(panel).not.toHaveClass(/collapsed/)

  // V302: togglen keskipiste kuuluu TOGGLELLE — bar ⊥ saa varastaa 44px-kohdetta.
  const hit = await page.evaluate(() => {
    const t = document.getElementById('left-panel-toggle')!.getBoundingClientRect()
    const el = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2)
    return el?.id ?? el?.className ?? 'null'
  })
  expect(hit).toBe('left-panel-toggle')

  // …& klikki todella sulkee lipaston (⊥ pelkkä hit-test).
  await toggle.click()
  await expect(panel).toHaveClass(/collapsed/)
})
