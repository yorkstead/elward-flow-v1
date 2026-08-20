import { auth } from '@/auth'
import { ShippingService } from '@/lib/services/shipping'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const loadPalletSchema = z.object({
  palletId: z.string().uuid(),
  truckPosition: z.number().int().positive().optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  try {
    const body = await req.json()
    const parsed = loadPalletSchema.parse(body)

    const shipment = await ShippingService.stagePalletOnShipment(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      {
        shipmentId: id,
        palletId: parsed.palletId,
        truckPosition: parsed.truckPosition,
      },
    )

    return NextResponse.json({ shipment })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const shipmentPalletId = searchParams.get('shipmentPalletId')
  if (!shipmentPalletId) {
    return NextResponse.json(
      { error: 'shipmentPalletId is required' },
      { status: 400 },
    )
  }

  try {
    const shipment = await ShippingService.removePalletFromShipment(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      shipmentPalletId,
    )

    return NextResponse.json({ shipment })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
