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
      inventoryItemId,
      releaseId,
      panelMarkId,
      quantity,
      isSubstituted,
      originalItemId,
      substitutionReason,
    } = body

    if (!inventoryItemId || !releaseId || !quantity) {
      return NextResponse.json(
        { error: 'Inventory Item ID, Release ID, and Quantity are required.' },
        { status: 400 },
      )
    }

    const result = await InventoryService.allocateMaterial(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        inventoryItemId,
        releaseId,
        panelMarkId,
        quantity: parseFloat(quantity),
        isSubstituted: Boolean(isSubstituted),
        originalItemId,
        substitutionReason,
      },
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    logger.error('Material allocation failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to allocate material.',
      },
      { status: 500 },
    )
  }
}
