import { test, expect, type Page } from '@playwright/test'
import { requireE2EAdminPassword } from './support/environment'

const ADMIN_EMAIL = 'admin@example.test'
const ADMIN_PASSWORD = requireE2EAdminPassword()

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

    await page.getByRole('button', { name: 'Shipped', exact: true }).click()
    // Verify seeded pallet is visible
    await expect(page.getByText('PAL-25036-R1-001').first()).toBeVisible()
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
    await expect(page.getByText('SHP-25036-001').first()).toBeVisible()
    await expect(
      page.getByText('Ellwood Dedicated Logistics (53ft Flatbed)').first(),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /BOL CSV/i })).toBeVisible()
  })
})
