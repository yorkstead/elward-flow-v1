import { db } from '@/db'
import {
  operationInstances,
  operationDefinitions,
  panelMarks,
  releaseRevisions,
  releases,
  productionJobs,
  workstations,
  productionDowntimeEvents,
  auditEvents,
  activityEvents,
  documents,
  organizations,
} from '@/db/schema'
import { eq, and, sql, desc, isNull, inArray } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export interface AuthenticatedContext {
  userId: string
  email: string
  roles: string[]
  isAdmin?: boolean
  organizationId?: string
}

export type OperationInstanceStatus =
  | 'Pending'
  | 'Ready'
  | 'In progress'
  | 'Completed'
  | 'Hold'
  | 'Scrapped'

export type ProductionPriority = 'Standard' | 'Rush' | 'Remake Priority'
export type FirstOffResult =
  | 'pending'
  | 'passed'
  | 'failed'
  | 'passed_with_note'
export type DowntimeCategory =
  | 'Machine Breakdown'
  | 'Drawing Conflict'
  | 'Material Shortage'
  | 'Tooling Change'
  | 'Quality Investigation'
  | 'Other'

export interface DepartmentCapacityMetric {
  department: string
  totalPlanned: number
  inProgress: number
  ready: number
  pending: number
  hold: number
  completed: number
  scrap: number
}

export interface ProductionQueueItem {
  id: string
  sequence: number
  department: string
  operationName: string
  operationCode: string
  status: OperationInstanceStatus
  priority: ProductionPriority
  plannedQuantity: number
  completedQuantity: number
  remainingQuantity: number
  scrapQuantity: number
  holdQuantity: number
  // Panel Mark Details
  markId: string
  markCode: string
  materialFamily: string
  color: string | null
  dimensions: string | null
  // Release & Job Context
  releaseId: string
  releaseNumber: number
  releaseKey: string
  revisionId: string
  revisionLabel: string
  isCurrentRevision: boolean
  jobNumber: string
  jobName: string
  // Station & Team
  assignedWorkstationId: string | null
  assignedWorkstationName: string | null
  assignedWorkstationCode: string | null
  assignedTeam: string | null
  // Inspection & Machine References
  firstOffInspection: FirstOffResult
  firstOffNotes: string | null
  machineReference: string | null
  layoutReference: string | null
  cartReference: string | null
  startedAt: string | null
  completedAt: string | null
  // Dynamic Readiness Evaluation
  materialReady: boolean
  documentReady: boolean
  predecessorReady: boolean
  holdBlocked: boolean
  overallReady: boolean
  readinessReason: string
}

export interface AssignWorkstationInput {
  operationInstanceId: string
  workstationId?: string | null
  assignedTeam?: string | null
  priority?: ProductionPriority
  machineReference?: string | null
  layoutReference?: string | null
  cartReference?: string | null
}

export interface RecordFirstOffInput {
  operationInstanceId: string
  result: FirstOffResult
  notes?: string
}

export interface LogDowntimeInput {
  workstationId?: string | null
  department: string
  category: DowntimeCategory
  reason: string
  notes?: string
}

export interface ResolveDowntimeInput {
  downtimeId: string
  notes?: string
}

export class ProductionService {
  /**
   * Get aggregated capacity and workload metrics by department.
   */
  static async getDepartmentCapacity(
    context: AuthenticatedContext,
  ): Promise<DepartmentCapacityMetric[]> {
    const rawCounts = await db
      .select({
        department: operationDefinitions.department,
        totalPlanned: sql<number>`cast(coalesce(sum(${operationInstances.plannedQuantity}), 0) as int)`,
        completed: sql<number>`cast(coalesce(sum(${operationInstances.completedQuantity}), 0) as int)`,
        scrap: sql<number>`cast(coalesce(sum(${operationInstances.scrapQuantity}), 0) as int)`,
        hold: sql<number>`cast(coalesce(sum(${operationInstances.holdQuantity}), 0) as int)`,
      })
      .from(operationInstances)
      .innerJoin(
        operationDefinitions,
        eq(operationInstances.operationDefinitionId, operationDefinitions.id),
      )
      .where(
        eq(
          operationInstances.organizationId,
          context.organizationId || (await this.getOrgId(context)),
        ),
      )
      .groupBy(operationDefinitions.department)

    const standardDepts = ['CNC', 'ELU', 'Assembly', 'QC', 'Shipping']

    return standardDepts.map((dept) => {
      const match = rawCounts.find((r) => r.department === dept)
      return {
        department: dept,
        totalPlanned: match?.totalPlanned || 0,
        inProgress: 0,
        ready: 0,
        pending: 0,
        hold: match?.hold || 0,
        completed: match?.completed || 0,
        scrap: match?.scrap || 0,
      }
    })
  }

  /**
   * Get filterable shop floor queue with real-time readiness evaluations.
   */
  static async getDepartmentQueue(
    context: AuthenticatedContext,
    filters?: {
      department?: string
      status?: string
      jobNumber?: string
      workstationId?: string
      priority?: string
      search?: string
    },
  ): Promise<ProductionQueueItem[]> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const query = db
      .select({
        id: operationInstances.id,
        sequence: operationInstances.sequence,
        status: operationInstances.status,
        priority: operationInstances.priority,
        plannedQuantity: operationInstances.plannedQuantity,
        completedQuantity: operationInstances.completedQuantity,
        scrapQuantity: operationInstances.scrapQuantity,
        holdQuantity: operationInstances.holdQuantity,
        assignedTeam: operationInstances.assignedTeam,
        firstOffInspection: operationInstances.firstOffInspection,
        firstOffNotes: operationInstances.firstOffNotes,
        machineReference: operationInstances.machineReference,
        layoutReference: operationInstances.layoutReference,
        cartReference: operationInstances.cartReference,
        startedAt: operationInstances.startedAt,
        completedAt: operationInstances.completedAt,
        // Op Def
        department: operationDefinitions.department,
        operationName: operationDefinitions.name,
        operationCode: operationDefinitions.code,
        // Mark
        markId: panelMarks.id,
        markCode: panelMarks.mark,
        materialFamily: panelMarks.materialFamily,
        color: panelMarks.color,
        width: panelMarks.width,
        length: panelMarks.length,
        // Revision
        revisionId: releaseRevisions.id,
        revisionLabel: releaseRevisions.revisionLabel,
        isCurrentRevision: releaseRevisions.isCurrent,
        // Release
        releaseId: releases.id,
        releaseNumber: releases.releaseNumber,
        // Job
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
        // Station
        assignedWorkstationId: workstations.id,
        assignedWorkstationName: workstations.name,
        assignedWorkstationCode: workstations.code,
      })
      .from(operationInstances)
      .innerJoin(
        operationDefinitions,
        eq(operationInstances.operationDefinitionId, operationDefinitions.id),
      )
      .innerJoin(panelMarks, eq(operationInstances.panelMarkId, panelMarks.id))
      .innerJoin(
        releaseRevisions,
        eq(operationInstances.releaseRevisionId, releaseRevisions.id),
      )
      .innerJoin(releases, eq(releaseRevisions.releaseId, releases.id))
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .leftJoin(
        workstations,
        eq(operationInstances.assignedWorkstationId, workstations.id),
      )
      .where(eq(operationInstances.organizationId, orgId))
      .orderBy(operationInstances.sequence, desc(productionJobs.jobNumber))

    const rows = await query

    // Preload mark predecessor states for exact predecessor readiness calculation
    const allMarkIds = Array.from(new Set(rows.map((r) => r.markId)))
    const allInstancesForMarks =
      allMarkIds.length > 0
        ? await db
            .select({
              panelMarkId: operationInstances.panelMarkId,
              sequence: operationInstances.sequence,
              status: operationInstances.status,
            })
            .from(operationInstances)
            .where(inArray(operationInstances.panelMarkId, allMarkIds))
        : []

    // Preload documents attached to releases
    const allReleaseIds = Array.from(new Set(rows.map((r) => r.releaseId)))
    const attachedDocs =
      allReleaseIds.length > 0
        ? await db
            .select({
              releaseId: documents.releaseId,
              classificationId: documents.classificationId,
            })
            .from(documents)
            .where(inArray(documents.releaseId, allReleaseIds))
        : []

    return rows
      .map((row) => {
        const remaining = Math.max(
          0,
          row.plannedQuantity - row.completedQuantity - row.scrapQuantity,
        )

        // 1. Predecessor Readiness Check: prior operations for this mark must be Completed
        const priorOps = allInstancesForMarks.filter(
          (inst) =>
            inst.panelMarkId === row.markId && inst.sequence < row.sequence,
        )
        const predecessorReady =
          priorOps.length === 0 ||
          priorOps.every((inst) => inst.status === 'Completed')

        // 2. Document Readiness Check: release must have documents attached
        const docsForRelease = attachedDocs.filter(
          (d) => d.releaseId === row.releaseId,
        )
        const documentReady = docsForRelease.length > 0

        // 3. Material Readiness Check (Simulated / Staged)
        const materialReady = true

        // 4. Hold Check
        const holdBlocked =
          row.status === 'Hold' ||
          row.holdQuantity > 0 ||
          !row.isCurrentRevision

        // Compute overall ready
        const overallReady =
          row.isCurrentRevision &&
          predecessorReady &&
          documentReady &&
          materialReady &&
          !holdBlocked &&
          remaining > 0

        let readinessReason = 'Ready for production'
        if (!row.isCurrentRevision) {
          readinessReason = 'Blocked: Superseded revision'
        } else if (holdBlocked) {
          readinessReason = 'Blocked: Quality/Engineering hold'
        } else if (!predecessorReady) {
          readinessReason = `Waiting on upstream operation (Seq ${priorOps.find((p) => p.status !== 'Completed')?.sequence || 'prior'})`
        } else if (!documentReady) {
          readinessReason = 'Waiting on approved shop drawing packet'
        } else if (remaining === 0) {
          readinessReason = 'Operation completed'
        }

        const dims =
          row.width && row.length ? `${row.width}" × ${row.length}"` : null

        return {
          id: row.id,
          sequence: row.sequence,
          department: row.department,
          operationName: row.operationName,
          operationCode: row.operationCode,
          status: row.status as OperationInstanceStatus,
          priority: (row.priority as ProductionPriority) || 'Standard',
          plannedQuantity: row.plannedQuantity,
          completedQuantity: row.completedQuantity,
          remainingQuantity: remaining,
          scrapQuantity: row.scrapQuantity,
          holdQuantity: row.holdQuantity,
          markId: row.markId,
          markCode: row.markCode,
          materialFamily: row.materialFamily,
          color: row.color,
          dimensions: dims,
          releaseId: row.releaseId,
          releaseNumber: row.releaseNumber,
          releaseKey: `${row.jobNumber}-${row.releaseNumber}`,
          revisionId: row.revisionId,
          revisionLabel: row.revisionLabel,
          isCurrentRevision: row.isCurrentRevision,
          jobNumber: row.jobNumber,
          jobName: row.jobName,
          assignedWorkstationId: row.assignedWorkstationId,
          assignedWorkstationName: row.assignedWorkstationName,
          assignedWorkstationCode: row.assignedWorkstationCode,
          assignedTeam: row.assignedTeam,
          firstOffInspection:
            (row.firstOffInspection as FirstOffResult) || 'pending',
          firstOffNotes: row.firstOffNotes,
          machineReference: row.machineReference,
          layoutReference: row.layoutReference,
          cartReference: row.cartReference,
          startedAt: row.startedAt?.toISOString() || null,
          completedAt: row.completedAt?.toISOString() || null,
          materialReady,
          documentReady,
          predecessorReady,
          holdBlocked,
          overallReady,
          readinessReason,
        }
      })
      .filter((item) => {
        if (filters?.department && filters.department !== 'all') {
          if (
            item.department.toLowerCase() !== filters.department.toLowerCase()
          ) {
            return false
          }
        }
        if (filters?.status && filters.status !== 'all') {
          if (item.status.toLowerCase() !== filters.status.toLowerCase()) {
            return false
          }
        }
        if (filters?.priority && filters.priority !== 'all') {
          if (item.priority.toLowerCase() !== filters.priority.toLowerCase()) {
            return false
          }
        }
        if (filters?.jobNumber && item.jobNumber !== filters.jobNumber) {
          return false
        }
        if (
          filters?.workstationId &&
          item.assignedWorkstationId !== filters.workstationId
        ) {
          return false
        }
        if (filters?.search) {
          const q = filters.search.toLowerCase()
          const matches =
            item.markCode.toLowerCase().includes(q) ||
            item.jobNumber.includes(q) ||
            item.releaseKey.toLowerCase().includes(q) ||
            item.materialFamily.toLowerCase().includes(q) ||
            (item.color ? item.color.toLowerCase().includes(q) : false)
          if (!matches) return false
        }
        return true
      })
  }

  /**
   * Assign workstation, team, and priority to an operation instance.
   */
  static async assignWorkstation(
    context: AuthenticatedContext,
    input: AssignWorkstationInput,
  ): Promise<{ success: boolean; instanceId: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const [existing] = await db
      .select()
      .from(operationInstances)
      .where(
        and(
          eq(operationInstances.id, input.operationInstanceId),
          eq(operationInstances.organizationId, orgId),
        ),
      )
      .limit(1)

    if (!existing) {
      throw new Error(
        `Operation instance not found: ${input.operationInstanceId}`,
      )
    }

    await db.transaction(async (tx) => {
      await tx
        .update(operationInstances)
        .set({
          assignedWorkstationId:
            input.workstationId !== undefined
              ? input.workstationId
              : existing.assignedWorkstationId,
          assignedTeam:
            input.assignedTeam !== undefined
              ? input.assignedTeam
              : existing.assignedTeam,
          priority: input.priority || existing.priority,
          machineReference:
            input.machineReference !== undefined
              ? input.machineReference
              : existing.machineReference,
          layoutReference:
            input.layoutReference !== undefined
              ? input.layoutReference
              : existing.layoutReference,
          cartReference:
            input.cartReference !== undefined
              ? input.cartReference
              : existing.cartReference,
          updatedAt: new Date(),
        })
        .where(eq(operationInstances.id, input.operationInstanceId))

      await tx.insert(auditEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        actingRole: context.roles[0] || 'Operations Manager',
        action: 'UPDATE_ASSIGNMENT',
        resourceType: 'operation_instance',
        resourceId: input.operationInstanceId,
        priorState: {
          workstationId: existing.assignedWorkstationId,
          team: existing.assignedTeam,
          priority: existing.priority,
        },
        newState: {
          workstationId: input.workstationId,
          team: input.assignedTeam,
          priority: input.priority,
        },
        workstationId: input.workstationId || undefined,
        reason: 'Workstation / team assignment updated',
      })

      await tx.insert(activityEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        entityType: 'operation_instance',
        entityId: input.operationInstanceId,
        actionTitle: 'Workstation Dispatched',
        summary: `Assigned to ${input.assignedTeam || 'team'} with priority ${input.priority || existing.priority}.`,
      })
    })

    logger.info('Operation instance assignment updated', {
      instanceId: input.operationInstanceId,
      workstationId: input.workstationId,
      team: input.assignedTeam,
    })

    return { success: true, instanceId: input.operationInstanceId }
  }

  /**
   * Record first-off inspection result for an operation.
   */
  static async recordFirstOff(
    context: AuthenticatedContext,
    input: RecordFirstOffInput,
  ): Promise<{ success: boolean; instanceId: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const [existing] = await db
      .select()
      .from(operationInstances)
      .where(
        and(
          eq(operationInstances.id, input.operationInstanceId),
          eq(operationInstances.organizationId, orgId),
        ),
      )
      .limit(1)

    if (!existing) {
      throw new Error(
        `Operation instance not found: ${input.operationInstanceId}`,
      )
    }

    await db.transaction(async (tx) => {
      await tx
        .update(operationInstances)
        .set({
          firstOffInspection: input.result,
          firstOffNotes: input.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(operationInstances.id, input.operationInstanceId))

      await tx.insert(auditEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        actingRole: context.roles[0] || 'Quality Inspector',
        action: 'FIRST_OFF_INSPECTION',
        resourceType: 'operation_instance',
        resourceId: input.operationInstanceId,
        condition: input.result,
        reason: input.notes || `First-off inspection marked as ${input.result}`,
      })
    })

    return { success: true, instanceId: input.operationInstanceId }
  }

  /**
   * Log a new machine downtime event.
   */
  static async logDowntime(
    context: AuthenticatedContext,
    input: LogDowntimeInput,
  ): Promise<{ success: boolean; downtimeId: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const [created] = await db
      .insert(productionDowntimeEvents)
      .values({
        organizationId: orgId,
        workstationId: input.workstationId || null,
        department: input.department,
        category: input.category,
        reason: input.reason,
        notes: input.notes || null,
        reportedById: context.userId,
        startedAt: new Date(),
      })
      .returning()

    await db.insert(auditEvents).values({
      organizationId: orgId,
      actorId: context.userId,
      actingRole: context.roles[0] || 'Operator',
      action: 'DOWNTIME_LOGGED',
      resourceType: 'downtime_event',
      resourceId: created.id,
      workstationId: input.workstationId || undefined,
      reason: `${input.category}: ${input.reason}`,
    })

    return { success: true, downtimeId: created.id }
  }

  /**
   * Resolve an active downtime event and compute total duration minutes.
   */
  static async resolveDowntime(
    context: AuthenticatedContext,
    input: ResolveDowntimeInput,
  ): Promise<{
    success: boolean
    downtimeId: string
    durationMinutes: number
  }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const [existing] = await db
      .select()
      .from(productionDowntimeEvents)
      .where(
        and(
          eq(productionDowntimeEvents.id, input.downtimeId),
          eq(productionDowntimeEvents.organizationId, orgId),
        ),
      )
      .limit(1)

    if (!existing) {
      throw new Error(`Downtime event not found: ${input.downtimeId}`)
    }

    const now = new Date()
    const durationMinutes = Math.max(
      1,
      Math.round(
        (now.getTime() - new Date(existing.startedAt).getTime()) / 60000,
      ),
    )

    await db
      .update(productionDowntimeEvents)
      .set({
        resolvedAt: now,
        durationMinutes,
        resolvedById: context.userId,
        notes: input.notes
          ? `${existing.notes || ''} [Resolution: ${input.notes}]`.trim()
          : existing.notes,
        updatedAt: now,
      })
      .where(eq(productionDowntimeEvents.id, input.downtimeId))

    await db.insert(auditEvents).values({
      organizationId: orgId,
      actorId: context.userId,
      actingRole: context.roles[0] || 'Operator',
      action: 'DOWNTIME_RESOLVED',
      resourceType: 'downtime_event',
      resourceId: input.downtimeId,
      workstationId: existing.workstationId || undefined,
      reason: `Resolved after ${durationMinutes} minutes: ${input.notes || 'Normal operation restored'}`,
    })

    return { success: true, downtimeId: input.downtimeId, durationMinutes }
  }

  /**
   * Get all active (unresolved) downtime events.
   */
  static async getActiveDowntimes(context: AuthenticatedContext) {
    const orgId = context.organizationId || (await this.getOrgId(context))

    return db
      .select({
        id: productionDowntimeEvents.id,
        department: productionDowntimeEvents.department,
        category: productionDowntimeEvents.category,
        reason: productionDowntimeEvents.reason,
        notes: productionDowntimeEvents.notes,
        startedAt: productionDowntimeEvents.startedAt,
        workstationName: workstations.name,
        workstationCode: workstations.code,
      })
      .from(productionDowntimeEvents)
      .leftJoin(
        workstations,
        eq(productionDowntimeEvents.workstationId, workstations.id),
      )
      .where(
        and(
          eq(productionDowntimeEvents.organizationId, orgId),
          isNull(productionDowntimeEvents.resolvedAt),
        ),
      )
      .orderBy(desc(productionDowntimeEvents.startedAt))
  }

  /**
   * Generate clean CSV string for printable/exportable production queue.
   */
  static exportScheduleCsv(items: ProductionQueueItem[]): string {
    const headers = [
      'Job Number',
      'Release Key',
      'Mark',
      'Department',
      'Operation',
      'Status',
      'Priority',
      'Planned Qty',
      'Completed Qty',
      'Remaining Qty',
      'Material Family',
      'Color',
      'Dimensions',
      'Workstation',
      'Assigned Team',
      'First Off',
      'Readiness Reason',
    ]

    const rows = items.map((i) => [
      `"${i.jobNumber}"`,
      `"${i.releaseKey}"`,
      `"${i.markCode}"`,
      `"${i.department}"`,
      `"${i.operationName}"`,
      `"${i.status}"`,
      `"${i.priority}"`,
      i.plannedQuantity,
      i.completedQuantity,
      i.remainingQuantity,
      `"${i.materialFamily}"`,
      `"${i.color}"`,
      `"${i.dimensions || ''}"`,
      `"${i.assignedWorkstationName || ''}"`,
      `"${i.assignedTeam || ''}"`,
      `"${i.firstOffInspection}"`,
      `"${i.readinessReason}"`,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }

  private static async getOrgId(
    context: AuthenticatedContext,
  ): Promise<string> {
    if (context.organizationId) return context.organizationId
    const [res] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .limit(1)
    if (!res) throw new Error('No organization configured in database.')
    return res.id
  }
}
