import { auth } from '@/auth'
import { PalletService } from '@/lib/services/pallet'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const addMarkSchema = z.object({
  panelMarkId: z.string().uuid(),
  quantity: z.number().int().positive().optional(),
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
    const parsed = addMarkSchema.parse(body)

    const pallet = await PalletService.addMarkToPallet(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      {
        palletId: id,
        panelMarkId: parsed.panelMarkId,
        quantity: parsed.quantity,
      },
    )

    return NextResponse.json({ pallet })
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
  const itemId = searchParams.get('itemId')
  if (!itemId) {
    return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
  }

  try {
    const pallet = await PalletService.removeMarkFromPallet(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      itemId,
    )

    return NextResponse.json({ pallet })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
