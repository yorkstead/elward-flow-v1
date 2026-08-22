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

test.describe('Admin RBAC and Operational Reporting Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
  })

  test('Reports Dashboard displays yield, throughput, and export button', async ({
    page,
  }) => {
    await page.goto('/reports')
    await expect(
      page.getByRole('heading', {
        name: /Operational Manufacturing Reports/i,
      }),
    ).toBeVisible()

    // Verify yield and scrap rate cards
    await expect(page.getByText('Overall Shop Yield')).toBeVisible()
    await expect(page.getByText('Total Scrap Rate')).toBeVisible()
    await expect(
      page.getByText('Station Throughput & Cycle Efficiency'),
    ).toBeVisible()
    await expect(page.getByText('Export Full Report (CSV)')).toBeVisible()
  })

  test('Admin Console navigates across users, dynamic roles, config rules, and audit trail', async ({
    page,
  }) => {
    await page.goto('/admin')
    await expect(
      page.getByRole('heading', {
        name: /System Administration & Access Control/i,
      }),
    ).toBeVisible()

    // Users tab
    await expect(page.getByText('Registered Plant Users')).toBeVisible()
    await expect(page.getByText('admin@example.test')).toBeVisible()

    // Switch to Roles tab
    await page.click('button:has-text("Dynamic Roles & Permissions")')
    await expect(
      page.getByText('Custom Role & Permission Registry'),
    ).toBeVisible()

    // Switch to Config tab
    await page.click('button:has-text("Staged Config Rules")')
    await expect(
      page.getByText('Staged Manufacturing Rules Registry'),
    ).toBeVisible()

    // Switch to Audit tab
    await page.click('button:has-text("Audit Ledger")')
    await expect(page.getByText('Immutable Audit Trail')).toBeVisible()
    await expect(page.getByText('Export Ledger (CSV)')).toBeVisible()
  })
})
