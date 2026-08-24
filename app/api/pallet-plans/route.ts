import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { PalletPlannerService } from '@/lib/services/pallet-planner'
import { z } from 'zod'

const GeneratePlanSchema = z.object({
  releaseId: z.string().uuid(),
  customRules: z
    .object({
      maxWeightLbs: z.number().positive().optional(),
      targetHeightInches: z.number().positive().optional(),
      allowMaterialMixing: z.boolean().optional(),
    })
    .optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const releaseId = searchParams.get('releaseId')

  if (!releaseId) {
    return NextResponse.json(
      { error: 'Query parameter releaseId is required' },
      { status: 400 },
    )
  }

  const userContext = {
    userId: session.user.id,
    email: session.user.email || '',
    roles: session.user.roles || [],
    isAdmin: session.user.isAdmin,
    organizationId: session.user.organizationId,
  }

  try {
    const plans = await PalletPlannerService.getPlansForRelease(
      userContext,
      releaseId,
    )
    return NextResponse.json({ plans })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch pallet plans'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userContext = {
    userId: session.user.id,
    email: session.user.email || '',
    roles: session.user.roles || [],
    isAdmin: session.user.isAdmin,
    organizationId: session.user.organizationId,
  }

  try {
    const body = await req.json()
    const parsed = GeneratePlanSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const plan = await PalletPlannerService.generatePlanForRelease(
      userContext,
      parsed.data.releaseId,
      { customRules: parsed.data.customRules },
    )

    return NextResponse.json({ plan }, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate pallet plan'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
