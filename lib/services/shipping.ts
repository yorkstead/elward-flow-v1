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

export class ShippingService {
  /**
   * Retrieves shipments with loaded pallets count and totals.
   */
  static async getShipments(
    context: UserContext,
    filters?: { status?: string },
  ): Promise<ShipmentSummary[]> {
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

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
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

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
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    const [shipment] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.id, input.shipmentId))
      .limit(1)

    if (!shipment) throw new Error('Shipment not found')
    if (shipment.status === 'Dispatched' || shipment.status === 'Delivered') {
      throw new Error('Cannot modify an already dispatched shipment')
    }

    const [pallet] = await db
      .select()
      .from(pallets)
      .where(eq(pallets.id, input.palletId))
      .limit(1)

    if (!pallet) throw new Error('Pallet not found')
    if (pallet.status === 'Shipped') {
      throw new Error('Pallet has already been shipped')
    }

    // Flatbed trailer max weight: 45,000 lbs; max pallets: 26
    const palletWeight = Number(pallet.currentWeightLbs)
    const newTotalWeight = Number(shipment.totalWeightLbs) + palletWeight
    const newTotalPallets = shipment.totalPallets + 1

    if (newTotalWeight > 45000) {
      throw new Error(
        `Truck Weight Limit Exceeded: Total load weight would reach ${newTotalWeight.toFixed(1)} lbs (Max legal flatbed: 45,000 lbs).`,
      )
    }

    if (newTotalPallets > 26) {
      throw new Error(
        `Trailer Space Exceeded: Max trailer capacity is 26 pallets (Current: ${shipment.totalPallets}).`,
      )
    }

    const nextPosition = input.truckPosition || newTotalPallets

    await db.transaction(async (tx) => {
      await tx.insert(shipmentPallets).values({
        organizationId: orgId,
        shipmentId: input.shipmentId,
        palletId: input.palletId,
        truckPosition: nextPosition,
        loadedById: context.userId,
      })

      await tx
        .update(shipments)
        .set({
          totalPallets: newTotalPallets,
          totalWeightLbs: String(newTotalWeight.toFixed(2)),
          status: 'Loading',
          updatedAt: new Date(),
        })
        .where(eq(shipments.id, input.shipmentId))
    })

    await recordAuditEvent(context, {
      action: 'shipment.load_pallet',
      entityType: 'shipment',
      entityId: input.shipmentId,
      quantity: pallet.panelCount,
      details: {
        palletId: input.palletId,
        palletNumber: pallet.palletNumber,
        truckPosition: nextPosition,
        loadWeightLbs: newTotalWeight,
      },
    })

    return (await this.getShipmentById(context, input.shipmentId))!
  }

  /**
   * Removes a pallet from the shipment load.
   */
  static async removePalletFromShipment(
    context: UserContext,
    shipmentPalletId: string,
  ): Promise<ShipmentSummary> {
    requirePermission(context, 'edit', 'removePalletFromShipment')

    const [item] = await db
      .select()
      .from(shipmentPallets)
      .where(eq(shipmentPallets.id, shipmentPalletId))
      .limit(1)

    if (!item) throw new Error('Shipment pallet entry not found')

    const [shipment] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.id, item.shipmentId))
      .limit(1)

    if (!shipment) throw new Error('Shipment not found')
    if (shipment.status === 'Dispatched') {
      throw new Error('Cannot remove pallets from a dispatched shipment')
    }

    const [pallet] = await db
      .select()
      .from(pallets)
      .where(eq(pallets.id, item.palletId))
      .limit(1)

    const palletWeight = pallet ? Number(pallet.currentWeightLbs) : 0
    const newTotalWeight = Math.max(
      0,
      Number(shipment.totalWeightLbs) - palletWeight,
    )
    const newTotalPallets = Math.max(0, shipment.totalPallets - 1)

    await db.transaction(async (tx) => {
      await tx
        .delete(shipmentPallets)
        .where(eq(shipmentPallets.id, shipmentPalletId))

      await tx
        .update(shipments)
        .set({
          totalPallets: newTotalPallets,
          totalWeightLbs: String(newTotalWeight.toFixed(2)),
          updatedAt: new Date(),
        })
        .where(eq(shipments.id, item.shipmentId))
    })

    await recordAuditEvent(context, {
      action: 'shipment.remove_pallet',
      entityType: 'shipment',
      entityId: item.shipmentId,
      details: { shipmentPalletId, palletId: item.palletId },
    })

    return (await this.getShipmentById(context, item.shipmentId))!
  }

  /**
   * Finalizes and dispatches a shipment, marking pallets and releases as Shipped.
   */
  static async dispatchShipment(
    context: UserContext,
    input: { shipmentId: string; bolNumber?: string; notes?: string },
  ): Promise<ShipmentSummary> {
    requirePermission(context, 'approve', 'dispatchShipment')

    const shipment = await this.getShipmentById(context, input.shipmentId)
    if (!shipment) throw new Error('Shipment not found')
    if (shipment.totalPallets === 0) {
      throw new Error('Cannot dispatch an empty shipment with 0 pallets loaded')
    }

    const bolNumber =
      input.bolNumber ||
      `BOL-${shipment.shipmentNumber.replace('SHP-', '')}-${Math.floor(1000 + Math.random() * 9000)}`

    const departureTime = new Date()

    await db.transaction(async (tx) => {
      // 1. Update Shipment
      await tx
        .update(shipments)
        .set({
          status: 'Dispatched',
          bolNumber,
          actualDeparture: departureTime,
          dispatchedById: context.userId,
          notes: input.notes || shipment.notes,
          updatedAt: departureTime,
        })
        .where(eq(shipments.id, input.shipmentId))

      // 2. Mark all included pallets as Shipped
      const palletIds = (shipment.pallets || []).map((p) => p.palletId)
      if (palletIds.length > 0) {
        await tx
          .update(pallets)
          .set({
            status: 'Shipped',
            updatedAt: departureTime,
          })
          .where(inArray(pallets.id, palletIds))
      }
    })

    await recordAuditEvent(context, {
      action: 'shipment.dispatch',
      entityType: 'shipment',
      entityId: input.shipmentId,
      priorState: shipment.status,
      newState: 'Dispatched',
      quantity: shipment.totalPallets,
      details: {
        bolNumber,
        carrier: shipment.carrier,
        trailerNumber: shipment.trailerNumber,
        palletsCount: shipment.totalPallets,
        totalPanels: shipment.totalPanels,
        totalWeightLbs: shipment.totalWeightLbs,
      },
    })

    await recordActivityEvent(context, {
      action: 'shipment_dispatched',
      entityType: 'shipment',
      entityId: input.shipmentId,
      description: `Shipment ${shipment.shipmentNumber} dispatched via ${shipment.carrier} with ${shipment.totalPallets} pallets (${shipment.totalPanels} panels). BOL: ${bolNumber}`,
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
