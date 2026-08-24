import { db } from '@/db'
import {
  users,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  configurationRules,
  auditEvents,
} from '@/db/schema'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { UserContext } from '@/lib/auth/roles'
import { requireRole, requirePermission } from '@/lib/middleware/authorize'
import { recordAuditEvent } from '@/lib/services/audit'
import { hashPassword } from '@/lib/auth/password'

export interface UserManagementItem {
  id: string
  name: string
  email: string
  isAdmin: boolean
  disabledAt: string | null
  createdAt: string
  roles: string[]
}

export interface RoleManagementItem {
  id: string
  name: string
  code: string
  description: string | null
  isSystem: boolean
  permissions: string[]
  userCount: number
}

export interface SystemConfigItem {
  id: string
  category: string
  ruleKey: string
  activeValue: unknown
  proposedValue: unknown | null
  status: 'active' | 'proposed_change' | 'deprecated'
  version: number
  approvalNotes: string | null
  updatedAt: string
}

export interface AuditLedgerItem {
  id: string
  action: string
  entityType: string
  entityId: string
  userName: string | null
  userEmail: string | null
  reason: string | null
  priorState: string | null
  newState: string | null
  quantity: string | null
  condition: string | null
  revision: string | null
  workstationId: string | null
  deviceId: string | null
  ipAddress: string | null
  createdAt: string
}

export class AdminService {
  /**
   * Retrieves all registered users and their assigned roles.
   */
  static async getUsers(context: UserContext): Promise<UserManagementItem[]> {
    requirePermission(context, 'administer', 'getUsers')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.organizationId, orgId))
      .orderBy(desc(users.createdAt))

    const userRoleRows = await db
      .select({
        userId: userRoles.userId,
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))

    const roleMap = new Map<string, string[]>()
    for (const ur of userRoleRows) {
      const list = roleMap.get(ur.userId) || []
      list.push(ur.roleName)
      roleMap.set(ur.userId, list)
    }

    return userRows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isAdmin: u.isAdmin,
      disabledAt: u.disabledAt ? u.disabledAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      roles: roleMap.get(u.id) || [],
    }))
  }

  /**
   * Creates a new user with password and role assignments.
   */
  static async createUser(
    context: UserContext,
    input: {
      name: string
      email: string
      password: string
      isAdmin?: boolean
      roleNames?: string[]
    },
  ): Promise<UserManagementItem> {
    requirePermission(context, 'administer', 'createUser')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email.trim().toLowerCase()))
      .limit(1)

    if (existing.length > 0) {
      throw new Error(`A user with email ${input.email} already exists.`)
    }

    const passwordHash = await hashPassword(input.password)

    const [createdUser] = await db
      .insert(users)
      .values({
        organizationId: orgId,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        passwordHash,
        isAdmin: Boolean(input.isAdmin),
      })
      .returning()

    if (input.roleNames && input.roleNames.length > 0) {
      const dbRoles = await db
        .select()
        .from(roles)
        .where(inArray(roles.name, input.roleNames))

      for (const r of dbRoles) {
        await db.insert(userRoles).values({
          userId: createdUser.id,
          roleId: r.id,
        })
      }
    }

    await recordAuditEvent(context, {
      action: 'admin.create_user',
      entityType: 'user',
      entityId: createdUser.id,
      details: {
        email: createdUser.email,
        name: createdUser.name,
        isAdmin: createdUser.isAdmin,
        roles: input.roleNames,
      },
    })

    return {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      isAdmin: createdUser.isAdmin,
      disabledAt: null,
      createdAt: createdUser.createdAt.toISOString(),
      roles: input.roleNames || [],
    }
  }

  /**
   * Updates user details, password, admin status, roles, or disabled state.
   */
  static async updateUser(
    context: UserContext,
    userId: string,
    input: {
      name?: string
      email?: string
      password?: string
      isAdmin?: boolean
      roleNames?: string[]
      disabled?: boolean
    },
  ): Promise<UserManagementItem> {
    requirePermission(context, 'administer', 'updateUser')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, orgId)))
      .limit(1)

    if (!existing) {
      throw new Error(`User not found with id: ${userId}`)
    }

    if (input.email && input.email.trim().toLowerCase() !== existing.email) {
      const emailConflict = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.trim().toLowerCase()))
        .limit(1)
      if (emailConflict.length > 0) {
        throw new Error(`A user with email ${input.email} already exists.`)
      }
    }

    const updates: Partial<{
      name: string
      email: string
      passwordHash: string
      isAdmin: boolean
      disabledAt: Date | null
      updatedAt: Date
    }> = {
      updatedAt: new Date(),
    }

    if (input.name !== undefined) updates.name = input.name.trim()
    if (input.email !== undefined) updates.email = input.email.trim().toLowerCase()
    if (input.isAdmin !== undefined) updates.isAdmin = Boolean(input.isAdmin)
    if (input.password && input.password.trim().length > 0) {
      updates.passwordHash = await hashPassword(input.password)
    }
    if (input.disabled !== undefined) {
      if (userId === context.userId && input.disabled) {
        throw new Error('Cannot disable your own administrator account.')
      }
      updates.disabledAt = input.disabled ? new Date() : null
    }

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning()

    if (input.roleNames !== undefined) {
      const dbRoles = await db
        .select()
        .from(roles)
        .where(inArray(roles.name, input.roleNames))

      await db.transaction(async (tx) => {
        await tx.delete(userRoles).where(eq(userRoles.userId, userId))
        for (const r of dbRoles) {
          await tx.insert(userRoles).values({
            userId,
            roleId: r.id,
          })
        }
      })
    }

    // Get current assigned roles
    const userRoleRows = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId))

    const assignedRoles = userRoleRows.map((r) => r.roleName)

    await recordAuditEvent(context, {
      action: 'admin.update_user',
      entityType: 'user',
      entityId: userId,
      details: {
        updatedFields: Object.keys(updates),
        roles: assignedRoles,
      },
    })

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
      disabledAt: updatedUser.disabledAt ? updatedUser.disabledAt.toISOString() : null,
      createdAt: updatedUser.createdAt.toISOString(),
      roles: assignedRoles,
    }
  }

  /**
   * Toggles active / disabled state of a user.
   */
  static async toggleUserDisabled(
    context: UserContext,
    userId: string,
    disable: boolean,
  ): Promise<UserManagementItem> {
    requirePermission(context, 'administer', 'toggleUserDisabled')
    if (userId === context.userId && disable) {
      throw new Error('Cannot disable your own administrator account.')
    }

    return this.updateUser(context, userId, { disabled: disable })
  }

  /**
   * Permanently deletes a user from the organization.
   */
  static async deleteUser(
    context: UserContext,
    userId: string,
  ): Promise<{ success: boolean; deletedUserId: string }> {
    requirePermission(context, 'administer', 'deleteUser')
    if (userId === context.userId) {
      throw new Error('Cannot delete your own administrator account.')
    }

    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, orgId)))
      .limit(1)

    if (!existing) {
      throw new Error(`User not found with id: ${userId}`)
    }

    await db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, userId))
      await tx.delete(users).where(eq(users.id, userId))
    })

    await recordAuditEvent(context, {
      action: 'admin.delete_user',
      entityType: 'user',
      entityId: userId,
      details: {
        deletedUserName: existing.name,
        deletedUserEmail: existing.email,
      },
    })

    return { success: true, deletedUserId: userId }
  }

  /**
   * Assigns roles to an existing user.
   */
  static async assignUserRoles(
    context: UserContext,
    input: { userId: string; roleNames: string[] },
  ): Promise<void> {
    requirePermission(context, 'administer', 'assignUserRoles')

    const dbRoles = await db
      .select()
      .from(roles)
      .where(inArray(roles.name, input.roleNames))

    await db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, input.userId))
      for (const r of dbRoles) {
        await tx.insert(userRoles).values({
          userId: input.userId,
          roleId: r.id,
        })
      }
    })

    await recordAuditEvent(context, {
      action: 'admin.assign_roles',
      entityType: 'user',
      entityId: input.userId,
      details: { assignedRoles: input.roleNames },
    })
  }

  /**
   * Retrieves all roles with their assigned permissions and user count.
   */
  static async getRoles(context: UserContext): Promise<RoleManagementItem[]> {
    requirePermission(context, 'administer', 'getRoles')

    const roleList = await db.select().from(roles).orderBy(roles.name)

    const permRows = await db
      .select({
        roleId: rolePermissions.roleId,
        action: permissions.action,
        resource: permissions.resource,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))

    const rolePermMap = new Map<string, string[]>()
    for (const p of permRows) {
      const list = rolePermMap.get(p.roleId) || []
      list.push(p.action)
      rolePermMap.set(p.roleId, list)
    }

    const countRows = await db
      .select({
        roleId: userRoles.roleId,
        count: sql<number>`count(*)::int`,
      })
      .from(userRoles)
      .groupBy(userRoles.roleId)

    const countMap = new Map(countRows.map((c) => [c.roleId, Number(c.count)]))

    return roleList.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description,
      isSystem: r.isSystem,
      permissions: rolePermMap.get(r.id) || [],
      userCount: countMap.get(r.id) || 0,
    }))
  }

  /**
   * Creates a new dynamic custom role through the UI.
   */
  static async createCustomRole(
    context: UserContext,
    input: {
      name: string
      code?: string
      description?: string
      permissions?: string[]
    },
  ): Promise<RoleManagementItem> {
    requirePermission(context, 'administer', 'createCustomRole')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'
    const code = input.code || input.name.toLowerCase().replace(/\s+/g, '_')

    const [createdRole] = await db
      .insert(roles)
      .values({
        organizationId: orgId,
        name: input.name,
        code,
        description: input.description || null,
        isSystem: false,
      })
      .returning()

    if (input.permissions && input.permissions.length > 0) {
      const permDefs = await db
        .select()
        .from(permissions)
        .where(inArray(permissions.action, input.permissions))

      for (const p of permDefs) {
        await db.insert(rolePermissions).values({
          roleId: createdRole.id,
          permissionId: p.id,
        })
      }
    }

    await recordAuditEvent(context, {
      action: 'admin.create_role',
      entityType: 'role',
      entityId: createdRole.id,
      details: { name: createdRole.name, code, permissions: input.permissions },
    })

    return {
      id: createdRole.id,
      name: createdRole.name,
      code: createdRole.code,
      description: createdRole.description,
      isSystem: false,
      permissions: input.permissions || [],
      userCount: 0,
    }
  }

  /**
   * Updates permissions for an existing role.
   */
  static async updateRolePermissions(
    context: UserContext,
    input: { roleId: string; permissions: string[] },
  ): Promise<void> {
    requirePermission(context, 'administer', 'updateRolePermissions')

    const permDefs = await db
      .select()
      .from(permissions)
      .where(inArray(permissions.action, input.permissions))

    await db.transaction(async (tx) => {
      await tx
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, input.roleId))

      for (const p of permDefs) {
        await tx.insert(rolePermissions).values({
          roleId: input.roleId,
          permissionId: p.id,
        })
      }
    })

    await recordAuditEvent(context, {
      action: 'admin.update_role_permissions',
      entityType: 'role',
      entityId: input.roleId,
      details: { updatedPermissions: input.permissions },
    })
  }

  /**
   * Retrieves staged and active configuration rules.
   */
  static async getSystemConfigs(
    context: UserContext,
  ): Promise<SystemConfigItem[]> {
    requirePermission(context, 'view', 'getSystemConfigs')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    const rows = await db
      .select()
      .from(configurationRules)
      .where(eq(configurationRules.organizationId, orgId))
      .orderBy(configurationRules.category, configurationRules.ruleKey)

    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      ruleKey: r.ruleKey,
      activeValue: r.activeValue,
      proposedValue: r.proposedValue,
      status: r.status,
      version: r.version,
      approvalNotes: r.approvalNotes,
      updatedAt: r.updatedAt.toISOString(),
    }))
  }

  /**
   * Proposes a configuration rule update.
   */
  static async proposeConfigChange(
    context: UserContext,
    input: {
      configId: string
      proposedValue: unknown
      reason: string
    },
  ): Promise<void> {
    requirePermission(context, 'configure', 'proposeConfigChange')

    await db
      .update(configurationRules)
      .set({
        proposedValue: input.proposedValue,
        status: 'proposed_change',
        proposedById: context.userId,
        approvalNotes: input.reason,
        updatedAt: new Date(),
      })
      .where(eq(configurationRules.id, input.configId))

    await recordAuditEvent(context, {
      action: 'config.propose_change',
      entityType: 'configuration_rule',
      entityId: input.configId,
      reason: input.reason,
      details: { proposedValue: input.proposedValue },
    })
  }

  /**
   * Approves and activates a proposed configuration rule.
   */
  static async approveConfigChange(
    context: UserContext,
    input: { configId: string; approvalNotes: string },
  ): Promise<void> {
    requireRole(context, ['admin', 'manager'], 'approveConfigChange')

    const [rule] = await db
      .select()
      .from(configurationRules)
      .where(eq(configurationRules.id, input.configId))
      .limit(1)

    if (!rule || !rule.proposedValue) {
      throw new Error('No valid proposed configuration found to approve.')
    }

    await db
      .update(configurationRules)
      .set({
        activeValue: rule.proposedValue,
        proposedValue: null,
        status: 'active',
        version: rule.version + 1,
        approvedById: context.userId,
        approvalNotes: input.approvalNotes,
        updatedAt: new Date(),
      })
      .where(eq(configurationRules.id, input.configId))

    await recordAuditEvent(context, {
      action: 'config.approve_change',
      entityType: 'configuration_rule',
      entityId: input.configId,
      priorState: JSON.stringify(rule.activeValue),
      newState: JSON.stringify(rule.proposedValue),
      reason: input.approvalNotes,
      details: { newVersion: rule.version + 1 },
    })
  }

  /**
   * Queries immutable audit trail.
   */
  static async getAuditLedger(
    context: UserContext,
    filters?: { action?: string; entityType?: string; limit?: number },
  ): Promise<AuditLedgerItem[]> {
    requirePermission(context, 'administer', 'getAuditLedger')
    const orgId =
      context.organizationId || '00000000-0000-0000-0000-000000000001'

    const conditions = [eq(auditEvents.organizationId, orgId)]
    if (filters?.action) {
      conditions.push(eq(auditEvents.action, filters.action))
    }
    if (filters?.entityType) {
      conditions.push(eq(auditEvents.resourceType, filters.entityType))
    }

    const rows = await db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        resourceType: auditEvents.resourceType,
        resourceId: auditEvents.resourceId,
        userName: users.name,
        userEmail: users.email,
        reason: auditEvents.reason,
        priorState: auditEvents.priorState,
        newState: auditEvents.newState,
        quantity: auditEvents.quantity,
        condition: auditEvents.condition,
        sourceRevision: auditEvents.sourceRevision,
        workstationId: auditEvents.workstationId,
        deviceId: auditEvents.deviceId,
        ipAddress: auditEvents.ipAddress,
        timestamp: auditEvents.timestamp,
      })
      .from(auditEvents)
      .leftJoin(users, eq(auditEvents.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditEvents.timestamp))
      .limit(filters?.limit || 100)

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.resourceType,
      entityId: r.resourceId,
      userName: r.userName,
      userEmail: r.userEmail,
      reason: r.reason,
      priorState: r.priorState ? JSON.stringify(r.priorState) : null,
      newState: r.newState ? JSON.stringify(r.newState) : null,
      quantity: r.quantity,
      condition: r.condition,
      revision: r.sourceRevision,
      workstationId: r.workstationId,
      deviceId: r.deviceId,
      ipAddress: r.ipAddress,
      createdAt: r.timestamp.toISOString(),
    }))
  }

  /**
   * Exports full audit log as CSV.
   */
  static async exportAuditCsv(context: UserContext): Promise<string> {
    const logs = await this.getAuditLedger(context, { limit: 1000 })
    const headers = [
      'Timestamp (UTC)',
      'Action',
      'Entity Type',
      'Entity ID',
      'User Name',
      'User Email',
      'Prior State',
      'New State',
      'Quantity',
      'Reason',
      'IP Address',
    ]

    const rows = logs.map((l) => [
      `"${l.createdAt}"`,
      `"${l.action}"`,
      `"${l.entityType}"`,
      `"${l.entityId}"`,
      `"${l.userName || 'System'}"`,
      `"${l.userEmail || ''}"`,
      `"${l.priorState || ''}"`,
      `"${l.newState || ''}"`,
      `"${l.quantity || ''}"`,
      `"${l.reason || ''}"`,
      `"${l.ipAddress || ''}"`,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}
