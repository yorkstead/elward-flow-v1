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
    const {
      idempotencyKey,
      recordType,
      recordId,
      recordIdentifier,
      operationInstanceId,
      actionId,
      sourceStatus,
      destinationStatus,
      quantity,
      unit = 'EA',
      condition = 'pass',
      reason,
      notes,
      workstationId,
      deviceId,
      clientTimestamp,
    } = body

    if (!idempotencyKey || !recordType || !recordId || !actionId) {
      return NextResponse.json(
        { error: 'Missing required parameters for movement execution.' },
        { status: 400 },
      )
    }

    const result = await ScannerService.executeMovement(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        idempotencyKey,
        recordType,
        recordId,
        recordIdentifier: recordIdentifier || recordId,
        operationInstanceId,
        actionId,
        sourceStatus: sourceStatus || 'In progress',
        destinationStatus: destinationStatus || 'Completed',
        quantity:
          typeof quantity === 'number' ? quantity : parseFloat(quantity) || 1,
        unit,
        condition,
        reason,
        notes,
        workstationId,
        deviceId,
        clientTimestamp,
      },
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
