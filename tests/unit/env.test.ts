import { describe, expect, it } from 'vitest'
import { normalizeEnvironment, getEnvironment } from '@/lib/env'

describe('Environment variable normalization', () => {
  it('treats empty strings as undefined so schema defaults apply', () => {
    const raw = {
      APP_URL: '',
      LOG_LEVEL: '',
      AUTH_SECRET: '',
      DATABASE_URL: '   ',
      ADMIN_EMAIL: '[SENSITIVE]',
    }

    const normalized = normalizeEnvironment(raw)
    expect(normalized.APP_URL).toBeUndefined()
    expect(normalized.LOG_LEVEL).toBeUndefined()
    expect(normalized.AUTH_SECRET).toBeUndefined()
    expect(normalized.DATABASE_URL).toBeUndefined()
    expect(normalized.ADMIN_EMAIL).toBeUndefined()
  })

  it('prepends https:// when APP_URL is provided without protocol', () => {
    const raw = {
      APP_URL: 'elward-flow.vercel.app',
    }

    const normalized = normalizeEnvironment(raw)
    expect(normalized.APP_URL).toBe('https://elward-flow.vercel.app')
  })

  it('derives APP_URL from VERCEL_URL when APP_URL is missing', () => {
    const raw = {
      VERCEL_URL: 'elward-flow-git-main.vercel.app',
    }

    const normalized = normalizeEnvironment(raw)
    expect(normalized.APP_URL).toBe('https://elward-flow-git-main.vercel.app')
  })

  it('normalizes uppercase LOG_LEVEL to lowercase', () => {
    const raw = {
      LOG_LEVEL: 'DEBUG',
    }

    const normalized = normalizeEnvironment(raw)
    expect(normalized.LOG_LEVEL).toBe('debug')
  })

  it('removes invalid LOG_LEVEL so default applies', () => {
    const raw = {
      LOG_LEVEL: 'verbose',
    }

    const normalized = normalizeEnvironment(raw)
    expect(normalized.LOG_LEVEL).toBeUndefined()
  })

  it('successfully returns environment object with getEnvironment()', () => {
    const env = getEnvironment()
    expect(env.NODE_ENV).toBeDefined()
    expect(env.APP_URL).toBeDefined()
    expect(env.LOG_LEVEL).toBeDefined()
  })
})
