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
    const { action, allocationId, quantity, locationId, reason, notes } = body

    if (!allocationId || !quantity) {
      return NextResponse.json(
        { error: 'Allocation ID and quantity are required.' },
        { status: 400 },
      )
    }

    if (action === 'return') {
      if (!locationId || !reason) {
        return NextResponse.json(
          {
            error: 'Location ID and reason are required for material returns.',
          },
          { status: 400 },
        )
      }
      const result = await InventoryService.returnMaterial(
        {
          userId: session.user.id,
          email: session.user.email,
          roles: session.user.roles || [],
          isAdmin: session.user.isAdmin,
        },
        {
          allocationId,
          quantity: parseFloat(quantity),
          locationId,
          reason,
        },
      )
      return NextResponse.json({ success: true, result })
    }

    // Default: Issue Material
    const result = await InventoryService.issueMaterial(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      {
        allocationId,
        quantity: parseFloat(quantity),
        locationId,
        notes,
      },
    )

    return NextResponse.json({ success: true, result })
  } catch (error) {
    logger.error('Material issue/return failed', { error: String(error) })
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process material movement.',
      },
      { status: 500 },
    )
  }
}
