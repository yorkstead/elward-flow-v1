import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Match the application environment for local runs; CI supplies its own secrets.
if (!process.env.CI) loadEnvConfig(process.cwd(), true)
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: process.env.CI
    ? {
        command: 'bun run start',
        url: 'http://localhost:3000/api/health/live',
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
