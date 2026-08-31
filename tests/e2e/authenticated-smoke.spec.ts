import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { requireE2EAdminPassword } from './support/environment'
import { createHash } from 'node:crypto'
import { and, eq, like } from 'drizzle-orm'
import { db } from '@/db'
import { storedFiles, users } from '@/db/schema'
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
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
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

  // Check an actual seeded controlled drawing, not just the temporary upload.
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, process.env.ADMIN_EMAIL ?? 'admin@example.test'))
    .limit(1)
  const [drawing] = await db
    .select()
    .from(storedFiles)
    .where(
      and(
        eq(storedFiles.organizationId, user.organizationId),
        like(storedFiles.originalName, '%Cut Drawings CNC.pdf'),
      ),
    )
    .limit(1)
  expect(drawing).toBeTruthy()
  const controlled = await page.request.get(`/api/files/${drawing.id}`)
  expect(controlled.status()).toBe(200)
  expect(
    createHash('sha256')
      .update(await controlled.body())
      .digest('hex'),
  ).toBe(drawing.sha256)
})
