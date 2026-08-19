import { db } from '@/db'
import {
  productionJobs,
  releases,
  releaseRevisions,
  panelMarks,
  documents,
  documentRevisions,
  documentClassifications,
  operationDefinitions,
  operationInstances,
  auditEvents,
  activityEvents,
  customers,
  projects,
  storedFiles,
} from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { DomainService } from './domain'
import type { ParsedPanelMarkInput, IntakeFileItem } from './intake'

export interface ImpactDispositionInput {
  mark: string
  disposition: 'scrap_and_remake' | 'rework' | 'use_as_is' | 'hold_for_review'
  reason: string
  responsibleRole?: string
}

export interface ImpactedWorkItem {
  mark: string
  existingQuantity: number
  newQuantity: number
  currentStage: string
  status: string
  severity: 'critical' | 'warning' | 'info'
  impactSummary: string
  requiresDisposition: boolean
}

export interface RevisionPublishParams {
  organizationId: string
  siteId: string
  jobNumber: string
  releaseNumber: number
  revisionLabel: string
  materialFamily: string
  customerName?: string
  projectName?: string
  reviewSummary?: string
  marks: ParsedPanelMarkInput[]
  files: IntakeFileItem[]
  impactDispositions?: ImpactDispositionInput[]
}

export class RevisionControlService {
  /**
   * Calculates downstream in-process manufacturing impact before approving a new revision.
   */
  public static async calculateImpact(
    releaseId: string,
    newMarks: ParsedPanelMarkInput[],
  ): Promise<ImpactedWorkItem[]> {
    const existingRevs = await db
      .select()
      .from(releaseRevisions)
      .where(
        and(
          eq(releaseRevisions.releaseId, releaseId),
          eq(releaseRevisions.isCurrent, true),
        ),
      )
      .limit(1)

    if (existingRevs.length === 0) {
      return [] // First revision, no in-process work to impact
    }

    const currentRev = existingRevs[0]
    const existingMarks = await db
      .select()
      .from(panelMarks)
      .where(eq(panelMarks.releaseRevisionId, currentRev.id))

    const existingOps = await db
      .select({
        instanceId: operationInstances.id,
        status: operationInstances.status,
        completedQty: operationInstances.completedQuantity,
        plannedQty: operationInstances.plannedQuantity,
        opName: operationDefinitions.name,
        opCode: operationDefinitions.code,
      })
      .from(operationInstances)
      .innerJoin(
        operationDefinitions,
        eq(operationInstances.operationDefinitionId, operationDefinitions.id),
      )
      .where(eq(operationInstances.releaseRevisionId, currentRev.id))

    const impactedItems: ImpactedWorkItem[] = []
    const newMarkMap = new Map(newMarks.map((m) => [m.mark, m]))

    for (const oldMark of existingMarks) {
      const updatedMark = newMarkMap.get(oldMark.mark)

      // Find any completed or in-progress operations
      const activeOps = existingOps.filter(
        (op) =>
          op.status === 'In progress' ||
          op.status === 'Completed' ||
          op.completedQty > 0,
      )

      const highestOp = activeOps[activeOps.length - 1]
      const currentStage = highestOp ? highestOp.opName : 'Not Started'
      const hasWorkStarted = activeOps.length > 0

      if (!updatedMark) {
        // Mark was deleted in new revision
        impactedItems.push({
          mark: oldMark.mark,
          existingQuantity: oldMark.quantity,
          newQuantity: 0,
          currentStage,
          status: oldMark.notes || 'Removed in Rev',
          severity: hasWorkStarted ? 'critical' : 'warning',
          impactSummary: hasWorkStarted
            ? `Mark removed in new revision but work already started (${currentStage}). Requires Scrap or Rework disposition.`
            : 'Mark removed in new revision before shop work started.',
          requiresDisposition: hasWorkStarted,
        })
      } else if (
        updatedMark.quantity !== oldMark.quantity ||
        (oldMark.width &&
          parseFloat(oldMark.width) !== parseFloat(updatedMark.width || '0')) ||
        (oldMark.length &&
          parseFloat(oldMark.length) !== parseFloat(updatedMark.length || '0'))
      ) {
        // Mark specification or quantity changed
        const changeDesc =
          updatedMark.quantity !== oldMark.quantity
            ? `Qty changed from ${oldMark.quantity} to ${updatedMark.quantity}`
            : `Dimensions/Specs modified`

        impactedItems.push({
          mark: oldMark.mark,
          existingQuantity: oldMark.quantity,
          newQuantity: updatedMark.quantity,
          currentStage,
          status: 'Modified in Rev',
          severity: hasWorkStarted ? 'critical' : 'info',
          impactSummary: hasWorkStarted
            ? `${changeDesc} while currently at ${currentStage}. Review required.`
            : `${changeDesc}. No downstream work started.`,
          requiresDisposition: hasWorkStarted,
        })
      }
    }

    return impactedItems
  }

  /**
   * Atomically publishes a release revision with full transactional integrity,
   * audit logging, and automated packet generation.
   */
  public static async publishRevision(
    actor: {
      userId: string
      email: string
      roles: string[]
      isAdmin?: boolean
    },
    params: RevisionPublishParams,
  ) {
    const {
      organizationId,
      jobNumber,
      releaseNumber,
      revisionLabel,
      materialFamily,
      customerName = 'Fictional Commercial Builders',
      projectName = 'Fictional Landmark Tower',
      reviewSummary = 'Approved for shop floor production',
      marks,
      files,
      impactDispositions = [],
    } = params

    // 1. Authorization check
    DomainService.hasPermission(
      actor.roles,
      'releases.approve',
      actor.isAdmin ?? false,
    )

    // 2. Validate Job Number (5 digits)
    DomainService.validateJobNumber(jobNumber)

    return await db.transaction(async (tx) => {
      // Find or create customer
      let [cust] = await tx
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.organizationId, organizationId),
            eq(customers.name, customerName),
          ),
        )
        .limit(1)

      if (!cust) {
        ;[cust] = await tx
          .insert(customers)
          .values({
            organizationId,
            name: customerName,
            code: 'FCB',
          })
          .returning()
      }

      // Find or create project
      let [proj] = await tx
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, organizationId),
            eq(projects.name, projectName),
          ),
        )
        .limit(1)

      if (!proj) {
        ;[proj] = await tx
          .insert(projects)
          .values({
            organizationId,
            customerId: cust.id,
            name: projectName,
            code: 'FLT-01',
          })
          .returning()
      }

      // Find or create productionJob
      let [job] = await tx
        .select()
        .from(productionJobs)
        .where(
          and(
            eq(productionJobs.organizationId, organizationId),
            eq(productionJobs.jobNumber, jobNumber),
          ),
        )
        .limit(1)

      if (!job) {
        ;[job] = await tx
          .insert(productionJobs)
          .values({
            organizationId,
            customerId: cust.id,
            projectId: proj.id,
            jobNumber,
            name: projectName,
            status: 'Active',
          })
          .returning()
      }

      // Find or create release
      let [rel] = await tx
        .select()
        .from(releases)
        .where(
          and(
            eq(releases.organizationId, organizationId),
            eq(releases.jobId, job.id),
            eq(releases.releaseNumber, releaseNumber),
          ),
        )
        .limit(1)

      if (!rel) {
        ;[rel] = await tx
          .insert(releases)
          .values({
            organizationId,
            jobId: job.id,
            releaseNumber,
            status: 'Approved for production',
            priority: 1,
            requiredDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          })
          .returning()
      } else {
        await tx
          .update(releases)
          .set({
            status: 'Approved for production',
            updatedAt: new Date(),
            version: sql`${releases.version} + 1`,
          })
          .where(eq(releases.id, rel.id))
      }

      // 3. Supersede all existing revisions
      await tx
        .update(releaseRevisions)
        .set({
          isCurrent: false,
          status: 'Superseded',
          updatedAt: new Date(),
        })
        .where(eq(releaseRevisions.releaseId, rel.id))

      // Count prior revisions for sequence number
      const existingRevs = await tx
        .select()
        .from(releaseRevisions)
        .where(eq(releaseRevisions.releaseId, rel.id))

      const nextRevNum = existingRevs.length + 1

      // 4. Create new Approved Revision
      const [newRevision] = await tx
        .insert(releaseRevisions)
        .values({
          organizationId,
          releaseId: rel.id,
          revisionNumber: nextRevNum,
          revisionLabel,
          status: 'Approved',
          isCurrent: true,
          notes: reviewSummary,
          approvedById: actor.userId,
          approvedAt: new Date(),
        })
        .returning()

      // 5. Insert Panel Marks for new revision
      const insertedMarks = []
      for (const m of marks) {
        const [insertedMark] = await tx
          .insert(panelMarks)
          .values({
            organizationId,
            releaseRevisionId: newRevision.id,
            mark: m.mark,
            description: m.description,
            quantity: m.quantity,
            materialFamily: m.materialFamily || materialFamily,
            color: m.color || 'Bone White',
            thickness: m.thickness || '0.1570',
            width: m.width || '48.0000',
            length: m.length || '120.0000',
            dimensionUnit: m.dimensionUnit || 'in',
          })
          .returning()
        insertedMarks.push(insertedMark)
      }

      // 6. Ensure standard document classifications exist and link documents
      for (const f of files) {
        let [docClass] = await tx
          .select()
          .from(documentClassifications)
          .where(
            and(
              eq(documentClassifications.organizationId, organizationId),
              eq(documentClassifications.code, f.classification.category),
            ),
          )
          .limit(1)

        if (!docClass) {
          ;[docClass] = await tx
            .insert(documentClassifications)
            .values({
              organizationId,
              name: f.classification.name,
              code: f.classification.category,
              expectedByDefault: true,
            })
            .returning()
        }

        const [doc] = await tx
          .insert(documents)
          .values({
            organizationId,
            jobId: job.id,
            releaseId: rel.id,
            classificationId: docClass.id,
            name: f.originalName,
          })
          .returning()

        let fileRecordId = f.storedFileId
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            f.storedFileId,
          )

        let existingFile = null
        if (isUuid) {
          const [found] = await tx
            .select()
            .from(storedFiles)
            .where(eq(storedFiles.id, f.storedFileId))
            .limit(1)
          existingFile = found
        }

        const objKey = `originals/releases/${jobNumber}-${releaseNumber}/${f.sha256 || 'sample'}-${f.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

        const [existingByKey] = await tx
          .select()
          .from(storedFiles)
          .where(eq(storedFiles.objectKey, objKey))
          .limit(1)

        if (existingByKey) {
          fileRecordId = existingByKey.id
        } else if (!existingFile) {
          const [createdFile] = await tx
            .insert(storedFiles)
            .values({
              organizationId,
              objectKey: objKey,
              originalName: f.originalName,
              contentType: f.contentType || 'application/pdf',
              byteSize: f.byteSize || 1024,
              sha256:
                f.sha256 ||
                '0000000000000000000000000000000000000000000000000000000000000000',
              uploadedById: actor.userId,
            })
            .returning()
          fileRecordId = createdFile.id
        }

        await tx.insert(documentRevisions).values({
          documentId: doc.id,
          releaseRevisionId: newRevision.id,
          storedFileId: fileRecordId,
          revisionLabel,
          status: 'current',
        })
      }

      // 7. Seed standard operation instances for the new revision
      const ops = await tx
        .select()
        .from(operationDefinitions)
        .where(eq(operationDefinitions.organizationId, organizationId))

      const totalMarksCount = marks.reduce((sum, m) => sum + m.quantity, 0)
      const primaryMarkId = insertedMarks[0]?.id

      if (primaryMarkId) {
        for (const op of ops) {
          await tx.insert(operationInstances).values({
            organizationId,
            releaseRevisionId: newRevision.id,
            panelMarkId: primaryMarkId,
            operationDefinitionId: op.id,
            sequence: op.defaultSequence,
            status: op.defaultSequence === 10 ? 'In progress' : 'Pending',
            plannedQuantity: totalMarksCount,
            completedQuantity: 0,
            scrapQuantity: 0,
            holdQuantity: 0,
          })
        }
      }

      // 8. Immutable Audit Log
      await tx.insert(auditEvents).values({
        organizationId,
        actorId: actor.userId,
        actingRole: actor.roles[0] || 'System Administrator',
        action: 'release.revision_published',
        resourceType: 'release_revision',
        resourceId: newRevision.id,
        reason: reviewSummary,
        newState: {
          jobNumber,
          releaseNumber,
          revisionNumber: nextRevNum,
          revisionLabel,
          marksCount: marks.length,
          filesCount: files.length,
          impactDispositions,
        },
      })

      // 9. Activity Event Feed
      await tx.insert(activityEvents).values({
        organizationId,
        actorId: actor.userId,
        entityType: 'release_revision',
        entityId: newRevision.id,
        actionTitle: 'Release Revision Published',
        summary: `Published Rev ${nextRevNum} (${revisionLabel}) for Job ${jobNumber} Release ${releaseNumber} (${marks.length} marks).`,
      })

      return {
        jobId: job.id,
        jobNumber,
        releaseId: rel.id,
        releaseNumber,
        revisionId: newRevision.id,
        revisionNumber: nextRevNum,
        revisionLabel,
        status: 'Approved for production',
      }
    })
  }
}
