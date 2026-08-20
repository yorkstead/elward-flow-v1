import { auth } from '@/auth'
import { ShippingService } from '@/lib/services/shipping'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createShipmentSchema = z.object({
  carrier: z.string().optional(),
  trailerNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  destinationAddress: z.string().optional(),
  scheduledDeparture: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || undefined

  try {
    const shipments = await ShippingService.getShipments(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      { status },
    )
    return NextResponse.json({ shipments })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = createShipmentSchema.parse(body)

    const shipment = await ShippingService.createShipment(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      parsed,
    )

    return NextResponse.json({ shipment }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
