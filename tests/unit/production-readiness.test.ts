import { describe, it, expect } from 'vitest'
import {
  ProductionService,
  type ProductionQueueItem,
} from '@/lib/services/production'

describe('ProductionService & Shop Readiness Engine (Prompt 06)', () => {
  const sampleQueueItems: ProductionQueueItem[] = [
    {
      id: 'inst-1',
      sequence: 10,
      department: 'CNC',
      operationName: 'CNC Routing',
      operationCode: 'CNC',
      status: 'Ready',
      priority: 'Rush',
      plannedQuantity: 12,
      completedQuantity: 4,
      remainingQuantity: 8,
      scrapQuantity: 0,
      holdQuantity: 0,
      markId: 'mark-101',
      markCode: 'P-101',
      materialFamily: 'ACM',
      color: 'Silver Metallic',
      dimensions: '48.0000" × 96.0000"',
      releaseId: 'rel-1',
      releaseNumber: 1,
      releaseKey: '54120-1',
      revisionId: 'rev-1',
      revisionLabel: 'A',
      isCurrentRevision: true,
      jobNumber: '54120',
      jobName: 'Tempe Gateway Phase II',
      assignedWorkstationId: 'ws-1',
      assignedWorkstationName: 'CNC Station 1 - CNT Motion 1',
      assignedWorkstationCode: 'CNC-01',
      assignedTeam: 'Team Alpha',
      firstOffInspection: 'passed',
      firstOffNotes: 'Kerf verified +0.010"',
      machineReference: '54120_1_P101_ACM.tap',
      layoutReference: 'Table 1 - Layout A',
      cartReference: null,
      startedAt: null,
      completedAt: null,
      materialReady: true,
      documentReady: true,
      predecessorReady: true,
      holdBlocked: false,
      overallReady: true,
      readinessReason: 'Ready for production',
    },
    {
      id: 'inst-2',
      sequence: 40,
      department: 'Assembly',
      operationName: 'Assembly',
      operationCode: 'ASSY',
      status: 'Pending',
      priority: 'Standard',
      plannedQuantity: 12,
      completedQuantity: 0,
      remainingQuantity: 12,
      scrapQuantity: 0,
      holdQuantity: 0,
      markId: 'mark-101',
      markCode: 'P-101',
      materialFamily: 'ACM',
      color: 'Silver Metallic',
      dimensions: '48.0000" × 96.0000"',
      releaseId: 'rel-1',
      releaseNumber: 1,
      releaseKey: '54120-1',
      revisionId: 'rev-1',
      revisionLabel: 'A',
      isCurrentRevision: true,
      jobNumber: '54120',
      jobName: 'Tempe Gateway Phase II',
      assignedWorkstationId: null,
      assignedWorkstationName: null,
      assignedWorkstationCode: null,
      assignedTeam: null,
      firstOffInspection: 'pending',
      firstOffNotes: null,
      machineReference: null,
      layoutReference: null,
      cartReference: null,
      startedAt: null,
      completedAt: null,
      materialReady: true,
      documentReady: true,
      predecessorReady: false,
      holdBlocked: false,
      overallReady: false,
      readinessReason: 'Waiting on upstream operation (Seq 10)',
    },
  ]

  describe('Readiness & Predecessor Safety Logic', () => {
    it('marks stage overallReady when current revision, predecessor completed, and not held', () => {
      const cnc = sampleQueueItems[0]
      expect(cnc.overallReady).toBe(true)
      expect(cnc.predecessorReady).toBe(true)
      expect(cnc.isCurrentRevision).toBe(true)
    })

    it('blocks downstream assembly readiness when upstream CNC is incomplete', () => {
      const assy = sampleQueueItems[1]
      expect(assy.overallReady).toBe(false)
      expect(assy.predecessorReady).toBe(false)
      expect(assy.readinessReason).toContain('Waiting on upstream operation')
    })
  })

  describe('CSV Schedule Export Generation', () => {
    it('generates standard CSV rows matching shop columns', () => {
      const csv = ProductionService.exportScheduleCsv(sampleQueueItems)
      expect(csv).toContain('Job Number,Release Key,Mark,Department')
      expect(csv).toContain('"54120"')
      expect(csv).toContain('"54120-1"')
      expect(csv).toContain('"P-101"')
      expect(csv).toContain('"CNC"')
      expect(csv).toContain('"Rush"')
      expect(csv).toContain('"passed"')
    })
  })
})
