import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { PalletPlannerService } from '@/lib/services/pallet-planner'
import { z } from 'zod'

const OverrideSchema = z.object({
  palletPlanPalletId: z.string().uuid(),
  warningCode: z.any(),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  resultingValue: z.unknown().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userContext = {
    userId: session.user.id,
    email: session.user.email || '',
    roles: session.user.roles || [],
    isAdmin: session.user.isAdmin,
    organizationId: session.user.organizationId,
  }

  try {
    const body = await req.json()
    const parsed = OverrideSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid override data', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const plan = await PalletPlannerService.overrideWarning(
      userContext,
      id,
      parsed.data,
    )
    return NextResponse.json({ plan })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to override warning'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
