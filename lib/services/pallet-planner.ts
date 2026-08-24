import { db } from '@/db'
import {
  palletPlans,
  palletPlanPallets,
  palletPlanItems,
  pallets,
  palletItems,
  panelMarks,
  releases,
  releaseRevisions,
  productionJobs,
  users,
} from '@/db/schema'
import { eq, and, sql, desc, inArray } from 'drizzle-orm'
import { UserContext } from '@/lib/auth/roles'
import { requirePermission } from '@/lib/middleware/authorize'
import { recordAuditEvent, recordActivityEvent } from '@/lib/services/audit'
import {
  buildPalletPlan,
  DEFAULT_ELWARD_PALLET_RULES,
  PalletCandidate,
  PalletizationRuleSet,
  PalletWarning,
  PalletWarningCode,
  PalletWarningOverride,
  PlannedPallet,
  PlannedPalletItem,
  canApprovePalletPlan,
  PALLET_PLANNER_VERSION,
} from '@/lib/domain/palletization'
import { ensureSystemFoundationPopulated } from '@/lib/services/system-init'

let schemaChecked = false
export async function ensurePalletSchemaApplied(): Promise<void> {
  if (schemaChecked) return
  try {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "public"."pallet_plan_status" AS ENUM('Draft', 'Review', 'Approved', 'Applied', 'Superseded', 'Cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      ALTER TABLE "panel_marks" ADD COLUMN IF NOT EXISTS "elevation" text;
      ALTER TABLE "panel_marks" ADD COLUMN IF NOT EXISTS "source_metadata" jsonb;

      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "release_revision_id" uuid;
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "pallet_plan_id" uuid;
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "elevation" text;
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "elevations" jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "width_inches" numeric(10, 2);
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "length_inches" numeric(10, 2);
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "border_inches" numeric(10, 2);
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "max_height_inches" numeric(10, 2) DEFAULT '60.00';
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "current_height_inches" numeric(10, 2) DEFAULT '0.00';
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "max_weight_lbs" numeric(10, 2) DEFAULT '3500.00';
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "current_weight_lbs" numeric(10, 2) DEFAULT '0.00';
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "panel_count" integer DEFAULT 0;
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "builder_id" uuid;
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "notes" text;

      ALTER TABLE "pallet_items" ADD COLUMN IF NOT EXISTS "sequence" integer DEFAULT 1;
      ALTER TABLE "pallet_items" ADD COLUMN IF NOT EXISTS "elevation" text;
      ALTER TABLE "pallet_items" ADD COLUMN IF NOT EXISTS "calculated_weight" numeric(10, 2);
      ALTER TABLE "pallet_items" ADD COLUMN IF NOT EXISTS "calculated_height" numeric(10, 2);
      ALTER TABLE "pallet_items" ADD COLUMN IF NOT EXISTS "staged_at" timestamp with time zone DEFAULT now();
      ALTER TABLE "pallet_items" ADD COLUMN IF NOT EXISTS "staged_by_id" uuid;

      CREATE TABLE IF NOT EXISTS "pallet_plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" uuid NOT NULL,
        "release_id" uuid NOT NULL,
        "release_revision_id" uuid NOT NULL,
        "status" "pallet_plan_status" DEFAULT 'Draft' NOT NULL,
        "algorithm_version" text DEFAULT '1.0.0' NOT NULL,
        "generated_by_id" uuid,
        "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "approved_by_id" uuid,
        "approved_at" timestamp with time zone,
        "applied_by_id" uuid,
        "applied_at" timestamp with time zone,
        "superseded_at" timestamp with time zone,
        "warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "pallet_plan_pallets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" uuid NOT NULL,
        "pallet_plan_id" uuid NOT NULL,
        "sequence" integer DEFAULT 1 NOT NULL,
        "planned_pallet_number" text NOT NULL,
        "width_inches" numeric(10, 2) DEFAULT '0.00' NOT NULL,
        "length_inches" numeric(10, 2) DEFAULT '0.00' NOT NULL,
        "height_inches" numeric(10, 2) DEFAULT '0.00' NOT NULL,
        "weight_lbs" numeric(10, 2) DEFAULT '0.00' NOT NULL,
        "border_inches" numeric(10, 2) DEFAULT '4.00' NOT NULL,
        "elevations" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "material_families" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "panel_count" integer DEFAULT 0 NOT NULL,
        "notes" text,
        "warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "pallet_plan_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" uuid NOT NULL,
        "pallet_plan_pallet_id" uuid NOT NULL,
        "panel_mark_id" uuid NOT NULL,
        "quantity" integer DEFAULT 1 NOT NULL,
        "sequence" integer DEFAULT 1 NOT NULL,
        "elevation" text,
        "calculated_weight" numeric(10, 2),
        "calculated_height" numeric(10, 2),
        "source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );

      DELETE FROM "production_jobs" WHERE "job_number" = '59001';
    `)
    schemaChecked = true
    await ensureSystemFoundationPopulated()
  } catch (err) {
    console.error('Pallet schema auto-migration notice:', err)
  }
}

export interface PalletPlanSummary {
  id: string
  releaseId: string
  releaseRevisionId: string
  releaseKey: string
  jobNumber: string
  jobName: string
  revisionNumber: number
  revisionLabel: string
  isCurrentRevision: boolean
  status: string
  algorithmVersion: string
  palletCount: number
  totalPanels: number
  totalWeightLbs: number
  maxWeightLbs: number
  averageUtilizationPercent: number
  warningsCount: number
  hasBlockingWarnings: boolean
  generatedByName: string | null
  generatedAt: string
  approvedByName: string | null
  approvedAt: string | null
  appliedAt: string | null
}

export interface PalletPlanDetail extends PalletPlanSummary {
  pallets: (PlannedPallet & { id: string })[]
  planWarnings: PalletWarning[]
  metadata: Record<string, unknown>
}

export class PalletPlannerService {
  /**
   * Generates a recommended deterministic pallet plan for an active release revision.
   */
  static async generatePlanForRelease(
    context: UserContext,
    releaseId: string,
    options?: { customRules?: Partial<PalletizationRuleSet> },
  ): Promise<PalletPlanDetail> {
    requirePermission(context, 'create', 'generatePalletPlan')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    await ensurePalletSchemaApplied()

    // 1. Fetch Release & Current Active Revision
    const [release] = await db
      .select({
        id: releases.id,
        releaseNumber: releases.releaseNumber,
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
      })
      .from(releases)
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .where(
        and(eq(releases.id, releaseId), eq(releases.organizationId, orgId)),
      )
      .limit(1)

    if (!release) {
      throw new Error(`Release not found for id: ${releaseId}`)
    }

    const [currentRev] = await db
      .select()
      .from(releaseRevisions)
      .where(
        and(
          eq(releaseRevisions.releaseId, releaseId),
          eq(releaseRevisions.isCurrent, true),
        ),
      )
      .limit(1)

    if (!currentRev) {
      throw new Error(
        `No active approved revision found for release ${release.jobNumber}-R${release.releaseNumber}`,
      )
    }

    // 2. Fetch Panel Marks for Active Revision
    const marks = await db
      .select()
      .from(panelMarks)
      .where(
        and(
          eq(panelMarks.releaseRevisionId, currentRev.id),
          eq(panelMarks.organizationId, orgId),
        ),
      )

    if (marks.length === 0) {
      throw new Error(
        `No panel marks found for active revision of release ${release.jobNumber}-R${release.releaseNumber}`,
      )
    }

    // 3. Compute already-palletized quantities from operational pallets
    const existingPalletItems = await db
      .select({
        panelMarkId: palletItems.panelMarkId,
        totalQuantity: sql<number>`COALESCE(sum(${palletItems.quantity}), 0)`,
      })
      .from(palletItems)
      .innerJoin(pallets, eq(palletItems.palletId, pallets.id))
      .where(
        and(
          eq(pallets.releaseId, releaseId),
          eq(pallets.organizationId, orgId),
        ),
      )
      .groupBy(palletItems.panelMarkId)

    const palletizedMap = new Map<string, number>()
    for (const epi of existingPalletItems) {
      palletizedMap.set(epi.panelMarkId, Number(epi.totalQuantity || 0))
    }

    // 4. Build Candidate Panels
    const candidates: PalletCandidate[] = marks.map((m) => {
      const palletized = palletizedMap.get(m.id) || 0
      const available = Math.max(0, m.quantity - palletized)
      const widthInches = m.width ? parseFloat(m.width) : 48
      const lengthInches = m.length ? parseFloat(m.length) : 120
      const thicknessInches = m.thickness ? parseFloat(m.thickness) : 0.157

      return {
        panelMarkId: m.id,
        mark: m.mark,
        description: m.description || undefined,
        primaryElevation: m.elevation || 'General Elevation',
        elevationNames: m.elevation ? [m.elevation] : ['General Elevation'],
        materialFamily: m.materialFamily,
        color: m.color || undefined,
        widthInches: Number.isFinite(widthInches) ? widthInches : 48,
        lengthInches: Number.isFinite(lengthInches) ? lengthInches : 120,
        thicknessInches: Number.isFinite(thicknessInches)
          ? thicknessInches
          : 0.157,
        quantity: m.quantity,
        availableQuantity: available,
        sourceProvenance: m.sourceMetadata ?? undefined,
      }
    })

    // 5. Merge Rules & Run Pure Deterministic Planner
    const ruleSet: PalletizationRuleSet = {
      ...DEFAULT_ELWARD_PALLET_RULES,
      ...(options?.customRules || {}),
    }

    const releaseKey = `${release.jobNumber}-R${release.releaseNumber}`
    const planResult = buildPalletPlan(candidates, ruleSet, { releaseKey })

    // 6. Save Plan in PostgreSQL Transaction
    return await db.transaction(async (tx) => {
      // Mark any prior draft/review plans for this release revision as superseded
      await tx
        .update(palletPlans)
        .set({
          status: 'Superseded',
          supersededAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(palletPlans.releaseRevisionId, currentRev.id),
            inArray(palletPlans.status, ['Draft', 'Review']),
          ),
        )

      // Insert new plan header
      const [newPlan] = await tx
        .insert(palletPlans)
        .values({
          organizationId: orgId,
          releaseId,
          releaseRevisionId: currentRev.id,
          status: 'Draft',
          algorithmVersion: PALLET_PLANNER_VERSION,
          generatedById: context.userId,
          generatedAt: new Date(),
          warnings: planResult.warnings,
          metadata: {
            statistics: planResult.statistics,
            ruleSetVersion: ruleSet.version,
            maxWeightLbs: ruleSet.maxWeightLbs,
            targetHeightInches: ruleSet.targetHeightInches,
            candidatesCount: candidates.length,
          },
        })
        .returning()

      // Insert planned pallets & items
      for (const plannedPallet of planResult.pallets) {
        const [insertedPallet] = await tx
          .insert(palletPlanPallets)
          .values({
            organizationId: orgId,
            palletPlanId: newPlan.id,
            sequence: plannedPallet.sequence,
            plannedPalletNumber: plannedPallet.plannedPalletNumber,
            widthInches: String(plannedPallet.geometry.widthInches),
            lengthInches: String(plannedPallet.geometry.lengthInches),
            heightInches: String(plannedPallet.geometry.heightInches),
            weightLbs: String(plannedPallet.geometry.weightLbs),
            borderInches: String(plannedPallet.geometry.borderInches),
            elevations: plannedPallet.elevations,
            materialFamilies: plannedPallet.materialFamilies,
            panelCount: plannedPallet.panelCount,
            warnings: plannedPallet.warnings,
            overrides: plannedPallet.overrides || [],
          })
          .returning()

        for (const item of plannedPallet.items) {
          await tx.insert(palletPlanItems).values({
            organizationId: orgId,
            palletPlanPalletId: insertedPallet.id,
            panelMarkId: item.panelMarkId,
            quantity: item.quantity,
            sequence: item.sequence,
            elevation: item.elevation,
            calculatedWeight: String(item.totalWeightLbs),
            calculatedHeight: String(item.stackHeightInches),
            sourceMetadata: item.sourceProvenance || {},
          })
        }
      }

      await recordAuditEvent(context, {
        action: 'pallet_plan.generate',
        entityType: 'pallet_plan',
        entityId: newPlan.id,
        newState: 'Draft',
        details: {
          releaseId,
          revisionId: currentRev.id,
          palletCount: planResult.pallets.length,
          totalPanels: planResult.statistics.totalPanels,
          totalWeightLbs: planResult.statistics.totalWeightLbs,
          algorithmVersion: PALLET_PLANNER_VERSION,
        },
      })

      await recordActivityEvent(context, {
        action: 'pallet_plan_generated',
        entityType: 'pallet_plan',
        entityId: newPlan.id,
        description: `Generated intelligent pallet plan for ${releaseKey} (${planResult.pallets.length} pallets, ${planResult.statistics.totalPanels} panels).`,
      })

      return (await this.getPlanById(context, newPlan.id))!
    })
  }

  /**
   * Retrieves plan summary and details by plan ID.
   */
  static async getPlanById(
    context: UserContext,
    planId: string,
  ): Promise<PalletPlanDetail | null> {
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    await ensurePalletSchemaApplied()

    const [plan] = await db
      .select({
        id: palletPlans.id,
        releaseId: palletPlans.releaseId,
        releaseRevisionId: palletPlans.releaseRevisionId,
        releaseNumber: releases.releaseNumber,
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
        revisionNumber: releaseRevisions.revisionNumber,
        revisionLabel: releaseRevisions.revisionLabel,
        isCurrentRevision: releaseRevisions.isCurrent,
        status: palletPlans.status,
        algorithmVersion: palletPlans.algorithmVersion,
        warnings: palletPlans.warnings,
        metadata: palletPlans.metadata,
        generatedByName: users.name,
        generatedAt: palletPlans.generatedAt,
        approvedAt: palletPlans.approvedAt,
        appliedAt: palletPlans.appliedAt,
      })
      .from(palletPlans)
      .innerJoin(releases, eq(palletPlans.releaseId, releases.id))
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .innerJoin(
        releaseRevisions,
        eq(palletPlans.releaseRevisionId, releaseRevisions.id),
      )
      .leftJoin(users, eq(palletPlans.generatedById, users.id))
      .where(
        and(eq(palletPlans.id, planId), eq(palletPlans.organizationId, orgId)),
      )
      .limit(1)

    if (!plan) return null

    // Fetch Pallet Plan Pallets
    const plannedPalletsRows = await db
      .select()
      .from(palletPlanPallets)
      .where(eq(palletPlanPallets.palletPlanId, planId))
      .orderBy(palletPlanPallets.sequence)

    const palletIds = plannedPalletsRows.map((p) => p.id)

    const plannedItemsRows =
      palletIds.length > 0
        ? await db
            .select({
              id: palletPlanItems.id,
              palletPlanPalletId: palletPlanItems.palletPlanPalletId,
              panelMarkId: palletPlanItems.panelMarkId,
              quantity: palletPlanItems.quantity,
              sequence: palletPlanItems.sequence,
              elevation: palletPlanItems.elevation,
              calculatedWeight: palletPlanItems.calculatedWeight,
              calculatedHeight: palletPlanItems.calculatedHeight,
              sourceMetadata: palletPlanItems.sourceMetadata,
              mark: panelMarks.mark,
              materialFamily: panelMarks.materialFamily,
              color: panelMarks.color,
              width: panelMarks.width,
              length: panelMarks.length,
              thickness: panelMarks.thickness,
            })
            .from(palletPlanItems)
            .innerJoin(
              panelMarks,
              eq(palletPlanItems.panelMarkId, panelMarks.id),
            )
            .where(inArray(palletPlanItems.palletPlanPalletId, palletIds))
            .orderBy(palletPlanItems.sequence)
        : []

    const itemsByPallet = new Map<string, PlannedPalletItem[]>()
    for (const item of plannedItemsRows) {
      const list = itemsByPallet.get(item.palletPlanPalletId) || []
      const unitWeight = item.calculatedWeight
        ? Number(item.calculatedWeight) / item.quantity
        : 25
      list.push({
        id: item.id,
        panelMarkId: item.panelMarkId,
        mark: item.mark,
        quantity: item.quantity,
        sequence: item.sequence,
        elevation: item.elevation || 'General Elevation',
        widthInches: Number(item.width || 48),
        lengthInches: Number(item.length || 120),
        thicknessInches: Number(item.thickness || 0.157),
        unitWeightLbs: Number(unitWeight.toFixed(2)),
        totalWeightLbs: Number(item.calculatedWeight || 0),
        stackHeightInches: Number(item.calculatedHeight || 0),
        materialFamily: item.materialFamily,
        color: item.color || undefined,
        sourceProvenance: item.sourceMetadata ?? undefined,
        warnings: [],
      })
      itemsByPallet.set(item.palletPlanPalletId, list)
    }

    let totalWeight = 0
    let totalPanels = 0
    let sumUtil = 0

    const palletsDetail = plannedPalletsRows.map((p) => {
      const items = itemsByPallet.get(p.id) || []
      const weight = Number(p.weightLbs)
      const height = Number(p.heightInches)
      const weightPercent = Number(((weight / 3500) * 100).toFixed(1))
      const heightPercent = Number(((height / 60) * 100).toFixed(1))
      const util = Math.max(weightPercent, heightPercent)

      totalWeight += weight
      totalPanels += p.panelCount
      sumUtil += util

      return {
        id: p.id,
        sequence: p.sequence,
        plannedPalletNumber: p.plannedPalletNumber,
        geometry: {
          widthInches: Number(p.widthInches),
          lengthInches: Number(p.lengthInches),
          heightInches: height,
          weightLbs: weight,
          borderInches: Number(p.borderInches),
          orientation: 'STANDARD' as const,
        },
        elevations: (p.elevations as string[]) || [],
        materialFamilies: (p.materialFamilies as string[]) || [],
        panelCount: p.panelCount,
        items,
        warnings: (p.warnings as PalletWarning[]) || [],
        overrides: (p.overrides as PalletWarningOverride[]) || [],
        notes: p.notes || undefined,
        utilizationPercent: util,
        weightCapacityPercent: weightPercent,
        heightCapacityPercent: heightPercent,
      }
    })

    const avgUtil =
      palletsDetail.length > 0
        ? Number((sumUtil / palletsDetail.length).toFixed(1))
        : 0

    const planWarnings = (plan.warnings as PalletWarning[]) || []
    const allWarnings = [
      ...planWarnings,
      ...palletsDetail.flatMap((p) => p.warnings),
    ]

    return {
      id: plan.id,
      releaseId: plan.releaseId,
      releaseRevisionId: plan.releaseRevisionId,
      releaseKey: `${plan.jobNumber}-R${plan.releaseNumber}`,
      jobNumber: plan.jobNumber,
      jobName: plan.jobName,
      revisionNumber: plan.revisionNumber,
      revisionLabel: plan.revisionLabel,
      isCurrentRevision: plan.isCurrentRevision,
      status: plan.status,
      algorithmVersion: plan.algorithmVersion,
      palletCount: palletsDetail.length,
      totalPanels,
      totalWeightLbs: Number(totalWeight.toFixed(2)),
      maxWeightLbs: 3500,
      averageUtilizationPercent: avgUtil,
      warningsCount: allWarnings.length,
      hasBlockingWarnings: allWarnings.some((w) => w.severity === 'BLOCKING'),
      generatedByName: plan.generatedByName,
      generatedAt: plan.generatedAt.toISOString(),
      approvedByName: null,
      approvedAt: plan.approvedAt ? plan.approvedAt.toISOString() : null,
      appliedAt: plan.appliedAt ? plan.appliedAt.toISOString() : null,
      pallets: palletsDetail,
      planWarnings,
      metadata: (plan.metadata as Record<string, unknown>) || {},
    }
  }

  /**
   * Retrieves all pallet plans for a release.
   */
  static async getPlansForRelease(
    context: UserContext,
    releaseId: string,
  ): Promise<PalletPlanSummary[]> {
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    await ensurePalletSchemaApplied()

    const rows = await db
      .select({
        id: palletPlans.id,
        releaseId: palletPlans.releaseId,
        releaseRevisionId: palletPlans.releaseRevisionId,
        releaseNumber: releases.releaseNumber,
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
        revisionNumber: releaseRevisions.revisionNumber,
        revisionLabel: releaseRevisions.revisionLabel,
        isCurrentRevision: releaseRevisions.isCurrent,
        status: palletPlans.status,
        algorithmVersion: palletPlans.algorithmVersion,
        warnings: palletPlans.warnings,
        metadata: palletPlans.metadata,
        generatedByName: users.name,
        generatedAt: palletPlans.generatedAt,
        approvedAt: palletPlans.approvedAt,
        appliedAt: palletPlans.appliedAt,
      })
      .from(palletPlans)
      .innerJoin(releases, eq(palletPlans.releaseId, releases.id))
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .innerJoin(
        releaseRevisions,
        eq(palletPlans.releaseRevisionId, releaseRevisions.id),
      )
      .leftJoin(users, eq(palletPlans.generatedById, users.id))
      .where(
        and(
          eq(palletPlans.releaseId, releaseId),
          eq(palletPlans.organizationId, orgId),
        ),
      )
      .orderBy(desc(palletPlans.createdAt))

    return rows.map((r) => {
      const meta = (r.metadata as Record<string, unknown>) || {}
      const stats =
        (meta.statistics as
          | {
              palletCount?: number
              totalPanels?: number
              totalWeightLbs?: number
              averageUtilizationPercent?: number
            }
          | undefined) || {}
      const warnings = (r.warnings as PalletWarning[]) || []
      return {
        id: r.id,
        releaseId: r.releaseId,
        releaseRevisionId: r.releaseRevisionId,
        releaseKey: `${r.jobNumber}-R${r.releaseNumber}`,
        jobNumber: r.jobNumber,
        jobName: r.jobName,
        revisionNumber: r.revisionNumber,
        revisionLabel: r.revisionLabel,
        isCurrentRevision: r.isCurrentRevision,
        status: r.status,
        algorithmVersion: r.algorithmVersion,
        palletCount: stats.palletCount || 0,
        totalPanels: stats.totalPanels || 0,
        totalWeightLbs: stats.totalWeightLbs || 0,
        maxWeightLbs: 3500,
        averageUtilizationPercent: stats.averageUtilizationPercent || 0,
        warningsCount: warnings.length,
        hasBlockingWarnings: warnings.some((w) => w.severity === 'BLOCKING'),
        generatedByName: r.generatedByName,
        generatedAt: r.generatedAt.toISOString(),
        approvedByName: null,
        approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
        appliedAt: r.appliedAt ? r.appliedAt.toISOString() : null,
      }
    })
  }

  /**
   * Approves a recommended pallet plan.
   */
  static async approvePlan(
    context: UserContext,
    planId: string,
    notes?: string,
  ): Promise<PalletPlanDetail> {
    requirePermission(context, 'approve', 'approvePalletPlan')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    const plan = await this.getPlanById(context, planId)
    if (!plan) throw new Error('Pallet plan not found')

    if (!plan.isCurrentRevision) {
      throw new Error(
        'Cannot approve a pallet plan generated from a superseded revision. Please generate a new plan for the active revision.',
      )
    }

    if (plan.status === 'Approved' || plan.status === 'Applied') {
      return plan
    }

    // Check blocking warnings
    const approvalCheck = canApprovePalletPlan(plan.pallets, plan.planWarnings)
    if (!approvalCheck.canApprove) {
      throw new Error(
        `Plan Approval Blocked:\n${approvalCheck.blockingReasons.join('\n')}`,
      )
    }

    await db
      .update(palletPlans)
      .set({
        status: 'Approved',
        approvedById: context.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(palletPlans.id, planId), eq(palletPlans.organizationId, orgId)),
      )

    await recordAuditEvent(context, {
      action: 'pallet_plan.approve',
      entityType: 'pallet_plan',
      entityId: planId,
      priorState: plan.status,
      newState: 'Approved',
      reason: notes || 'Supervisor approval for production palletizing',
      details: {
        palletCount: plan.palletCount,
        totalPanels: plan.totalPanels,
      },
    })

    return (await this.getPlanById(context, planId))!
  }

  /**
   * Applies an approved pallet plan into operational pallets.
   */
  static async applyPlan(
    context: UserContext,
    planId: string,
  ): Promise<{ createdPalletIds: string[]; totalPallets: number }> {
    requirePermission(context, 'approve', 'applyPalletPlan')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    await ensurePalletSchemaApplied()

    const plan = await this.getPlanById(context, planId)
    if (!plan) throw new Error('Pallet plan not found')

    if (!plan.isCurrentRevision) {
      throw new Error(
        'Cannot apply a pallet plan generated from a superseded revision.',
      )
    }

    if (plan.status !== 'Approved') {
      throw new Error(
        `Plan must be in 'Approved' status before applying (current status: ${plan.status}).`,
      )
    }

    return await db.transaction(async (tx) => {
      const createdPalletIds: string[] = []

      for (const pp of plan.pallets) {
        const [createdPallet] = await tx
          .insert(pallets)
          .values({
            organizationId: orgId,
            releaseId: plan.releaseId,
            releaseRevisionId: plan.releaseRevisionId,
            palletPlanId: planId,
            palletNumber: pp.plannedPalletNumber,
            status: 'Building',
            elevation: pp.elevations.join(', '),
            elevations: pp.elevations,
            widthInches: String(pp.geometry.widthInches),
            lengthInches: String(pp.geometry.lengthInches),
            borderInches: String(pp.geometry.borderInches),
            maxHeightInches: '60.00',
            currentHeightInches: String(pp.geometry.heightInches),
            maxWeightLbs: '3500.00',
            currentWeightLbs: String(pp.geometry.weightLbs),
            panelCount: pp.panelCount,
            builderId: context.userId,
            notes: pp.notes || null,
          })
          .returning()

        createdPalletIds.push(createdPallet.id)

        for (const it of pp.items) {
          await tx.insert(palletItems).values({
            organizationId: orgId,
            palletId: createdPallet.id,
            panelMarkId: it.panelMarkId,
            quantity: it.quantity,
            sequence: it.sequence,
            elevation: it.elevation,
            calculatedWeight: String(it.totalWeightLbs),
            calculatedHeight: String(it.stackHeightInches),
            stagedById: context.userId,
          })
        }
      }

      // Mark plan as Applied
      await tx
        .update(palletPlans)
        .set({
          status: 'Applied',
          appliedById: context.userId,
          appliedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(palletPlans.id, planId))

      await recordAuditEvent(context, {
        action: 'pallet_plan.apply',
        entityType: 'pallet_plan',
        entityId: planId,
        priorState: 'Approved',
        newState: 'Applied',
        details: {
          createdPalletIds,
          totalPallets: createdPalletIds.length,
        },
      })

      await recordActivityEvent(context, {
        action: 'pallet_plan_applied',
        entityType: 'pallet_plan',
        entityId: planId,
        description: `Applied pallet plan for ${plan.releaseKey}: Created ${createdPalletIds.length} operational pallets.`,
      })

      return {
        createdPalletIds,
        totalPallets: createdPalletIds.length,
      }
    })
  }

  /**
   * Overrides a warning with an authorized reason.
   */
  static async overrideWarning(
    context: UserContext,
    planId: string,
    override: {
      palletPlanPalletId: string
      warningCode: PalletWarningCode
      reason: string
      resultingValue?: unknown
    },
  ): Promise<PalletPlanDetail> {
    requirePermission(context, 'override', 'overridePalletWarning')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    if (!override.reason || override.reason.trim().length < 5) {
      throw new Error(
        'Override requires a justification reason of at least 5 characters.',
      )
    }

    const [palletRow] = await db
      .select()
      .from(palletPlanPallets)
      .where(
        and(
          eq(palletPlanPallets.id, override.palletPlanPalletId),
          eq(palletPlanPallets.organizationId, orgId),
        ),
      )
      .limit(1)

    if (!palletRow) throw new Error('Planned pallet not found')

    const currentOverrides =
      (palletRow.overrides as PalletWarningOverride[]) || []
    const newOverride: PalletWarningOverride = {
      warningCode: override.warningCode,
      entityId: override.palletPlanPalletId,
      overriddenBy: context.userId || 'supervisor',
      overriddenAt: new Date().toISOString(),
      reason: override.reason,
      resultingValue: override.resultingValue,
    }

    await db
      .update(palletPlanPallets)
      .set({
        overrides: [...currentOverrides, newOverride],
        updatedAt: new Date(),
      })
      .where(eq(palletPlanPallets.id, override.palletPlanPalletId))

    await recordAuditEvent(context, {
      action: 'pallet_plan.override_warning',
      entityType: 'pallet_plan',
      entityId: planId,
      reason: override.reason,
      details: {
        palletPlanPalletId: override.palletPlanPalletId,
        warningCode: override.warningCode,
      },
    })

    return (await this.getPlanById(context, planId))!
  }

  /**
   * Invalidates stale pallet plans when a new release revision is published.
   */
  static async invalidateStalePlansForRelease(
    releaseId: string,
    newRevisionId: string,
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db = db,
  ): Promise<number> {
    await tx
      .update(palletPlans)
      .set({
        status: 'Superseded',
        supersededAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(palletPlans.releaseId, releaseId),
          sql`${palletPlans.releaseRevisionId} != ${newRevisionId}`,
          inArray(palletPlans.status, ['Draft', 'Review', 'Approved']),
        ),
      )

    return 1
  }
}
