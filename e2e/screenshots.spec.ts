import { test } from 'playwright/test';
import { mockAuthAsJarjestaja, mockAuthAsTalkoolainen } from './helpers/auth';

test('organizer desktop', async ({ page }) => {
  await mockAuthAsJarjestaja(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'claude-design-assets/01-organizer-desktop.png' });
});

test('volunteer desktop', async ({ page }) => {
  await mockAuthAsTalkoolainen(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'claude-design-assets/02-volunteer-desktop.png' });
});

test('volunteer mobile', async ({ page }) => {
  await mockAuthAsTalkoolainen(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'claude-design-assets/03-volunteer-mobile.png' });
});

test('organizer mobile', async ({ page }) => {
  await mockAuthAsJarjestaja(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'claude-design-assets/04-organizer-mobile.png' });
});
