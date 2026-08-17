import { randomUUID } from 'node:crypto'
import { pool } from '@/db'

export type ClaimedJob = {
  id: string
  type: string
  payload: Record<string, unknown>
  attempts: number
  maxAttempts: number
}

export async function enqueueJob(
  type: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
  maxAttempts = 3,
) {
  const result = await pool.query(
    `insert into jobs (type, payload, idempotency_key, max_attempts) values ($1, $2, $3, $4)
     on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key returning *`,
    [type, payload, idempotencyKey, maxAttempts],
  )
  return result.rows[0]
}

export async function claimNextJob(
  workerId: string = randomUUID(),
): Promise<ClaimedJob | null> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await client.query(
      `select id, type, payload, attempts, max_attempts from jobs
       where status in ('queued', 'retry') and available_at <= now()
       order by available_at, created_at for update skip locked limit 1`,
    )
    if (!result.rows[0]) {
      await client.query('commit')
      return null
    }
    const job = result.rows[0]
    await client.query(
      `update jobs set status = 'running', locked_at = now(), locked_by = $2, attempts = attempts + 1, updated_at = now() where id = $1`,
      [job.id, workerId],
    )
    await client.query('commit')
    return {
      id: job.id,
      type: job.type,
      payload: job.payload,
      attempts: job.attempts + 1,
      maxAttempts: job.max_attempts,
    }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function completeJob(id: string) {
  await pool.query(
    `update jobs set status = 'succeeded', completed_at = now(), locked_at = null, locked_by = null, updated_at = now() where id = $1`,
    [id],
  )
}

export async function failJob(job: ClaimedJob, error: unknown) {
  const structuredError = {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    at: new Date().toISOString(),
  }
  const dead = job.attempts >= job.maxAttempts
  const delaySeconds = Math.min(60, 2 ** job.attempts)
  await pool.query(
    `update jobs set status = $2, last_error = $3, available_at = now() + ($4 * interval '1 second'), locked_at = null, locked_by = null, updated_at = now() where id = $1`,
    [job.id, dead ? 'dead' : 'retry', structuredError, delaySeconds],
  )
}
