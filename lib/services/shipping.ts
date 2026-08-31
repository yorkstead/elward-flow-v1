import { db } from '@/db'
import {
  shipments,
  shipmentPallets,
  pallets,
  releases,
  productionJobs,
  users,
} from '@/db/schema'
import { eq, and, sql, desc, inArray } from 'drizzle-orm'
import { UserContext } from '@/lib/auth/roles'
import { requirePermission } from '@/lib/middleware/authorize'
import { recordAuditEvent, recordActivityEvent } from '@/lib/services/audit'

export interface ShipmentSummary {
  id: string
  shipmentNumber: string
  carrier: string
  trailerNumber: string | null
  driverName: string | null
  driverPhone: string | null
  bolNumber: string | null
  status: string
  scheduledDeparture: string | null
  actualDeparture: string | null
  originAddress: string
  destinationAddress: string | null
  totalWeightLbs: number
  totalPallets: number
  totalPanels: number
  dispatchedByName: string | null
  notes: string | null
  createdAt: string
  pallets?: ShipmentPalletDetail[]
}

export interface ShipmentPalletDetail {
  id: string
  shipmentId: string
  palletId: string
  palletNumber: string
  releaseKey: string
  jobNumber: string
  jobName: string
  elevation: string | null
  panelCount: number
  weightLbs: number
  truckPosition: number | null
  loadedAt: string
}

export interface CreateShipmentInput {
  carrier?: string
  trailerNumber?: string
  driverName?: string
  driverPhone?: string
  destinationAddress?: string
  scheduledDeparture?: string
  notes?: string
}

export interface LoadPalletInput {
  shipmentId: string
  palletId: string
  truckPosition?: number
}

function requireOrganization(context: UserContext) {
  if (!context.organizationId) throw new Error('Organization context required.')
  return context.organizationId
}

export class ShippingService {
  /**
   * Retrieves shipments with loaded pallets count and totals.
   */
  static async getShipments(
    context: UserContext,
    filters?: { status?: string },
  ): Promise<ShipmentSummary[]> {
    const orgId = requireOrganization(context)

    const conditions = [eq(shipments.organizationId, orgId)]
    if (filters?.status) {
      conditions.push(eq(shipments.status, filters.status))
    }

    const rows = await db
      .select({
        id: shipments.id,
        shipmentNumber: shipments.shipmentNumber,
        carrier: shipments.carrier,
        trailerNumber: shipments.trailerNumber,
        driverName: shipments.driverName,
        driverPhone: shipments.driverPhone,
        bolNumber: shipments.bolNumber,
        status: shipments.status,
        scheduledDeparture: shipments.scheduledDeparture,
        actualDeparture: shipments.actualDeparture,
        originAddress: shipments.originAddress,
        destinationAddress: shipments.destinationAddress,
        totalWeightLbs: shipments.totalWeightLbs,
        totalPallets: shipments.totalPallets,
        dispatchedByName: users.name,
        notes: shipments.notes,
        createdAt: shipments.createdAt,
      })
      .from(shipments)
      .leftJoin(users, eq(shipments.dispatchedById, users.id))
      .where(and(...conditions))
      .orderBy(desc(shipments.createdAt))

    return rows.map((r) => ({
      id: r.id,
      shipmentNumber: r.shipmentNumber,
      carrier: r.carrier,
      trailerNumber: r.trailerNumber,
      driverName: r.driverName,
      driverPhone: r.driverPhone,
      bolNumber: r.bolNumber,
      status: r.status,
      scheduledDeparture: r.scheduledDeparture
        ? r.scheduledDeparture.toISOString()
        : null,
      actualDeparture: r.actualDeparture
        ? r.actualDeparture.toISOString()
        : null,
      originAddress: r.originAddress,
      destinationAddress: r.destinationAddress,
      totalWeightLbs: Number(r.totalWeightLbs),
      totalPallets: r.totalPallets,
      totalPanels: 0, // calculated on detail query
      dispatchedByName: r.dispatchedByName,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  /**
   * Retrieves single shipment with loaded pallet details.
   */
  static async getShipmentById(
    context: UserContext,
    shipmentId: string,
  ): Promise<ShipmentSummary | null> {
    const list = await this.getShipments(context)
    const found = list.find((s) => s.id === shipmentId)
    if (!found) return null

    const palletRows = await db
      .select({
        id: shipmentPallets.id,
        shipmentId: shipmentPallets.shipmentId,
        palletId: shipmentPallets.palletId,
        truckPosition: shipmentPallets.truckPosition,
        loadedAt: shipmentPallets.loadedAt,
        palletNumber: pallets.palletNumber,
        elevation: pallets.elevation,
        panelCount: pallets.panelCount,
        weightLbs: pallets.currentWeightLbs,
        releaseNumber: releases.releaseNumber,
        jobNumber: productionJobs.jobNumber,
        jobName: productionJobs.name,
      })
      .from(shipmentPallets)
      .innerJoin(pallets, eq(shipmentPallets.palletId, pallets.id))
      .innerJoin(releases, eq(pallets.releaseId, releases.id))
      .innerJoin(productionJobs, eq(releases.jobId, productionJobs.id))
      .where(eq(shipmentPallets.shipmentId, shipmentId))
      .orderBy(shipmentPallets.truckPosition)

    let totalPanels = 0
    found.pallets = palletRows.map((p) => {
      totalPanels += p.panelCount
      return {
        id: p.id,
        shipmentId: p.shipmentId,
        palletId: p.palletId,
        palletNumber: p.palletNumber,
        releaseKey: `${p.jobNumber}-R${p.releaseNumber}`,
        jobNumber: p.jobNumber,
        jobName: p.jobName,
        elevation: p.elevation,
        panelCount: p.panelCount,
        weightLbs: Number(p.weightLbs),
        truckPosition: p.truckPosition,
        loadedAt: p.loadedAt.toISOString(),
      }
    })

    found.totalPanels = totalPanels
    return found
  }

  /**
   * Creates a new shipment load.
   */
  static async createShipment(
    context: UserContext,
    input: CreateShipmentInput,
  ): Promise<ShipmentSummary> {
    requirePermission(context, 'create', 'createShipment')
    const orgId = requireOrganization(context)

    const existingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(shipments)
      .where(eq(shipments.organizationId, orgId))
    const seq = Number(existingCount[0]?.count || 0) + 1
    const shipmentNumber = `SHP-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`

    const [created] = await db
      .insert(shipments)
      .values({
        organizationId: orgId,
        shipmentNumber,
        carrier: input.carrier || 'Dedicated Logistics',
        trailerNumber: input.trailerNumber || null,
        driverName: input.driverName || null,
        driverPhone: input.driverPhone || null,
        destinationAddress:
          input.destinationAddress ||
          'Job Site Staging - 4500 Gateway Blvd, Tempe, AZ',
        scheduledDeparture: input.scheduledDeparture
          ? new Date(input.scheduledDeparture)
          : null,
        status: 'Draft',
        notes: input.notes || null,
      })
      .returning()

    await recordAuditEvent(context, {
      action: 'shipment.create',
      entityType: 'shipment',
      entityId: created.id,
      newState: 'Draft',
      details: { shipmentNumber, carrier: input.carrier },
    })

    await recordActivityEvent(context, {
      action: 'shipment_created',
      entityType: 'shipment',
      entityId: created.id,
      description: `Created shipment ${shipmentNumber} with carrier ${input.carrier || 'Dedicated Logistics'}`,
    })

    return (await this.getShipmentById(context, created.id))!
  }

  /**
   * Stages and loads a pallet onto the flatbed trailer.
   */
  static async stagePalletOnShipment(
    context: UserContext,
    input: LoadPalletInput,
  ): Promise<ShipmentSummary> {
    requirePermission(context, 'edit', 'stagePalletOnShipment')
    const orgId = requireOrganization(context)
    await db.transaction(async (tx) => {
      const [shipment] = await tx
        .select()
        .from(shipments)
        .where(
          and(
            eq(shipments.id, input.shipmentId),
            eq(shipments.organizationId, orgId),
          ),
        )
        .for('update')
      if (!shipment) throw new Error('Shipment not found in this organization')
      if (!['Draft', 'Loading', 'Ready'].includes(shipment.status))
        throw new Error('Cannot modify a dispatched shipment')
      const [pallet] = await tx
        .select()
        .from(pallets)
        .where(
          and(
            eq(pallets.id, input.palletId),
            eq(pallets.organizationId, orgId),
          ),
        )
        .for('update')
      if (!pallet) throw new Error('Pallet not found in this organization')
      const [existing] = await tx
        .select()
        .from(shipmentPallets)
        .where(eq(shipmentPallets.palletId, pallet.id))
        .limit(1)
      if (existing) {
        if (
          existing.shipmentId === shipment.id &&
          (input.truckPosition === undefined ||
            input.truckPosition === existing.truckPosition)
        )
          return
        throw new Error('Pallet is already assigned to a shipment')
      }
      if (!['Complete', 'Completed', 'Staged', 'Ready'].includes(pallet.status))
        throw new Error('Complete and stage the pallet before loading')
      const totalWeight =
        Number(shipment.totalWeightLbs) + Number(pallet.currentWeightLbs)
      const totalPallets = shipment.totalPallets + 1
      if (totalWeight > 45000 || totalPallets > 26)
        throw new Error('Truck weight or pallet capacity exceeded')
      const loaded = await tx
        .select()
        .from(shipmentPallets)
        .where(eq(shipmentPallets.shipmentId, shipment.id))
      const occupied = new Set(loaded.map((p) => p.truckPosition))
      const position =
        input.truckPosition ??
        Array.from({ length: 26 }, (_, i) => i + 1).find(
          (p) => !occupied.has(p),
        )
      if (
        !position ||
        !Number.isInteger(position) ||
        position < 1 ||
        position > 26 ||
        occupied.has(position)
      )
        throw new Error('Invalid or occupied truck position')
      await tx.insert(shipmentPallets).values({
        organizationId: orgId,
        shipmentId: shipment.id,
        palletId: pallet.id,
        truckPosition: position,
        loadedById: context.userId,
      })
      await tx
        .update(shipments)
        .set({
          totalPallets,
          totalWeightLbs: totalWeight.toFixed(2),
          status: 'Loading',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(shipments.id, shipment.id),
            eq(shipments.totalPallets, shipment.totalPallets),
          ),
        )
      await recordAuditEvent(
        context,
        {
          action: 'shipment.load_pallet',
          entityType: 'shipment',
          entityId: shipment.id,
          priorState: shipment.status,
          newState: 'Loading',
          quantity: pallet.panelCount,
          details: {
            palletId: pallet.id,
            truckPosition: position,
            loadWeightLbs: totalWeight,
          },
        },
        tx,
      )
    })
    return (await this.getShipmentById(context, input.shipmentId))!
  }

  static async removePalletFromShipment(
    context: UserContext,
    shipmentPalletId: string,
    expectedShipmentId?: string,
  ): Promise<ShipmentSummary> {
    requirePermission(context, 'edit', 'removePalletFromShipment')
    const orgId = requireOrganization(context)
    const shipmentId = await db.transaction(async (tx) => {
      const [initial] = await tx
        .select()
        .from(shipmentPallets)
        .where(
          and(
            eq(shipmentPallets.id, shipmentPalletId),
            eq(shipmentPallets.organizationId, orgId),
          ),
        )
        .limit(1)
      if (
        !initial ||
        (expectedShipmentId && initial.shipmentId !== expectedShipmentId)
      )
        throw new Error('Shipment pallet entry not found')
      const [shipment] = await tx
        .select()
        .from(shipments)
        .where(
          and(
            eq(shipments.id, initial.shipmentId),
            eq(shipments.organizationId, orgId),
          ),
        )
        .for('update')
      if (!shipment || !['Draft', 'Loading', 'Ready'].includes(shipment.status))
        throw new Error('Cannot remove pallets from this shipment')
      const [pallet] = await tx
        .select()
        .from(pallets)
        .where(
          and(
            eq(pallets.id, initial.palletId),
            eq(pallets.organizationId, orgId),
          ),
        )
        .for('update')
      if (!pallet) throw new Error('Pallet not found')
      const [removed] = await tx
        .delete(shipmentPallets)
        .where(
          and(
            eq(shipmentPallets.id, shipmentPalletId),
            eq(shipmentPallets.organizationId, orgId),
          ),
        )
        .returning()
      if (!removed) return shipment.id
      await tx
        .update(shipments)
        .set({
          totalPallets: shipment.totalPallets - 1,
          totalWeightLbs: (
            Number(shipment.totalWeightLbs) - Number(pallet.currentWeightLbs)
          ).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(shipments.id, shipment.id))
      await recordAuditEvent(
        context,
        {
          action: 'shipment.remove_pallet',
          entityType: 'shipment',
          entityId: shipment.id,
          quantity: pallet.panelCount,
          details: { palletId: pallet.id, shipmentPalletId },
        },
        tx,
      )
      return shipment.id
    })
    return (await this.getShipmentById(context, shipmentId))!
  }

  static async dispatchShipment(
    context: UserContext,
    input: { shipmentId: string; bolNumber?: string; notes?: string },
  ): Promise<ShipmentSummary> {
    requirePermission(context, 'approve', 'dispatchShipment')
    const orgId = requireOrganization(context)
    await db.transaction(async (tx) => {
      const [shipment] = await tx
        .select()
        .from(shipments)
        .where(
          and(
            eq(shipments.id, input.shipmentId),
            eq(shipments.organizationId, orgId),
          ),
        )
        .for('update')
      if (!shipment) throw new Error('Shipment not found')
      if (shipment.status === 'Dispatched') return
      if (!['Loading', 'Ready'].includes(shipment.status))
        throw new Error('Shipment is not ready for dispatch')
      const loaded = await tx
        .select()
        .from(shipmentPallets)
        .where(
          and(
            eq(shipmentPallets.shipmentId, shipment.id),
            eq(shipmentPallets.organizationId, orgId),
          ),
        )
      if (loaded.length === 0 || loaded.length !== shipment.totalPallets)
        throw new Error('Shipment load count is empty or inconsistent')
      const palletIds = loaded.map((p) => p.palletId)
      const loadedPallets = await tx
        .select()
        .from(pallets)
        .where(
          and(
            inArray(pallets.id, palletIds),
            eq(pallets.organizationId, orgId),
          ),
        )
        .orderBy(pallets.id)
        .for('update')
      if (
        loadedPallets.length !== loaded.length ||
        loadedPallets.some(
          (p) =>
            !['Complete', 'Completed', 'Staged', 'Ready'].includes(p.status),
        )
      )
        throw new Error('All pallets must be complete and staged')
      const actualWeight = loadedPallets.reduce(
        (sum, p) => sum + Number(p.currentWeightLbs),
        0,
      )
      if (actualWeight > 45000 || loaded.length > 26)
        throw new Error('Truck capacity exceeded')
      const departure = new Date()
      const bolNumber = input.bolNumber || `BOL-${shipment.shipmentNumber}`
      await tx
        .update(shipments)
        .set({
          status: 'Dispatched',
          bolNumber,
          actualDeparture: departure,
          dispatchedById: context.userId,
          notes: input.notes || shipment.notes,
          totalWeightLbs: actualWeight.toFixed(2),
          updatedAt: departure,
        })
        .where(eq(shipments.id, shipment.id))
      await tx
        .update(pallets)
        .set({ status: 'Shipped', updatedAt: departure })
        .where(
          and(
            inArray(pallets.id, palletIds),
            eq(pallets.organizationId, orgId),
          ),
        )
      await recordAuditEvent(
        context,
        {
          action: 'shipment.dispatch',
          entityType: 'shipment',
          entityId: shipment.id,
          priorState: shipment.status,
          newState: 'Dispatched',
          quantity: loaded.length,
          details: { bolNumber, totalWeightLbs: actualWeight },
        },
        tx,
      )
      await recordActivityEvent(
        context,
        {
          action: 'shipment_dispatched',
          entityType: 'shipment',
          entityId: shipment.id,
          description: `Shipment ${shipment.shipmentNumber} dispatched with ${loaded.length} pallets`,
        },
        tx,
      )
    })
    return (await this.getShipmentById(context, input.shipmentId))!
  }

  /**
   * Generates a Bill of Lading (BOL) CSV manifest.
   */
  static async exportBolCsv(
    context: UserContext,
    shipmentId: string,
  ): Promise<string> {
    const shipment = await this.getShipmentById(context, shipmentId)
    if (!shipment) throw new Error('Shipment not found')

    const headers = [
      'Shipment Number',
      'BOL Number',
      'Carrier',
      'Trailer Number',
      'Driver Name',
      'Driver Phone',
      'Origin Address',
      'Destination Address',
      'Truck Position',
      'Pallet Number',
      'Release Key',
      'Job Number',
      'Job Name',
      'Elevation',
      'Panel Count',
      'Pallet Weight (lbs)',
      'Loaded At',
    ]

    const rows = (shipment.pallets || []).map((p) => [
      `"${shipment.shipmentNumber}"`,
      `"${shipment.bolNumber || 'DRAFT'}"`,
      `"${shipment.carrier}"`,
      `"${shipment.trailerNumber || ''}"`,
      `"${shipment.driverName || ''}"`,
      `"${shipment.driverPhone || ''}"`,
      `"${shipment.originAddress}"`,
      `"${shipment.destinationAddress || ''}"`,
      p.truckPosition || 1,
      `"${p.palletNumber}"`,
      `"${p.releaseKey}"`,
      `"${p.jobNumber}"`,
      `"${p.jobName}"`,
      `"${p.elevation || 'All'}"`,
      p.panelCount,
      p.weightLbs,
      `"${p.loadedAt}"`,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}
