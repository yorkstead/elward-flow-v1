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
    const result = await ScannerService.executeMovement(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      body,
    )

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    logger.error('Scanner movement execution failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Movement execution failed.',
      },
      { status: 400 },
    )
  }
}
