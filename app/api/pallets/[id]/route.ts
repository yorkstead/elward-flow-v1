import { auth } from '@/auth'
import { PalletService } from '@/lib/services/pallet'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  try {
    const pallet = await PalletService.getPalletById(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      id,
    )

    if (!pallet) {
      return NextResponse.json({ error: 'Pallet not found' }, { status: 404 })
    }

    return NextResponse.json({ pallet })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
