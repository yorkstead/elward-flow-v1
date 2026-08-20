import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { InventoryService } from '@/lib/services/inventory'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const materialFamily = searchParams.get('family') || undefined
    const status = searchParams.get('status') || undefined
    const reorderOnly = searchParams.get('reorder') === 'true'

    const stock = await InventoryService.getStockSummary(
      {
        userId: session.user.id,
        email: session.user.email,
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
      },
      { materialFamily, status, reorderOnly },
    )

    const csvContent = InventoryService.exportStockCsv(stock)
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `elward-inventory-ledger-${materialFamily || 'all'}-${timestamp}.csv`

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    logger.error('Inventory CSV export failed', { error: String(error) })
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to export CSV.',
      },
      { status: 500 },
    )
  }
}
