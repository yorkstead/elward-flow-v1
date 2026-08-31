import { test, expect } from '@playwright/test'
import { requireE2EAdminPassword } from './support/environment'

test('password login, passkey enrollment/sign-in, replay rejection and removal', async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  await page.goto('/sign-in')
  await page
    .getByLabel('Email')
    .fill(process.env.ADMIN_EMAIL || 'admin@example.test')
  await page
    .getByLabel('Password', { exact: true })
    .fill(requireE2EAdminPassword())
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await page.goto('/admin')
  await page
    .getByRole('button', { name: 'Passkeys & Security Keys', exact: true })
    .click()
  const keyName = `Synthetic test key ${Date.now()}`
  await page.getByLabel('Passkey / Device Name').fill(keyName)
  await page.getByRole('button', { name: 'Add Passkey', exact: true }).click()
  await expect(
    page.getByText(
      'Passkey registered successfully! You can now use it to sign in.',
    ),
  ).toBeVisible()
  await context.clearCookies()
  await page.goto('/sign-in')
  const assertionRequest = page.waitForRequest(
    (r) =>
      r.url().includes('/api/auth/callback/passkey') && r.method() === 'POST',
  )
  await page
    .getByRole('button', {
      name: 'Sign in with Passkey / Biometrics',
      exact: true,
    })
    .click()
  const captured = await assertionRequest
  await expect(page).toHaveURL(/\/dashboard/)
  const replay = await context.request.post(captured.url(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
    data: captured.postData()!,
  })
  expect((await replay.json()).url).toContain('error=CredentialsSignin')
  await page.goto('/admin')
  await page
    .getByRole('button', { name: 'Passkeys & Security Keys', exact: true })
    .click()
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: `Remove ${keyName}`, exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: `Remove ${keyName}`, exact: true }),
  ).toHaveCount(0)
  await cdp.send('WebAuthn.disable')
})

test('former embedded owner credentials no longer grant a session', async ({
  page,
}) => {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill('owner@ellwoodflow.com')
  await page.getByLabel('Password', { exact: true }).fill('EllwoodOwner2026!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(
    page.getByText('Email or password is incorrect.', { exact: true }),
  ).toBeVisible()
  const session = await page.request.get('/api/auth/session')
  expect(await session.json()).toBeNull()
})
