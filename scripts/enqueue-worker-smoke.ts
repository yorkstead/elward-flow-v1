import { pool } from '@/db'
import { enqueueJob } from '@/lib/jobs/service'

const key = `worker-smoke-${Date.now()}`
const job = await enqueueJob(
  'test.forced-failure',
  { reason: 'acceptance test' },
  key,
  2,
)
console.log(
  `Enqueued forced-failure job ${job.id}; run the worker and inspect retry/dead state.`,
)
await pool.end()
