import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Shop Floor Scan Station & Movement Ledger (Prompt 05)', () => {
  test.setTimeout(60_000)
  const password = process.env.E2E_ADMIN_PASSWORD || 'Local-nb-C5pY1tqvtrLx_!'
  const email = process.env.ADMIN_EMAIL || 'admin@example.test'

  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('executes scanning, 2-3 tap movement, blocking obsolete revision modal, and movement ledger updates', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    // 1. Navigate to Scan Station via navigation
    await page.getByRole('link', { name: 'Scan Station', exact: true }).click()
    await expect(page).toHaveURL(/\/scan/)
    await expect(
      page.getByRole('heading', { name: 'Shop Floor Scan Station' }),
    ).toBeVisible()
    await expect(page.getByText('ONLINE')).toBeVisible()

    // 2. Scan Current Mark P-103, which is actively in ELU production.
    const codeInput = page.getByPlaceholder(/Scan barcode, enter mark/i)
    await codeInput.fill('P-103')
    await page.getByRole('button', { name: /Resolve Code/i }).click()

    // 3. Verify Scanned Record Card & Permitted Actions
    await expect(page.getByText('Mark P-103', { exact: true })).toBeVisible()
    await expect(page.getByText(/Current Rev/i)).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Complete ELU Cut/i }),
    ).toBeVisible()

    // 4. Execute 2-3 Tap Action: Complete ELU Quantity
    await page.getByRole('button', { name: /Complete ELU Cut/i }).click()
    await expect(
      page.getByText(/Step 2: Confirm Movement — Complete ELU Cut/i),
    ).toBeVisible()

    // Click Confirm Movement
    await page
      .getByRole('button', { name: /Confirm Movement \(1 pcs\)/i })
      .click()

    // 5. Verify High-Visibility Success Feedback & Movement Ledger Row
    await expect(
      page.getByText(/SUCCESS: Recorded 1 pcs of P-103/i),
    ).toBeVisible()
    await expect(page.getByText('Shop Floor Movement Ledger')).toBeVisible()
    await expect(
      page.getByRole('cell', { name: 'P-103' }).first(),
    ).toBeVisible()

    // 6. Test Mandatory Reason for Exception (Hold) on Mark P-102
    await codeInput.fill('P-102')
    await page.getByRole('button', { name: /Resolve Code/i }).click()
    await expect(page.getByText('Mark P-102', { exact: true })).toBeVisible()

    // Click Place QC Hold
    await page.getByRole('button', { name: /Place QC Hold/i }).click()
    await expect(
      page.getByText(/Mandatory Reason \/ Defect Rationale \*/i),
    ).toBeVisible()

    const reasonInput = page.getByPlaceholder(/State reason for hold/i)
    await reasonInput.fill('Surface scratch on anodized finish')

    await page
      .getByRole('button', { name: /Confirm Movement \(1 pcs\)/i })
      .click()

    await expect(
      page.getByText(/SUCCESS: Recorded 1 pcs of P-102/i),
    ).toBeVisible()

    // 7. Test Blocking Obsolete Revision Warning Modal
    await codeInput.fill('P-OLD')
    await page.getByRole('button', { name: /Resolve Code/i }).click()

    await expect(
      page.getByRole('heading', { name: 'SUPERSEDED REVISION DETECTED' }),
    ).toBeVisible()
    await expect(
      page.getByText('Rev PRELIM (SUPERSEDED)', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Rev A (APPROVED)', { exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: /Dismiss/i }).click()

    // 8. Accessibility Audit on Scan Station
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
    expect(accessibilityScanResults.violations).toEqual([])
  })
})
