import { db } from '@/db'
import { roles, permissions, rolePermissions, userRoles } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

/**
 * Standard base roles per Elward Flow operating constitution & user requirements.
 */
export const CORE_ROLES = [
  'admin',
  'manager',
  'operator',
  'QC',
  'project manager',
] as const

export type CoreRole = (typeof CORE_ROLES)[number]

/**
 * Default permission mappings for standard roles.
 * Custom roles and dynamic permissions stored in PostgreSQL will augment these.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'view',
    'create',
    'edit',
    'approve',
    'override',
    'export',
    'configure',
    'administer',
  ],
  'system administrator': [
    'view',
    'create',
    'edit',
    'approve',
    'override',
    'export',
    'configure',
    'administer',
  ],
  manager: [
    'view',
    'create',
    'edit',
    'approve',
    'override',
    'export',
    'configure',
  ],
  'operations manager': [
    'view',
    'create',
    'edit',
    'approve',
    'override',
    'export',
    'configure',
  ],
  'production manager': [
    'view',
    'create',
    'edit',
    'approve',
    'override',
    'export',
  ],
  'project manager': ['view', 'create', 'edit', 'export'],
  qc: ['view', 'create', 'edit', 'approve', 'override', 'export'],
  operator: ['view', 'create', 'edit'],
  'cnc operator': ['view', 'create', 'edit'],
  'assembly operator': ['view', 'create', 'edit'],
  'shipping lead': ['view', 'create', 'edit', 'approve', 'export'],
  'pallet builder/packager': ['view', 'create', 'edit'],
}

export interface UserContext {
  userId: string
  email: string
  roles: string[]
  isAdmin?: boolean
  organizationId?: string
  siteId?: string | null
}

/**
 * Normalizes a role string for robust comparison (e.g. 'Project Manager' -> 'project manager').
 */
export function normalizeRole(role: string): string {
  return role.trim().toLowerCase()
}

/**
 * Evaluates whether the given user context has the requested action/permission.
 * Always passes if isAdmin is true or if user holds the 'admin' role.
 */
export function hasPermission(
  user: { roles?: string[]; isAdmin?: boolean },
  action: string,
): boolean {
  if (user.isAdmin) return true
  const userRolesList = user.roles || []

  for (const rawRole of userRolesList) {
    const norm = normalizeRole(rawRole)
    if (norm === 'admin' || norm === 'system administrator') {
      return true
    }
    const allowed = DEFAULT_ROLE_PERMISSIONS[norm] || []
    if (allowed.includes(action) || allowed.includes('administer')) {
      return true
    }
  }

  return false
}

/**
 * Checks if the user holds at least one of the required roles (case-insensitive).
 */
export function hasRole(
  user: { roles?: string[]; isAdmin?: boolean },
  requiredRoles: string[],
): boolean {
  if (user.isAdmin) return true
  const userRolesList = (user.roles || []).map(normalizeRole)
  const reqNormalized = requiredRoles.map(normalizeRole)

  if (
    userRolesList.includes('admin') ||
    userRolesList.includes('system administrator')
  ) {
    return true
  }

  return reqNormalized.some((r) => userRolesList.includes(r))
}

/**
 * Dynamically resolves all effective permissions for a user from database roles and static defaults.
 */
export async function getEffectivePermissions(
  userId: string,
): Promise<string[]> {
  const permSet = new Set<string>()

  try {
    const userRoleEntries = await db
      .select({
        roleId: roles.id,
        roleName: roles.name,
        roleCode: roles.code,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId))

    for (const r of userRoleEntries) {
      const norm = normalizeRole(r.roleName)
      const defaults = DEFAULT_ROLE_PERMISSIONS[norm] || []
      defaults.forEach((p) => permSet.add(p))
    }

    if (userRoleEntries.length > 0) {
      const roleIds = userRoleEntries.map((r) => r.roleId)
      const dynamicPerms = await db
        .select({
          action: permissions.action,
          resource: permissions.resource,
        })
        .from(rolePermissions)
        .innerJoin(
          permissions,
          eq(rolePermissions.permissionId, permissions.id),
        )
        .where(inArray(rolePermissions.roleId, roleIds))

      for (const p of dynamicPerms) {
        permSet.add(p.action)
        if (p.resource) {
          permSet.add(`${p.resource}:${p.action}`)
        }
      }
    }
  } catch {
    // Fallback gracefully to empty set if DB query fails in test isolation
  }

  return Array.from(permSet)
}
