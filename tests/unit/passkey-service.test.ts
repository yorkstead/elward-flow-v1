import { describe, it, expect } from 'vitest'
import { resolveRpIdAndOrigin, getPasskeyAuthenticationOptions } from '@/lib/services/passkey'

describe('Passkey Service & WebAuthn Integration', () => {
  it('correctly resolves RP ID and Origin from host headers for local development', () => {
    const { rpID, origin } = resolveRpIdAndOrigin('localhost:3000', null)
    expect(rpID).toBe('localhost')
    expect(origin).toBe('http://localhost:3000')
  })

  it('correctly resolves RP ID and Origin for production domain', () => {
    const { rpID, origin } = resolveRpIdAndOrigin(
      'ellwood.yorkstead.com',
      'https://ellwood.yorkstead.com',
    )
    expect(rpID).toBe('ellwood.yorkstead.com')
    expect(origin).toBe('https://ellwood.yorkstead.com')
  })

  it('generates standard WebAuthn authentication options with challenge and preferred verification', async () => {
    const options = await getPasskeyAuthenticationOptions('ellwood.yorkstead.com')
    expect(options).toBeDefined()
    expect(options.challenge).toBeDefined()
    expect(typeof options.challenge).toBe('string')
    expect(options.rpId).toBe('ellwood.yorkstead.com')
    expect(options.userVerification).toBe('preferred')
  })
})
