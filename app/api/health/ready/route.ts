import { NextResponse } from 'next/server'
import { pool } from '@/db'
import { getFileStore } from '@/lib/files/minio-file-store'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks = { database: false, storage: false }
  const errors: string[] = []

  try {
    await pool.query('select 1')
    checks.database = true
  } catch {
    errors.push('database unavailable')
  }

  try {
    await getFileStore().ensureReady()
    checks.storage = true
  } catch {
    errors.push('object storage unavailable')
  }

  const ready = checks.database && checks.storage
  if (!ready) logger.warn('Readiness check failed', { checks, errors })

  return NextResponse.json(
    {
      status: ready ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      checks: {
        database: checks.database ? 'healthy' : 'unhealthy',
        storage: checks.storage ? 'healthy' : 'unhealthy',
      },
      errors: errors.length > 0 ? errors : undefined,
    },
    { status: ready ? 200 : 503 },
  )
}
