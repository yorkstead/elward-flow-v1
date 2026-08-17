import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as liveGET } from '@/app/api/health/live/route'
import { GET as readyGET } from '@/app/api/health/ready/route'

const mocks = vi.hoisted(() => ({
  testDbConnection: vi.fn(),
  testStorageConnection: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  testDbConnection: mocks.testDbConnection,
}))

vi.mock('@/lib/storage', () => ({
  testStorageConnection: mocks.testStorageConnection,
}))

describe('Health API Route Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Liveness probe always returns UP and 200 status', async () => {
    const response = await liveGET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('UP')
    expect(body.uptime).toBeGreaterThanOrEqual(0)
  })

  it('Readiness probe returns UP when database and storage are healthy', async () => {
    mocks.testDbConnection.mockResolvedValue(true)
    mocks.testStorageConnection.mockResolvedValue(true)

    const response = await readyGET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('UP')
    expect(body.checks.database).toBe('healthy')
    expect(body.checks.storage).toBe('healthy')
  })

  it('Readiness probe returns DOWN and 503 status when database fails', async () => {
    mocks.testDbConnection.mockResolvedValue(false)
    mocks.testStorageConnection.mockResolvedValue(true)

    const response = await readyGET()
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.status).toBe('DOWN')
    expect(body.checks.database).toBe('unhealthy')
    expect(body.checks.storage).toBe('healthy')
  })
})
