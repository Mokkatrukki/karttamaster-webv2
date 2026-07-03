import type { Page } from 'playwright/test'
import path from 'path'

export async function snap(page: Page, name: string) {
  if (!process.env.SCREENSHOTS) return
  await page.screenshot({
    path: path.join('screenshots', `${name}.png`),
    fullPage: false,
  })
}
