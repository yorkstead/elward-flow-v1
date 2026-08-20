import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ProductionService } from '@/lib/services/production'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const department = searchParams.get('department') || undefined
    const status = searchParams.get('status') || undefined
    const priority = searchParams.get('priority') || undefined

    const queue = await ProductionService.getDepartmentQueue(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      { department, status, priority },
    )

    const csvContent = ProductionService.exportScheduleCsv(queue)
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `elward-production-schedule-${department || 'all'}-${timestamp}.csv`

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error('Production CSV export failed', { error: String(error) })
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to export CSV.',
      },
      { status: 500 },
    )
  }
}
