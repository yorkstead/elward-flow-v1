import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { requireE2EAdminPassword } from './support/environment'

test.describe('Production Planning & Department Execution (Prompt 06)', () => {
  test.setTimeout(60_000)
  const password = requireE2EAdminPassword()
  const email = process.env.ADMIN_EMAIL || 'admin@example.test'

  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('executes production schedule dispatch, first-off inspection, downtime logging, and printable queue generation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    // 1. Navigate to Production Planning via navigation
    await page.getByRole('link', { name: 'Production', exact: true }).click()
    await expect(page).toHaveURL(/\/production/)
    await expect(
      page.getByRole('heading', {
        name: 'Production Planning & Department Execution',
      }),
    ).toBeVisible()

    // 2. Verify Department Capacity Board Cards
    await expect(page.getByText('CNC', { exact: true }).first()).toBeVisible()
    await expect(
      page.getByText('Assembly', { exact: true }).first(),
    ).toBeVisible()

    // 3. Dispatch an operation instance
    const dispatchButtons = page.getByRole('button', { name: 'Dispatch' })
    if ((await dispatchButtons.count()) > 0) {
      await dispatchButtons.first().click()
      await expect(
        page.getByRole('heading', { name: /Dispatch & Assign/i }),
      ).toBeVisible()

      // Select Priority Rush
      const prioritySelect = page.getByLabel('Production Priority')
      if (await prioritySelect.isVisible()) {
        await prioritySelect.click()
        await page.getByRole('option', { name: 'Rush Order' }).click()
      }

      const teamInput = page.getByPlaceholder(/Team Alpha/i)
      await teamInput.fill('Team Alpha')

      await page.getByRole('button', { name: 'Save Dispatch' }).click()
      await expect(page.getByText('Team: Team Alpha').first()).toBeVisible()
    }

    // 4. Switch to Department Consoles Mode
    await page.getByRole('button', { name: /Department Consoles/i }).click()
    await expect(
      page.getByRole('heading', { name: /CNC Routing Execution Console/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: /Assembly Bay Execution & QC Handoff/i,
      }),
    ).toBeVisible()

    // 5. Inspect First-Off on CNC Console
    const inspectButtons = page.getByRole('button', {
      name: /Inspect First-Off/i,
    })
    if ((await inspectButtons.count()) > 0) {
      await inspectButtons.first().click()
      await expect(
        page.getByRole('heading', { name: /First-Off Inspection/i }),
      ).toBeVisible()

      const notesInput = page.getByPlaceholder(/Dimensions verified/i)
      await notesInput.fill('Kerf and tabs checked +0.010 in')

      await page.getByRole('button', { name: 'Save First-Off' }).click()
      await expect(
        page.getByText('Passed', { exact: true }).first(),
      ).toBeVisible()
    }

    // 6. Test Machine Downtime Stoppage & Resolution
    await page.getByRole('button', { name: /Log Machine Downtime/i }).click()
    await expect(
      page.getByRole('heading', { name: /Report Machine or Shop Downtime/i }),
    ).toBeVisible()

    const reasonInput = page.getByPlaceholder(/Spindle bearing/i)
    await reasonInput.fill('End mill tool replacement on Table 1')

    await page.getByRole('button', { name: 'Log Stoppage' }).click()

    // Verify Active Downtime listed
    await expect(
      page.getByText('End mill tool replacement on Table 1'),
    ).toBeVisible()

    // Resolve Outage
    await page.getByRole('button', { name: /Resolve Outage/i }).click()
    await expect(
      page.getByRole('heading', { name: /Restore Workstation Operation/i }),
    ).toBeVisible()

    const resNotes = page.getByPlaceholder(/Tooling replaced/i)
    await resNotes.fill('Tool changed and zeroed')

    await page.getByRole('button', { name: /Confirm Resolution/i }).click()
    await expect(
      page.getByText(
        /All shop workstations and machines are currently operational/i,
      ),
    ).toBeVisible()

    // 7. Printable Contingency Queue Dialog
    await page.getByRole('button', { name: /Master Schedule/i }).click()
    await page.getByRole('button', { name: /Print Contingency Queue/i }).click()
    await expect(
      page.getByRole('heading', {
        name: /Printable Daily Contingency Queue/i,
      }),
    ).toBeVisible()
    await expect(page.getByText('ELWARD FLOW — DAILY SHOP QUEUE')).toBeVisible()

    // 8. Accessibility Audit
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
    expect(accessibilityScanResults.violations).toEqual([])
  })
})
