import { test, expect, type Page } from '@playwright/test'

const ADMIN_EMAIL = 'admin@example.test'
const ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD || 'Local-nb-C5pY1tqvtrLx_!'

async function loginAdmin(page: Page) {
  await page.goto('/sign-in')
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url: URL) => url.pathname !== '/sign-in', {
    timeout: 10000,
  })
}

test.describe('Pallets and Shipping Operational Chain', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
  })

  test('Palletizing Station loads pallets and displays stack details', async ({
    page,
  }) => {
    await page.goto('/pallets')
    await expect(
      page.getByRole('heading', {
        name: /Palletizing & Staging Command Center/i,
      }),
    ).toBeVisible()

    // Verify KPI indicators
    await expect(page.getByText('Total Pallets')).toBeVisible()
    await expect(page.getByText('Staged for Ship')).toBeVisible()

    // Verify seeded pallet is visible
    await expect(page.getByText('PAL-54120-R1-001').first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Packing Slip/i }),
    ).toBeVisible()
  })

  test('Shipping Command Center loads shipments and trailer staging', async ({
    page,
  }) => {
    await page.goto('/shipping')
    await expect(
      page.getByRole('heading', {
        name: /Shipping & Logistics Command Center/i,
      }),
    ).toBeVisible()

    // Verify seeded shipment is visible
    await expect(page.getByText('SHP-2026-0001').first()).toBeVisible()
    await expect(
      page.getByText('Flatbed Freight Express').first(),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /BOL CSV/i })).toBeVisible()
  })
})
