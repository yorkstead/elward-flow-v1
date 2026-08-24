import { db } from '@/db'
import {
  pallets,
  palletItems,
  panelMarks,
  releases,
  releaseRevisions,
  productionJobs,
  users,
  qualityIssues,
} from '@/db/schema'
import { eq, and, sql, desc, inArray } from 'drizzle-orm'
import { UserContext } from '@/lib/auth/roles'
import { requirePermission } from '@/lib/middleware/authorize'
import { recordAuditEvent, recordActivityEvent } from '@/lib/services/audit'
import {
  calculatePanelWeight,
  calculatePanelStackHeight,
  calculatePalletGeometry,
  validatePalletForStaging,
  canAddMaterialToPallet,
  DEFAULT_ELWARD_PALLET_RULES,
} from '@/lib/domain/palletization'

export interface PalletSummary {
  id: string
  palletNumber: string
  releaseId: string
  releaseKey: string
  jobNumber: string
  jobName: string
  status: string
  elevation: string | null
  elevations: string[]
  widthInches: number | null
  lengthInches: number | null
  borderInches: number | null
  maxHeightInches: number
  currentHeightInches: number
  maxWeightLbs: number
  currentWeightLbs: number
  panelCount: number
  builderName: string | null
  completedAt: string | null
  notes: string | null
  createdAt: string
  items?: PalletItemDetail[]
}

export interface PalletItemDetail {
  id: string
  palletId: string
  panelMarkId: string
  markCode: string
  materialFamily: string
  color: string | null
  dimensions: string | null
  elevation: string | null
  unitWeightLbs: number
  totalWeightLbs: number
  quantity: number
  sequence: number
  stagedAt: string
}

export interface CreatePalletInput {
  releaseId: string
  palletNumber?: string
  elevation?: string
  elevations?: string[]
  maxHeightInches?: number
  maxWeightLbs?: number
  notes?: string
}

export interface AddPalletItemInput {
  palletId: string
  panelMarkId: string
  quantity?: number
}

export class PalletService {
  /**
   * Retrieves all pallets with release/job context and item counts.
   */
  static async getPallets(
    context: UserContext,
    filters?: { releaseId?: string; status?: string },
  ): Promise<PalletSummary[]> {
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    const conditions = [eq(pallets.organizationId, orgId)]
    if (filters?.releaseId) {
      conditions.push(eq(pallets.releaseId, filters.releaseId))
    }
    if (filters?.status) {
      conditions.push(eq(pallets.status, filters.status))
    }

    const rows = await db
      .select({
        id: pallets.id,
        palletNumber: pallets.palletNumber,
        releaseId: pallets.releaseId,
        releaseNumber: releases.releaseNumber,
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
        status: pallets.status,
        elevation: pallets.elevation,
        elevations: pallets.elevations,
        widthInches: pallets.widthInches,
        lengthInches: pallets.lengthInches,
        borderInches: pallets.borderInches,
        maxHeightInches: pallets.maxHeightInches,
        currentHeightInches: pallets.currentHeightInches,
        maxWeightLbs: pallets.maxWeightLbs,
        currentWeightLbs: pallets.currentWeightLbs,
        panelCount: pallets.panelCount,
        builderName: users.name,
        completedAt: pallets.completedAt,
        notes: pallets.notes,
        createdAt: pallets.createdAt,
      })
      .from(pallets)
      .innerJoin(releases, eq(pallets.releaseId, releases.id))
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .leftJoin(users, eq(pallets.builderId, users.id))
      .where(and(...conditions))
      .orderBy(desc(pallets.createdAt))

    return rows.map((r) => {
      const elevationsList = (r.elevations as string[]) || []
      const displayElevation =
        r.elevation ||
        (elevationsList.length > 0 ? elevationsList.join(', ') : null)

      return {
        id: r.id,
        palletNumber: r.palletNumber,
        releaseId: r.releaseId,
        releaseKey: `${r.jobNumber}-R${r.releaseNumber}`,
        jobNumber: r.jobNumber,
        jobName: r.jobName,
        status: r.status,
        elevation: displayElevation,
        elevations: elevationsList,
        widthInches: r.widthInches ? Number(r.widthInches) : null,
        lengthInches: r.lengthInches ? Number(r.lengthInches) : null,
        borderInches: r.borderInches ? Number(r.borderInches) : null,
        maxHeightInches: Number(r.maxHeightInches),
        currentHeightInches: Number(r.currentHeightInches),
        maxWeightLbs: Number(r.maxWeightLbs),
        currentWeightLbs: Number(r.currentWeightLbs),
        panelCount: r.panelCount,
        builderName: r.builderName,
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
      }
    })
  }

  /**
   * Retrieves single pallet details including items.
   */
  static async getPalletById(
    context: UserContext,
    palletId: string,
  ): Promise<PalletSummary | null> {
    const list = await this.getPallets(context)
    const found = list.find((p) => p.id === palletId)
    if (!found) return null

    const items = await db
      .select({
        id: palletItems.id,
        palletId: palletItems.palletId,
        panelMarkId: palletItems.panelMarkId,
        markCode: panelMarks.mark,
        materialFamily: panelMarks.materialFamily,
        color: panelMarks.color,
        width: panelMarks.width,
        length: panelMarks.length,
        elevation: palletItems.elevation,
        calculatedWeight: palletItems.calculatedWeight,
        quantity: palletItems.quantity,
        sequence: palletItems.sequence,
        stagedAt: palletItems.stagedAt,
      })
      .from(palletItems)
      .innerJoin(panelMarks, eq(palletItems.panelMarkId, panelMarks.id))
      .where(eq(palletItems.palletId, palletId))
      .orderBy(palletItems.sequence)

    found.items = items.map((it) => {
      const totalWeight = Number(it.calculatedWeight || 0)
      const unitWeight = it.quantity > 0 ? totalWeight / it.quantity : 0
      return {
        id: it.id,
        palletId: it.palletId,
        panelMarkId: it.panelMarkId,
        markCode: it.markCode,
        materialFamily: it.materialFamily,
        color: it.color,
        dimensions:
          it.width && it.length ? `${it.width}" × ${it.length}"` : null,
        elevation: it.elevation,
        unitWeightLbs: Number(unitWeight.toFixed(2)),
        totalWeightLbs: totalWeight,
        quantity: it.quantity,
        sequence: it.sequence,
        stagedAt: it.stagedAt.toISOString(),
      }
    })

    return found
  }

  /**
   * Creates a new pallet with automatic sequential naming.
   */
  static async createPallet(
    context: UserContext,
    input: CreatePalletInput,
  ): Promise<PalletSummary> {
    requirePermission(context, 'create', 'createPallet')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    const [release] = await db
      .select({
        releaseNumber: releases.releaseNumber,
        jobNumber: productionJobs.jobNumber,
      })
      .from(releases)
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .where(eq(releases.id, input.releaseId))
      .limit(1)

    if (!release) {
      throw new Error(`Release not found for id: ${input.releaseId}`)
    }

    const [currentRev] = await db
      .select()
      .from(releaseRevisions)
      .where(
        and(
          eq(releaseRevisions.releaseId, input.releaseId),
          eq(releaseRevisions.isCurrent, true),
        ),
      )
      .limit(1)

    let palletNumber = input.palletNumber
    if (!palletNumber) {
      const existingCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(pallets)
        .where(eq(pallets.releaseId, input.releaseId))
      const seq = Number(existingCount[0]?.count || 0) + 1
      palletNumber = `PAL-${release.jobNumber}-R${release.releaseNumber}-${String(
        seq,
      ).padStart(3, '0')}`
    }

    const elevationsList =
      input.elevations || (input.elevation ? [input.elevation] : [])

    const [created] = await db
      .insert(pallets)
      .values({
        organizationId: orgId,
        releaseId: input.releaseId,
        releaseRevisionId: currentRev?.id || null,
        palletNumber,
        status: 'Building',
        elevation:
          input.elevation ||
          (elevationsList.length > 0 ? elevationsList.join(', ') : null),
        elevations: elevationsList,
        maxHeightInches: input.maxHeightInches
          ? String(input.maxHeightInches)
          : '60.00',
        maxWeightLbs: input.maxWeightLbs
          ? String(input.maxWeightLbs)
          : '3500.00',
        builderId: context.userId,
        notes: input.notes || null,
      })
      .returning()

    await recordAuditEvent(context, {
      action: 'pallet.create',
      entityType: 'pallet',
      entityId: created.id,
      newState: 'Building',
      details: {
        palletNumber,
        releaseId: input.releaseId,
        elevation: input.elevation,
      },
    })

    await recordActivityEvent(context, {
      action: 'pallet_created',
      entityType: 'pallet',
      entityId: created.id,
      description: `Created Pallet ${palletNumber} for release ${release.jobNumber}-R${release.releaseNumber}`,
    })

    return (await this.getPalletById(context, created.id))!
  }

  /**
   * Adds a panel mark to the pallet and updates height/weight and counts using material calculations.
   */
  static async addMarkToPallet(
    context: UserContext,
    input: AddPalletItemInput,
  ): Promise<PalletSummary> {
    requirePermission(context, 'edit', 'addMarkToPallet')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    const [pallet] = await db
      .select()
      .from(pallets)
      .where(eq(pallets.id, input.palletId))
      .limit(1)

    if (!pallet) throw new Error('Pallet not found')
    if (pallet.status === 'Shipped') {
      throw new Error('Cannot add items to an already shipped pallet')
    }

    const [mark] = await db
      .select()
      .from(panelMarks)
      .where(eq(panelMarks.id, input.panelMarkId))
      .limit(1)

    if (!mark) throw new Error('Panel mark not found')

    const quantity = input.quantity || 1
    const currentItems = await db
      .select({
        id: palletItems.id,
        quantity: palletItems.quantity,
        materialFamily: panelMarks.materialFamily,
        width: panelMarks.width,
        length: panelMarks.length,
      })
      .from(palletItems)
      .innerJoin(panelMarks, eq(palletItems.panelMarkId, panelMarks.id))
      .where(eq(palletItems.palletId, input.palletId))

    const nextSeq = currentItems.length + 1

    // Material compatibility check
    const existingMaterials = Array.from(
      new Set(currentItems.map((i) => i.materialFamily)),
    )
    const compat = canAddMaterialToPallet(
      existingMaterials,
      mark.materialFamily,
      DEFAULT_ELWARD_PALLET_RULES,
    )
    if (!compat.compatible) {
      throw new Error(`Material Incompatibility: ${compat.reason}`)
    }

    // Material-aware weight & height calculation
    const widthInches = mark.width ? parseFloat(mark.width) : 48
    const lengthInches = mark.length ? parseFloat(mark.length) : 120
    const thicknessInches = mark.thickness ? parseFloat(mark.thickness) : 0.157

    const { unitWeight } = calculatePanelWeight(
      {
        widthInches,
        lengthInches,
        thicknessInches,
        materialFamily: mark.materialFamily,
      },
      DEFAULT_ELWARD_PALLET_RULES,
    )

    const { stackHeight } = calculatePanelStackHeight(
      {
        thicknessInches,
        materialFamily: mark.materialFamily,
      },
      DEFAULT_ELWARD_PALLET_RULES,
    )

    const itemTotalWeight = Number((quantity * unitWeight.valueLbs).toFixed(2))
    const itemTotalHeight = Number(
      (quantity * stackHeight.valueInches).toFixed(3),
    )

    const newWeight = Number(pallet.currentWeightLbs) + itemTotalWeight
    const newHeight = Number(pallet.currentHeightInches) + itemTotalHeight
    const newCount = pallet.panelCount + quantity

    if (newWeight > Number(pallet.maxWeightLbs)) {
      throw new Error(
        `Weight Limit Exceeded: Pallet weight would reach ${newWeight.toFixed(
          1,
        )} lbs (Max: ${pallet.maxWeightLbs} lbs).`,
      )
    }

    // Compute updated geometry
    const allDimensionItems = [
      ...currentItems.map((ci) => ({
        widthInches: ci.width ? parseFloat(ci.width) : 48,
        lengthInches: ci.length ? parseFloat(ci.length) : 120,
        materialFamily: ci.materialFamily,
      })),
      {
        widthInches,
        lengthInches,
        materialFamily: mark.materialFamily,
      },
    ]

    const updatedGeo = calculatePalletGeometry(
      allDimensionItems,
      DEFAULT_ELWARD_PALLET_RULES,
      newHeight,
      newWeight,
    )

    const existingElevations = (pallet.elevations as string[]) || []
    const itemElevation = mark.elevation || 'General Elevation'
    const newElevations = Array.from(
      new Set([...existingElevations, itemElevation]),
    )

    await db.transaction(async (tx) => {
      await tx.insert(palletItems).values({
        organizationId: orgId,
        palletId: input.palletId,
        panelMarkId: input.panelMarkId,
        quantity,
        sequence: nextSeq,
        elevation: itemElevation,
        calculatedWeight: String(itemTotalWeight),
        calculatedHeight: String(itemTotalHeight),
        stagedById: context.userId,
      })

      await tx
        .update(pallets)
        .set({
          panelCount: newCount,
          currentWeightLbs: String(newWeight.toFixed(2)),
          currentHeightInches: String(newHeight.toFixed(2)),
          widthInches: String(updatedGeo.widthInches),
          lengthInches: String(updatedGeo.lengthInches),
          borderInches: String(updatedGeo.borderInches),
          elevations: newElevations,
          elevation: newElevations.join(', '),
          status: 'Building',
          updatedAt: new Date(),
        })
        .where(eq(pallets.id, input.palletId))
    })

    await recordAuditEvent(context, {
      action: 'pallet.add_item',
      entityType: 'pallet',
      entityId: input.palletId,
      quantity,
      details: {
        markCode: mark.mark,
        panelMarkId: input.panelMarkId,
        newCount,
        newWeight,
      },
    })

    return (await this.getPalletById(context, input.palletId))!
  }

  /**
   * Removes an item from the pallet.
   */
  static async removeMarkFromPallet(
    context: UserContext,
    itemId: string,
  ): Promise<PalletSummary> {
    requirePermission(context, 'edit', 'removeMarkFromPallet')

    const [item] = await db
      .select()
      .from(palletItems)
      .where(eq(palletItems.id, itemId))
      .limit(1)

    if (!item) throw new Error('Pallet item not found')

    const [pallet] = await db
      .select()
      .from(pallets)
      .where(eq(pallets.id, item.palletId))
      .limit(1)

    if (!pallet) throw new Error('Pallet not found')

    const itemWeight = Number(item.calculatedWeight || 0)
    const itemHeight = Number(item.calculatedHeight || 0)

    const newWeight = Math.max(0, Number(pallet.currentWeightLbs) - itemWeight)
    const newHeight = Math.max(
      0,
      Number(pallet.currentHeightInches) - itemHeight,
    )
    const newCount = Math.max(0, pallet.panelCount - item.quantity)

    await db.transaction(async (tx) => {
      await tx.delete(palletItems).where(eq(palletItems.id, itemId))
      await tx
        .update(pallets)
        .set({
          panelCount: newCount,
          currentWeightLbs: String(newWeight.toFixed(2)),
          currentHeightInches: String(newHeight.toFixed(2)),
          updatedAt: new Date(),
        })
        .where(eq(pallets.id, item.palletId))
    })

    await recordAuditEvent(context, {
      action: 'pallet.remove_item',
      entityType: 'pallet',
      entityId: pallet.id,
      quantity: item.quantity,
      details: { itemId, panelMarkId: item.panelMarkId },
    })

    return (await this.getPalletById(context, pallet.id))!
  }

  /**
   * Marks a pallet as Completed & Staged for shipment with strict validation.
   */
  static async completePallet(
    context: UserContext,
    palletId: string,
  ): Promise<PalletSummary> {
    requirePermission(context, 'approve', 'completePallet')

    const [pallet] = await db
      .select()
      .from(pallets)
      .where(eq(pallets.id, palletId))
      .limit(1)

    if (!pallet) throw new Error('Pallet not found')

    // 1. Revision Currentness Check
    let isCurrentRevision = true
    if (pallet.releaseRevisionId) {
      const [rev] = await db
        .select()
        .from(releaseRevisions)
        .where(eq(releaseRevisions.id, pallet.releaseRevisionId))
        .limit(1)
      if (rev && !rev.isCurrent) {
        isCurrentRevision = false
      }
    }

    // 2. QC Hold Check
    const items = await db
      .select({ panelMarkId: palletItems.panelMarkId })
      .from(palletItems)
      .where(eq(palletItems.palletId, palletId))

    const markIds = items.map((i) => i.panelMarkId)
    let hasActiveQCHold = false

    if (markIds.length > 0) {
      const activeHolds = await db
        .select({ count: sql<number>`count(*)` })
        .from(qualityIssues)
        .where(
          and(
            inArray(qualityIssues.panelMarkId, markIds),
            eq(qualityIssues.status, 'Open'),
            eq(qualityIssues.disposition, 'Hold'),
          ),
        )
      hasActiveQCHold = Number(activeHolds[0]?.count || 0) > 0
    }

    // 3. Staging Validation
    const validation = validatePalletForStaging(
      {
        id: pallet.id,
        palletNumber: pallet.palletNumber,
        status: pallet.status,
        panelCount: pallet.panelCount,
        currentWeightLbs: Number(pallet.currentWeightLbs),
        maxWeightLbs: Number(pallet.maxWeightLbs),
        currentHeightInches: Number(pallet.currentHeightInches),
        maxHeightInches: Number(pallet.maxHeightInches),
      },
      {
        isCurrentRevision,
        hasActiveQCHold,
      },
    )

    if (!validation.canStage) {
      throw new Error(
        `Pallet Staging Blocked:\n${validation.errors.join('\n')}`,
      )
    }

    await db
      .update(pallets)
      .set({
        status: 'Staged',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pallets.id, palletId))

    await recordAuditEvent(context, {
      action: 'pallet.complete',
      entityType: 'pallet',
      entityId: palletId,
      priorState: pallet.status,
      newState: 'Staged',
      quantity: pallet.panelCount,
      details: {
        palletNumber: pallet.palletNumber,
        weight: pallet.currentWeightLbs,
        height: pallet.currentHeightInches,
      },
    })

    await recordActivityEvent(context, {
      action: 'pallet_staged',
      entityType: 'pallet',
      entityId: palletId,
      description: `Pallet ${pallet.palletNumber} completed with ${pallet.panelCount} panels and staged for shipping.`,
    })

    return (await this.getPalletById(context, palletId))!
  }

  /**
   * Generates a CSV packing slip for a pallet including panel elevation breakdown.
   */
  static async exportPackingSlipCsv(
    context: UserContext,
    palletId: string,
  ): Promise<string> {
    const pallet = await this.getPalletById(context, palletId)
    if (!pallet) throw new Error('Pallet not found')

    const headers = [
      'Pallet Number',
      'Release Key',
      'Job Number',
      'Job Name',
      'Elevation',
      'Stack Sequence',
      'Panel Mark',
      'Material Family',
      'Color',
      'Dimensions',
      'Unit Weight (lbs)',
      'Total Weight (lbs)',
      'Quantity',
      'Staged At',
    ]

    const rows = (pallet.items || []).map((item) => [
      `"${pallet.palletNumber}"`,
      `"${pallet.releaseKey}"`,
      `"${pallet.jobNumber}"`,
      `"${pallet.jobName}"`,
      `"${item.elevation || pallet.elevation || 'All'}"`,
      item.sequence,
      `"${item.markCode}"`,
      `"${item.materialFamily}"`,
      `"${item.color || ''}"`,
      `"${item.dimensions || ''}"`,
      item.unitWeightLbs,
      item.totalWeightLbs,
      item.quantity,
      `"${item.stagedAt}"`,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}
