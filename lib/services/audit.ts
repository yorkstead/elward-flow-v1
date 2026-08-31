import { db } from '@/db'
import { auditEvents, activityEvents } from '@/db/schema'
import { UserContext } from '@/lib/auth/roles'
import { logger } from '@/lib/logger'

export interface AuditRecordInput {
  action: string
  entityType: string
  entityId: string
  details?: Record<string, unknown> | null
  reason?: string | null
  priorState?: string | null
  newState?: string | null
  quantity?: number | null
  condition?: string | null
  revision?: string | null
  workstationId?: string | null
  deviceId?: string | null
  ipAddress?: string | null
}

export interface ActivityRecordInput {
  action: string
  entityType: string
  entityId: string
  description: string
  actorName?: string | null
  actorRole?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Records an immutable, append-only audit event in compliance with Elward Flow constitution.
 */
export async function recordAuditEvent(
  context: UserContext,
  input: AuditRecordInput,
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<void> {
  const client = tx || db
  const orgId = context.organizationId || '00000000-0000-0000-0000-000000000001'

  try {
    await client.insert(auditEvents).values({
      organizationId: orgId,
      actorId: context.userId,
      actingRole: context.roles?.[0] ?? 'operator',
      action: input.action,
      resourceType: input.entityType,
      resourceId: input.entityId,
      priorState: input.priorState ? { state: input.priorState } : null,
      newState: input.newState
        ? { state: input.newState, details: input.details }
        : input.details
          ? input.details
          : null,
      quantity:
        input.quantity !== undefined && input.quantity !== null
          ? String(input.quantity)
          : null,
      condition: input.condition || null,
      sourceRevision: input.revision || null,
      reason: input.reason || null,
      workstationId: input.workstationId || null,
      deviceId: input.deviceId || null,
      ipAddress: input.ipAddress || null,
    })
  } catch (error) {
    if (tx) throw error
    logger.error('Failed to write audit event', {
      error,
      input,
      userId: context.userId,
    })
  }
}

/**
 * Records an activity event for real-time streams and user timelines.
 */
export async function recordActivityEvent(
  context: UserContext,
  input: ActivityRecordInput,
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<void> {
  const client = tx || db
  const orgId = context.organizationId || '00000000-0000-0000-0000-000000000001'

  try {
    await client.insert(activityEvents).values({
      organizationId: orgId,
      actorId: context.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      actionTitle: input.action,
      summary: input.description,
    })
  } catch (error) {
    if (tx) throw error
    logger.error('Failed to write activity event', {
      error,
      input,
      userId: context.userId,
    })
  }
}
