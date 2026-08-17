import { hostname } from 'node:os'
import { claimNextJob, completeJob, failJob } from '@/lib/jobs/service'
import { getEnvironment } from '@/lib/env'
import { logger } from '@/lib/logger'

const workerId = `${hostname()}:${process.pid}`

async function handle(job: Awaited<ReturnType<typeof claimNextJob>>) {
  if (!job) return
  if (job.type === 'test.forced-failure')
    throw new Error('Forced failure for retry verification')
  if (job.type === 'test.noop') return
  throw new Error(`No handler registered for job type ${job.type}`)
}

async function tick() {
  const job = await claimNextJob(workerId)
  if (!job) return
  logger.info('Job claimed', {
    jobId: job.id,
    jobType: job.type,
    attempt: job.attempts,
    workerId,
  })
  try {
    await handle(job)
    await completeJob(job.id)
    logger.info('Job completed', { jobId: job.id })
  } catch (error) {
    await failJob(job, error)
    logger.error('Job failed', { jobId: job.id, attempt: job.attempts, error })
  }
}

logger.info('Worker started', { workerId })
const interval = setInterval(
  () =>
    void tick().catch((error) => logger.error('Worker tick failed', { error })),
  getEnvironment().WORKER_POLL_INTERVAL_MS,
)
void tick()
process.on('SIGTERM', () => {
  clearInterval(interval)
  void poolEnd()
})
async function poolEnd() {
  const { pool } = await import('@/db')
  await pool.end()
  process.exit(0)
}
