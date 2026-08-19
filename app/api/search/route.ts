import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SearchService } from '@/lib/services/search'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''

  try {
    const results = await SearchService.search(session.user.organizationId, q)
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Search API failure:', error)
    return NextResponse.json(
      { error: 'Search failed', results: [] },
      { status: 500 },
    )
  }
}
