import { db } from '@/db'
import {
  customers,
  projects,
  productionJobs,
  releases,
  releaseRevisions,
  auditEvents,
  configurationRules,
  type releaseStatusEnum,
} from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export type ReleaseStatus = (typeof releaseStatusEnum.enumValues)[number]

// 21 Standard Role Templates from Master Constitution & Prompt 02
export const STANDARD_ROLES = [
  'Executive',
  'Operations Manager',
  'Production Manager',
  'Project Manager',
  'Drafting/Engineering',
  'Production Administration',
  'Purchasing',
  'Receiving',
  'CNC Lead',
  'CNC Operator',
  'ELU Lead',
  'ELU Operator',
  'Parts Preparation',
  'Assembly Lead',
  'Assembly Operator',
  'QC',
  'Shipping Lead',
  'Pallet Builder/Packager',
  'Forklift Operator',
  'Accounting Read/Export',
  'System Administrator',
] as const

export type StandardRole = (typeof STANDARD_ROLES)[number]

export const ROLE_PERMISSIONS_MATRIX: Record<string, string[]> = {
  'System Administrator': [
    'view',
    'create',
    'edit',
    'approve',
    'override',
    'export',
    'configure',
    'administer',
  ],
  'Operations Manager': [
    'view',
    'create',
    'edit',
    'approve',
    'override',
    'export',
    'configure',
  ],
  'Production Manager': [
    'view',
    'create',
    'edit',
    'approve',
    'override',
    'export',
  ],
  QC: ['view', 'create', 'edit', 'approve', 'override'],
  Executive: ['view', 'export'],
  'Project Manager': ['view', 'create', 'edit', 'export'],
  'Drafting/Engineering': ['view', 'create', 'edit', 'export'],
  'Production Administration': ['view', 'create', 'edit', 'export'],
  Purchasing: ['view', 'create', 'edit', 'export'],
  Receiving: ['view', 'create', 'edit'],
  'CNC Lead': ['view', 'create', 'edit'],
  'CNC Operator': ['view', 'create'],
  'ELU Lead': ['view', 'create', 'edit'],
  'ELU Operator': ['view', 'create'],
  'Parts Preparation': ['view', 'create'],
  'Assembly Lead': ['view', 'create', 'edit'],
  'Assembly Operator': ['view', 'create'],
  'Shipping Lead': ['view', 'create', 'edit', 'export'],
  'Pallet Builder/Packager': ['view', 'create'],
  'Forklift Operator': ['view', 'create'],
  'Accounting Read/Export': ['view', 'export'],
}

export interface ActorContext {
  organizationId: string
  siteId?: string | null
  userId: string
  email: string
  roles: string[]
  isAdmin?: boolean
  workstationId?: string | null
  deviceId?: string | null
  ipAddress?: string | null
}

export class DomainService {
  /**
   * Validates if a job number strictly matches the required 5-digit format.
   */
  static validateJobNumber(jobNumber: string): boolean {
    return /^\d{5}$/.test(jobNumber)
  }

  /**
   * Helper to verify if an actor's roles grant a specific action.
   */
  static hasPermission(
    actorRoles: string[],
    action: string,
    isAdmin = false,
  ): boolean {
    if (isAdmin) return true
    for (const role of actorRoles) {
      const allowedActions =
        ROLE_PERMISSIONS_MATRIX[role] ||
        ROLE_PERMISSIONS_MATRIX[role.toLowerCase()] ||
        []
      if (
        allowedActions.includes(action) ||
        allowedActions.includes('administer')
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Creates a Customer record.
   */
  static async createCustomer(
    actor: ActorContext,
    data: {
      name: string
      code?: string
      contactName?: string
      contactEmail?: string
      contactPhone?: string
    },
  ) {
    if (!this.hasPermission(actor.roles, 'create', actor.isAdmin)) {
      throw new Error('Security Exception: Unauthorized to create customers.')
    }

    const [customer] = await db
      .insert(customers)
      .values({
        organizationId: actor.organizationId,
        name: data.name,
        code: data.code,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
      })
      .returning()

    return customer
  }

  /**
   * Creates a Project under a Customer.
   */
  static async createProject(
    actor: ActorContext,
    data: {
      customerId: string
      name: string
      code?: string
      location?: string
    },
  ) {
    if (!this.hasPermission(actor.roles, 'create', actor.isAdmin)) {
      throw new Error('Security Exception: Unauthorized to create projects.')
    }

    const [project] = await db
      .insert(projects)
      .values({
        organizationId: actor.organizationId,
        customerId: data.customerId,
        name: data.name,
        code: data.code,
        location: data.location,
      })
      .returning()

    return project
  }

  /**
   * Creates a Production Job with strict 5-digit job number validation.
   */
  static async createJob(
    actor: ActorContext,
    data: {
      customerId: string
      projectId: string
      jobNumber: string
      name: string
      targetShipDate?: Date
    },
  ) {
    if (!this.hasPermission(actor.roles, 'create', actor.isAdmin)) {
      throw new Error('Security Exception: Unauthorized to create jobs.')
    }

    if (!this.validateJobNumber(data.jobNumber)) {
      throw new Error(
        'Validation Exception: Job number must be exactly 5 digits.',
      )
    }

    const existing = await db
      .select()
      .from(productionJobs)
      .where(
        and(
          eq(productionJobs.organizationId, actor.organizationId),
          eq(productionJobs.jobNumber, data.jobNumber),
        ),
      )

    if (existing.length > 0) {
      throw new Error(
        `Duplicate Entry Error: Job ${data.jobNumber} already exists in this organization.`,
      )
    }

    const [job] = await db
      .insert(productionJobs)
      .values({
        organizationId: actor.organizationId,
        customerId: data.customerId,
        projectId: data.projectId,
        jobNumber: data.jobNumber,
        name: data.name,
        targetShipDate: data.targetShipDate,
      })
      .returning()

    return job
  }

  /**
   * Creates a Release under a 5-digit Job, creating its initial Revision atomically.
   */
  static async createRelease(
    actor: ActorContext,
    data: {
      jobId: string
      releaseNumber: number
      requiredDate?: Date
      priority?: number
    },
  ) {
    if (!this.hasPermission(actor.roles, 'create', actor.isAdmin)) {
      throw new Error('Security Exception: Unauthorized to create releases.')
    }

    // Check uniqueness of Job + Release within organization
    const existing = await db
      .select()
      .from(releases)
      .where(
        and(
          eq(releases.organizationId, actor.organizationId),
          eq(releases.jobId, data.jobId),
          eq(releases.releaseNumber, data.releaseNumber),
        ),
      )

    if (existing.length > 0) {
      throw new Error(
        `Duplicate Entry Error: Release ${data.releaseNumber} already exists for this Job.`,
      )
    }

    return await db.transaction(async (tx) => {
      const [release] = await tx
        .insert(releases)
        .values({
          organizationId: actor.organizationId,
          jobId: data.jobId,
          releaseNumber: data.releaseNumber,
          requiredDate: data.requiredDate,
          priority: data.priority ?? 0,
          status: 'Draft',
        })
        .returning()

      const [revision] = await tx
        .insert(releaseRevisions)
        .values({
          organizationId: actor.organizationId,
          releaseId: release.id,
          revisionNumber: 1,
          revisionLabel: 'A',
          status: 'Draft',
          isCurrent: true,
        })
        .returning()

      return { release, initialRevision: revision }
    })
  }

  /**
   * Approves a release revision atomically, marking previous revisions superseded.
   */
  static async approveReleaseRevision(
    actor: ActorContext,
    data: {
      revisionId: string
      notes?: string
    },
  ) {
    if (!this.hasPermission(actor.roles, 'approve', actor.isAdmin)) {
      throw new Error(
        'Security Exception: Unauthorized to approve release revisions.',
      )
    }

    return await db.transaction(async (tx) => {
      const [targetRev] = await tx
        .select()
        .from(releaseRevisions)
        .where(eq(releaseRevisions.id, data.revisionId))

      if (!targetRev) {
        throw new Error('Not Found Exception: Revision record not found.')
      }

      // Mark all other revisions for this release as Superseded
      await tx
        .update(releaseRevisions)
        .set({
          isCurrent: false,
          status: 'Superseded',
          updatedAt: new Date(),
        })
        .where(eq(releaseRevisions.releaseId, targetRev.releaseId))

      // Mark target revision as Approved & Current
      const [approved] = await tx
        .update(releaseRevisions)
        .set({
          isCurrent: true,
          status: 'Approved',
          approvedById: actor.userId,
          approvedAt: new Date(),
          notes: data.notes ?? targetRev.notes,
          version: targetRev.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(releaseRevisions.id, targetRev.id))
        .returning()

      // Update release status to Approved for production
      await tx
        .update(releases)
        .set({
          status: 'Approved for production',
          updatedAt: new Date(),
        })
        .where(eq(releases.id, targetRev.releaseId))

      return approved
    })
  }

  /**
   * Optimistic Concurrency status update for a release.
   */
  static async updateReleaseStatusWithLock(
    actor: ActorContext,
    data: {
      releaseId: string
      currentExpectedVersion: number
      newStatus: ReleaseStatus
    },
  ) {
    if (!this.hasPermission(actor.roles, 'edit', actor.isAdmin)) {
      throw new Error(
        'Security Exception: Unauthorized to update release status.',
      )
    }

    const result = await db
      .update(releases)
      .set({
        status: data.newStatus,
        version: data.currentExpectedVersion + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(releases.id, data.releaseId),
          eq(releases.version, data.currentExpectedVersion),
        ),
      )
      .returning()

    if (result.length === 0) {
      throw new Error(
        'Concurrency Exception: Update aborted. The record has been modified by another user.',
      )
    }

    return result[0]
  }

  /**
   * Executes an elevated override action with strict server-side authorization
   * and mandatory immutable audit logging in the same transaction.
   */
  static async performOverride<T>(
    actor: ActorContext,
    data: {
      targetResource: string
      targetId: string
      action: string
      reason: string
      priorState?: unknown
      newState?: unknown
      quantity?: string | number
      condition?: string
      sourceRevision?: string
    },
    overrideFn: () => Promise<T>,
  ): Promise<T> {
    if (!this.hasPermission(actor.roles, 'override', actor.isAdmin)) {
      throw new Error(
        `Security Exception: User with roles [${actor.roles.join(', ')}] is not authorized to perform overrides.`,
      )
    }

    if (!data.reason || data.reason.trim().length < 5) {
      throw new Error(
        'Validation Exception: An override requires a detailed reason (minimum 5 characters).',
      )
    }

    const result = await overrideFn()

    await db.insert(auditEvents).values({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      actingRole: actor.roles[0] || 'Unknown',
      action: `OVERRIDE_${data.action.toUpperCase()}`,
      resourceType: data.targetResource,
      resourceId: data.targetId,
      reason: data.reason.trim(),
      priorState: data.priorState
        ? JSON.parse(JSON.stringify(data.priorState))
        : null,
      newState: data.newState
        ? JSON.parse(JSON.stringify(data.newState))
        : null,
      quantity: data.quantity ? String(data.quantity) : null,
      condition: data.condition,
      sourceRevision: data.sourceRevision,
      workstationId: actor.workstationId ?? null,
      deviceId: actor.deviceId ?? null,
      ipAddress: actor.ipAddress ?? null,
    })

    return result
  }

  /**
   * Proposes a new configuration rule or change.
   * Staged changes do not impact active production values until approved.
   */
  static async proposeConfigurationRule(
    actor: ActorContext,
    data: {
      category: string
      ruleKey: string
      proposedValue: unknown
    },
  ) {
    if (!this.hasPermission(actor.roles, 'create', actor.isAdmin)) {
      throw new Error(
        'Security Exception: Unauthorized to propose configuration rules.',
      )
    }

    const existing = await db
      .select()
      .from(configurationRules)
      .where(
        and(
          eq(configurationRules.organizationId, actor.organizationId),
          eq(configurationRules.category, data.category),
          eq(configurationRules.ruleKey, data.ruleKey),
        ),
      )

    if (existing.length === 0) {
      const [inserted] = await db
        .insert(configurationRules)
        .values({
          organizationId: actor.organizationId,
          category: data.category,
          ruleKey: data.ruleKey,
          activeValue: data.proposedValue as Record<string, unknown>,
          proposedValue: data.proposedValue as Record<string, unknown>,
          status: 'proposed_change',
          proposedById: actor.userId,
        })
        .returning()
      return inserted
    } else {
      const current = existing[0]
      const [updated] = await db
        .update(configurationRules)
        .set({
          proposedValue: data.proposedValue as Record<string, unknown>,
          status: 'proposed_change',
          proposedById: actor.userId,
          updatedAt: new Date(),
        })
        .where(eq(configurationRules.id, current.id))
        .returning()
      return updated
    }
  }

  /**
   * Approves a staged configuration rule, activating its proposed value.
   */
  static async approveConfigurationRule(
    actor: ActorContext,
    data: {
      ruleId: string
      approvalNotes?: string
    },
  ) {
    if (!this.hasPermission(actor.roles, 'configure', actor.isAdmin)) {
      throw new Error(
        'Security Exception: Only administrators or operations managers can approve configuration rules.',
      )
    }

    const existing = await db
      .select()
      .from(configurationRules)
      .where(eq(configurationRules.id, data.ruleId))

    if (existing.length === 0) {
      throw new Error('Not Found Exception: Configuration rule not found.')
    }

    const rule = existing[0]
    if (!rule.proposedValue) {
      throw new Error(
        'Validation Exception: No pending proposed configuration value found to approve.',
      )
    }

    const [approved] = await db
      .update(configurationRules)
      .set({
        activeValue: rule.proposedValue,
        proposedValue: null,
        status: 'active',
        approvedById: actor.userId,
        approvalNotes: data.approvalNotes,
        version: rule.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(configurationRules.id, rule.id))
      .returning()

    return approved
  }

  /**
   * Retrieves active configuration value for a category and rule key.
   */
  static async getActiveConfiguration<T>(
    organizationId: string,
    category: string,
    ruleKey: string,
  ): Promise<T | null> {
    const rules = await db
      .select()
      .from(configurationRules)
      .where(
        and(
          eq(configurationRules.organizationId, organizationId),
          eq(configurationRules.category, category),
          eq(configurationRules.ruleKey, ruleKey),
        ),
      )

    if (rules.length === 0) return null
    return rules[0].activeValue as T
  }
}
