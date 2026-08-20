import { auth } from '@/auth'
import { AdminService } from '@/lib/services/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const proposeSchema = z.object({
  action: z.literal('propose'),
  configId: z.string().uuid(),
  proposedValue: z.unknown(),
  reason: z.string().min(5),
})

const approveSchema = z.object({
  action: z.literal('approve'),
  configId: z.string().uuid(),
  approvalNotes: z.string().min(5),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const configs = await AdminService.getSystemConfigs({
      userId: session.user.id,
      email: session.user.email || '',
      roles: session.user.roles || [],
      isAdmin: session.user.isAdmin,
      organizationId: session.user.organizationId,
    })
    return NextResponse.json({ configs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Access denied'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const context = {
      userId: session.user.id,
      email: session.user.email || '',
      roles: session.user.roles || [],
      isAdmin: session.user.isAdmin,
      organizationId: session.user.organizationId,
    }

    if (body.action === 'propose') {
      const parsed = proposeSchema.parse(body)
      await AdminService.proposeConfigChange(context, parsed)
      return NextResponse.json({ success: true })
    } else if (body.action === 'approve') {
      const parsed = approveSchema.parse(body)
      await AdminService.approveConfigChange(context, parsed)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
