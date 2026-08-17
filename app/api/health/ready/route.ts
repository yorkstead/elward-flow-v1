import { NextResponse } from 'next/server'
import { testDbConnection } from '@/lib/db'
import { testStorageConnection } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [dbHealthy, storageHealthy] = await Promise.all([
    testDbConnection(),
    testStorageConnection(),
  ])

  const status = dbHealthy && storageHealthy ? 'UP' : 'DOWN'
  const statusCode = status === 'UP' ? 200 : 503

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        storage: storageHealthy ? 'healthy' : 'unhealthy',
      },
    },
    { status: statusCode },
  )
}
