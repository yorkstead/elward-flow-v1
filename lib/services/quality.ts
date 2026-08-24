import { db } from '@/db'
import {
  qualityInspections,
  qualityIssues,
  panelMarkRemakes,
  panelMarks,
  operationInstances,
  operationDefinitions,
  releases,
  productionJobs,
  users,
  auditEvents,
  activityEvents,
  organizations,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { AuthenticatedContext } from './production'

export type QualityDisposition =
  'Pass' | 'Pass with Note' | 'Hold' | 'Rework' | 'Remake' | 'Scrap'

export type QualityIssueCategory =
  | 'Surface Defect'
  | 'Dimensional Discrepancy'
  | 'Machining / Routing Error'
  | 'Hardware/Assembly Defect'
  | 'Material Flaw'
  | 'Drawing Discrepancy'
  | 'Handling Damage'
  | 'Other'

export type QualityIssueSeverity =
  'Minor' | 'Moderate' | 'Critical' | 'Blocking'

export interface QualityInspectionItem {
  id: string
  releaseId: string
  releaseKey: string
  markId: string
  markCode: string
  quantity: number
  inspectorName: string
  specificationVersion: string
  measurements: {
    width?: number
    length?: number
    diagonal?: number
    thickness?: number
    caliperDevice?: string
    notes?: string
  } | null
  disposition: QualityDisposition
  notes: string | null
  destination: string | null
  createdAt: string
}

export interface QualityIssueItem {
  id: string
  issueNumber: string
  category: QualityIssueCategory
  severity: QualityIssueSeverity
  detectionPoint: string
  suspectedCause: string | null
  responsibleDepartment: string
  ownerName: string
  dueDate: string | null
  affectedQuantity: number
  containmentAction: string | null
  disposition: string
  status: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed'
  releaseKey: string
  markCode: string
  agingDays: number
  resolutionNotes: string | null
  verifiedByName: string | null
  verifiedAt: string | null
  createdAt: string
}

export interface RemakeItem {
  id: string
  remakeType: 'RMK' | 'RME'
  remakeMark: string
  sequenceNumber: number
  originalMarkCode: string
  originalMarkId: string
  replacementMarkId: string | null
  responsibleArea: string
  materialCost: number | null
  laborHours: number | null
  laborCost: number | null
  outsideCost: number | null
  totalCost: number | null
  status: string
  createdAt: string
}

export interface RecordInspectionInput {
  releaseId: string
  panelMarkId: string
  operationInstanceId?: string
  quantity: number
  disposition: QualityDisposition
  specificationVersion?: string
  measurements?: {
    width?: number
    length?: number
    diagonal?: number
    thickness?: number
    caliperDevice?: string
    notes?: string
  }
  notes?: string
  destination?: string
  // Non-conformance fields (required if Hold, Rework, Remake, Scrap)
  issueCategory?: QualityIssueCategory
  issueSeverity?: QualityIssueSeverity
  suspectedCause?: string
  responsibleDepartment?: string
  reworkToOperationId?: string
}

export interface ReleaseQualityHoldInput {
  issueId: string
  releaseReason: string
  disposition: QualityDisposition
  notes?: string
}

export interface GenerateRemakeInput {
  originalPanelMarkId: string
  remakeType: 'RMK' | 'RME'
  qualityIssueId?: string
  responsibleArea: string
  startingSequence?: number
  materialCost?: number
  laborHours?: number
  laborCost?: number
  outsideCost?: number
  notes?: string
}

export class QualityService {
  /**
   * Get all quality inspections for a release or entire plant.
   */
  static async getInspections(
    context: AuthenticatedContext,
    filters?: { releaseId?: string; disposition?: string },
  ): Promise<QualityInspectionItem[]> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const records = await db
      .select({
        id: qualityInspections.id,
        releaseId: qualityInspections.releaseId,
        quantity: qualityInspections.quantity,
        specificationVersion: qualityInspections.specificationVersion,
        measurements: qualityInspections.measurements,
        disposition: qualityInspections.disposition,
        notes: qualityInspections.notes,
        destination: qualityInspections.destination,
        createdAt: qualityInspections.createdAt,
        markCode: panelMarks.mark,
        markId: panelMarks.id,
        inspectorName: users.name,
        jobNumber: productionJobs.jobNumber,
        releaseNumber: releases.releaseNumber,
      })
      .from(qualityInspections)
      .leftJoin(panelMarks, eq(qualityInspections.panelMarkId, panelMarks.id))
      .leftJoin(releases, eq(qualityInspections.releaseId, releases.id))
      .leftJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .leftJoin(users, eq(qualityInspections.inspectorId, users.id))
      .where(eq(qualityInspections.organizationId, orgId))
      .orderBy(desc(qualityInspections.createdAt))

    return records
      .filter((r) => {
        if (filters?.releaseId && r.releaseId !== filters.releaseId)
          return false
        if (
          filters?.disposition &&
          filters.disposition !== 'all' &&
          r.disposition.toLowerCase() !== filters.disposition.toLowerCase()
        ) {
          return false
        }
        return true
      })
      .map((r) => ({
        id: r.id,
        releaseId: r.releaseId,
        releaseKey:
          r.jobNumber && r.releaseNumber
            ? `${r.jobNumber}-${r.releaseNumber}`
            : '54120-1',
        markId: r.markId || '',
        markCode: r.markCode || 'General',
        quantity: r.quantity,
        inspectorName: r.inspectorName || 'Quality Inspector',
        specificationVersion: r.specificationVersion,
        measurements:
          (r.measurements as QualityInspectionItem['measurements']) || null,
        disposition: r.disposition as QualityDisposition,
        notes: r.notes,
        destination: r.destination,
        createdAt: new Date(r.createdAt).toLocaleString('en-US', {
          timeZone: 'America/Denver',
        }),
      }))
  }

  /**
   * Get active quality issues and holds.
   */
  static async getIssues(
    context: AuthenticatedContext,
    filters?: { status?: string; severity?: string },
  ): Promise<QualityIssueItem[]> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const records = await db
      .select({
        id: qualityIssues.id,
        issueNumber: qualityIssues.issueNumber,
        category: qualityIssues.category,
        severity: qualityIssues.severity,
        detectionPoint: qualityIssues.detectionPoint,
        suspectedCause: qualityIssues.suspectedCause,
        responsibleDepartment: qualityIssues.responsibleDepartment,
        dueDate: qualityIssues.dueDate,
        affectedQuantity: qualityIssues.affectedQuantity,
        containmentAction: qualityIssues.containmentAction,
        disposition: qualityIssues.disposition,
        status: qualityIssues.status,
        resolutionNotes: qualityIssues.resolutionNotes,
        verifiedAt: qualityIssues.verifiedAt,
        createdAt: qualityIssues.createdAt,
        ownerName: users.name,
        markCode: panelMarks.mark,
        jobNumber: productionJobs.jobNumber,
        releaseNumber: releases.releaseNumber,
      })
      .from(qualityIssues)
      .leftJoin(panelMarks, eq(qualityIssues.panelMarkId, panelMarks.id))
      .leftJoin(releases, eq(qualityIssues.releaseId, releases.id))
      .leftJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .leftJoin(users, eq(qualityIssues.ownerId, users.id))
      .where(eq(qualityIssues.organizationId, orgId))
      .orderBy(desc(qualityIssues.createdAt))

    const now = Date.now()

    return records
      .filter((r) => {
        if (
          filters?.status &&
          filters.status !== 'all' &&
          r.status.toLowerCase() !== filters.status.toLowerCase()
        ) {
          return false
        }
        if (
          filters?.severity &&
          filters.severity !== 'all' &&
          r.severity.toLowerCase() !== filters.severity.toLowerCase()
        ) {
          return false
        }
        return true
      })
      .map((r) => {
        const createdMs = new Date(r.createdAt).getTime()
        const agingDays = Math.max(
          0,
          Math.floor((now - createdMs) / (1000 * 60 * 60 * 24)),
        )

        return {
          id: r.id,
          issueNumber: r.issueNumber,
          category: r.category as QualityIssueCategory,
          severity: r.severity as QualityIssueSeverity,
          detectionPoint: r.detectionPoint,
          suspectedCause: r.suspectedCause,
          responsibleDepartment: r.responsibleDepartment,
          ownerName: r.ownerName || 'Quality Lead',
          dueDate: r.dueDate
            ? new Date(r.dueDate).toISOString().split('T')[0]
            : null,
          affectedQuantity: r.affectedQuantity,
          containmentAction: r.containmentAction,
          disposition: r.disposition,
          status: r.status as QualityIssueItem['status'],
          releaseKey:
            r.jobNumber && r.releaseNumber
              ? `${r.jobNumber}-${r.releaseNumber}`
              : '54120-1',
          markCode: r.markCode || 'Mark',
          agingDays,
          resolutionNotes: r.resolutionNotes,
          verifiedByName: 'Quality Supervisor',
          verifiedAt: r.verifiedAt
            ? new Date(r.verifiedAt).toLocaleString('en-US', {
                timeZone: 'America/Denver',
              })
            : null,
          createdAt: new Date(r.createdAt).toLocaleString('en-US', {
            timeZone: 'America/Denver',
          }),
        }
      })
  }

  /**
   * Get all RMK / RME remakes and cost tracking.
   */
  static async getRemakes(
    context: AuthenticatedContext,
  ): Promise<RemakeItem[]> {
    const orgId = context.organizationId || (await this.getOrgId(context))
    const canViewCost =
      context.isAdmin ||
      context.roles.includes('Operations Manager') ||
      context.roles.includes('System Administrator')

    const records = await db
      .select({
        id: panelMarkRemakes.id,
        remakeType: panelMarkRemakes.remakeType,
        remakeMark: panelMarkRemakes.remakeMark,
        sequenceNumber: panelMarkRemakes.sequenceNumber,
        originalMarkId: panelMarkRemakes.originalPanelMarkId,
        replacementMarkId: panelMarkRemakes.replacementPanelMarkId,
        responsibleArea: panelMarkRemakes.responsibleArea,
        materialCost: panelMarkRemakes.materialCost,
        laborHours: panelMarkRemakes.laborHours,
        laborCost: panelMarkRemakes.laborCost,
        outsideCost: panelMarkRemakes.outsideCost,
        totalCost: panelMarkRemakes.totalCost,
        status: panelMarkRemakes.status,
        createdAt: panelMarkRemakes.createdAt,
        originalMarkCode: panelMarks.mark,
      })
      .from(panelMarkRemakes)
      .leftJoin(
        panelMarks,
        eq(panelMarkRemakes.originalPanelMarkId, panelMarks.id),
      )
      .where(eq(panelMarkRemakes.organizationId, orgId))
      .orderBy(desc(panelMarkRemakes.createdAt))

    return records.map((r) => ({
      id: r.id,
      remakeType: r.remakeType as 'RMK' | 'RME',
      remakeMark: r.remakeMark,
      sequenceNumber: r.sequenceNumber,
      originalMarkCode: r.originalMarkCode || 'Original Mark',
      originalMarkId: r.originalMarkId || '',
      replacementMarkId: r.replacementMarkId,
      responsibleArea: r.responsibleArea,
      materialCost:
        canViewCost && r.materialCost ? parseFloat(r.materialCost) : null,
      laborHours: canViewCost && r.laborHours ? parseFloat(r.laborHours) : null,
      laborCost: canViewCost && r.laborCost ? parseFloat(r.laborCost) : null,
      outsideCost:
        canViewCost && r.outsideCost ? parseFloat(r.outsideCost) : null,
      totalCost: canViewCost && r.totalCost ? parseFloat(r.totalCost) : null,
      status: r.status,
      createdAt: new Date(r.createdAt).toLocaleString('en-US', {
        timeZone: 'America/Denver',
      }),
    }))
  }

  /**
   * Transact-safely record a QC inspection with disposition logic (Pass, Hold, Rework, Remake, Scrap).
   */
  static async recordInspection(
    context: AuthenticatedContext,
    input: RecordInspectionInput,
  ): Promise<{ success: boolean; inspectionId: string; issueId?: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    let createdInspectionId = ''
    let createdIssueId: string | undefined

    await db.transaction(async (tx) => {
      // 1. Insert QC Inspection Record
      const [inspection] = await tx
        .insert(qualityInspections)
        .values({
          organizationId: orgId,
          releaseId: input.releaseId,
          panelMarkId: input.panelMarkId,
          operationInstanceId: input.operationInstanceId || null,
          quantity: input.quantity,
          inspectorId: context.userId,
          specificationVersion: input.specificationVersion || 'v1.0',
          measurements: input.measurements || null,
          disposition: input.disposition,
          notes: input.notes || null,
          destination: input.destination || 'Next Route Station',
        })
        .returning()

      createdInspectionId = inspection.id

      // 2. Handle Non-Conforming Dispositions (Hold, Rework, Remake, Scrap)
      if (['Hold', 'Rework', 'Remake', 'Scrap'].includes(input.disposition)) {
        const issueNumber = `QI-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`

        const [issue] = await tx
          .insert(qualityIssues)
          .values({
            organizationId: orgId,
            issueNumber,
            category: input.issueCategory || 'Surface Defect',
            severity: input.issueSeverity || 'Moderate',
            detectionPoint: 'QC Final Inspection Station',
            suspectedCause: input.suspectedCause || 'Inspection discrepancy',
            responsibleDepartment: input.responsibleDepartment || 'Assembly',
            ownerId: context.userId,
            dueDate: new Date(Date.now() + 86400000 * 2),
            affectedQuantity: input.quantity,
            containmentAction: `Placed on ${input.disposition} in QC bay`,
            disposition: input.disposition,
            status: 'Open',
            releaseId: input.releaseId,
            panelMarkId: input.panelMarkId,
            operationInstanceId: input.operationInstanceId || null,
          })
          .returning()

        createdIssueId = issue.id

        // Update Operation Instance if present
        if (input.operationInstanceId) {
          const [op] = await tx
            .select()
            .from(operationInstances)
            .where(eq(operationInstances.id, input.operationInstanceId))
            .limit(1)

          if (op) {
            if (input.disposition === 'Hold') {
              await tx
                .update(operationInstances)
                .set({
                  holdQuantity: op.holdQuantity + input.quantity,
                  status: 'Hold',
                  notes: input.notes || 'Quality Hold Placed',
                  updatedAt: new Date(),
                })
                .where(eq(operationInstances.id, op.id))
            } else if (input.disposition === 'Scrap') {
              await tx
                .update(operationInstances)
                .set({
                  scrapQuantity: op.scrapQuantity + input.quantity,
                  notes: input.notes || 'Scrapped at QC',
                  updatedAt: new Date(),
                })
                .where(eq(operationInstances.id, op.id))
            }
          }
        }
      } else {
        // Pass or Pass with Note: Increment completed quantity
        if (input.operationInstanceId) {
          const [op] = await tx
            .select()
            .from(operationInstances)
            .where(eq(operationInstances.id, input.operationInstanceId))
            .limit(1)

          if (op) {
            const newCompleted = op.completedQuantity + input.quantity
            const isFullyCompleted = newCompleted >= op.plannedQuantity
            await tx
              .update(operationInstances)
              .set({
                completedQuantity: newCompleted,
                status: isFullyCompleted ? 'Completed' : 'In progress',
                completedAt: isFullyCompleted ? new Date() : null,
                notes: input.notes || op.notes,
                updatedAt: new Date(),
              })
              .where(eq(operationInstances.id, op.id))
          }
        }
      }

      // 3. Write Audit Event
      await tx.insert(auditEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        actingRole: context.roles[0] || 'Quality Inspector',
        action: 'RECORD_QC_INSPECTION',
        resourceType: 'quality_inspection',
        resourceId: inspection.id,
        quantity: input.quantity.toString(),
        condition: input.disposition,
        reason: `QC Inspection: ${input.disposition} (${input.notes || 'Routine check'})`,
      })

      // 4. Write Activity Stream Event
      await tx.insert(activityEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        entityType: 'qc',
        entityId: inspection.id,
        actionTitle: `QC Inspection — ${input.disposition}`,
        summary: `Inspected ${input.quantity} unit(s) with disposition: ${input.disposition}.`,
      })
    })

    return {
      success: true,
      inspectionId: createdInspectionId,
      issueId: createdIssueId,
    }
  }

  /**
   * Release a quality hold with mandatory supervisor reason and audit event.
   */
  static async releaseQualityHold(
    context: AuthenticatedContext,
    input: ReleaseQualityHoldInput,
  ): Promise<{ success: boolean; issueId: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    if (!input.releaseReason?.trim()) {
      throw new Error(
        'Mandatory release reason is required to release quality holds.',
      )
    }

    const [issue] = await db
      .select()
      .from(qualityIssues)
      .where(
        and(
          eq(qualityIssues.id, input.issueId),
          eq(qualityIssues.organizationId, orgId),
        ),
      )
      .limit(1)

    if (!issue) {
      throw new Error(`Quality issue not found: ${input.issueId}`)
    }

    await db.transaction(async (tx) => {
      // 1. Resolve Quality Issue
      await tx
        .update(qualityIssues)
        .set({
          status: 'Resolved',
          disposition: input.disposition,
          resolutionNotes: input.releaseReason.trim(),
          verifiedById: context.userId,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(qualityIssues.id, issue.id))

      // 2. Unblock Operation Instance
      if (issue.operationInstanceId) {
        const [op] = await tx
          .select()
          .from(operationInstances)
          .where(eq(operationInstances.id, issue.operationInstanceId))
          .limit(1)

        if (op) {
          const newHold = Math.max(0, op.holdQuantity - issue.affectedQuantity)
          const newCompleted =
            input.disposition === 'Pass' ||
            input.disposition === 'Pass with Note'
              ? op.completedQuantity + issue.affectedQuantity
              : op.completedQuantity

          await tx
            .update(operationInstances)
            .set({
              holdQuantity: newHold,
              completedQuantity: newCompleted,
              status:
                newHold > 0
                  ? 'Hold'
                  : newCompleted >= op.plannedQuantity
                    ? 'Completed'
                    : 'In progress',
              notes: `Hold released: ${input.releaseReason}`,
              updatedAt: new Date(),
            })
            .where(eq(operationInstances.id, op.id))
        }
      }

      // 3. Write Audit Event
      await tx.insert(auditEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        actingRole: context.roles[0] || 'Quality Supervisor',
        action: 'RELEASE_QUALITY_HOLD',
        resourceType: 'quality_issue',
        resourceId: issue.id,
        quantity: issue.affectedQuantity.toString(),
        condition: input.disposition,
        reason: input.releaseReason.trim(),
      })
    })

    return { success: true, issueId: issue.id }
  }

  /**
   * Generate an RMK / RME remake beginning at configurable sequence 51.
   */
  static async generateRemake(
    context: AuthenticatedContext,
    input: GenerateRemakeInput,
  ): Promise<{ success: boolean; remakeId: string; remakeMark: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const [originalMark] = await db
      .select()
      .from(panelMarks)
      .where(
        and(
          eq(panelMarks.id, input.originalPanelMarkId),
          eq(panelMarks.organizationId, orgId),
        ),
      )
      .limit(1)

    if (!originalMark) {
      throw new Error(
        `Original panel mark not found: ${input.originalPanelMarkId}`,
      )
    }

    // 1. Calculate next sequence starting at 51
    const existingRemakes = await db
      .select({ sequenceNumber: panelMarkRemakes.sequenceNumber })
      .from(panelMarkRemakes)
      .where(
        and(
          eq(panelMarkRemakes.organizationId, orgId),
          eq(panelMarkRemakes.originalPanelMarkId, originalMark.id),
          eq(panelMarkRemakes.remakeType, input.remakeType),
        ),
      )

    const baseSeq = input.startingSequence || 51
    const maxSeq = existingRemakes.reduce(
      (max, r) => Math.max(max, r.sequenceNumber),
      baseSeq - 1,
    )
    const nextSeq = maxSeq + 1

    const remakeMarkLabel = `${originalMark.mark}-${input.remakeType}-${nextSeq}`

    let createdRemakeId = ''

    await db.transaction(async (tx) => {
      // 2. Create Replacement Panel Mark
      const [replacementMark] = await tx
        .insert(panelMarks)
        .values({
          organizationId: orgId,
          releaseRevisionId: originalMark.releaseRevisionId,
          mark: remakeMarkLabel,
          description: `Remake replacement for ${originalMark.mark}`,
          quantity: 1,
          materialFamily: originalMark.materialFamily,
          color: originalMark.color,
          thickness: originalMark.thickness,
          width: originalMark.width,
          length: originalMark.length,
          dimensionUnit: originalMark.dimensionUnit,
          isRemake: true,
          originalMarkId: originalMark.id,
          remakeType: input.remakeType,
          remakeSequence: nextSeq,
          notes: input.notes || `Generated ${input.remakeType} remake`,
        })
        .returning()

      // 3. Create High-Priority Routing Operation Instances
      const opDefs = await tx
        .select()
        .from(operationDefinitions)
        .where(eq(operationDefinitions.organizationId, orgId))

      const cncDef = opDefs.find((d) => d.code === 'CNC')
      if (cncDef) {
        await tx.insert(operationInstances).values({
          organizationId: orgId,
          releaseRevisionId: originalMark.releaseRevisionId,
          panelMarkId: replacementMark.id,
          operationDefinitionId: cncDef.id,
          sequence: 10,
          status: 'Ready',
          priority: 'Remake Priority',
          plannedQuantity: 1,
          completedQuantity: 0,
          notes: `High Priority Remake — ${input.responsibleArea}`,
        })
      }

      // 4. Calculate Costs
      const matCost = input.materialCost || 145.0
      const labHours = input.laborHours || 1.5
      const labCost = input.laborCost || 67.5
      const outCost = input.outsideCost || 0.0
      const totalCost = matCost + labCost + outCost

      // 5. Insert Remake Record
      const [remake] = await tx
        .insert(panelMarkRemakes)
        .values({
          organizationId: orgId,
          remakeType: input.remakeType,
          remakeMark: remakeMarkLabel,
          sequenceNumber: nextSeq,
          originalPanelMarkId: originalMark.id,
          replacementPanelMarkId: replacementMark.id,
          qualityIssueId: input.qualityIssueId || null,
          responsibleArea: input.responsibleArea,
          materialCost: matCost.toFixed(4),
          laborHours: labHours.toFixed(2),
          laborCost: labCost.toFixed(4),
          outsideCost: outCost.toFixed(4),
          totalCost: totalCost.toFixed(4),
          approvedById: context.userId,
          status: 'In Routing',
        })
        .returning()

      createdRemakeId = remake.id

      // 6. Write Audit Event
      await tx.insert(auditEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        actingRole: context.roles[0] || 'Quality Manager',
        action: 'GENERATE_REMAKE',
        resourceType: 'panel_mark_remake',
        resourceId: remake.id,
        quantity: '1',
        reason: `Generated ${input.remakeType} remake ${remakeMarkLabel} (Seq: ${nextSeq}) for ${input.responsibleArea}`,
      })

      // 7. Write Activity Event
      await tx.insert(activityEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        entityType: 'qc',
        entityId: remake.id,
        actionTitle: `${input.remakeType} Remake Created`,
        summary: `Created replacement mark ${remakeMarkLabel} for ${originalMark.mark}.`,
      })
    })

    return {
      success: true,
      remakeId: createdRemakeId,
      remakeMark: remakeMarkLabel,
    }
  }

  /**
   * Export quality inspections as CSV.
   */
  static exportInspectionsCsv(items: QualityInspectionItem[]): string {
    const headers = [
      'Mark Code',
      'Release Key',
      'Quantity',
      'Disposition',
      'Inspector',
      'Specification Version',
      'Measured Width (in)',
      'Measured Length (in)',
      'Measured Diagonal (in)',
      'Measured Thickness (in)',
      'Destination',
      'Timestamp (Denver)',
      'Notes',
    ]

    const rows = items.map((i) => [
      `"${i.markCode}"`,
      `"${i.releaseKey}"`,
      i.quantity,
      `"${i.disposition}"`,
      `"${i.inspectorName}"`,
      `"${i.specificationVersion}"`,
      i.measurements?.width || 'N/A',
      i.measurements?.length || 'N/A',
      i.measurements?.diagonal || 'N/A',
      i.measurements?.thickness || 'N/A',
      `"${i.destination || ''}"`,
      `"${i.createdAt}"`,
      `"${i.notes || ''}"`,
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
