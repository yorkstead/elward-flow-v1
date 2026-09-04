import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it('requires an explicitly configured signing secret', async () => {
  vi.resetModules()
  vi.stubEnv('AUTH_SECRET', '')
  const { getEnvironment } = await import('@/lib/env')
  expect(() => getEnvironment()).toThrow(/AUTH_SECRET/)
})
