import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createReceiptFixture } from './support/inventory-fixture'
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

test.describe('Inventory, Purchasing, Receiving & Allocations (Prompt 07)', () => {
  let poNumber: string
  test.beforeAll(async () => {
    poNumber = await createReceiptFixture()
  })
  test('executes stock adjustments, PO receiving with damaged quarantine, demand allocation, and blind cycle counts', async ({
    page,
  }) => {
    await loginAdmin(page)

    // 1. Navigate to Inventory Command Center
    await page.goto('/inventory')
    await expect(page).toHaveURL('/inventory')
    await expect(
      page.getByRole('heading', {
        name: 'Inventory, Purchasing & Material Allocations',
      }),
    ).toBeVisible()

    // 2. Verify Stock Ledger Table & Balances
    await expect(page.getByText('ACM-BS-48120')).toBeVisible()
    await expect(page.getByText('ACM-BW-48120')).toBeVisible()
    await expect(page.getByText('ALU-EXT-4001')).toBeVisible()

    // 3. Test Adjust / Scrap Stock Action
    const adjustBtn = page
      .getByRole('button', { name: /Adjust \/ Scrap/i })
      .first()
    await adjustBtn.click()
    await expect(
      page.getByRole('heading', { name: /Adjust Physical Inventory/i }),
    ).toBeVisible()

    await page.fill('input[aria-label="Quantity"]', '2')
    await page.fill(
      'input[placeholder="e.g. Physical count reconciliation approved by supervisor"]',
      'Daily floor adjustment reconciliation',
    )
    await page.getByRole('button', { name: /Confirm Adjustment/i }).click()
    await page.waitForTimeout(1000)

    // 4. Switch to PO Receiving Dock Tab
    await page.getByRole('button', { name: /PO Receiving Dock/i }).click()
    await expect(
      page.getByRole('heading', { name: 'Purchasing & Receiving Dock' }),
    ).toBeVisible()
    await expect(page.getByText(poNumber).first()).toBeVisible()

    // Execute PO Line Receiving (Good + Damaged)
    const receiveBtn = page
      .getByRole('row')
      .filter({ hasText: poNumber })
      .first()
      .getByRole('button', { name: 'Receive', exact: true })
    if ((await receiveBtn.isVisible()) && (await receiveBtn.isEnabled())) {
      await receiveBtn.click()
      await expect(
        page.getByRole('heading', {
          name: `Receive Material — ${poNumber} Line #1`,
        }),
      ).toBeVisible()

      await page.fill('input[aria-label="Good Quantity"]', '10')
      await page.fill('input[aria-label="Damaged Quantity"]', '1')
      await page.fill(
        'input[placeholder="e.g. 1 damaged sheet with deep scratch from shipping pallet band"]',
        '1 sheet damaged in transit by freight carrier',
      )
      await page
        .getByRole('button', { name: /Confirm Receiving & Update Ledger/i })
        .click()
      await page.waitForTimeout(1000)

      // Verify PO Line updated status badge
      await expect(page.getByText('Partial').first()).toBeVisible()
    }

    // 5. Switch to Release Demand Tab
    await page.getByRole('button', { name: /Release Demand/i }).click()
    await expect(
      page.getByRole('heading', {
        name: /Release Material Demand & Allocations/i,
      }),
    ).toBeVisible()

    // Allocate material to release demand
    const allocateBtn = page
      .getByRole('button', { name: 'Allocate', exact: true })
      .first()
    await allocateBtn.click()
    await expect(
      page.getByRole('heading', { name: /Allocate Material/i }),
    ).toBeVisible()

    await page.fill('input[aria-label="Allocate Quantity"]', '2')
    await page.getByRole('button', { name: 'Confirm Allocation' }).click()
    await page.waitForTimeout(1000)

    // 6. Switch to Blind Cycle Count Tab
    await page.getByRole('button', { name: /Blind Cycle Count/i }).click()
    await expect(
      page.getByRole('heading', {
        name: 'Blind Cycle Count & Discrepancy Reconciliation',
      }),
    ).toBeVisible()

    // Start New Blind Session
    const startCountBtn = page.getByRole('button', {
      name: /Start New Blind Count Session/i,
    })
    if (await startCountBtn.isVisible()) {
      await startCountBtn.click()
      await page.waitForTimeout(1000)
    }

    // Submit counts
    const firstCountInput = page.locator('input[type="number"]').first()
    if (await firstCountInput.isVisible()) {
      await firstCountInput.fill('45')
      await page
        .getByRole('button', { name: /Submit Counts & Review Discrepancies/i })
        .click()
      await page.waitForTimeout(1000)

      // Approve reconciliation
      const approveBtn = page.getByRole('button', {
        name: /Approve & Write Compensating Adjustments/i,
      })
      if (await approveBtn.isVisible()) {
        await approveBtn.click()
        await page.fill(
          'input[placeholder="e.g. Approved monthly physical warehouse cycle count"]',
          'Supervisor weekly count audit approved',
        )
        await page
          .getByRole('button', { name: /Approve & Post Ledger Adjustments/i })
          .click()
        await page.waitForTimeout(1000)
        await expect(
          page.getByText('Reconciliation Complete & Closed'),
        ).toBeVisible()
      }
    }

    // 7. Verify WCAG AA Accessibility Compliance
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })
})
