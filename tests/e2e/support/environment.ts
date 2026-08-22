export function requireE2EAdminPassword(): string {
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!password) {
    throw new Error(
      'E2E_ADMIN_PASSWORD is required. Set it to the one-time password printed by seed.',
    )
  }
  return password
}
