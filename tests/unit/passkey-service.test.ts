import { describe, it, expect } from 'vitest'
import { getPasskeyAuthenticationOptions } from '@/lib/services/passkey'
import {
  getPasskeyRelyingParty,
  requirePasskeyOrigin,
} from '@/lib/auth/passkey-challenge'

describe('Passkey security configuration', () => {
  it('uses the configured origin rather than request headers', () => {
    expect(getPasskeyRelyingParty()).toEqual({
      rpID: 'localhost',
      origin: 'http://localhost:3000',
    })
    expect(() =>
      requirePasskeyOrigin(
        new Request('http://localhost:3000', {
          headers: { origin: 'https://attacker.example' },
        }),
      ),
    ).toThrow('Invalid request origin')
  })
  it('requires user verification for passwordless authentication', async () => {
    const options = await getPasskeyAuthenticationOptions('localhost')
    expect(options.challenge).toBeTruthy()
    expect(options.userVerification).toBe('required')
  })
})
