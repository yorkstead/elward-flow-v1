import { auth } from '@/auth'
import { ReportsService } from '@/lib/services/reports'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const report = await ReportsService.getComprehensiveReport({
      userId: session.user.id,
      email: session.user.email || '',
      roles: session.user.roles || [],
      isAdmin: session.user.isAdmin,
      organizationId: session.user.organizationId,
    })

    return NextResponse.json({ report })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
