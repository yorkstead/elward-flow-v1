import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Release Intake & Revision Control MVP (Prompt 04)', () => {
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

  test('executes complete release intake, classification review, and atomic publishing flow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    // 1. Navigate to Releases directory
    await page.getByRole('link', { name: 'Releases', exact: true }).click()
    await expect(page).toHaveURL(/\/releases/)
    await expect(
      page.getByRole('heading', { name: 'Production Releases Master' }),
    ).toBeVisible()

    // 2. Launch Release Intake Wizard
    await page.getByRole('link', { name: /New Release Intake/i }).click()
    await expect(page).toHaveURL(/\/releases\/intake/)
    await expect(
      page.getByRole('heading', { name: 'Release Intake & Revision Control' }),
    ).toBeVisible()

    // 3. Step 1: Upload / Load Standard Sample Release
    const jobInput = page.getByLabel(/5-Digit Job Number/i)
    await jobInput.fill('54125')

    const releaseInput = page.getByLabel(/Release Number/i)
    await releaseInput.fill('1')

    await page
      .getByRole('button', { name: 'Load Standard Sample Release' })
      .click()

    // 4. Step 2: Verify Metadata & Panel Marks
    await expect(
      page.getByRole('heading', {
        name: 'Release Metadata & Panel Marks Master',
      }),
    ).toBeVisible()
    await expect(page.getByText('Key: 54125-1 (Rev A)')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'P-101' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'P-102' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'P-103' })).toBeVisible()

    await page
      .getByRole('button', { name: /Continue to Document Control/i })
      .click()

    // 5. Step 3: Document Classification & Department Routing
    await expect(
      page.getByRole('heading', {
        name: 'Document Classification & Department Routing',
      }),
    ).toBeVisible()
    await expect(page.getByText('54120-1_CNC_Table_Layout.pdf')).toBeVisible()
    await expect(
      page.getByText('54120-1_Extrusions_ELU_Schedule.pdf'),
    ).toBeVisible()

    // Test page rotation button
    const rotateBtn = page.getByTitle('Rotate Page 90°').first()
    await rotateBtn.click()
    await expect(page.getByText('90°').first()).toBeVisible()

    await page
      .getByRole('button', { name: /Continue to Revision Impact/i })
      .click()

    // 6. Step 4: Revision Impact Analysis
    await expect(
      page.getByRole('heading', {
        name: 'Revision Impact & Downstream Dispositions',
      }),
    ).toBeVisible()
    await expect(page.getByText('Downstream Impact Check Result')).toBeVisible()

    await page
      .getByRole('button', { name: /Continue to Review & Publish/i })
      .click()

    // 7. Step 5: Final Review & Authorization
    await expect(
      page.getByRole('heading', {
        name: 'Review & Authorize Release Revision',
      }),
    ).toBeVisible()
    await expect(page.getByText('54125-1')).toBeVisible()

    // Click Approve & Publish
    await page
      .getByRole('button', { name: /Approve & Publish Revision/i })
      .click()

    // 8. Expect Redirection to Command Center for Job 54125 Release 1
    await expect(page).toHaveURL(/\/dashboard\?job=54125&release=1/)
    await expect(page.getByText(/Job 54125 • Release 1/i)).toBeVisible()
    await expect(page.getByText('Key: 54125-1')).toBeVisible()

    // 9. Accessibility Audit on Intake Screen
    await page.goto('/releases/intake')
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
    expect(accessibilityScanResults.violations).toEqual([])
  })
})
