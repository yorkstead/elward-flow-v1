import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QuickActionsToolbar } from '@/components/domain/release/quick-actions-toolbar'

describe('QuickActionsToolbar', () => {
  it('uses direct links for scanning and controlled drawings', () => {
    const html = renderToStaticMarkup(
      <QuickActionsToolbar
        jobNumber="12345"
        releaseNumber={2}
        userRoles={[]}
      />,
    )

    expect(html).toContain('href="/scan?job=12345&amp;release=2"')
    expect(html).toContain('href="#controlled-documents"')
    expect(html).not.toMatch(/<a[^>]*>\s*<button/)
  })
})
