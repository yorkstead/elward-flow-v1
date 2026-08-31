'use client'

import * as React from 'react'

export type Theme = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(
  undefined,
)

export const STORAGE_KEY = 'elward-flow-theme'

function subscribeToMediaQuery(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', callback)
    return () => mediaQuery.removeEventListener('change', callback)
  } else {
    mediaQuery.addListener(callback)
    return () => mediaQuery.removeListener(callback)
  }
}

function getSystemThemeSnapshot(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getSystemThemeServerSnapshot(): ResolvedTheme {
  return 'light'
}

function subscribeToStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getStoredThemeSnapshot(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const val = window.localStorage.getItem(STORAGE_KEY)
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val
    }
  } catch {
    // Ignore localStorage access errors
  }
  return null
}

export function applyTheme(resolvedTheme: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (resolvedTheme === 'dark') {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = STORAGE_KEY,
}: ThemeProviderProps) {
  const systemTheme = React.useSyncExternalStore(
    subscribeToMediaQuery,
    getSystemThemeSnapshot,
    getSystemThemeServerSnapshot,
  )

  const [themeState, setThemeState] = React.useState<Theme>(defaultTheme)

  // Sync with external storage
  const storedTheme = React.useSyncExternalStore(
    subscribeToStorage,
    getStoredThemeSnapshot,
    () => null,
  )

  // Use stored theme if available, otherwise local state
  const theme = storedTheme ?? themeState

  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? systemTheme : theme

  // Synchronize DOM with current resolved theme
  React.useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  const setTheme = React.useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme)
      try {
        window.localStorage.setItem(storageKey, newTheme)
      } catch {
        // Ignore localStorage write errors
      }
    },
    [storageKey],
  )

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextType {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export const THEME_INIT_SCRIPT = `(function(){try{var k='${STORAGE_KEY}';var s=localStorage.getItem(k);var isDark=s==='dark'||((!s||s==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var root=document.documentElement;if(isDark){root.classList.add('dark');root.style.colorScheme='dark';}else{root.classList.remove('dark');root.style.colorScheme='light';}}catch(e){}})();`
