import { afterAll, describe, expect, it } from 'vitest'
import { pool } from '@/db'
import { enqueueJob } from '@/lib/jobs/service'

async function isDatabaseReachable(): Promise<boolean> {
  try {
    const client = await pool.connect()
    client.release()
    return true
  } catch {
    return false
  }
}

describe('database foundation', () => {
  afterAll(async () => {
    try {
      await pool.end()
    } catch {
      // ignore
    }
  })
  it('connects to migrated PostgreSQL and enforces job idempotency', async (ctx) => {
    const reachable = await isDatabaseReachable()
    if (!reachable) {
      ctx.skip()
      return
    }
    const key = `integration-${crypto.randomUUID()}`
    const first = await enqueueJob('test.noop', { source: 'integration' }, key)
    const duplicate = await enqueueJob(
      'test.noop',
      { source: 'duplicate' },
      key,
    )
    expect(duplicate.id).toBe(first.id)
    await pool.query('delete from jobs where id = $1', [first.id])
  })
})
