import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FirstRunDashboard } from '@/components/domain/dashboard/first-run-dashboard'

describe('production dashboard first-run state', () => {
  it('guides an empty organization into controlled release intake', () => {
    const markup = renderToStaticMarkup(<FirstRunDashboard />)

    expect(markup).toContain('No production releases yet')
    expect(markup).toContain('Start release intake')
    expect(markup).toContain('href="/releases/intake"')
    expect(markup).not.toContain('54120')
  })
})
