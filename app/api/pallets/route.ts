import { auth } from '@/auth'
import { PalletService } from '@/lib/services/pallet'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createPalletSchema = z.object({
  releaseId: z.string().uuid(),
  palletNumber: z.string().optional(),
  elevation: z.string().optional(),
  maxHeightInches: z.number().positive().optional(),
  maxWeightLbs: z.number().positive().optional(),
  notes: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const releaseId = searchParams.get('releaseId') || undefined
  const status = searchParams.get('status') || undefined

  try {
    const pallets = await PalletService.getPallets(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      { releaseId, status },
    )
    return NextResponse.json({ pallets })
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
    const parsed = createPalletSchema.parse(body)

    const pallet = await PalletService.createPallet(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      parsed,
    )

    return NextResponse.json({ pallet }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
