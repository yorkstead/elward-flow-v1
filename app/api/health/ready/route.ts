import { pool } from '@/db'
import { getFileStore } from '@/lib/files/minio-file-store'
import { logger } from '@/lib/logger'

export async function GET() {
  const checks = { database: false, objectStorage: false }
  const errors: string[] = []
  try {
    await pool.query('select 1')
    checks.database = true
  } catch {
    errors.push('database unavailable')
  }
  try {
    await getFileStore().ensureReady()
    checks.objectStorage = true
  } catch {
    errors.push('object storage unavailable')
  }
  const ready = checks.database && checks.objectStorage
  if (!ready) logger.warn('Readiness check failed', { checks })
  return Response.json(
    {
      status: ready ? 'ready' : 'not-ready',
      checks,
      errors,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  )
}
