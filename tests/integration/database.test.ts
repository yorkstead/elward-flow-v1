import { afterAll, describe, expect, it } from 'vitest'
import { pool } from '@/db'
import { enqueueJob } from '@/lib/jobs/service'
describe('database foundation', () => {
  afterAll(() => pool.end())
  it('connects to migrated PostgreSQL and enforces job idempotency', async () => {
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
