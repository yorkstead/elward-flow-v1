import { auth } from '@/auth'
import { AdminService } from '@/lib/services/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  isAdmin: z.boolean().optional(),
  roleNames: z.array(z.string()).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const users = await AdminService.getUsers({
      userId: session.user.id,
      email: session.user.email || '',
      roles: session.user.roles || [],
      isAdmin: session.user.isAdmin,
      organizationId: session.user.organizationId,
    })
    return NextResponse.json({ users })
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
    const parsed = createUserSchema.parse(body)

    const user = await AdminService.createUser(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      parsed,
    )

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
