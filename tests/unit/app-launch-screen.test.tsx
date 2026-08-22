import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppLaunchScreen } from '@/components/brand/app-launch-screen'
import { APP_LAUNCH_MINIMUM_MS } from '@/components/brand/app-launch-gate'

describe('AppLaunchScreen', () => {
  it('provides a branded and accessible initial loading state', () => {
    const markup = renderToStaticMarkup(<AppLaunchScreen />)

    expect(markup).toContain('Preparing your workspace')
    expect(markup).toContain('aria-label="Elward Flow is loading"')
    expect(markup).toContain('aria-label="Elward Flow"')
    expect(markup).toContain('elward-logo-primary.png')
  })

  it('keeps a hard-launch visible long enough to feel intentional', () => {
    expect(APP_LAUNCH_MINIMUM_MS).toBe(1100)
  })
})
