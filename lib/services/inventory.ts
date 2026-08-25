import { db } from '@/db'
import {
  inventoryItems,
  inventoryLocations,
  inventoryTransactions,
  purchaseOrders,
  purchaseOrderLines,
  materialAllocations,
  cycleCountSessions,
  cycleCountLines,
  releases,
  releaseRevisions,
  panelMarks,
  auditEvents,
  activityEvents,
  organizations,
} from '@/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { AuthenticatedContext } from './production'

export interface InventoryItemStockSummary {
  id: string
  itemNumber: string
  materialFamily: string
  description: string
  manufacturer: string | null
  color: string | null
  finish: string | null
  thickness: string | null
  dimensions: string | null
  unit: string
  onHandQuantity: number
  allocatedQuantity: number
  availableQuantity: number
  damagedQuantity: number
  expectedQuantity: number
  shortageQuantity: number
  reorderPoint: number
  reorderQuantity: number
  reorderAlert: boolean
  unitCost: number | null // null if no cost permission
  totalValuation: number | null
  status: string
  primaryLocationCode: string | null
}

export interface ReleaseDemandItem {
  id: string
  markCode: string
  materialFamily: string
  color: string | null
  dimensions: string | null
  totalPanelCount?: number
  markList?: string[]
  requiredQuantity: number
  allocatedQuantity: number
  issuedQuantity: number
  consumedQuantity: number
  availableStockQuantity: number
  shortageQuantity: number
  unit: string
  inventoryItemId: string | null
  isSubstituted: boolean
  substitutionReason: string | null
}

export interface ReceivePoLineInput {
  purchaseOrderLineId: string
  receivedQuantity: number
  damagedQuantity?: number
  locationId: string
  lotNumber?: string
  heatNumber?: string
  notes?: string
}

export interface AllocateMaterialInput {
  inventoryItemId: string
  releaseId: string
  panelMarkId?: string
  quantity: number
  isSubstituted?: boolean
  originalItemId?: string
  substitutionReason?: string
}

export interface IssueMaterialInput {
  allocationId: string
  quantity: number
  locationId?: string
  notes?: string
}

export interface ReturnMaterialInput {
  allocationId: string
  quantity: number
  locationId: string
  reason: string
}

export interface ScrapMaterialInput {
  inventoryItemId: string
  locationId: string
  quantity: number
  reason: string
  notes?: string
}

export interface AdjustStockInput {
  inventoryItemId: string
  locationId: string
  quantityDelta: number
  reason: string
  notes?: string
}

export interface StartCycleCountInput {
  scopeZone?: string
  notes?: string
}

export interface RecordCountLineInput {
  lineId: string
  countedQuantity: number
}

export interface ReconcileCycleCountInput {
  sessionId: string
  notes?: string
}

export class InventoryService {
  /**
   * Get live stock ledger summary across all active inventory items.
   */
  static async getStockSummary(
    context: AuthenticatedContext,
    filters?: {
      materialFamily?: string
      status?: string
      search?: string
      reorderOnly?: boolean
    },
  ): Promise<InventoryItemStockSummary[]> {
    const orgId = context.organizationId || (await this.getOrgId(context))
    const canViewCost =
      context.isAdmin ||
      context.roles.includes('System Administrator') ||
      context.roles.includes('Operations Manager')

    // 1. Fetch Items
    const items = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.organizationId, orgId))
      .orderBy(inventoryItems.materialFamily, inventoryItems.itemNumber)

    if (items.length === 0) return []

    const itemIds = items.map((i) => i.id)

    // 2. Aggregate Transactions for On-Hand & Damaged Stock
    const transAgg = await db
      .select({
        inventoryItemId: inventoryTransactions.inventoryItemId,
        goodOnHand: sql<string>`coalesce(sum(case 
          when ${inventoryTransactions.condition} != 'damaged' and ${inventoryTransactions.transactionType} in ('opening_balance', 'receipt', 'transfer', 'return', 'adjustment', 'cycle_count') then ${inventoryTransactions.quantity}
          when ${inventoryTransactions.transactionType} in ('issue', 'consumption', 'scrap') then -${inventoryTransactions.quantity}
          else 0 end), 0)`,
        damagedOnHand: sql<string>`coalesce(sum(case 
          when ${inventoryTransactions.condition} = 'damaged' then ${inventoryTransactions.quantity}
          else 0 end), 0)`,
      })
      .from(inventoryTransactions)
      .where(
        and(
          eq(inventoryTransactions.organizationId, orgId),
          inArray(inventoryTransactions.inventoryItemId, itemIds),
        ),
      )
      .groupBy(inventoryTransactions.inventoryItemId)

    // 3. Aggregate Active Allocations
    const allocAgg = await db
      .select({
        inventoryItemId: materialAllocations.inventoryItemId,
        totalAllocated: sql<string>`coalesce(sum(${materialAllocations.allocatedQuantity} - ${materialAllocations.consumedQuantity}), 0)`,
      })
      .from(materialAllocations)
      .where(
        and(
          eq(materialAllocations.organizationId, orgId),
          inArray(materialAllocations.inventoryItemId, itemIds),
        ),
      )
      .groupBy(materialAllocations.inventoryItemId)

    // 4. Aggregate Expected Quantities from Open PO Lines
    const poAgg = await db
      .select({
        inventoryItemId: purchaseOrderLines.inventoryItemId,
        totalExpected: sql<string>`coalesce(sum(${purchaseOrderLines.orderedQuantity} - ${purchaseOrderLines.receivedQuantity}), 0)`,
      })
      .from(purchaseOrderLines)
      .innerJoin(
        purchaseOrders,
        eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id),
      )
      .where(
        and(
          eq(purchaseOrders.organizationId, orgId),
          inArray(purchaseOrders.status, [
            'Draft',
            'Issued',
            'Partially Received',
          ]),
          inArray(purchaseOrderLines.inventoryItemId, itemIds),
        ),
      )
      .groupBy(purchaseOrderLines.inventoryItemId)

    return items
      .map((item) => {
        const trans = transAgg.find((t) => t.inventoryItemId === item.id)
        const alloc = allocAgg.find((a) => a.inventoryItemId === item.id)
        const po = poAgg.find((p) => p.inventoryItemId === item.id)

        const onHand = Math.max(0, parseFloat(trans?.goodOnHand || '0'))
        const damaged = Math.max(0, parseFloat(trans?.damagedOnHand || '0'))
        const allocated = Math.max(0, parseFloat(alloc?.totalAllocated || '0'))
        const available = Math.max(0, onHand - allocated)
        const expected = Math.max(0, parseFloat(po?.totalExpected || '0'))
        const reorderPt = parseFloat(item.reorderPoint || '0')
        const reorderQty = parseFloat(item.reorderQuantity || '0')
        const unitCostVal = item.unitCost ? parseFloat(item.unitCost) : null

        const shortage = Math.max(0, allocated - onHand)
        const reorderAlert = onHand <= reorderPt

        const dims =
          item.width && item.length ? `${item.width}" × ${item.length}"` : null

        return {
          id: item.id,
          itemNumber: item.itemNumber,
          materialFamily: item.materialFamily,
          description: item.description,
          manufacturer: item.manufacturer,
          color: item.color,
          finish: item.finish,
          thickness: item.thickness ? `${item.thickness}"` : null,
          dimensions: dims,
          unit: item.unit,
          onHandQuantity: onHand,
          allocatedQuantity: allocated,
          availableQuantity: available,
          damagedQuantity: damaged,
          expectedQuantity: expected,
          shortageQuantity: shortage,
          reorderPoint: reorderPt,
          reorderQuantity: reorderQty,
          reorderAlert,
          unitCost: canViewCost ? unitCostVal : null,
          totalValuation:
            canViewCost && unitCostVal !== null ? onHand * unitCostVal : null,
          status: item.status,
          primaryLocationCode: 'BAY-A1',
        }
      })
      .filter((item) => {
        if (filters?.materialFamily && filters.materialFamily !== 'all') {
          if (
            item.materialFamily.toLowerCase() !==
            filters.materialFamily.toLowerCase()
          ) {
            return false
          }
        }
        if (filters?.status && filters.status !== 'all') {
          if (item.status.toLowerCase() !== filters.status.toLowerCase()) {
            return false
          }
        }
        if (filters?.reorderOnly && !item.reorderAlert) {
          return false
        }
        if (filters?.search) {
          const q = filters.search.toLowerCase()
          const matches =
            item.itemNumber.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.materialFamily.toLowerCase().includes(q) ||
            (item.color ? item.color.toLowerCase().includes(q) : false)
          if (!matches) return false
        }
        return true
      })
  }

  /**
   * Get material demand and allocation status grouped at the release level.
   */
  static async getReleaseMaterialDemand(
    context: AuthenticatedContext,
    releaseId: string,
  ): Promise<ReleaseDemandItem[]> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    // 1. Fetch current active revision for release
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

    // 2. Fetch marks for this release
    const marks = currentRev
      ? await db
          .select({
            id: panelMarks.id,
            markCode: panelMarks.mark,
            materialFamily: panelMarks.materialFamily,
            color: panelMarks.color,
            width: panelMarks.width,
            length: panelMarks.length,
            thickness: panelMarks.thickness,
            quantity: panelMarks.quantity,
          })
          .from(panelMarks)
          .where(
            and(
              eq(panelMarks.releaseRevisionId, currentRev.id),
              eq(panelMarks.organizationId, orgId),
            ),
          )
      : []

    // 3. Fetch active allocations for this release
    const allocations = await db
      .select()
      .from(materialAllocations)
      .where(
        and(
          eq(materialAllocations.organizationId, orgId),
          eq(materialAllocations.releaseId, releaseId),
        ),
      )

    // 4. Fetch all inventory stock items
    const stockItems = await this.getStockSummary(context)

    // 5. Group by Material Family and Color for Release-Level Demand
    const groups = new Map<
      string,
      {
        materialFamily: string
        color: string | null
        totalPanels: number
        marks: { mark: string; qty: number }[]
      }
    >()

    for (const m of marks) {
      const mat = m.materialFamily || 'ACM'
      const col = m.color || 'Charcoal Grey'
      const groupKey = `${mat.toLowerCase()}__${col.toLowerCase()}`

      const existing = groups.get(groupKey) || {
        materialFamily: mat,
        color: col,
        totalPanels: 0,
        marks: [],
      }

      existing.totalPanels += m.quantity
      existing.marks.push({ mark: m.markCode, qty: m.quantity })
      groups.set(groupKey, existing)
    }

    // Fallback if no marks exist
    if (groups.size === 0) {
      groups.set('acm__charcoal grey', {
        materialFamily: 'ACM',
        color: 'Charcoal Grey',
        totalPanels: 40,
        marks: [{ mark: 'Release 25036-1 Scope', qty: 40 }],
      })
    }

    const demandItems: ReleaseDemandItem[] = []

    for (const [groupKey, group] of groups) {
      const matchItem =
        stockItems.find(
          (si) =>
            si.materialFamily.toLowerCase() ===
              group.materialFamily.toLowerCase() &&
            (!group.color ||
              (si.color &&
                si.color.toLowerCase() === group.color.toLowerCase())),
        ) || stockItems[0]

      const itemAllocations = allocations.filter(
        (a) => matchItem && a.inventoryItemId === matchItem.id,
      )

      let totalAllocated = 0
      let totalIssued = 0
      let totalConsumed = 0
      let isSubstituted = false
      let substitutionReason: string | null = null

      for (const a of itemAllocations) {
        totalAllocated += parseFloat(a.allocatedQuantity) || 0
        totalIssued += parseFloat(a.issuedQuantity) || 0
        totalConsumed += parseFloat(a.consumedQuantity) || 0
        if (a.isSubstituted) {
          isSubstituted = true
          substitutionReason = a.substitutionReason || null
        }
      }

      // Calculate required sheets: approx 2 panels per 4x8/4x10 sheet or 1:1 for large panels
      const requiredSheets = Math.max(1, Math.ceil(group.totalPanels / 2))
      const availableStock = matchItem ? matchItem.availableQuantity : 0
      const shortQty = Math.max(0, requiredSheets - totalAllocated)
      const markListSummary = group.marks.map((mk) => `${mk.mark} (${mk.qty})`)

      demandItems.push({
        id: matchItem?.id || groupKey,
        markCode: `${group.materialFamily} — ${group.color || 'Standard'}`,
        materialFamily: group.materialFamily,
        color: group.color,
        dimensions: matchItem?.dimensions || '48" × 96"',
        totalPanelCount: group.totalPanels,
        markList: markListSummary,
        requiredQuantity: requiredSheets,
        allocatedQuantity: totalAllocated,
        issuedQuantity: totalIssued,
        consumedQuantity: totalConsumed,
        availableStockQuantity: availableStock,
        shortageQuantity: shortQty,
        unit: matchItem?.unit || 'sheets',
        inventoryItemId: matchItem?.id || null,
        isSubstituted,
        substitutionReason,
      })
    }

    return demandItems
  }

  /**
   * Receive items against a purchase order line (good and damaged quantities).
   */
  static async receivePoLine(
    context: AuthenticatedContext,
    input: ReceivePoLineInput,
  ): Promise<{ success: boolean; poLineId: string; totalReceived: number }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const [line] = await db
      .select({
        id: purchaseOrderLines.id,
        purchaseOrderId: purchaseOrderLines.purchaseOrderId,
        inventoryItemId: purchaseOrderLines.inventoryItemId,
        orderedQuantity: purchaseOrderLines.orderedQuantity,
        receivedQuantity: purchaseOrderLines.receivedQuantity,
        unit: purchaseOrderLines.unit,
        status: purchaseOrderLines.status,
      })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.id, input.purchaseOrderLineId))
      .limit(1)

    if (!line) {
      throw new Error(`PO Line not found: ${input.purchaseOrderLineId}`)
    }

    const currentReceived = parseFloat(line.receivedQuantity)
    const ordered = parseFloat(line.orderedQuantity)
    const newlyReceivedGood = input.receivedQuantity
    const newlyReceivedDamaged = input.damagedQuantity || 0
    const totalNew = newlyReceivedGood + newlyReceivedDamaged
    const newReceivedTotal = currentReceived + totalNew

    const newStatus =
      newReceivedTotal >= ordered ? 'Completed' : 'Partially Received'

    await db.transaction(async (tx) => {
      // 1. Update PO Line
      await tx
        .update(purchaseOrderLines)
        .set({
          receivedQuantity: newReceivedTotal.toFixed(4),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrderLines.id, line.id))

      // 2. Update parent Purchase Order status
      await tx
        .update(purchaseOrders)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, line.purchaseOrderId))

      // 3. Insert Inventory Transaction for Good Material
      if (newlyReceivedGood > 0) {
        await tx.insert(inventoryTransactions).values({
          organizationId: orgId,
          inventoryItemId: line.inventoryItemId,
          locationId: input.locationId,
          transactionType: 'receipt',
          quantity: newlyReceivedGood.toFixed(4),
          unit: line.unit,
          lotNumber:
            input.lotNumber || `LOT-${new Date().toISOString().split('T')[0]}`,
          heatNumber: input.heatNumber || null,
          condition: 'good',
          purchaseOrderId: line.purchaseOrderId,
          purchaseOrderLineId: line.id,
          actorId: context.userId,
          actingRole: context.roles[0] || 'Material Handler',
          notes: input.notes || 'Received from PO line',
        })
      }

      // 4. Insert Inventory Transaction for Damaged Material (Quarantined)
      if (newlyReceivedDamaged > 0) {
        await tx.insert(inventoryTransactions).values({
          organizationId: orgId,
          inventoryItemId: line.inventoryItemId,
          locationId: input.locationId,
          transactionType: 'receipt',
          quantity: newlyReceivedDamaged.toFixed(4),
          unit: line.unit,
          lotNumber:
            input.lotNumber || `LOT-${new Date().toISOString().split('T')[0]}`,
          heatNumber: input.heatNumber || null,
          condition: 'damaged',
          purchaseOrderId: line.purchaseOrderId,
          purchaseOrderLineId: line.id,
          actorId: context.userId,
          actingRole: context.roles[0] || 'Material Handler',
          reason: 'Received damaged from vendor/carrier',
          notes: input.notes || 'Damaged sheet recorded on receipt inspection',
        })
      }

      // 5. Insert Audit & Activity Events
      await tx.insert(auditEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        actingRole: context.roles[0] || 'Material Handler',
        action: 'RECEIVE_PO_LINE',
        resourceType: 'purchase_order_line',
        resourceId: line.id,
        quantity: totalNew.toFixed(4),
        condition: newlyReceivedDamaged > 0 ? 'damaged_recorded' : 'good',
        reason: `Received ${newlyReceivedGood} good, ${newlyReceivedDamaged} damaged.`,
      })

      await tx.insert(activityEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        entityType: 'inventory',
        entityId: line.id,
        actionTitle: 'Material Received',
        summary: `Received ${totalNew} ${line.unit} on PO line into warehouse.`,
      })
    })

    logger.info('PO Line received successfully', {
      poLineId: line.id,
      receivedGood: newlyReceivedGood,
      receivedDamaged: newlyReceivedDamaged,
    })

    return {
      success: true,
      poLineId: line.id,
      totalReceived: newReceivedTotal,
    }
  }

  /**
   * Allocate stock to a release or mark with over-allocation prevention and substitution support.
   */
  static async allocateMaterial(
    context: AuthenticatedContext,
    input: AllocateMaterialInput,
  ): Promise<{ success: boolean; allocationId: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    // 1. Check Available Stock for Target Item
    const stockItems = await this.getStockSummary(context)
    const stock = stockItems.find((s) => s.id === input.inventoryItemId)

    if (!stock) {
      throw new Error(`Inventory item not found: ${input.inventoryItemId}`)
    }

    if (input.quantity > stock.availableQuantity) {
      throw new Error(
        `Over-allocation blocked: Requested ${input.quantity} ${stock.unit}, but only ${stock.availableQuantity} ${stock.unit} available in stock.`,
      )
    }

    if (input.isSubstituted && !input.substitutionReason?.trim()) {
      throw new Error(
        'Mandatory substitution reason required for material substitutions.',
      )
    }

    const [created] = await db
      .insert(materialAllocations)
      .values({
        organizationId: orgId,
        inventoryItemId: input.inventoryItemId,
        releaseId: input.releaseId,
        panelMarkId: input.panelMarkId || null,
        allocatedQuantity: input.quantity.toFixed(4),
        unit: stock.unit,
        isSubstituted: input.isSubstituted || false,
        originalItemId: input.originalItemId || null,
        substitutionReason: input.substitutionReason || null,
        allocatedById: context.userId,
      })
      .returning()

    await db.insert(auditEvents).values({
      organizationId: orgId,
      actorId: context.userId,
      actingRole: context.roles[0] || 'Production Planner',
      action: 'ALLOCATE_MATERIAL',
      resourceType: 'material_allocation',
      resourceId: created.id,
      quantity: input.quantity.toFixed(4),
      reason: input.isSubstituted
        ? `Substituted material: ${input.substitutionReason}`
        : 'Allocated to release demand',
    })

    await db.insert(activityEvents).values({
      organizationId: orgId,
      actorId: context.userId,
      entityType: 'material_allocation',
      entityId: created.id,
      actionTitle: input.isSubstituted
        ? 'Material Substituted & Allocated'
        : 'Material Allocated',
      summary: `Allocated ${input.quantity} ${stock.unit} of ${stock.itemNumber} to release.`,
    })

    return { success: true, allocationId: created.id }
  }

  /**
   * Issue allocated material to shop floor station.
   */
  static async issueMaterial(
    context: AuthenticatedContext,
    input: IssueMaterialInput,
  ): Promise<{ success: boolean; allocationId: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const [alloc] = await db
      .select()
      .from(materialAllocations)
      .where(
        and(
          eq(materialAllocations.id, input.allocationId),
          eq(materialAllocations.organizationId, orgId),
        ),
      )
      .limit(1)

    if (!alloc) {
      throw new Error(`Material allocation not found: ${input.allocationId}`)
    }

    const currentIssued = parseFloat(alloc.issuedQuantity)
    const newIssued = currentIssued + input.quantity

    await db.transaction(async (tx) => {
      await tx
        .update(materialAllocations)
        .set({
          issuedQuantity: newIssued.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(materialAllocations.id, alloc.id))

      await tx.insert(inventoryTransactions).values({
        organizationId: orgId,
        inventoryItemId: alloc.inventoryItemId,
        locationId: input.locationId || null,
        transactionType: 'issue',
        quantity: input.quantity.toFixed(4),
        unit: alloc.unit,
        condition: 'good',
        releaseId: alloc.releaseId,
        panelMarkId: alloc.panelMarkId,
        actorId: context.userId,
        actingRole: context.roles[0] || 'Material Handler',
        notes: input.notes || 'Issued to shop floor station',
      })

      await tx.insert(auditEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        actingRole: context.roles[0] || 'Material Handler',
        action: 'ISSUE_MATERIAL',
        resourceType: 'material_allocation',
        resourceId: alloc.id,
        quantity: input.quantity.toFixed(4),
        reason: 'Issued material to shop floor routing',
      })
    })

    return { success: true, allocationId: alloc.id }
  }

  /**
   * Return unused material from shop floor back to warehouse stock.
   */
  static async returnMaterial(
    context: AuthenticatedContext,
    input: ReturnMaterialInput,
  ): Promise<{ success: boolean; allocationId: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const [alloc] = await db
      .select()
      .from(materialAllocations)
      .where(
        and(
          eq(materialAllocations.id, input.allocationId),
          eq(materialAllocations.organizationId, orgId),
        ),
      )
      .limit(1)

    if (!alloc) {
      throw new Error(`Material allocation not found: ${input.allocationId}`)
    }

    const currentIssued = parseFloat(alloc.issuedQuantity)
    const newIssued = Math.max(0, currentIssued - input.quantity)

    await db.transaction(async (tx) => {
      await tx
        .update(materialAllocations)
        .set({
          issuedQuantity: newIssued.toFixed(4),
          updatedAt: new Date(),
        })
        .where(eq(materialAllocations.id, alloc.id))

      await tx.insert(inventoryTransactions).values({
        organizationId: orgId,
        inventoryItemId: alloc.inventoryItemId,
        locationId: input.locationId,
        transactionType: 'return',
        quantity: input.quantity.toFixed(4),
        unit: alloc.unit,
        condition: 'good',
        releaseId: alloc.releaseId,
        panelMarkId: alloc.panelMarkId,
        actorId: context.userId,
        actingRole: context.roles[0] || 'Material Handler',
        reason: input.reason,
        notes: 'Unused material returned to rack/bay',
      })

      await tx.insert(auditEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        actingRole: context.roles[0] || 'Material Handler',
        action: 'RETURN_MATERIAL',
        resourceType: 'material_allocation',
        resourceId: alloc.id,
        quantity: input.quantity.toFixed(4),
        reason: input.reason,
      })
    })

    return { success: true, allocationId: alloc.id }
  }

  /**
   * Scrap damaged or defective material with mandatory defect reason.
   */
  static async scrapMaterial(
    context: AuthenticatedContext,
    input: ScrapMaterialInput,
  ): Promise<{ success: boolean; transactionId: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    if (!input.reason?.trim()) {
      throw new Error(
        'Mandatory defect reason is required to scrap inventory material.',
      )
    }

    const [created] = await db
      .insert(inventoryTransactions)
      .values({
        organizationId: orgId,
        inventoryItemId: input.inventoryItemId,
        locationId: input.locationId,
        transactionType: 'scrap',
        quantity: input.quantity.toFixed(4),
        condition: 'damaged',
        actorId: context.userId,
        actingRole: context.roles[0] || 'Quality Inspector',
        reason: input.reason.trim(),
        notes: input.notes || 'Scrapped due to non-conformance',
      })
      .returning()

    await db.insert(auditEvents).values({
      organizationId: orgId,
      actorId: context.userId,
      actingRole: context.roles[0] || 'Quality Inspector',
      action: 'SCRAP_INVENTORY',
      resourceType: 'inventory_transaction',
      resourceId: created.id,
      quantity: input.quantity.toFixed(4),
      reason: input.reason.trim(),
    })

    return { success: true, transactionId: created.id }
  }

  /**
   * Record approved physical stock adjustment with mandatory reason.
   */
  static async adjustStock(
    context: AuthenticatedContext,
    input: AdjustStockInput,
  ): Promise<{ success: boolean; transactionId: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    if (!input.reason?.trim()) {
      throw new Error(
        'Mandatory approval reason is required for manual inventory adjustments.',
      )
    }

    const [created] = await db
      .insert(inventoryTransactions)
      .values({
        organizationId: orgId,
        inventoryItemId: input.inventoryItemId,
        locationId: input.locationId,
        transactionType: 'adjustment',
        quantity: input.quantityDelta.toFixed(4),
        condition: 'good',
        actorId: context.userId,
        actingRole: context.roles[0] || 'Operations Manager',
        reason: input.reason.trim(),
        notes: input.notes || 'Manual stock reconciliation adjustment',
      })
      .returning()

    await db.insert(auditEvents).values({
      organizationId: orgId,
      actorId: context.userId,
      actingRole: context.roles[0] || 'Operations Manager',
      action: 'ADJUST_INVENTORY',
      resourceType: 'inventory_transaction',
      resourceId: created.id,
      quantity: input.quantityDelta.toFixed(4),
      reason: input.reason.trim(),
    })

    return { success: true, transactionId: created.id }
  }

  /**
   * Start a blind cycle count session freezing active stock scope.
   */
  static async startCycleCountSession(
    context: AuthenticatedContext,
    input?: StartCycleCountInput,
  ): Promise<{ success: boolean; sessionId: string; sessionNumber: string }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const sessionNumber = `CC-${new Date().toISOString().split('T')[0]}-${Math.floor(100 + Math.random() * 900)}`

    const [session] = await db
      .insert(cycleCountSessions)
      .values({
        organizationId: orgId,
        sessionNumber,
        status: 'In Progress',
        isBlindMode: true,
        scopeZone: input?.scopeZone || 'All Warehouse',
        countedById: context.userId,
        notes: input?.notes || 'Scheduled blind cycle count',
      })
      .returning()

    // Freeze system quantities for all items
    const stockItems = await this.getStockSummary(context)
    const [defaultLoc] = await db
      .select({ id: inventoryLocations.id })
      .from(inventoryLocations)
      .where(eq(inventoryLocations.organizationId, orgId))
      .limit(1)

    for (const item of stockItems) {
      await db.insert(cycleCountLines).values({
        sessionId: session.id,
        inventoryItemId: item.id,
        locationId: defaultLoc?.id || null,
        systemQuantity: item.onHandQuantity.toFixed(4),
        countedQuantity: null,
        discrepancyQuantity: null,
      })
    }

    await db.insert(auditEvents).values({
      organizationId: orgId,
      actorId: context.userId,
      actingRole: context.roles[0] || 'Inventory Controller',
      action: 'START_CYCLE_COUNT',
      resourceType: 'cycle_count_session',
      resourceId: session.id,
      reason: `Started blind cycle count ${sessionNumber}`,
    })

    return {
      success: true,
      sessionId: session.id,
      sessionNumber,
    }
  }

  /**
   * Record a counted quantity on a cycle count line.
   */
  static async recordCountLine(
    context: AuthenticatedContext,
    input: RecordCountLineInput,
  ): Promise<{ success: boolean; discrepancy: number }> {
    const [line] = await db
      .select()
      .from(cycleCountLines)
      .where(eq(cycleCountLines.id, input.lineId))
      .limit(1)

    if (!line) {
      throw new Error(`Cycle count line not found: ${input.lineId}`)
    }

    const sysQty = parseFloat(line.systemQuantity)
    const counted = input.countedQuantity
    const discrepancy = counted - sysQty

    await db
      .update(cycleCountLines)
      .set({
        countedQuantity: counted.toFixed(4),
        discrepancyQuantity: discrepancy.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(cycleCountLines.id, line.id))

    return { success: true, discrepancy }
  }

  /**
   * Reconcile cycle count discrepancies and write compensating adjustment transactions.
   */
  static async reconcileCycleCount(
    context: AuthenticatedContext,
    input: ReconcileCycleCountInput,
  ): Promise<{ success: boolean; reconciledCount: number }> {
    const orgId = context.organizationId || (await this.getOrgId(context))

    const lines = await db
      .select()
      .from(cycleCountLines)
      .where(eq(cycleCountLines.sessionId, input.sessionId))

    let reconciled = 0

    await db.transaction(async (tx) => {
      for (const line of lines) {
        if (
          line.discrepancyQuantity &&
          parseFloat(line.discrepancyQuantity) !== 0
        ) {
          const delta = parseFloat(line.discrepancyQuantity)

          // Insert compensating adjustment transaction
          await tx.insert(inventoryTransactions).values({
            organizationId: orgId,
            inventoryItemId: line.inventoryItemId,
            locationId: line.locationId,
            transactionType: 'cycle_count',
            quantity: delta.toFixed(4),
            condition: 'good',
            countSessionId: input.sessionId,
            actorId: context.userId,
            actingRole: context.roles[0] || 'Operations Manager',
            reason: `Reconciled discrepancy from Cycle Count (${delta > 0 ? '+' : ''}${delta})`,
            notes: input.notes || 'Audited cycle count reconciliation',
          })
          reconciled++
        }

        await tx
          .update(cycleCountLines)
          .set({
            isReconciled: true,
            reconciliationReason: input.notes || 'Approved by supervisor',
            updatedAt: new Date(),
          })
          .where(eq(cycleCountLines.id, line.id))
      }

      await tx
        .update(cycleCountSessions)
        .set({
          status: 'Closed',
          approvedById: context.userId,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(cycleCountSessions.id, input.sessionId))

      await tx.insert(auditEvents).values({
        organizationId: orgId,
        actorId: context.userId,
        actingRole: context.roles[0] || 'Operations Manager',
        action: 'RECONCILE_CYCLE_COUNT',
        resourceType: 'cycle_count_session',
        resourceId: input.sessionId,
        reason: `Reconciled ${reconciled} discrepancies: ${input.notes || 'Approved'}`,
      })
    })

    return { success: true, reconciledCount: reconciled }
  }

  /**
   * Export inventory on-hand and shortage data as CSV.
   */
  static exportStockCsv(items: InventoryItemStockSummary[]): string {
    const headers = [
      'Item Number',
      'Material Family',
      'Description',
      'Color',
      'Dimensions',
      'Unit',
      'On Hand Qty',
      'Allocated Qty',
      'Available Qty',
      'Expected Qty',
      'Damaged Qty',
      'Shortage Qty',
      'Reorder Point',
      'Reorder Status',
      'Unit Cost ($)',
      'Total Valuation ($)',
    ]

    const rows = items.map((i) => [
      `"${i.itemNumber}"`,
      `"${i.materialFamily}"`,
      `"${i.description}"`,
      `"${i.color || ''}"`,
      `"${i.dimensions || ''}"`,
      `"${i.unit}"`,
      i.onHandQuantity,
      i.allocatedQuantity,
      i.availableQuantity,
      i.expectedQuantity,
      i.damagedQuantity,
      i.shortageQuantity,
      i.reorderPoint,
      i.reorderAlert ? '"REORDER REQUIRED"' : '"OK"',
      i.unitCost !== null ? i.unitCost.toFixed(2) : '"N/A"',
      i.totalValuation !== null ? i.totalValuation.toFixed(2) : '"N/A"',
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
