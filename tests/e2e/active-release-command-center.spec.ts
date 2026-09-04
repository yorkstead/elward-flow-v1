import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { requireE2EAdminPassword } from './support/environment'

test.describe('Active Release Command Center & Application Shell', () => {
  const password = requireE2EAdminPassword()
  const email = process.env.ADMIN_EMAIL || 'admin@example.test'

  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/)
    await page.goto('/dashboard?job=25036&release=1')
  })

  test('renders the pinned active release command center on desktop (1280px)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    // 1. Verify Job + Release Identification Banner
    await expect(page.getByText(/Job 25036 • Release 1/i)).toBeVisible()
    await expect(page.getByText('Key: 25036-1')).toBeVisible()
    await expect(page.getByText('Rev 1 (A)', { exact: true })).toBeVisible()
    await expect(
      page.getByText(/CURRENT — Approved for Shop Floor/i),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Tempe Gateway Commercial Center Phase II',
      }),
    ).toBeVisible()

    // 2. Verify Prominent Shop Actions Toolbar
    await expect(
      page.getByRole('link', { name: 'Scan', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Record Qty' })).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Drawings', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'CNC Files', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Toggle Hold' }),
    ).toBeVisible()

    // 3. Verify Department Progress Pipeline
    await expect(
      page.getByRole('heading', { name: 'Department Execution Pipeline' }),
    ).toBeVisible()
    await expect(page.getByText('CNC Routing').first()).toBeVisible()
    await expect(page.getByText('ELU Extrusion Cut').first()).toBeVisible()

    // 4. Verify the dashboard does not invent operational blockers
    await expect(
      page.getByText('No Active Blockers or Holds', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Extrusion Profile EX-402 Shortage'),
    ).toHaveCount(0)
    await expect(page.getByText('QC Hold on Mark P-102 (1 unit)')).toHaveCount(
      0,
    )

    // 5. Verify Panel Marks Table & Filtering
    await expect(
      page.getByRole('heading', { name: 'Panel Marks Master' }),
    ).toBeVisible()
    await expect(
      page.getByRole('cell', { name: 'P-101', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('cell', { name: 'P-102', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('cell', { name: 'P-103', exact: true }),
    ).toBeVisible()

    // Filter by P-101
    const filterInput = page.getByPlaceholder(
      'Filter marks, material, color...',
    )
    await filterInput.fill('P-101')
    await expect(
      page.getByRole('cell', { name: 'P-101', exact: true }).first(),
    ).toBeVisible()
    await expect(page.getByRole('cell', { name: 'P-102' })).not.toBeVisible()
    await filterInput.clear()

    // 6. Accessibility Audit
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('operates seamlessly on tablet viewport (768px) without horizontal scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 })

    await expect(page.getByText(/Job 25036 • Release 1/i)).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Department Execution Pipeline' }),
    ).toBeVisible()

    // Ensure no horizontal scrollbar on body
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    )
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    )
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('global search opens via button and keyboard shortcut', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    // Trigger search dialog via search button
    await page.getByRole('button', { name: 'Search records' }).click()
    await expect(
      page.getByRole('heading', { name: 'Global Search' }),
    ).toBeVisible()

    const searchInput = page.getByPlaceholder(/Search by 5-digit job/i)
    await searchInput.fill('25036')

    // Expect search results for Job 25036 and Release 25036-1 inside the dialog
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Job 25036', { exact: true })).toBeVisible()
    await expect(dialog.getByText(/Release 25036-1/)).toBeVisible()

    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('heading', { name: 'Global Search' }),
    ).not.toBeVisible()

    // Reopen via Ctrl+K
    await page.keyboard.press('Control+KeyK')
    await expect(
      page.getByRole('heading', { name: 'Global Search' }),
    ).toBeVisible()
  })
})
