import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { PalletPlannerService } from '@/lib/services/pallet-planner'

export async function GET(
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
    const plan = await PalletPlannerService.getPlanById(userContext, id)
    if (!plan) {
      return NextResponse.json(
        { error: 'Pallet plan not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({ plan })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch pallet plan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
