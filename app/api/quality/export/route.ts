import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { QualityService } from '@/lib/services/quality'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const disposition = searchParams.get('disposition') || undefined
    const releaseId = searchParams.get('releaseId') || undefined

    const inspections = await QualityService.getInspections(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      { disposition, releaseId },
    )

    const csvContent = QualityService.exportInspectionsCsv(inspections)
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `elward-qc-inspections-${timestamp}.csv`

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error('Quality CSV export failed', { error: String(error) })
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to export CSV.',
      },
      { status: 500 },
    )
  }
}
