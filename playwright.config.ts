import { defineConfig } from 'playwright/test'

export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  testDir: 'e2e',
  testMatch: ['**/*.spec.ts'],
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5180',
    headless: true,
  },
  webServer: {
    // Erillinen portti + DB_PATH (dev.e2e.db) — e2e ei koskaan koske kehittäjän omaan
    // dev-sessioon (localhost:5173 / dev.db). Ks. B49/V80-viereinen huomio SPEC.md:ssä.
    command: 'bun run dev:e2e',
    url: 'http://localhost:5180',
    reuseExistingServer: false,
    timeout: 30000,
  },
})
