import { test, expect } from 'playwright/test'
import { mockAuthAsTalkoolainen, mockTalkoolainenSegment, mockTemplates } from './helpers/auth'

// T233/V155: talkoolaisen yläpalkki = {Kaikki merkit, 🎒 Varustelista, ⋯}. Kapealla mobiililla
// (≤360px) toolbar ⊥ rivinylitä eikä vuoda yli leveyden; 44px-touch säilyy joka napilla.
test.describe('T233 — talkoolais-toolbar mobiili (≤360px)', () => {
  test('yläpalkki ei hajoa 360px:llä: yksi rivi, 44px touch, ei overflowia', async ({ page }) => {
    await mockAuthAsTalkoolainen(page)
    await mockTalkoolainenSegment(page, { withMarker: true })
    await mockTemplates(page)
    await page.setViewportSize({ width: 360, height: 780 })
    await page.goto('/s/TEST01')
    await page.waitForTimeout(1500)

    const actions = page.locator('#toolbar-actions')
    await expect(actions).toBeVisible()

    const btns = actions.locator('button:visible')
    const n = await btns.count()
    expect(n).toBeGreaterThanOrEqual(3)

    const boxes = []
    for (let i = 0; i < n; i++) boxes.push(await btns.nth(i).boundingBox())

    // Ei rivinylitä: kaikki napit samalla y-rivillä
    const tops = boxes.map(b => Math.round(b!.y))
    expect(Math.max(...tops) - Math.min(...tops), 'toolbar-napit eri riveillä = wrap').toBeLessThan(4)

    // 44px-touch jokaiselle näkyvälle napille
    for (let i = 0; i < n; i++) {
      const box = boxes[i]!
      const label = (await btns.nth(i).innerText()).trim()
      expect(Math.min(box.width, box.height), `TOUCH SMALL: "${label}"`).toBeGreaterThanOrEqual(44)
    }

    // Ei horisontaalista overflowia
    const overflow = await page.evaluate(() => {
      const t = document.getElementById('toolbar')!
      return t.scrollWidth - t.clientWidth
    })
    expect(overflow, 'toolbar vuotaa yli leveyden').toBeLessThanOrEqual(1)
  })
})
