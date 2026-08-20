import { auth } from '@/auth'
import { ReportsService } from '@/lib/services/reports'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const rawType = searchParams.get('type')
  const validTypes = ['yield', 'throughput', 'defects', 'scrap'] as const
  const type = validTypes.find((t) => t === rawType) || 'yield'

  try {
    const csv = await ReportsService.exportReportCsv(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      type,
    )

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="report-${type}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
