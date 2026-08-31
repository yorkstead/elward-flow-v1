import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ScannerService } from '@/lib/services/scanner'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code, workstationId, activeJobNumber, activeReleaseNumber } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code is required for scan resolution.' },
        { status: 400 },
      )
    }

    const result = await ScannerService.resolveScan(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      {
        code,
        workstationId,
        activeJobNumber,
        activeReleaseNumber,
      },
    )

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    logger.error('Scanner resolution failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Scan resolution failed.',
      },
      { status: 500 },
    )
  }
}
