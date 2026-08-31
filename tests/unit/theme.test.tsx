import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ThemeProvider,
  useTheme,
  applyTheme,
  THEME_INIT_SCRIPT,
  STORAGE_KEY,
} from '@/components/theme/theme-provider'
import {
  ThemeToggle,
  ThemeSegmentedControl,
} from '@/components/theme/theme-toggle'

describe('Theme System', () => {
  let localStorageMock: Record<string, string>
  let classListMock: Set<string>
  let styleMock: Record<string, string>
  let matchMediaListeners: Array<(e: { matches: boolean }) => void>
  let prefersDark = false

  beforeEach(() => {
    localStorageMock = {}
    classListMock = new Set()
    styleMock = {}
    matchMediaListeners = []
    prefersDark = false

    // Setup global window / document mocks for node test environment
    const globalAny = global as unknown as {
      window: Record<string, unknown>
      document: Record<string, unknown>
    }

    globalAny.window = {
      localStorage: {
        getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
        setItem: vi.fn((key: string, val: string) => {
          localStorageMock[key] = val
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key]
        }),
      },
      matchMedia: vi.fn((query: string) => ({
        matches: prefersDark,
        media: query,
        addEventListener: vi.fn(
          (event: string, cb: (e: { matches: boolean }) => void) => {
            if (event === 'change') matchMediaListeners.push(cb)
          },
        ),
        removeEventListener: vi.fn(
          (event: string, cb: (e: { matches: boolean }) => void) => {
            const idx = matchMediaListeners.indexOf(cb)
            if (idx !== -1) matchMediaListeners.splice(idx, 1)
          },
        ),
      })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    globalAny.document = {
      documentElement: {
        classList: {
          add: vi.fn((cls: string) => classListMock.add(cls)),
          remove: vi.fn((cls: string) => classListMock.delete(cls)),
          contains: vi.fn((cls: string) => classListMock.has(cls)),
        },
        style: styleMock,
      },
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('provides the default theme init script that handles system preference', () => {
    expect(THEME_INIT_SCRIPT).toContain(STORAGE_KEY)
    expect(THEME_INIT_SCRIPT).toContain('localStorage.getItem(k)')
    expect(THEME_INIT_SCRIPT).toContain(
      "window.matchMedia('(prefers-color-scheme: dark)').matches",
    )
    expect(THEME_INIT_SCRIPT).toContain("classList.add('dark')")
    expect(THEME_INIT_SCRIPT).toContain("classList.remove('dark')")
  })

  it('applies light and dark classes correctly to documentElement', () => {
    applyTheme('dark')
    expect(classListMock.has('dark')).toBe(true)
    expect(styleMock.colorScheme).toBe('dark')

    applyTheme('light')
    expect(classListMock.has('dark')).toBe(false)
    expect(styleMock.colorScheme).toBe('light')
  })

  it('renders ThemeToggle and ThemeSegmentedControl without crashing', () => {
    const toggleMarkup = renderToStaticMarkup(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )
    expect(toggleMarkup).toContain('Toggle theme')

    const segmentedMarkup = renderToStaticMarkup(
      <ThemeProvider>
        <ThemeSegmentedControl />
      </ThemeProvider>,
    )
    expect(segmentedMarkup).toContain('Light')
    expect(segmentedMarkup).toContain('Dark')
    expect(segmentedMarkup).toContain('System')
  })

  it('throws error when useTheme is called outside of ThemeProvider', () => {
    function ConsumerOutside() {
      useTheme()
      return null
    }

    expect(() => renderToStaticMarkup(<ConsumerOutside />)).toThrow(
      'useTheme must be used within a ThemeProvider',
    )
  })
})
