import { db } from '@/db'
import {
  releases,
  productionJobs,
  releaseRevisions,
  panelMarks,
  operationDefinitions,
  operationInstances,
  workstations,
  movementEvents,
  auditEvents,
  activityEvents,
  users,
  sites,
} from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { type UserContext, hasPermission } from '@/lib/auth/roles'
import { requirePermission } from '@/lib/middleware/authorize'
import { z } from 'zod'
import { movementInputSchema } from '@/lib/scanner/movement-validation'

export type BarcodeType =
  | 'panel_mark'
  | 'release'
  | 'revision'
  | 'job'
  | 'pallet'
  | 'workstation'
  | 'inventory_item'
  | 'badge'
  | 'unknown'

export interface ParsedBarcode {
  raw: string
  type: BarcodeType
  identifier: string
  jobContext?: string
  releaseContext?: string
  markContext?: string
  params?: Record<string, string>
}

export class BarcodeEngine {
  /**
   * Parse any raw barcode, QR code string, or manual code input.
   * Standard prefixes: EF:<TYPE>:<VALUE> (e.g. EF:MARK:54120-1:P-101, EF:REL:54120-1)
   */
  static parse(input: string): ParsedBarcode {
    const raw = input.trim()

    // 1. Explicit EF Prefix format
    if (raw.startsWith('EF:') || raw.startsWith('ef:')) {
      const parts = raw.split(':')
      const typeKey = parts[1]?.toUpperCase()
      const payload = parts.slice(2).join(':')

      switch (typeKey) {
        case 'MARK': {
          // Format: EF:MARK:54120-1:P-101 or EF:MARK:<UUID> or EF:MARK:P-101
          if (parts.length >= 4) {
            const relKey = parts[2]
            const mark = parts[3]
            const [job, rel] = relKey.split('-')
            return {
              raw,
              type: 'panel_mark',
              identifier: mark,
              jobContext: job,
              releaseContext: rel,
              markContext: mark,
            }
          }
          return {
            raw,
            type: 'panel_mark',
            identifier: payload,
            markContext: payload,
          }
        }
        case 'REL': {
          // Format: EF:REL:54120-1 or EF:REL:<UUID>
          const [job, rel] = payload.split('-')
          return {
            raw,
            type: 'release',
            identifier: payload,
            jobContext: job,
            releaseContext: rel,
          }
        }
        case 'REV':
          return { raw, type: 'revision', identifier: payload }
        case 'JOB':
          return {
            raw,
            type: 'job',
            identifier: payload,
            jobContext: payload,
          }
        case 'PALLET':
          return { raw, type: 'pallet', identifier: payload }
        case 'STATION':
        case 'WORKSTATION':
        case 'LOC':
          return { raw, type: 'workstation', identifier: payload }
        case 'ITEM':
          return { raw, type: 'inventory_item', identifier: payload }
        case 'EMP':
        case 'BADGE':
          return { raw, type: 'badge', identifier: payload }
        default:
          return { raw, type: 'unknown', identifier: payload || raw }
      }
    }

    // 2. Intelligent pattern recognition fallback
    // Release Key: 54120-1
    if (/^\d{5}-\d+$/.test(raw)) {
      const [job, rel] = raw.split('-')
      return {
        raw,
        type: 'release',
        identifier: raw,
        jobContext: job,
        releaseContext: rel,
      }
    }

    // 5-Digit Job: 54120
    if (/^\d{5}$/.test(raw)) {
      return { raw, type: 'job', identifier: raw, jobContext: raw }
    }

    // Panel Mark Pattern: P-101, M-01, P101, etc.
    if (/^[a-zA-Z0-9_.-]+$/.test(raw)) {
      return {
        raw,
        type: 'panel_mark',
        identifier: raw,
        markContext: raw,
      }
    }

    return { raw, type: 'unknown', identifier: raw }
  }
}

export type MovementCondition =
  'pass' | 'pass_with_note' | 'hold' | 'rework' | 'remake' | 'scrap'

export interface PermittedAction {
  id: string
  label: string
  stage: string
  targetStatus: string
  conditionRequired?: MovementCondition
  requiresReason?: boolean
  description: string
  recommended?: boolean
  color: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'slate'
}

export interface ResolveScanResult {
  parsed: ParsedBarcode
  recordType: BarcodeType
  found: boolean
  isSuperseded: boolean
  blockingWarning?: {
    title: string
    message: string
    scannedRevisionLabel: string
    currentRevisionLabel: string
    currentRevisionId: string
    currentMarkId?: string
    directUrl: string
  }
  entity?: {
    id: string
    identifier: string
    title: string
    subtitle: string
    materialFamily?: string
    color?: string
    thickness?: string
    dimensions?: string
    totalQuantity?: number
    completedQuantity?: number
    remainingQuantity?: number
    currentStage?: string
    status: string
    jobNumber?: string
    releaseNumber?: number
    revisionLabel?: string
    activeOperationInstanceId?: string
  }
  permittedActions: PermittedAction[]
  recentMovements: Array<{
    id: string
    actorName: string
    actingRole: string
    sourceStatus: string
    destinationStatus: string
    quantity: string
    condition: string
    reason?: string | null
    notes?: string | null
    timestamp: string
    workstationName?: string | null
  }>
}

export interface ExecuteMovementInput {
  idempotencyKey: string
  recordType: BarcodeType
  recordId: string
  recordIdentifier: string
  operationInstanceId?: string
  actionId: string
  sourceStatus: string
  destinationStatus: string
  quantity: number
  unit?: string
  condition?: MovementCondition
  reason?: string
  notes?: string
  workstationId?: string
  deviceId?: string
  clientTimestamp?: string
}

export class ScannerService {
  /**
   * Resolve any scanned barcode, verify revision status, and calculate permitted shop actions.
   */
  static async resolveScan(
    actor: UserContext,
    input: {
      code: string
      workstationId?: string
      activeJobNumber?: string
      activeReleaseNumber?: number
    },
  ): Promise<ResolveScanResult> {
    requirePermission(actor, 'view', 'resolveScan')
    if (!actor.organizationId) throw new Error('Organization context required.')
    const parsed = BarcodeEngine.parse(input.code)

    // 1. Resolve Panel Mark
    if (parsed.type === 'panel_mark') {
      return this.resolvePanelMark(actor, parsed, input)
    }

    // 2. Resolve Release
    if (parsed.type === 'release') {
      return this.resolveRelease(actor, parsed)
    }

    // 3. Resolve Workstation
    if (parsed.type === 'workstation') {
      return this.resolveWorkstation(actor, parsed)
    }

    // 4. Default Not Found / Unsupported
    return {
      parsed,
      recordType: parsed.type,
      found: false,
      isSuperseded: false,
      permittedActions: [],
      recentMovements: [],
    }
  }

  private static async resolvePanelMark(
    actor: UserContext,
    parsed: ParsedBarcode,
    input: {
      activeJobNumber?: string
      activeReleaseNumber?: number
    },
  ): Promise<ResolveScanResult> {
    const markKey = parsed.identifier

    // Query matching marks with their release, revision, and job
    const candidates = await db
      .select({
        markId: panelMarks.id,
        mark: panelMarks.mark,
        description: panelMarks.description,
        quantity: panelMarks.quantity,
        materialFamily: panelMarks.materialFamily,
        color: panelMarks.color,
        thickness: panelMarks.thickness,
        width: panelMarks.width,
        length: panelMarks.length,
        dimensionUnit: panelMarks.dimensionUnit,
        revisionId: releaseRevisions.id,
        revisionLabel: releaseRevisions.revisionLabel,
        revisionNumber: releaseRevisions.revisionNumber,
        isCurrentRevision: releaseRevisions.isCurrent,
        revisionStatus: releaseRevisions.status,
        releaseId: releases.id,
        releaseNumber: releases.releaseNumber,
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
      })
      .from(panelMarks)
      .innerJoin(
        releaseRevisions,
        eq(panelMarks.releaseRevisionId, releaseRevisions.id),
      )
      .innerJoin(releases, eq(releaseRevisions.releaseId, releases.id))
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .where(
        and(
          eq(panelMarks.organizationId, actor.organizationId!),
          z.uuid().safeParse(markKey).success
            ? eq(panelMarks.id, markKey)
            : eq(panelMarks.mark, markKey),
        ),
      )

    if (!candidates || candidates.length === 0) {
      return {
        parsed,
        recordType: 'panel_mark',
        found: false,
        isSuperseded: false,
        permittedActions: [],
        recentMovements: [],
      }
    }

    // Narrow candidate if job/release context was provided
    let candidate: (typeof candidates)[number] | undefined
    if (parsed.jobContext && parsed.releaseContext) {
      const matching = candidates.filter(
        (c) =>
          c.jobNumber === parsed.jobContext &&
          c.releaseNumber === parseInt(parsed.releaseContext!, 10),
      )
      candidate = matching.length === 1 ? matching[0] : undefined
    } else if (input.activeJobNumber && input.activeReleaseNumber) {
      const matching = candidates.filter(
        (c) =>
          c.jobNumber === input.activeJobNumber &&
          c.releaseNumber === input.activeReleaseNumber,
      )
      candidate = matching.length === 1 ? matching[0] : undefined
    } else if (candidates.length === 1) candidate = candidates[0]
    if (!candidate)
      throw new Error(
        'Mark is missing or ambiguous. Scan its exact job/release identifier.',
      )

    // =========================================================================
    // BLOCKING CHECK: Is the scanned mark attached to an obsolete revision?
    // =========================================================================
    if (!candidate.isCurrentRevision) {
      // Find the CURRENT revision of this release
      const [currentRev] = await db
        .select()
        .from(releaseRevisions)
        .where(
          and(
            eq(releaseRevisions.releaseId, candidate.releaseId),
            eq(releaseRevisions.isCurrent, true),
          ),
        )
        .limit(1)

      // Find the equivalent mark in current revision if exists
      const [currentMark] = currentRev
        ? await db
            .select()
            .from(panelMarks)
            .where(
              and(
                eq(panelMarks.releaseRevisionId, currentRev.id),
                eq(panelMarks.mark, candidate.mark),
              ),
            )
            .limit(1)
        : [null]

      return {
        parsed,
        recordType: 'panel_mark',
        found: true,
        isSuperseded: true,
        blockingWarning: {
          title: 'SUPERSEDED REVISION DETECTED',
          message: `This barcode references Rev ${candidate.revisionLabel} (Job ${candidate.jobNumber}-${candidate.releaseNumber}), which has been SUPERSEDED by Rev ${currentRev ? currentRev.revisionLabel : 'Current'}. Production cannot silently proceed against obsolete revisions.`,
          scannedRevisionLabel: candidate.revisionLabel,
          currentRevisionLabel: currentRev
            ? currentRev.revisionLabel
            : 'Current',
          currentRevisionId: currentRev ? currentRev.id : '',
          currentMarkId: currentMark ? currentMark.id : undefined,
          directUrl: `/dashboard?job=${candidate.jobNumber}&release=${candidate.releaseNumber}`,
        },
        permittedActions: [],
        recentMovements: [],
      }
    }

    // =========================================================================
    // CURRENT REVISION: Fetch active operation instances and permitted actions
    // =========================================================================
    const opInstances = await db
      .select({
        instanceId: operationInstances.id,
        opDefId: operationDefinitions.id,
        opName: operationDefinitions.name,
        opCode: operationDefinitions.code,
        opDept: operationDefinitions.department,
        sequence: operationInstances.sequence,
        status: operationInstances.status,
        plannedQuantity: operationInstances.plannedQuantity,
        completedQuantity: operationInstances.completedQuantity,
        scrapQuantity: operationInstances.scrapQuantity,
        holdQuantity: operationInstances.holdQuantity,
      })
      .from(operationInstances)
      .innerJoin(
        operationDefinitions,
        eq(operationInstances.operationDefinitionId, operationDefinitions.id),
      )
      .where(eq(operationInstances.panelMarkId, candidate.markId))
      .orderBy(operationInstances.sequence)

    // Identify active operation stage
    const activeOp = opInstances.find(
      (op) => !['Completed', 'Skipped'].includes(op.status),
    )

    const totalQty = candidate.quantity
    const completedQty = activeOp ? activeOp.completedQuantity : 0
    const remainingQty = Math.max(
      0,
      (activeOp?.plannedQuantity ?? totalQty) -
        completedQty -
        (activeOp?.scrapQuantity ?? 0) -
        (activeOp?.holdQuantity ?? 0),
    )

    // Calculate permitted actions based on actor role and active operation
    const permittedActions = this.calculatePermittedActions(
      actor,
      activeOp,
      remainingQty,
    )

    // Fetch recent movement history
    const recentMovements = await this.getRecentMovements(
      'panel_mark',
      candidate.markId,
    )

    return {
      parsed,
      recordType: 'panel_mark',
      found: true,
      isSuperseded: false,
      entity: {
        id: candidate.markId,
        identifier: candidate.mark,
        title: `Mark ${candidate.mark}`,
        subtitle: `${candidate.jobNumber}-${candidate.releaseNumber} (Rev ${candidate.revisionLabel}) • ${candidate.jobName}`,
        materialFamily: candidate.materialFamily,
        color: candidate.color || undefined,
        thickness: candidate.thickness || undefined,
        dimensions:
          candidate.width && candidate.length
            ? `${candidate.width}" × ${candidate.length}"`
            : undefined,
        totalQuantity: totalQty,
        completedQuantity: completedQty,
        remainingQuantity: remainingQty,
        currentStage: activeOp ? activeOp.opName : 'Completed',
        status: activeOp ? activeOp.status : 'Completed',
        jobNumber: candidate.jobNumber,
        releaseNumber: candidate.releaseNumber,
        revisionLabel: candidate.revisionLabel,
        activeOperationInstanceId: activeOp?.instanceId,
      },
      permittedActions,
      recentMovements,
    }
  }

  private static async resolveRelease(
    actor: UserContext,
    parsed: ParsedBarcode,
  ): Promise<ResolveScanResult> {
    const key = parsed.identifier
    const [jobNum, relNumStr] = key.split('-')
    const relNum = parseInt(relNumStr, 10) || 1

    const [rel] = await db
      .select({
        releaseId: releases.id,
        releaseNumber: releases.releaseNumber,
        status: releases.status,
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
      })
      .from(releases)
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .where(
        and(
          eq(releases.organizationId, actor.organizationId!),
          eq(productionJobs.jobNumber, jobNum),
          eq(releases.releaseNumber, relNum),
        ),
      )
      .limit(1)

    if (!rel) {
      return {
        parsed,
        recordType: 'release',
        found: false,
        isSuperseded: false,
        permittedActions: [],
        recentMovements: [],
      }
    }

    const [currentRev] = await db
      .select()
      .from(releaseRevisions)
      .where(
        and(
          eq(releaseRevisions.releaseId, rel.releaseId),
          eq(releaseRevisions.isCurrent, true),
        ),
      )
      .limit(1)

    const recentMovements = await this.getRecentMovements(
      'release',
      rel.releaseId,
    )

    return {
      parsed,
      recordType: 'release',
      found: true,
      isSuperseded: false,
      entity: {
        id: rel.releaseId,
        identifier: `${rel.jobNumber}-${rel.releaseNumber}`,
        title: `Release ${rel.jobNumber}-${rel.releaseNumber}`,
        subtitle: `${rel.jobName} • Status: ${rel.status}`,
        status: rel.status,
        jobNumber: rel.jobNumber,
        releaseNumber: rel.releaseNumber,
        revisionLabel: currentRev ? currentRev.revisionLabel : 'A',
      },
      permittedActions: [
        {
          id: 'view_command_center',
          label: 'Open Release Workspace',
          stage: 'Workspace',
          targetStatus: rel.status,
          description: 'Navigate to Active Release Command Center',
          recommended: true,
          color: 'blue',
        },
      ],
      recentMovements,
    }
  }

  private static async resolveWorkstation(
    actor: UserContext,
    parsed: ParsedBarcode,
  ): Promise<ResolveScanResult> {
    const [station] = await db
      .select()
      .from(workstations)
      .where(
        and(
          eq(workstations.code, parsed.identifier),
          sql`${workstations.siteId} in (select id from ${sites} where organization_id = ${actor.organizationId})`,
        ),
      )
      .limit(1)

    if (!station) {
      return {
        parsed,
        recordType: 'workstation',
        found: false,
        isSuperseded: false,
        permittedActions: [],
        recentMovements: [],
      }
    }

    return {
      parsed,
      recordType: 'workstation',
      found: true,
      isSuperseded: false,
      entity: {
        id: station.id,
        identifier: station.code,
        title: station.name,
        subtitle: `Department: ${station.department} • Status: ${station.isActive ? 'Active' : 'Inactive'}`,
        status: station.isActive ? 'Active' : 'Inactive',
      },
      permittedActions: [
        {
          id: 'bind_station',
          label: 'Bind Workstation to Scanner',
          stage: 'Station',
          targetStatus: 'Active',
          description: `Set active workstation to ${station.name}`,
          recommended: true,
          color: 'emerald',
        },
      ],
      recentMovements: [],
    }
  }

  /**
   * Calculate permitted 2-3 tap actions based on user role and current operation stage.
   */
  private static calculatePermittedActions(
    actor: { roles: string[]; isAdmin?: boolean },
    activeOp:
      | {
          instanceId: string
          opName: string
          opCode: string
          opDept: string
          status: string
          completedQuantity: number
          plannedQuantity: number
        }
      | undefined,
    remainingQty: number,
  ): PermittedAction[] {
    const actions: PermittedAction[] = []
    if (
      !hasPermission(actor, 'edit') ||
      !activeOp ||
      ['Completed', 'Hold'].includes(activeOp.status)
    )
      return actions
    const opCode = activeOp?.opCode?.toLowerCase() || ''
    const opName = activeOp?.opName || 'Production'

    // 1. CNC Actions
    if (opCode.includes('cnc')) {
      if (activeOp?.status !== 'In progress') {
        actions.push({
          id: 'start_cnc',
          label: 'Start CNC Routing',
          stage: 'CNC',
          targetStatus: 'In progress',
          description: 'Begin CNC routing pass on table',
          recommended: true,
          color: 'blue',
        })
      }
      if (remainingQty > 0) {
        actions.push({
          id: 'complete_cnc_qty',
          label: `Complete CNC (${remainingQty} remaining)`,
          stage: 'CNC',
          targetStatus: 'Completed',
          description: 'Record cut pieces and advance to next station',
          recommended: activeOp?.status === 'In progress',
          color: 'emerald',
        })
      }
    }

    // 2. ELU Extrusion Cut Actions
    if (opCode.includes('elu')) {
      if (activeOp?.status !== 'In progress') {
        actions.push({
          id: 'start_elu',
          label: 'Start ELU Saw Cut',
          stage: 'ELU',
          targetStatus: 'In progress',
          description: 'Begin cutting aluminum extrusion profiles',
          recommended: true,
          color: 'blue',
        })
      }
      if (remainingQty > 0) {
        actions.push({
          id: 'complete_elu_qty',
          label: `Complete ELU Cut (${remainingQty} pcs)`,
          stage: 'ELU',
          targetStatus: 'Completed',
          description: 'Complete extrusion cut list schedule',
          recommended: activeOp?.status === 'In progress',
          color: 'emerald',
        })
      }
    }

    // 3. Assembly Actions
    if (opCode.includes('assembly')) {
      if (activeOp?.status !== 'In progress') {
        actions.push({
          id: 'start_assembly',
          label: 'Start Assembly',
          stage: 'Assembly',
          targetStatus: 'In progress',
          description: 'Fasten extrusions, core, and structural attachments',
          recommended: true,
          color: 'blue',
        })
      }
      if (remainingQty > 0) {
        actions.push({
          id: 'complete_assembly_qty',
          label: `Complete Assembly (${remainingQty} pcs)`,
          stage: 'Assembly',
          targetStatus: 'Completed',
          description: 'Hand off assembled panels to QC inspection',
          recommended: activeOp?.status === 'In progress',
          color: 'emerald',
        })
      }
    }

    // 4. QC Inspection Actions (Pass, Pass w/ Note, Hold, Rework, Remake, Scrap)
    if (opCode.includes('qc') && hasPermission(actor, 'approve')) {
      actions.push({
        id: 'qc_pass',
        label: 'QC Inspection Pass',
        stage: 'QC',
        targetStatus: 'Completed',
        conditionRequired: 'pass',
        description: 'Verify dimensions, finish, perimeter, and label',
        recommended: true,
        color: 'emerald',
      })
      actions.push({
        id: 'qc_pass_note',
        label: 'QC Pass with Note',
        stage: 'QC',
        targetStatus: 'Completed',
        conditionRequired: 'pass_with_note',
        requiresReason: true,
        description: 'Acceptable with minor documented shop note',
        color: 'blue',
      })
      actions.push({
        id: 'qc_hold',
        label: 'Place QC Hold',
        stage: 'QC',
        targetStatus: 'Hold',
        conditionRequired: 'hold',
        requiresReason: true,
        description: 'Block mark from palletizing pending engineering review',
        color: 'amber',
      })
      actions.push({
        id: 'qc_rework',
        label: 'Route for Rework',
        stage: 'QC',
        targetStatus: 'In progress',
        conditionRequired: 'rework',
        requiresReason: true,
        description: 'Return mark to Assembly or CNC for correction',
        color: 'purple',
      })
    }

    // 6. Generic Log Scrap (always available with mandatory reason)
    actions.push({
      id: 'log_scrap',
      label: 'Log Scrap / Remake',
      stage: opName,
      targetStatus: 'Hold',
      conditionRequired: 'scrap',
      requiresReason: true,
      description: 'Record material damage or fabrication defect',
      color: 'red',
    })

    return actions
  }

  /**
   * Execute an atomic, idempotent physical movement or stage transition.
   */
  static async executeMovement(
    actor: UserContext,
    input: ExecuteMovementInput,
  ) {
    requirePermission(actor, 'edit', 'executeMovement')
    if (!actor.organizationId) throw new Error('Organization context required.')
    const data = movementInputSchema.parse(input)
    const orgId = actor.organizationId
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${orgId + ':' + data.idempotencyKey}, 0))`,
      )
      const [existing] = await tx
        .select()
        .from(movementEvents)
        .where(
          and(
            eq(movementEvents.organizationId, orgId),
            eq(movementEvents.idempotencyKey, data.idempotencyKey),
          ),
        )
        .limit(1)
      if (existing) {
        const quantity = data.actionId.startsWith('start_') ? 0 : data.quantity
        if (
          existing.recordId !== data.recordId ||
          existing.operationInstanceId !== data.operationInstanceId ||
          Number(existing.quantity) !== quantity ||
          existing.actorId !== actor.userId ||
          existing.condition !== data.condition
        ) {
          throw new Error(
            'Idempotency key was already used for a different movement.',
          )
        }
        return {
          success: true,
          isDuplicate: true,
          movementId: existing.id,
          recordedAt: existing.serverTimestamp,
        }
      }
      const [actorUser] = await tx
        .select()
        .from(users)
        .where(and(eq(users.id, actor.userId), eq(users.organizationId, orgId)))
        .limit(1)
      if (!actorUser || actorUser.disabledAt)
        throw new Error('User is not active in this organization.')
      const [mark] = await tx
        .select()
        .from(panelMarks)
        .where(
          and(
            eq(panelMarks.id, data.recordId),
            eq(panelMarks.organizationId, orgId),
          ),
        )
        .limit(1)
      if (!mark) throw new Error('Panel mark not found in this organization.')
      const [revision] = await tx
        .select()
        .from(releaseRevisions)
        .where(
          and(
            eq(releaseRevisions.id, mark.releaseRevisionId),
            eq(releaseRevisions.organizationId, orgId),
          ),
        )
        .for('update')
      if (!revision?.isCurrent || revision.status !== 'Approved')
        throw new Error(
          'Superseded revision: scan the current revision before recording production.',
        )
      const [op] = await tx
        .select()
        .from(operationInstances)
        .where(
          and(
            eq(operationInstances.id, data.operationInstanceId),
            eq(operationInstances.organizationId, orgId),
            eq(operationInstances.panelMarkId, mark.id),
          ),
        )
        .for('update')
      if (!op) throw new Error('Operation does not belong to this panel mark.')
      if (data.sourceStatus !== op.status)
        throw new Error('Operation changed. Rescan before continuing.')
      const predecessors = await tx
        .select()
        .from(operationInstances)
        .where(
          and(
            eq(operationInstances.panelMarkId, mark.id),
            sql`${operationInstances.sequence} < ${op.sequence}`,
          ),
        )
      if (predecessors.some((p) => p.status !== 'Completed'))
        throw new Error('Complete preceding operations first.')
      const [definition] = await tx
        .select()
        .from(operationDefinitions)
        .where(eq(operationDefinitions.id, op.operationDefinitionId))
        .limit(1)
      if (!definition) throw new Error('Operation definition not found.')
      const remaining =
        op.plannedQuantity -
        op.completedQuantity -
        op.scrapQuantity -
        op.holdQuantity
      const action = this.calculatePermittedActions(
        actor,
        {
          instanceId: op.id,
          opName: definition.name,
          opCode: definition.code,
          opDept: definition.department,
          status: op.status,
          completedQuantity: op.completedQuantity,
          plannedQuantity: op.plannedQuantity,
        },
        remaining,
      ).find((a) => a.id === data.actionId)
      if (!action)
        throw new Error(
          'This action is not permitted for the current operation.',
        )
      if (
        data.destinationStatus !== action.targetStatus ||
        data.condition !== (action.conditionRequired ?? 'pass')
      )
        throw new Error('Invalid action state or condition.')
      if (
        (action.requiresReason || data.condition !== 'pass') &&
        !data.reason?.trim()
      )
        throw new Error('A reason is required for this action.')
      const starting = data.actionId.startsWith('start_')
      if (!starting && data.quantity > remaining)
        throw new Error('Quantity exceeds remaining work.')
      if (data.workstationId) {
        const [station] = await tx
          .select({ id: workstations.id })
          .from(workstations)
          .innerJoin(sites, eq(workstations.siteId, sites.id))
          .where(
            and(
              eq(workstations.id, data.workstationId),
              eq(sites.organizationId, orgId),
            ),
          )
          .limit(1)
        if (!station)
          throw new Error('Workstation does not belong to this organization.')
      }
      const passed =
        !starting && ['pass', 'pass_with_note'].includes(data.condition)
      const completed = op.completedQuantity + (passed ? data.quantity : 0)
      const scrap =
        op.scrapQuantity + (data.condition === 'scrap' ? data.quantity : 0)
      const hold =
        op.holdQuantity + (data.condition === 'hold' ? data.quantity : 0)
      const status = ['hold', 'scrap'].includes(data.condition)
        ? 'Hold'
        : completed >= op.plannedQuantity
          ? 'Completed'
          : 'In progress'
      const [updated] = await tx
        .update(operationInstances)
        .set({
          completedQuantity: completed,
          scrapQuantity: scrap,
          holdQuantity: hold,
          status,
          updatedAt: new Date(),
          version: op.version + 1,
        })
        .where(
          and(
            eq(operationInstances.id, op.id),
            eq(operationInstances.status, op.status),
            eq(operationInstances.completedQuantity, op.completedQuantity),
          ),
        )
        .returning()
      if (!updated)
        throw new Error('Operation changed. Rescan before continuing.')
      const [movement] = await tx
        .insert(movementEvents)
        .values({
          organizationId: orgId,
          actorId: actor.userId,
          actingRole: actor.roles[0] || 'Operator',
          recordType: data.recordType,
          recordId: mark.id,
          recordIdentifier: mark.mark,
          sourceStatus: op.status,
          destinationStatus: status,
          operationInstanceId: op.id,
          quantity: String(starting ? 0 : data.quantity),
          unit: data.unit,
          condition: data.condition,
          reason: data.reason,
          notes: data.notes,
          workstationId: data.workstationId,
          deviceId: data.deviceId,
          idempotencyKey: data.idempotencyKey,
          clientTimestamp: data.clientTimestamp
            ? new Date(data.clientTimestamp)
            : new Date(),
        })
        .returning()
      await tx.insert(auditEvents).values({
        organizationId: orgId,
        actorId: actor.userId,
        actingRole: actor.roles[0] || 'Operator',
        action: `SCAN_MOVEMENT_${data.actionId.toUpperCase()}`,
        resourceType: 'panel_mark',
        resourceId: mark.id,
        priorState: { status: op.status },
        newState: {
          status,
          condition: data.condition,
          actionId: data.actionId,
          requestedQuantity: data.quantity,
        },
        quantity: String(starting ? 0 : data.quantity),
        condition: data.condition,
        reason: data.reason,
        workstationId: data.workstationId,
        deviceId: data.deviceId,
        sourceRevision: revision.revisionLabel,
      })
      await tx.insert(activityEvents).values({
        organizationId: orgId,
        actorId: actor.userId,
        entityType: 'panel_mark',
        entityId: mark.id,
        actionTitle: 'Movement recorded',
        summary: `${mark.mark}: ${op.status} -> ${status}`,
      })
      return {
        success: true,
        isDuplicate: false,
        movementId: movement.id,
        recordedAt: movement.serverTimestamp,
      }
    })
  }

  private static async getRecentMovements(
    recordType: BarcodeType,
    recordId: string,
  ) {
    const results = await db
      .select({
        id: movementEvents.id,
        actingRole: movementEvents.actingRole,
        sourceStatus: movementEvents.sourceStatus,
        destinationStatus: movementEvents.destinationStatus,
        quantity: movementEvents.quantity,
        condition: movementEvents.condition,
        reason: movementEvents.reason,
        notes: movementEvents.notes,
        serverTimestamp: movementEvents.serverTimestamp,
        actorName: users.name,
        workstationName: workstations.name,
      })
      .from(movementEvents)
      .leftJoin(users, eq(movementEvents.actorId, users.id))
      .leftJoin(workstations, eq(movementEvents.workstationId, workstations.id))
      .where(
        and(
          eq(movementEvents.recordType, recordType),
          eq(movementEvents.recordId, recordId),
        ),
      )
      .orderBy(desc(movementEvents.serverTimestamp))
      .limit(10)

    return results.map((r) => ({
      id: r.id,
      actorName: r.actorName || 'Operator',
      actingRole: r.actingRole,
      sourceStatus: r.sourceStatus,
      destinationStatus: r.destinationStatus,
      quantity: r.quantity,
      condition: r.condition,
      reason: r.reason,
      notes: r.notes,
      timestamp: r.serverTimestamp.toISOString(),
      workstationName: r.workstationName,
    }))
  }
}
