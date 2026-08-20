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
    const {
      operationInstanceId,
      workstationId,
      assignedTeam,
      priority,
      machineReference,
      layoutReference,
      cartReference,
    } = body

    if (!operationInstanceId) {
      return NextResponse.json(
        { error: 'Operation instance ID is required.' },
        { status: 400 },
      )
    }

    const result = await ProductionService.assignWorkstation(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        operationInstanceId,
        workstationId,
        assignedTeam,
        priority,
        machineReference,
        layoutReference,
        cartReference,
      },
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    logger.error('Production assignment failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to assign station.',
      },
      { status: 500 },
    )
  }
}
