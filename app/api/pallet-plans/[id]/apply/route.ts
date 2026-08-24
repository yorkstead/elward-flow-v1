import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { PalletPlannerService } from '@/lib/services/pallet-planner'

export async function POST(
  _req: NextRequest,
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
    const result = await PalletPlannerService.applyPlan(userContext, id)
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to apply pallet plan'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
