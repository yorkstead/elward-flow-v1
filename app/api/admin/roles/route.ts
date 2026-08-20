import { auth } from '@/auth'
import { AdminService } from '@/lib/services/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createRoleSchema = z.object({
  name: z.string().min(2),
  code: z.string().optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
})

const updateRoleSchema = z.object({
  roleId: z.string().uuid(),
  permissions: z.array(z.string()),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const roles = await AdminService.getRoles({
      userId: session.user.id,
      email: session.user.email || '',
      roles: session.user.roles || [],
      isAdmin: session.user.isAdmin,
      organizationId: session.user.organizationId,
    })
    return NextResponse.json({ roles })
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
    const parsed = createRoleSchema.parse(body)

    const role = await AdminService.createCustomRole(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      parsed,
    )

    return NextResponse.json({ role }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = updateRoleSchema.parse(body)

    await AdminService.updateRolePermissions(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      parsed,
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
