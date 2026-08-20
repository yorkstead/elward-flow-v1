import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  hasRole,
  normalizeRole,
  CORE_ROLES,
} from '@/lib/auth/roles'

describe('Admin RBAC & Dynamic Permissions Matrix', () => {
  it('correctly normalizes role strings for case-insensitive matching', () => {
    expect(normalizeRole('Project Manager')).toBe('project manager')
    expect(normalizeRole('QC ')).toBe('qc')
    expect(normalizeRole('  Admin')).toBe('admin')
  })

  it('recognizes all 5 core standard roles', () => {
    expect(CORE_ROLES).toContain('admin')
    expect(CORE_ROLES).toContain('manager')
    expect(CORE_ROLES).toContain('operator')
    expect(CORE_ROLES).toContain('QC')
    expect(CORE_ROLES).toContain('project manager')
  })

  it('evaluates permissions accurately based on assigned roles', () => {
    const adminUser = { roles: ['admin'], isAdmin: false }
    const operatorUser = { roles: ['operator'], isAdmin: false }
    const qcUser = { roles: ['QC'], isAdmin: false }

    expect(hasPermission(adminUser, 'administer')).toBe(true)
    expect(hasPermission(adminUser, 'create')).toBe(true)

    expect(hasPermission(operatorUser, 'view')).toBe(true)
    expect(hasPermission(operatorUser, 'administer')).toBe(false)

    expect(hasPermission(qcUser, 'approve')).toBe(true)
    expect(hasPermission(qcUser, 'administer')).toBe(false)
  })

  it('super-admin flag automatically passes any role and permission check', () => {
    const superAdmin = { roles: [], isAdmin: true }
    expect(hasPermission(superAdmin, 'anything')).toBe(true)
    expect(hasRole(superAdmin, ['arbitrary_role'])).toBe(true)
  })
})
