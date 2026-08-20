import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ProductionService } from '@/lib/services/production'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { operationInstanceId, result, notes } = body

    if (!operationInstanceId || !result) {
      return NextResponse.json(
        { error: 'Operation instance ID and result are required.' },
        { status: 400 },
      )
    }

    const res = await ProductionService.recordFirstOff(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        operationInstanceId,
        result,
        notes,
      },
    )

    return NextResponse.json({ success: true, result: res })
  } catch (error) {
    logger.error('First-off inspection recording failed', {
      error: String(error),
    })
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to record first-off inspection.',
      },
      { status: 500 },
    )
  }
}
