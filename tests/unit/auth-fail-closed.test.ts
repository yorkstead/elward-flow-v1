import { beforeEach, describe, expect, it, vi } from 'vitest'

type RefreshSession = (input: {
  token: Record<string, unknown>
  user?: { id: string }
}) => Promise<unknown>

type Provider = {
  id: string
  authorize: (input: Record<string, unknown>) => Promise<unknown>
}
const state = vi.hoisted(() => ({
  providers: [] as Provider[],
  refresh: undefined as RefreshSession | undefined,
  select: vi.fn(),
  verify: vi.fn(),
}))
vi.mock('next-auth', () => ({
  default: (config: {
    providers: Provider[]
    callbacks: { jwt: RefreshSession }
  }) => {
    state.providers = config.providers
    state.refresh = config.callbacks.jwt
    return {}
  },
}))
vi.mock('next-auth/providers/credentials', () => ({
  default: (provider: Provider) => provider,
}))
vi.mock('@/db', () => ({ db: { select: state.select } }))
vi.mock('@/lib/auth/password', () => ({ verifyPassword: state.verify }))
vi.mock('@/lib/services/passkey', () => ({
  verifyPasskeyAuthentication: vi.fn(),
}))
vi.mock('@/lib/auth/passkey-challenge', () => ({
  consumePasskeyChallenge: vi.fn(),
  getPasskeyRelyingParty: vi.fn(),
}))
import '@/auth'

describe('Password authentication fails closed', () => {
  beforeEach(() => {
    state.select.mockReset()
    state.verify.mockReset()
  })
  const login = () =>
    state.providers
      .find((p) => p.id === 'credentials')!
      .authorize({
        email: 'owner@ellwoodflow.com',
        password: 'EllwoodOwner2026!',
      })
  function result(rows: unknown[]) {
    state.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => rows }) }),
    })
  }
  it('does not grant access to an unprovisioned former fallback identity', async () => {
    result([])
    expect(await login()).toBeNull()
  })
  it('revokes sessions for removed or disabled accounts rather than trusting embedded admin claims', async () => {
    result([])
    expect(
      await state.refresh!({
        token: { userId: crypto.randomUUID(), isAdmin: true },
      }),
    ).toBeNull()
    result([{ disabledAt: new Date() }])
    expect(
      await state.refresh!({
        token: { userId: crypto.randomUUID(), isAdmin: true },
      }),
    ).toBeNull()
  })
  it('does not bypass disabled users', async () => {
    result([{ disabledAt: new Date() }])
    expect(await login()).toBeNull()
    expect(state.verify).not.toHaveBeenCalled()
  })
  it('does not bypass the stored password hash', async () => {
    result([{ disabledAt: null, passwordHash: 'fixture-hash' }])
    state.verify.mockResolvedValue(false)
    expect(await login()).toBeNull()
  })
  it('does not create an administrator session when the database fails', async () => {
    state.select.mockImplementation(() => {
      throw new Error('synthetic database outage')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(await login()).toBeNull()
    } finally {
      warn.mockRestore()
    }
  })
})
