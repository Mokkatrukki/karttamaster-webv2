import { defineConfig } from 'playwright/test'

export default defineConfig({
  testDir: 'e2e',
  testMatch: ['**/*.spec.ts'],
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
