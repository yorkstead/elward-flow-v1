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
    const {
      purchaseOrderLineId,
      receivedQuantity,
      damagedQuantity,
      locationId,
      lotNumber,
      heatNumber,
      notes,
    } = body

    if (!purchaseOrderLineId || !locationId || receivedQuantity === undefined) {
      return NextResponse.json(
        {
          error: 'PO Line ID, location ID, and received quantity are required.',
        },
        { status: 400 },
      )
    }

    const result = await InventoryService.receivePoLine(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        purchaseOrderLineId,
        receivedQuantity: parseFloat(receivedQuantity),
        damagedQuantity: damagedQuantity ? parseFloat(damagedQuantity) : 0,
        locationId,
        lotNumber,
        heatNumber,
        notes,
      },
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    logger.error('PO receiving failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to receive material.',
      },
      { status: 500 },
    )
  }
}
