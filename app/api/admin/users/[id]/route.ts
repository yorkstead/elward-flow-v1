import { auth } from '@/auth'
import { AdminService } from '@/lib/services/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().or(z.literal('')),
  isAdmin: z.boolean().optional(),
  roleNames: z.array(z.string()).optional(),
  disabled: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await props.params

  try {
    const body = await req.json()
    const parsed = updateUserSchema.parse(body)

    const updatedUser = await AdminService.updateUser(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      id,
      {
        name: parsed.name,
        email: parsed.email,
        password: parsed.password || undefined,
        isAdmin: parsed.isAdmin,
        roleNames: parsed.roleNames,
        disabled: parsed.disabled,
      },
    )

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update user'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await props.params

  try {
    const result = await AdminService.deleteUser(
      {
        userId: session.user.id,
        email: session.user.email || '',
        roles: session.user.roles || [],
        isAdmin: session.user.isAdmin,
        organizationId: session.user.organizationId,
      },
      id,
    )

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete user'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
