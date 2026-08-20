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
    const { action, inventoryItemId, locationId, quantity, reason, notes } =
      body

    if (!inventoryItemId || !locationId || quantity === undefined || !reason) {
      return NextResponse.json(
        {
          error:
            'Inventory Item ID, Location ID, Quantity, and Mandatory Reason are required.',
        },
        { status: 400 },
      )
    }

    if (action === 'scrap') {
      const result = await InventoryService.scrapMaterial(
        {
          userId: session.user.id,
          email: session.user.email,
          roles: session.user.roles || [],
          isAdmin: session.user.isAdmin,
        },
        {
          inventoryItemId,
          locationId,
          quantity: parseFloat(quantity),
          reason,
          notes,
        },
      )
      return NextResponse.json({ success: true, result })
    }

    // Default: Manual Stock Adjustment
    const result = await InventoryService.adjustStock(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        inventoryItemId,
        locationId,
        quantityDelta: parseFloat(quantity),
        reason,
        notes,
      },
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    logger.error('Inventory adjustment/scrap failed', {
      error: String(error),
    })
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to adjust inventory.',
      },
      { status: 500 },
    )
  }
}
