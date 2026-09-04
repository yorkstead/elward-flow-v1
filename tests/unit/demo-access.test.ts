import { describe, expect, it } from 'vitest'
import { isDemoAccessEnabled } from '@/lib/auth/demo-access'

describe('demo access boundary', () => {
  it('cannot be enabled in production', () => {
    expect(
      isDemoAccessEnabled({
        NODE_ENV: 'production',
        ALLOW_DEMO_SEED: 'true',
      }),
    ).toBe(false)
  })

  it('requires an explicit opt-in outside production', () => {
    expect(isDemoAccessEnabled({ NODE_ENV: 'development' })).toBe(false)
    expect(
      isDemoAccessEnabled({
        NODE_ENV: 'development',
        ALLOW_DEMO_SEED: 'true',
      }),
    ).toBe(true)
  })
})
