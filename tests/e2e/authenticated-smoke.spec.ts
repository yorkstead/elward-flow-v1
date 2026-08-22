import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { requireE2EAdminPassword } from './support/environment'
test('redirects unauthorized users and authenticates the local administrator', async ({
  page,
}) => {
  const password = requireE2EAdminPassword()
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/sign-in/)
  await page
    .getByLabel('Email')
    .fill(process.env.ADMIN_EMAIL ?? 'admin@example.test')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(
    page.getByText('Active Command Center • Pinned Release'),
  ).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.setViewportSize({ width: 360, height: 800 })
  const viewportWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(viewportWidth.scroll).toBe(viewportWidth.client)
  await expect(
    page.getByRole('button', { name: 'Search records' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Toggle Navigation Menu' }),
  ).toBeVisible()

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByRole('link', { name: 'Storage Test' }).click()
  await page.getByLabel('Fictional PDF').setInputFiles({
    name: 'fictional-foundation-test.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% Fictional Elward Flow test only\n%%EOF'),
  })
  await page.getByRole('button', { name: 'Upload and verify' }).click()
  await expect(page.getByText('Upload verified')).toBeVisible()
  await expect(page.getByText(/SHA-256:/)).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download and verify again' }).click()
  expect((await download).suggestedFilename()).toBe(
    'fictional-foundation-test.pdf',
  )
})
