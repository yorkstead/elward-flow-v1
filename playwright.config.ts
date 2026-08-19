import { defineConfig, devices } from '@playwright/test'
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
        command: 'bun run dev',
        url: 'http://localhost:3000/api/health',
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
