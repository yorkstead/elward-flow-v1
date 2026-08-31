import { beforeAll, describe, expect, it, vi } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import {
  organizations,
  users,
  customers,
  projects,
  productionJobs,
  releases,
  releaseRevisions,
  panelMarks,
  operationDefinitions,
  operationInstances,
  pallets,
  shipments,
  shipmentPallets,
  movementEvents,
  auditEvents,
  verificationTokens,
} from '@/db/schema'
import {
  ScannerService,
  type ExecuteMovementInput,
} from '@/lib/services/scanner'
import { ShippingService } from '@/lib/services/shipping'
import * as audit from '@/lib/services/audit'
import {
  consumePasskeyChallenge,
  storePasskeyChallenge,
} from '@/lib/auth/passkey-challenge'

const browser = vi.hoisted(() => ({ cookies: new Map<string, string>() }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = browser.cookies.get(name)
      return value ? { value } : undefined
    },
    set: (name: string, value: string) => browser.cookies.set(name, value),
  }),
}))

describe('Server-side security and concurrent mutation regressions', () => {
  let orgId: string,
    otherOrgId: string,
    userId: string,
    releaseId: string,
    revisionId: string,
    definitionId: string
  const context = () => ({
    userId,
    email: 'security@example.test',
    roles: ['System Administrator'],
    isAdmin: true,
    organizationId: orgId,
  })
  beforeAll(async () => {
    if (
      !['localhost', '127.0.0.1'].includes(
        new URL(process.env.DATABASE_URL!).hostname,
      )
    ) {
      throw new Error('Security fixtures require a local test database')
    }
    const suffix = crypto.randomUUID()
    const [org, other] = await db
      .insert(organizations)
      .values([
        { name: 'Synthetic security fixture', slug: `security-${suffix}` },
        { name: 'Synthetic other tenant', slug: `other-${suffix}` },
      ])
      .returning()
    orgId = org.id
    otherOrgId = other.id
    const [user] = await db
      .insert(users)
      .values({
        organizationId: orgId,
        name: 'Synthetic Test Operator',
        email: `${suffix}@example.test`,
        passwordHash: 'not-a-login-hash',
      })
      .returning()
    userId = user.id
    const [customer] = await db
      .insert(customers)
      .values({ organizationId: orgId, name: 'Synthetic Customer' })
      .returning()
    const [project] = await db
      .insert(projects)
      .values({
        organizationId: orgId,
        customerId: customer.id,
        name: 'Synthetic Project',
      })
      .returning()
    const [job] = await db
      .insert(productionJobs)
      .values({
        organizationId: orgId,
        customerId: customer.id,
        projectId: project.id,
        jobNumber: '99881',
        name: 'Synthetic Security Job',
      })
      .returning()
    const [release] = await db
      .insert(releases)
      .values({ organizationId: orgId, jobId: job.id, releaseNumber: 1 })
      .returning()
    releaseId = release.id
    const [rev] = await db
      .insert(releaseRevisions)
      .values({
        organizationId: orgId,
        releaseId,
        revisionNumber: 1,
        isCurrent: true,
        status: 'Approved',
      })
      .returning()
    revisionId = rev.id
    const [definition] = await db
      .insert(operationDefinitions)
      .values({
        organizationId: orgId,
        code: 'cnc',
        name: 'Synthetic CNC',
        department: 'CNC',
      })
      .returning()
    definitionId = definition.id
  })

  async function movement() {
    const [mark] = await db
      .insert(panelMarks)
      .values({
        organizationId: orgId,
        releaseRevisionId: revisionId,
        mark: crypto.randomUUID(),
        materialFamily: 'Synthetic',
        quantity: 5,
      })
      .returning()
    const [op] = await db
      .insert(operationInstances)
      .values({
        organizationId: orgId,
        releaseRevisionId: revisionId,
        panelMarkId: mark.id,
        operationDefinitionId: definitionId,
        sequence: 1,
        status: 'In progress',
        plannedQuantity: 5,
      })
      .returning()
    const input: ExecuteMovementInput = {
      idempotencyKey: crypto.randomUUID(),
      recordType: 'panel_mark',
      recordId: mark.id,
      recordIdentifier: mark.mark,
      operationInstanceId: op.id,
      actionId: 'complete_cnc_qty',
      sourceStatus: 'In progress',
      destinationStatus: 'Completed',
      quantity: 1,
      condition: 'pass',
    }
    return { mark, op, input }
  }

  it('rejects foreign-tenant and unprivileged movement writes', async () => {
    const { input } = await movement()
    await expect(
      ScannerService.executeMovement(
        { ...context(), organizationId: otherOrgId },
        input,
      ),
    ).rejects.toThrow()
    await expect(
      ScannerService.executeMovement(
        { ...context(), roles: [], isAdmin: false },
        input,
      ),
    ).rejects.toThrow(/Permission/)
    const rows = await db
      .select()
      .from(movementEvents)
      .where(eq(movementEvents.recordId, input.recordId))
    expect(rows).toHaveLength(0)
  })

  it('rejects superseded revisions, invented actions, overrun, negative and stale quantities', async () => {
    const { input } = await movement()
    await expect(
      ScannerService.executeMovement(context(), {
        ...input,
        actionId: 'invented',
      }),
    ).rejects.toThrow(/not permitted/)
    await expect(
      ScannerService.executeMovement(context(), { ...input, quantity: 6 }),
    ).rejects.toThrow(/exceeds/)
    await expect(
      ScannerService.executeMovement(context(), { ...input, quantity: -1 }),
    ).rejects.toThrow()
    await expect(
      ScannerService.executeMovement(context(), {
        ...input,
        sourceStatus: 'Ready',
      }),
    ).rejects.toThrow(/changed/)
    await db
      .update(releaseRevisions)
      .set({ isCurrent: false })
      .where(eq(releaseRevisions.id, revisionId))
    try {
      await expect(
        ScannerService.executeMovement(context(), input),
      ).rejects.toThrow(/Superseded/)
    } finally {
      await db
        .update(releaseRevisions)
        .set({ isCurrent: true })
        .where(eq(releaseRevisions.id, revisionId))
    }
  })

  it('serializes repeated and distinct scans without double-counting or losing quantities', async () => {
    const { input, op } = await movement()
    const repeated = await Promise.all([
      ScannerService.executeMovement(context(), input),
      ScannerService.executeMovement(context(), input),
    ])
    expect(repeated.filter((r) => r.isDuplicate)).toHaveLength(1)
    await Promise.all(
      [1, 2].map(() =>
        ScannerService.executeMovement(context(), {
          ...input,
          idempotencyKey: crypto.randomUUID(),
        }),
      ),
    )
    const [updated] = await db
      .select()
      .from(operationInstances)
      .where(eq(operationInstances.id, op.id))
    expect(updated.completedQuantity).toBe(3)
    const events = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.resourceId, input.recordId))
    expect(events).toHaveLength(3)
  })

  it('starting work does not increment completion', async () => {
    const { input, op } = await movement()
    await db
      .update(operationInstances)
      .set({ status: 'Ready' })
      .where(eq(operationInstances.id, op.id))
    await ScannerService.executeMovement(context(), {
      ...input,
      actionId: 'start_cnc',
      sourceStatus: 'Ready',
      destinationStatus: 'In progress',
    })
    const [updated] = await db
      .select()
      .from(operationInstances)
      .where(eq(operationInstances.id, op.id))
    expect(updated.completedQuantity).toBe(0)
  })

  it('rejects cross-tenant shipments and serializes duplicate/concurrent loads', async () => {
    const [shipment] = await db
      .insert(shipments)
      .values({ organizationId: orgId, shipmentNumber: crypto.randomUUID() })
      .returning()
    const items = await db
      .insert(pallets)
      .values(
        [1, 2].map(() => ({
          organizationId: orgId,
          releaseId,
          palletNumber: crypto.randomUUID(),
          status: 'Staged',
          currentWeightLbs: '100.00',
          panelCount: 1,
        })),
      )
      .returning()
    await expect(
      ShippingService.stagePalletOnShipment(
        { ...context(), organizationId: otherOrgId },
        { shipmentId: shipment.id, palletId: items[0].id },
      ),
    ).rejects.toThrow(/not found/)
    await Promise.all(
      [0, 0, 1].map((i) =>
        ShippingService.stagePalletOnShipment(context(), {
          shipmentId: shipment.id,
          palletId: items[i].id,
        }),
      ),
    )
    const [updated] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.id, shipment.id))
    expect(updated.totalPallets).toBe(2)
    expect(Number(updated.totalWeightLbs)).toBe(200)
    expect(
      await db
        .select()
        .from(shipmentPallets)
        .where(eq(shipmentPallets.shipmentId, shipment.id)),
    ).toHaveLength(2)
    await Promise.all([
      ShippingService.dispatchShipment(context(), { shipmentId: shipment.id }),
      ShippingService.dispatchShipment(context(), { shipmentId: shipment.id }),
    ])
    const audits = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.resourceId, shipment.id),
          eq(auditEvents.action, 'shipment.dispatch'),
        ),
      )
    expect(audits).toHaveLength(1)
  })

  it('rolls back shipment totals and membership when the audit write fails', async () => {
    const [shipment] = await db
      .insert(shipments)
      .values({ organizationId: orgId, shipmentNumber: crypto.randomUUID() })
      .returning()
    const [pallet] = await db
      .insert(pallets)
      .values({
        organizationId: orgId,
        releaseId,
        palletNumber: crypto.randomUUID(),
        status: 'Staged',
        currentWeightLbs: '100.00',
        panelCount: 1,
      })
      .returning()
    const failure = vi
      .spyOn(audit, 'recordAuditEvent')
      .mockRejectedValueOnce(new Error('synthetic audit failure'))
    try {
      await expect(
        ShippingService.stagePalletOnShipment(context(), {
          shipmentId: shipment.id,
          palletId: pallet.id,
        }),
      ).rejects.toThrow('synthetic audit failure')
    } finally {
      failure.mockRestore()
    }
    const [unchanged] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.id, shipment.id))
    expect(unchanged.totalPallets).toBe(0)
    expect(
      await db
        .select()
        .from(shipmentPallets)
        .where(eq(shipmentPallets.palletId, pallet.id)),
    ).toHaveLength(0)
  })

  it('binds challenges to the browser, purpose and user and consumes once under concurrency', async () => {
    await storePasskeyChallenge('register', 'fixture-challenge', userId)
    await expect(
      consumePasskeyChallenge('register', crypto.randomUUID()),
    ).rejects.toThrow()
    await expect(consumePasskeyChallenge('authenticate')).rejects.toThrow()
    const attempts = await Promise.allSettled([
      consumePasskeyChallenge('register', userId),
      consumePasskeyChallenge('register', userId),
    ])
    expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    await storePasskeyChallenge('authenticate', 'expired-fixture')
    await db
      .update(verificationTokens)
      .set({ expires: new Date(0) })
      .where(eq(verificationTokens.token, 'expired-fixture'))
    await expect(consumePasskeyChallenge('authenticate')).rejects.toThrow(
      /expired/,
    )
  })
})
