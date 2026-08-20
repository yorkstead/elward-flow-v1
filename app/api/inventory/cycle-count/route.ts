import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { InventoryService } from '@/lib/services/inventory'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, scopeZone, notes, lineId, countedQuantity, sessionId } =
      body

    if (action === 'record_line') {
      if (!lineId || countedQuantity === undefined) {
        return NextResponse.json(
          { error: 'Line ID and counted quantity are required.' },
          { status: 400 },
        )
      }
      const result = await InventoryService.recordCountLine(
        {
          userId: session.user.id,
          email: session.user.email,
          roles: session.user.roles || [],
          isAdmin: session.user.isAdmin,
        },
        {
          lineId,
          countedQuantity: parseFloat(countedQuantity),
        },
      )
      return NextResponse.json({ success: true, result })
    }

    if (action === 'reconcile') {
      if (!sessionId) {
        return NextResponse.json(
          { error: 'Session ID is required for reconciliation.' },
          { status: 400 },
        )
      }
      const result = await InventoryService.reconcileCycleCount(
        {
          userId: session.user.id,
          email: session.user.email,
          roles: session.user.roles || [],
          isAdmin: session.user.isAdmin,
        },
        {
          sessionId,
          notes,
        },
      )
      return NextResponse.json({ success: true, result })
    }

    // Default: Start new cycle count session
    const result = await InventoryService.startCycleCountSession(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        scopeZone,
        notes,
      },
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    logger.error('Cycle count operation failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process cycle count.',
      },
      { status: 500 },
    )
  }
}
