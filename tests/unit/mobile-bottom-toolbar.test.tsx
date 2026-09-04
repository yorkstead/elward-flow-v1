import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/components/domain/app-shell'
import { ThemeProvider } from '@/components/theme/theme-provider'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

describe('AppShell Mobile Bottom Navigation Bar', () => {
  it('renders fixed mobile bottom navigation with safe-area padding and core navigation links', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider>
        <AppShell
          user={{
            name: 'Jane Operator',
            email: 'jane@example.com',
            isAdmin: false,
            roles: ['Machine Operator'],
          }}
          onSignOut={async () => {}}
        >
          <div id="test-content">Production Floor Content</div>
        </AppShell>
      </ThemeProvider>,
    )

    // Check that mobile navigation exists with accessible label
    expect(html).toContain('aria-label="Mobile Quick Navigation"')

    // Check fixed viewport positioning and safe-area padding
    expect(html).toContain('fixed inset-x-0 bottom-0 z-40')
    expect(html).toContain('pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]')

    // Check main container has mobile bottom clearance
    expect(html).toContain(
      'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0',
    )

    // Check all 4 quick navigation links are present
    expect(html).toContain('href="/dashboard"')
    expect(html).toContain('Active')
    expect(html).toContain('href="/scan"')
    expect(html).toContain('Scan')
    expect(html).toContain('href="/production"')
    expect(html).toContain('Shop')
    expect(html).toContain('href="/quality"')
    expect(html).toContain('Holds')

    // Active page indicator on dashboard
    expect(html).toContain('aria-current="page"')
  })
})
