import { auth } from '@/auth'
import { ShippingService } from '@/lib/services/shipping'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const dispatchSchema = z.object({
  bolNumber: z.string().optional(),
  notes: z.string().optional(),
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
    const body = await req.json().catch(() => ({}))
    const parsed = dispatchSchema.parse(body)

    const shipment = await ShippingService.dispatchShipment(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      {
        shipmentId: id,
        bolNumber: parsed.bolNumber,
        notes: parsed.notes,
      },
    )

    return NextResponse.json({ shipment })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
