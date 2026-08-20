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
    const csv = await PalletService.exportPackingSlipCsv(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      id,
    )

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="packing-slip-${id}.csv"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
