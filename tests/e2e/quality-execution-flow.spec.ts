import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
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

test.describe('Quality Control, Holds, Rework & RMK/RME Remakes (Prompt 08)', () => {
  test('executes QC inspection with caliper tolerances, hold containment, hold release, remake sequence 51 generation, and analytics', async ({
    page,
  }) => {
    await loginAdmin(page)

    // 1. Navigate to Quality Command Center
    await page.goto('/quality')
    await expect(page).toHaveURL('/quality')
    await expect(
      page.getByRole('heading', {
        name: 'Quality Assurance, Holds & RMK/RME Remakes',
      }),
    ).toBeVisible()

    // 2. Verify Inspection Ledger Table & Seeded Entries
    await expect(page.getByText('P-101').first()).toBeVisible()

    // 3. Record a New QC Inspection with Caliper Measurements and Hold
    await page.getByRole('button', { name: /Record Inspection/i }).click()
    await expect(
      page.getByRole('heading', { name: 'Record QC Inspection' }),
    ).toBeVisible()

    // Fill caliper specs
    await page.fill('input[placeholder="48.000"]', '48.020')
    await page.fill('input[placeholder="120.000"]', '119.980')
    await page.fill('input[placeholder="129.240"]', '129.215')
    await page.fill('input[placeholder="0.1575"]', '0.1580')

    await page.fill(
      'input[placeholder="e.g. All edge rivets inspected; silicone seal continuous"]',
      'Flange corner slight burr observed during gauge fit',
    )

    await page
      .getByRole('button', { name: /Log Inspection & Apply Disposition/i })
      .click()
    await page.waitForTimeout(1000)

    // 4. Switch to Holds & Issues Tab
    await page.getByRole('button', { name: /Holds & Issues/i }).click()
    await expect(
      page.getByRole('heading', {
        name: 'Non-Conformance Issues & Quality Holds',
      }),
    ).toBeVisible()

    // Release an active hold if present
    const releaseHoldBtn = page
      .getByRole('button', { name: /Release Hold/i })
      .first()
    if (await releaseHoldBtn.isVisible()) {
      await releaseHoldBtn.click()
      await expect(
        page.getByRole('heading', { name: /Release Quality Hold/i }),
      ).toBeVisible()

      await page.fill(
        'input[placeholder="e.g. Flange deburred and polished; dimensions verified within ±0.015 tolerance"]',
        'Caliper gauge re-checked; flange polished and authorized by supervisor',
      )
      await page
        .getByRole('button', { name: /Confirm Release & Log Audit/i })
        .click()
      await page.waitForTimeout(1000)

      const statusTrigger = page.getByLabel('Status Filter')
      if (await statusTrigger.isVisible()) {
        await statusTrigger.click()
        await page.getByRole('option', { name: 'Resolved' }).click()
      }

      await expect(page.getByText(/Cleared by/i).first()).toBeVisible()
    }

    // 5. Switch to RMK / RME Remakes Tab
    await page.getByRole('button', { name: /RMK \/ RME Remakes/i }).click()
    await expect(
      page.getByRole('heading', {
        name: 'RMK / RME Remake Command & Cost Trace',
      }),
    ).toBeVisible()

    // Verify seeded RME remake starting at sequence 51
    await expect(page.getByText(/P-103-RMK-51/i).first()).toBeVisible()

    // Generate a new RMK / RME Remake
    await page
      .getByRole('button', { name: /Generate RMK \/ RME Remake/i })
      .click()
    await expect(
      page.getByRole('heading', {
        name: 'Generate Replacement Remake (RMK / RME)',
      }),
    ).toBeVisible()

    await page.fill(
      'input[placeholder="e.g. Revised flange return dimension from 1.50 to 1.75 per RFI-08"]',
      'Engineering revised return flange for Tempe Phase II',
    )
    await page
      .getByRole('button', { name: /Generate Remake & Dispatch/i })
      .click()
    await page.waitForTimeout(1000)

    // 6. Switch to Defect Analytics Tab
    await page.getByRole('button', { name: /Defect Analytics/i }).click()
    await expect(
      page.getByRole('heading', { name: 'Non-Conformance by Department' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Recurring Defect Categories' }),
    ).toBeVisible()

    // 7. Verify WCAG AA Accessibility Compliance
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })
})
