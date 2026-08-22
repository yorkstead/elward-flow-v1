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
    page.getByRole('heading', {
      name: 'Tempe Gateway Commercial Center Phase II',
    }),
  ).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

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
