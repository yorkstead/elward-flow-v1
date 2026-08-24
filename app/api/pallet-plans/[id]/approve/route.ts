import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { PalletPlannerService } from '@/lib/services/pallet-planner'
import { z } from 'zod'

const ApproveSchema = z.object({
  notes: z.string().optional(),
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
    let notes: string | undefined
    try {
      const body = await req.json()
      const parsed = ApproveSchema.safeParse(body)
      if (parsed.success) notes = parsed.data.notes
    } catch {
      // empty body is acceptable
    }

    const plan = await PalletPlannerService.approvePlan(userContext, id, notes)
    return NextResponse.json({ plan })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to approve pallet plan'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
