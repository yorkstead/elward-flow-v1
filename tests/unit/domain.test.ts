import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DomainService, type ActorContext } from '@/lib/services/domain'

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    insert: mocks.insert,
    select: mocks.select,
    update: mocks.update,
    transaction: mocks.transaction,
  },
}))

describe('Prompt 02 — Domain Model, Audit, Permissions, and Configuration', () => {
  const operatorContext: ActorContext = {
    organizationId: 'org-123',
    userId: 'user-op',
    email: 'operator@elward.test',
    roles: ['CNC Operator'],
  }

  const managerContext: ActorContext = {
    organizationId: 'org-123',
    userId: 'user-mgr',
    email: 'manager@elward.test',
    roles: ['Operations Manager'],
  }

  const adminContext: ActorContext = {
    organizationId: 'org-123',
    userId: 'user-admin',
    email: 'admin@elward.test',
    roles: ['System Administrator'],
    isAdmin: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('5-Digit Job Number Validation', () => {
    it('accepts valid 5-digit job numbers', () => {
      expect(DomainService.validateJobNumber('54120')).toBe(true)
      expect(DomainService.validateJobNumber('00001')).toBe(true)
      expect(DomainService.validateJobNumber('99999')).toBe(true)
    })

    it('rejects non-5-digit or alphanumeric job numbers', () => {
      expect(DomainService.validateJobNumber('1234')).toBe(false)
      expect(DomainService.validateJobNumber('123456')).toBe(false)
      expect(DomainService.validateJobNumber('5412A')).toBe(false)
      expect(DomainService.validateJobNumber('ABCDE')).toBe(false)
    })

    it('createJob rejects invalid job numbers before database mutation', async () => {
      await expect(
        DomainService.createJob(managerContext, {
          customerId: 'cust-1',
          projectId: 'proj-1',
          jobNumber: '123',
          name: 'Invalid Job',
        }),
      ).rejects.toThrow(
        'Validation Exception: Job number must be exactly 5 digits.',
      )
    })
  })

  describe('Role-Based Authorization & Permissions Matrix', () => {
    it('grants view and create to operators, but blocks override and configure', () => {
      expect(DomainService.hasPermission(['CNC Operator'], 'view')).toBe(true)
      expect(DomainService.hasPermission(['CNC Operator'], 'create')).toBe(true)
      expect(DomainService.hasPermission(['CNC Operator'], 'override')).toBe(
        false,
      )
      expect(DomainService.hasPermission(['CNC Operator'], 'configure')).toBe(
        false,
      )
    })

    it('grants override and configure to Operations Manager', () => {
      expect(
        DomainService.hasPermission(['Operations Manager'], 'override'),
      ).toBe(true)
      expect(
        DomainService.hasPermission(['Operations Manager'], 'configure'),
      ).toBe(true)
      expect(
        DomainService.hasPermission(['Operations Manager'], 'approve'),
      ).toBe(true)
    })

    it('grants all permissions to System Administrator / isAdmin', () => {
      expect(
        DomainService.hasPermission(
          adminContext.roles,
          'administer',
          adminContext.isAdmin,
        ),
      ).toBe(true)
      expect(
        DomainService.hasPermission(
          adminContext.roles,
          'override',
          adminContext.isAdmin,
        ),
      ).toBe(true)
      expect(
        DomainService.hasPermission(
          adminContext.roles,
          'configure',
          adminContext.isAdmin,
        ),
      ).toBe(true)
    })
  })

  describe('Elevated Override Execution & Mandatory Audit Logging', () => {
    it('blocks unauthorized operator from executing override', async () => {
      await expect(
        DomainService.performOverride(
          operatorContext,
          {
            targetResource: 'release',
            targetId: 'rel-1',
            action: 'force_status',
            reason: 'Need to run early',
          },
          async () => 'success',
        ),
      ).rejects.toThrow('Security Exception')
    })

    it('rejects override if reason is less than 5 characters', async () => {
      await expect(
        DomainService.performOverride(
          managerContext,
          {
            targetResource: 'release',
            targetId: 'rel-1',
            action: 'force_status',
            reason: 'fix',
          },
          async () => 'success',
        ),
      ).rejects.toThrow(
        'Validation Exception: An override requires a detailed reason',
      )
    })

    it('allows authorized manager to execute override and writes immutable audit log', async () => {
      mocks.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce([{ id: 'audit-1' }]),
      })

      const mutationResult = await DomainService.performOverride(
        managerContext,
        {
          targetResource: 'release',
          targetId: 'rel-1',
          action: 'status_advance',
          reason: 'Authorizing engineering fast-track approval',
          priorState: { status: 'Draft' },
          newState: { status: 'Approved for production' },
        },
        async () => ({ status: 'Approved for production' }),
      )

      expect(mutationResult.status).toBe('Approved for production')
      expect(mocks.insert).toHaveBeenCalledTimes(1)
    })
  })

  describe('Staged Configuration Rules & Versioning', () => {
    it('proposing a rule change stages the proposed value without mutating active value', async () => {
      // Mock existing active rule: 3500 lbs max pallet weight
      mocks.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: 'rule-pallet-weight',
              organizationId: 'org-123',
              category: 'pallet_rules',
              ruleKey: 'limits',
              activeValue: { max_weight_lbs: 3500 },
              proposedValue: null,
              status: 'active',
              version: 1,
            },
          ]),
        }),
      })

      mocks.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([
              {
                id: 'rule-pallet-weight',
                activeValue: { max_weight_lbs: 3500 },
                proposedValue: { max_weight_lbs: 3000 },
                status: 'proposed_change',
              },
            ]),
          }),
        }),
      })

      const proposed = await DomainService.proposeConfigurationRule(
        managerContext,
        {
          category: 'pallet_rules',
          ruleKey: 'limits',
          proposedValue: { max_weight_lbs: 3000 },
        },
      )

      expect(proposed.status).toBe('proposed_change')
      expect(proposed.activeValue).toEqual({ max_weight_lbs: 3500 })
      expect(proposed.proposedValue).toEqual({ max_weight_lbs: 3000 })
    })

    it('approving a proposed rule promotes proposedValue to activeValue', async () => {
      mocks.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: 'rule-pallet-weight',
              organizationId: 'org-123',
              category: 'pallet_rules',
              ruleKey: 'limits',
              activeValue: { max_weight_lbs: 3500 },
              proposedValue: { max_weight_lbs: 3000 },
              status: 'proposed_change',
              version: 1,
            },
          ]),
        }),
      })

      mocks.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([
              {
                id: 'rule-pallet-weight',
                activeValue: { max_weight_lbs: 3000 },
                proposedValue: null,
                status: 'active',
                version: 2,
              },
            ]),
          }),
        }),
      })

      const approved = await DomainService.approveConfigurationRule(
        managerContext,
        {
          ruleId: 'rule-pallet-weight',
          approvalNotes: 'Approved for lightweight shipping lane',
        },
      )

      expect(approved.status).toBe('active')
      expect(approved.activeValue).toEqual({ max_weight_lbs: 3000 })
      expect(approved.proposedValue).toBeNull()
      expect(approved.version).toBe(2)
    })
  })

  describe('Optimistic Concurrency Control', () => {
    it('throws Concurrency Exception when updating a stale version', async () => {
      mocks.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([]), // 0 rows updated due to version mismatch
          }),
        }),
      })

      await expect(
        DomainService.updateReleaseStatusWithLock(managerContext, {
          releaseId: 'rel-1',
          currentExpectedVersion: 1,
          newStatus: 'In production',
        }),
      ).rejects.toThrow('Concurrency Exception')
    })
  })
})
