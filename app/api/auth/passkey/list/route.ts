import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { passkeys, auditEvents } from '@/db/schema'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userKeys = await db
    .select({
      id: passkeys.id,
      friendlyName: passkeys.friendlyName,
      deviceType: passkeys.deviceType,
      backedUp: passkeys.backedUp,
      lastUsedAt: passkeys.lastUsedAt,
      createdAt: passkeys.createdAt,
    })
    .from(passkeys)
    .where(eq(passkeys.userId, session.user.id))

  return NextResponse.json({ passkeys: userKeys })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const keyId = searchParams.get('id')
  if (!keyId) {
    return NextResponse.json({ error: 'Missing key ID' }, { status: 400 })
  }

  const [deleted] = await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, keyId), eq(passkeys.userId, session.user.id)))
    .returning()

  if (deleted && session.user.organizationId) {
    await db.insert(auditEvents).values({
      organizationId: session.user.organizationId,
      actorId: session.user.id,
      actingRole: session.user.isAdmin ? 'System Administrator' : 'Operator',
      action: 'PASSKEY_REMOVED',
      resourceType: 'passkey',
      resourceId: deleted.id,
      reason: `Passkey removed: ${deleted.friendlyName || 'Security Key'}`,
    })
  }

  return NextResponse.json({ success: true })
}
