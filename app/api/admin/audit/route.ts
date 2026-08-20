import { auth } from '@/auth'
import { AdminService } from '@/lib/services/admin'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || undefined
  const entityType = searchParams.get('entityType') || undefined
  const exportCsv = searchParams.get('export') === 'true'

  const context = {
    userId: session.user.id,
    email: session.user.email || '',
    roles: session.user.roles || [],
    isAdmin: session.user.isAdmin,
    organizationId: session.user.organizationId,
  }

  try {
    if (exportCsv) {
      const csv = await AdminService.exportAuditCsv(context)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-ledger-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    const auditLogs = await AdminService.getAuditLedger(context, {
      action,
      entityType,
      limit: 100,
    })

    return NextResponse.json({ auditLogs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Access denied'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
